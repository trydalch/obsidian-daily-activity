import { App, TFile, Vault, Notice } from 'obsidian';
import { ActivityDatabase, FileEvent } from './database/ActivityDatabase';
import { debounce } from 'lodash';
import DailyActivityPlugin from './main';
import moment from 'moment';

interface PendingFileChange {
    content: string;
    lastUpdate: number;
    accumulatedChanges: {
        added: number;
        removed: number;
        wordCountBefore?: number;
        wordCountAfter?: number;
        charCountBefore?: number;
        charCountAfter?: number;
    };
    retryCount?: number;
    batchStartTime?: number; // When this batch started
    forceBatchRecord?: boolean; // Flag to force recording when max duration is reached
}

interface FailedOperation {
    operation: string;
    data: any;
    timestamp: number;
    retryCount: number;
}

export class EventHandler {
    private app: App;
    private vault: Vault;
    private database: ActivityDatabase;
    private plugin: DailyActivityPlugin;
    private fileContents: Map<string, PendingFileChange> = new Map();
    private static CONTENT_DEBOUNCE_DELAY = 10000; // 10 seconds for content tracking
    private static DB_DEBOUNCE_DELAY = 60000; // 1 minute for DB writes
    private static MAX_RETRY_COUNT = 3;
    private static RETRY_DELAY = 5000; // 5 seconds
    private retryInterval: NodeJS.Timeout | null = null;
    private maxBatchTimers: Map<string, NodeJS.Timeout> = new Map(); // Timers for max batch duration

    // Store debounced functions per file to allow proper cleanup
    private debouncedTrackers: Map<string, Function> = new Map();
    private debouncedUpdaters: Map<string, Function> = new Map();
    private failedOperations: Map<string, FailedOperation> = new Map();

    constructor(app: App, plugin: DailyActivityPlugin) {
        this.app = app;
        this.vault = app.vault;
        this.plugin = plugin;
        this.database = plugin.database;  // Use the plugin's already initialized database
        this.initializeEventListeners().catch(error => {
            this.plugin.logger.error('Failed to initialize event listeners:', error);
        });

        // Set up periodic retry for failed operations
        this.retryInterval = setInterval(() => this.retryFailedOperations(), 30000); // Try every 30 seconds
    }

    private async initializeEventListeners() {
        try {
            // File creation events
            this.vault.on('create', async (file: TFile) => {
                if (!(file instanceof TFile)) return;
                if (!this.shouldTrackEvent('create', file.path)) return;

                try {
                    await this.handleFileCreate(file);
                } catch (error) {
                    this.handleError('create', file.path, error);
                }
            });

            // File modification events with two-level debouncing
            this.vault.on('modify', async (file: TFile) => {
                if (!(file instanceof TFile)) return;
                if (!this.shouldTrackEvent('modify', file.path)) return;

                try {
                    await this.handleModifyWithDebounce(file);
                } catch (error) {
                    this.handleError('modify', file.path, error);
                }
            });

            // File deletion events
            this.vault.on('delete', async (file: TFile) => {
                if (!(file instanceof TFile)) return;
                if (!this.shouldTrackEvent('delete', file.path)) return;

                try {
                    // Cancel any pending debounced operations
                    this.cancelDebounced(file.path);
                    await this.handleFileDelete(file);
                } catch (error) {
                    this.handleError('delete', file.path, error);
                }
            });

            // File rename events
            this.vault.on('rename', async (file: TFile, oldPath: string) => {
                if (!(file instanceof TFile)) return;
                if (!this.shouldTrackEvent('rename', file.path) && !this.shouldTrackEvent('rename', oldPath)) return;

                try {
                    // Cancel any pending debounced operations for old path
                    this.cancelDebounced(oldPath);
                    await this.handleFileRename(file, oldPath);
                } catch (error) {
                    this.handleError('rename', `${oldPath} -> ${file.path}`, error);
                }
            });
        } catch (error) {
            console.error('Failed to initialize event listeners:', error);
            new Notice('Failed to initialize activity tracking. Please restart Obsidian.');
        }
    }

    private shouldTrackEvent(eventType: 'create' | 'modify' | 'delete' | 'rename', filePath: string): boolean {
        this.plugin.logger.debug(`Checking if should track event: ${eventType} for ${filePath}`);

        // Check if activity tracking is enabled
        if (!this.plugin.settings.enableActivityTracking) {
            this.plugin.logger.debug('Activity tracking is disabled in settings');
            return false;
        }

        // Check if this is the dashboard file and exclude it
        const dashboardPath = this.plugin.settings.dashboardPath;
        const normalizedDashboardPath = dashboardPath.endsWith('.md') ? dashboardPath : dashboardPath + '.md';
        if (filePath === normalizedDashboardPath) {
            this.plugin.logger.debug(`Ignoring activity for dashboard file: ${filePath}`);
            return false;
        }

        // Special handling for Untitled.md files
        const isUntitledFile = filePath === 'Untitled.md' || filePath.endsWith('/Untitled.md');
        if (isUntitledFile) {
            // Allow tracking for rename events (when the file gets its real name)
            // Also track create so we can store initial content, but don't record it yet
            if (eventType === 'rename' || eventType === 'create') {
                this.plugin.logger.debug(`Tracking ${eventType} for Untitled file: ${filePath}`);
                return true;
            }
            this.plugin.logger.debug(`Ignoring ${eventType} for temporary file: ${filePath}`);
            return false;
        }

        // Check if this specific event type should be tracked
        const eventTypeSettings = {
            'create': this.plugin.settings.trackFileCreation,
            'modify': this.plugin.settings.trackFileModification,
            'delete': this.plugin.settings.trackFileDeletion,
            'rename': this.plugin.settings.trackFileRename
        };

        if (!eventTypeSettings[eventType]) {
            this.plugin.logger.debug(`Event type ${eventType} is disabled in settings`);
            return false;
        }

        // Check path filters
        const includePaths = this.plugin.settings.activityTrackingIncludePaths;
        const excludePaths = this.plugin.settings.activityTrackingExcludePaths;

        // If include paths are specified, the file must match at least one
        if (includePaths.length > 0) {
            const matches = includePaths.some(path => filePath.includes(path));
            if (!matches) {
                this.plugin.logger.debug(`File ${filePath} doesn't match any include paths`);
                return false;
            }
        }

        // If exclude paths are specified, the file must not match any
        if (excludePaths.length > 0) {
            const matches = excludePaths.some(path => filePath.includes(path));
            if (matches) {
                this.plugin.logger.debug(`File ${filePath} matches an exclude path`);
                return false;
            }
        }

        this.plugin.logger.debug(`Will track ${eventType} event for ${filePath}`);
        return true;
    }

    private handleError(operation: string, filePath: string, error: any) {
        this.plugin.logger.error(`Error during ${operation} operation on ${filePath}:`, error);

        // Store failed operation for retry
        const operationKey = `${operation}-${filePath}-${Date.now()}`;
        this.failedOperations.set(operationKey, {
            operation,
            data: { filePath, timestamp: Date.now() },
            timestamp: Date.now(),
            retryCount: 0
        });

        // Limit the number of stored failed operations
        if (this.failedOperations.size > 100) {
            // Remove oldest operations if we have too many
            const keys = Array.from(this.failedOperations.keys());
            const oldestKeys = keys.sort((a, b) => {
                return this.failedOperations.get(a)!.timestamp - this.failedOperations.get(b)!.timestamp;
            }).slice(0, 50); // Remove the oldest 50

            for (const key of oldestKeys) {
                this.failedOperations.delete(key);
            }
        }
    }

    private async retryFailedOperations() {
        if (this.failedOperations.size === 0) return;

        this.plugin.logger.info(`Retrying ${this.failedOperations.size} failed operations... `);

        // Check database initialization status
        const isDbInitialized = this.database.isInitialized();
        this.plugin.logger.debug(`Database initialization status: ${isDbInitialized ? 'Initialized' : 'Not initialized'}`);

        if (!isDbInitialized) {
            this.plugin.logger.info('Database not initialized yet, skipping retry operations');
            return;
        }

        try {
            // Log what operations we're about to retry
            const failedOps = Array.from(this.failedOperations.entries());
            this.plugin.logger.debug(`Failed operations details: ${failedOps.map(([key, op]) =>
                `\n${key}: ${op.operation} on ${op.data.filePath} (${op.retryCount} retries)`).join('')}`
            );

            // Make a copy of the keys to avoid modification during iteration
            const operations = Array.from(this.failedOperations.entries());

            // Files to skip - expand on these
            const filesToSkip = [
                `${this.plugin.settings.dashboardPath}.md`,
                this.plugin.settings.dashboardPath,
                'Untitled.md',
                'activity-export-'
            ];

            let processedCount = 0;
            let skippedCount = 0;
            let successCount = 0;
            let errorCount = 0;

            for (const [key, operation] of operations) {
                processedCount++;
                try {
                    // Only retry operations that are at least 5 seconds old
                    if (Date.now() - operation.timestamp < EventHandler.RETRY_DELAY) {
                        this.plugin.logger.debug(`Operation ${key} is too recent, skipping`);
                        continue;
                    }

                    // Check if this file should be skipped
                    const shouldSkip = filesToSkip.some(skipPattern =>
                        operation.data.filePath === skipPattern ||
                        operation.data.filePath.startsWith(skipPattern) ||
                        operation.data.filePath.endsWith('/' + skipPattern));

                    if (shouldSkip) {
                        this.plugin.logger.debug(`Skipping retry for excluded file: ${operation.data.filePath}`);
                        this.failedOperations.delete(key);
                        skippedCount++;
                        continue;
                    }

                    // Try to recover based on operation type
                    switch (operation.operation) {
                        case 'create':
                        case 'modify':
                            const file = this.vault.getAbstractFileByPath(operation.data.filePath);
                            if (file instanceof TFile) {
                                this.plugin.logger.debug(`Retrying ${operation.operation} for ${operation.data.filePath}`);
                                await this.handleFileCreate(file);
                            } else {
                                this.plugin.logger.debug(`File not found for ${operation.operation}: ${operation.data.filePath}`);
                                // Delete since file doesn't exist
                                this.failedOperations.delete(key);
                                skippedCount++;
                                continue;
                            }
                            break;
                        case 'delete':
                            // For delete, just record the event since the file is gone
                            this.plugin.logger.debug(`Retrying delete for ${operation.data.filePath}`);
                            await this.database.recordEvent({
                                timestamp: Date.now(),
                                filePath: operation.data.filePath,
                                eventType: 'delete',
                                contentDiff: {
                                    added: 0,
                                    removed: 0,
                                    wordCountBefore: 0,
                                    wordCountAfter: 0,
                                    charCountBefore: 0,
                                    charCountAfter: 0,
                                    lastDebounceTimestamp: Date.now()
                                }
                            });
                            break;
                        case 'rename':
                            // For rename, we can't easily recover, so just remove it
                            this.plugin.logger.debug(`Cannot recover rename operation, removing: ${operation.data.filePath}`);
                            this.failedOperations.delete(key);
                            skippedCount++;
                            continue;
                    }

                    // If we got here, the retry was successful
                    this.failedOperations.delete(key);
                    successCount++;
                    this.plugin.logger.debug(`Successfully retried operation: ${operation.operation} for ${operation.data.filePath}`);
                } catch (error) {
                    errorCount++;
                    this.plugin.logger.error(`Failed to retry operation ${key}:`, error);
                    this.plugin.logger.debug(`Error details for ${key}:`, {
                        message: error.message,
                        stack: error.stack,
                        code: error.code,
                        operation: operation.operation,
                        filePath: operation.data.filePath,
                        timestamp: new Date(operation.timestamp).toLocaleString()
                    });

                    // Update timestamp to prevent immediate retry
                    operation.timestamp = Date.now();

                    // Remove very old operations (older than 1 hour)
                    if (Date.now() - operation.timestamp > 3600000) {
                        this.failedOperations.delete(key);
                        this.plugin.logger.debug(`Abandoned retry for operation ${key} after 1 hour`);
                    }
                }
            }

            this.plugin.logger.info(`Retry summary: processed=${processedCount}, skipped=${skippedCount}, succeeded=${successCount}, errors=${errorCount}, remaining=${this.failedOperations.size}`);
        } catch (error) {
            this.plugin.logger.error('Unexpected error in retryFailedOperations:', error);
        }
    }

    private async handleModifyWithDebounce(file: TFile) {
        const filePath = file.path;

        try {
            // Ensure database is initialized before proceeding
            if (!this.database.isInitialized()) {
                this.plugin.logger.debug('Database not initialized, initializing now...');
                await this.database.initialize();
            }

            // Initialize file content if not already tracked
            if (!this.fileContents.has(filePath)) {
                const content = await this.vault.read(file);
                const wordCount = this.countWords(content);
                const timestamp = Date.now();

                this.fileContents.set(filePath, {
                    content,
                    lastUpdate: timestamp,
                    batchStartTime: timestamp,
                    accumulatedChanges: {
                        added: 0,
                        removed: 0,
                        wordCountBefore: wordCount,
                        wordCountAfter: wordCount,
                        charCountBefore: content.length,
                        charCountAfter: content.length
                    }
                });

                // If batching is enabled, set up a max duration timer
                if (this.plugin.settings.modifyBatchingEnabled) {
                    this.setupMaxBatchTimer(filePath);
                }
            } else {
                // Update the last update time
                const pendingChange = this.fileContents.get(filePath)!;
                pendingChange.lastUpdate = Date.now();

                // If this is a forced batch record, handle it immediately
                if (pendingChange.forceBatchRecord) {
                    this.plugin.logger.debug(`Max batch duration reached for ${filePath}, recording immediately`);
                    // Reset the force flag
                    pendingChange.forceBatchRecord = false;

                    // Track content changes synchronously
                    await this.trackContentChanges(file);

                    // Record the event
                    await this.handleFileModify(file);

                    // Reset the batch start time
                    pendingChange.batchStartTime = Date.now();

                    // Clear and set up a new max batch timer
                    this.clearMaxBatchTimer(filePath);
                    this.setupMaxBatchTimer(filePath);

                    return;
                }
            }

            // Determine which debounce approach to use
            if (this.plugin.settings.modifyBatchingEnabled) {
                // Use inactivity threshold for batching
                this.handleModifyWithBatching(file);
            } else {
                // Use the original two-level debouncing approach
                this.handleModifyWithTwoLevelDebounce(file);
            }
        } catch (error) {
            this.handleError('debounce-setup', filePath, error);

            // Direct fallback if debouncing fails
            try {
                const boundTrackContentChanges = this.trackContentChanges.bind(this);
                const boundHandleFileModify = this.handleFileModify.bind(this);
                await boundTrackContentChanges(file);
                await boundHandleFileModify(file);
            } catch (innerError) {
                console.error('Fallback handling also failed:', innerError);
            }
        }
    }

    private handleModifyWithBatching(file: TFile) {
        const filePath = file.path;

        // Create or update debounced content tracker
        if (!this.debouncedTrackers.has(filePath)) {
            const boundTrackContentChanges = this.trackContentChanges.bind(this);
            this.debouncedTrackers.set(
                filePath,
                debounce(async () => {
                    try {
                        await boundTrackContentChanges(file);
                    } catch (error) {
                        this.handleError('content-track', filePath, error);
                    }
                }, this.plugin.settings.contentTrackingDebounceInterval)
            );
        }

        // Create or update debounced event recorder
        if (!this.debouncedUpdaters.has(filePath)) {
            const boundHandleFileModify = this.handleFileModify.bind(this);
            this.debouncedUpdaters.set(
                filePath,
                debounce(async () => {
                    try {
                        // First track content changes
                        await this.trackContentChanges(file);

                        // Then record the modification
                        await boundHandleFileModify(file);

                        // Reset batch start time after recording
                        const pendingChange = this.fileContents.get(filePath);
                        if (pendingChange) {
                            pendingChange.batchStartTime = Date.now();

                            // Reset the max batch timer
                            this.clearMaxBatchTimer(filePath);
                            this.setupMaxBatchTimer(filePath);
                        }
                    } catch (error) {
                        this.handleError('db-update', filePath, error);
                    }
                }, this.plugin.settings.modifyInactivityThreshold)
            );
        }

        // Call content tracker
        const tracker = this.debouncedTrackers.get(filePath);
        if (tracker) tracker();

        // Call updater (this will reset the timer on every modification)
        const updater = this.debouncedUpdaters.get(filePath);
        if (updater) updater();
    }

    private handleModifyWithTwoLevelDebounce(file: TFile) {
        const filePath = file.path;

        // Get debounce intervals from settings
        const contentInterval = this.plugin.settings.contentTrackingDebounceInterval;
        const dbInterval = this.plugin.settings.dbWriteDebounceInterval;

        // Create or get content tracker for this file
        if (!this.debouncedTrackers.has(filePath)) {
            const boundTrackContentChanges = this.trackContentChanges.bind(this);
            this.debouncedTrackers.set(
                filePath,
                debounce(async () => {
                    try {
                        await boundTrackContentChanges(file);
                    } catch (error) {
                        this.handleError('content-track', filePath, error);
                    }
                }, contentInterval)
            );
        }

        // Create or get DB updater for this file
        if (!this.debouncedUpdaters.has(filePath)) {
            const boundHandleFileModify = this.handleFileModify.bind(this);
            this.debouncedUpdaters.set(
                filePath,
                debounce(async () => {
                    try {
                        await boundHandleFileModify(file);
                    } catch (error) {
                        this.handleError('db-update', filePath, error);
                    }
                }, dbInterval)
            );
        }

        // Call both debounced functions
        const tracker = this.debouncedTrackers.get(filePath);
        const updater = this.debouncedUpdaters.get(filePath);

        if (tracker) tracker();
        if (updater) updater();
    }

    private setupMaxBatchTimer(filePath: string) {
        // Clear any existing timer
        this.clearMaxBatchTimer(filePath);

        // Set up a new timer for max batch duration
        const timer = setTimeout(() => {
            // Get the pending change
            const pendingChange = this.fileContents.get(filePath);
            if (pendingChange) {
                // Set the force record flag
                pendingChange.forceBatchRecord = true;
                this.plugin.logger.debug(`Max batch duration reached for ${filePath}, flagging for immediate record`);
            }
        }, this.plugin.settings.modifyMaxBatchDuration);

        // Store the timer
        this.maxBatchTimers.set(filePath, timer);
    }

    private clearMaxBatchTimer(filePath: string) {
        // Clear the timer if it exists
        const timer = this.maxBatchTimers.get(filePath);
        if (timer) {
            clearTimeout(timer);
            this.maxBatchTimers.delete(filePath);
        }
    }

    private cancelDebounced(filePath: string) {
        // Cancel and remove debounced functions for a file
        const tracker = this.debouncedTrackers.get(filePath);
        const updater = this.debouncedUpdaters.get(filePath);

        if (tracker && 'cancel' in tracker) {
            (tracker as any).cancel();
        }
        if (updater && 'cancel' in updater) {
            (updater as any).cancel();
        }

        this.debouncedTrackers.delete(filePath);
        this.debouncedUpdaters.delete(filePath);

        // Also clear any max batch timers
        this.clearMaxBatchTimer(filePath);
    }

    private async trackContentChanges(file: TFile) {
        const newContent = await this.vault.read(file);
        const pendingChange = this.fileContents.get(file.path);

        if (!pendingChange) {
            // First change for this file
            this.fileContents.set(file.path, {
                content: newContent,
                lastUpdate: Date.now(),
                accumulatedChanges: {
                    added: newContent.length,
                    removed: 0,
                    wordCountBefore: 0,
                    wordCountAfter: this.countWords(newContent),
                    charCountBefore: 0,
                    charCountAfter: newContent.length
                }
            });
            return;
        }

        // Calculate incremental changes
        const { added, removed } = this.calculateDiff(pendingChange.content, newContent);

        // Update accumulated changes
        pendingChange.accumulatedChanges.added += Math.max(0, added);
        pendingChange.accumulatedChanges.removed += Math.max(0, removed);
        pendingChange.accumulatedChanges.wordCountAfter = this.countWords(newContent);
        pendingChange.accumulatedChanges.charCountAfter = newContent.length;
        pendingChange.content = newContent;
        pendingChange.lastUpdate = Date.now();
    }

    private async handleFileCreate(file: TFile) {
        this.plugin.logger.debug(`Handling file creation for ${file.path}`);

        try {
            // Ensure database is initialized
            if (!this.database.isInitialized()) {
                this.plugin.logger.debug('Database not initialized, initializing now...');
                await this.database.initialize();
            }

            const content = await this.vault.read(file);
            const timestamp = Date.now();

            this.fileContents.set(file.path, {
                content,
                lastUpdate: timestamp,
                accumulatedChanges: {
                    added: content.length,
                    removed: 0,
                    wordCountBefore: 0,
                    wordCountAfter: this.countWords(content),
                    charCountBefore: 0,
                    charCountAfter: content.length
                }
            });

            const event: FileEvent = {
                timestamp,
                filePath: file.path,
                eventType: 'create',
                contentDiff: {
                    ...this.fileContents.get(file.path)!.accumulatedChanges,
                    lastDebounceTimestamp: timestamp
                }
            };

            this.plugin.logger.debug('Attempting to record create event:', {
                file: file.path,
                contentLength: content.length,
                wordCount: this.countWords(content)
            });

            await this.database.recordEvent(event);
            this.plugin.logger.debug('Successfully recorded create event');
        } catch (error) {
            this.plugin.logger.error('Failed to record create event:', error);
            throw error;
        }
    }

    private async handleFileModify(file: TFile) {
        this.plugin.logger.debug(`Handling file modification for ${file.path}`);
        const pendingChange = this.fileContents.get(file.path);
        if (!pendingChange) {
            this.plugin.logger.debug('No pending changes found for file');
            return;
        }

        const timestamp = Date.now();
        const event: FileEvent = {
            timestamp,
            filePath: file.path,
            eventType: 'modify',
            contentDiff: {
                ...pendingChange.accumulatedChanges,
                lastDebounceTimestamp: timestamp
            }
        };

        this.plugin.logger.debug('Attempting to record modify event:', {
            file: file.path,
            changes: `+${pendingChange.accumulatedChanges.added}/-${pendingChange.accumulatedChanges.removed}`,
            wordCountChange: `${pendingChange.accumulatedChanges.wordCountBefore} → ${pendingChange.accumulatedChanges.wordCountAfter}`
        });

        try {
            await this.database.recordEvent(event);
            this.plugin.logger.debug('Successfully recorded modify event');
        } catch (error) {
            this.plugin.logger.error('Failed to record modify event:', error);
            throw error;
        }
    }

    private async handleFileRename(file: TFile, oldPath: string) {
        try {
            // Ensure database is initialized
            if (!this.database.isInitialized()) {
                this.plugin.logger.debug('Database not initialized, initializing now...');
                await this.database.initialize();
            }

            const pendingChange = this.fileContents.get(oldPath);
            if (!pendingChange) return;

            const timestamp = Date.now();
            const isFromUntitled = oldPath === 'Untitled.md' || oldPath.endsWith('/Untitled.md');

            // If this was an Untitled file being renamed, treat it as a create event
            const eventType = isFromUntitled ? 'create' : 'rename';
            const event: FileEvent = {
                timestamp,
                filePath: file.path,
                eventType,
                oldPath: isFromUntitled ? undefined : oldPath,
                contentDiff: {
                    added: isFromUntitled ? pendingChange.content.length : 0,
                    removed: 0,
                    wordCountBefore: isFromUntitled ? 0 : this.countWords(pendingChange.content),
                    wordCountAfter: this.countWords(pendingChange.content),
                    charCountBefore: isFromUntitled ? 0 : pendingChange.content.length,
                    charCountAfter: pendingChange.content.length,
                    lastDebounceTimestamp: timestamp
                }
            };

            // Update stored content with new path
            this.fileContents.delete(oldPath);
            this.fileContents.set(file.path, pendingChange);

            await this.database.recordEvent(event);
            this.plugin.logger.debug(`Recorded ${eventType} event for renamed file: ${oldPath} -> ${file.path}`);
        } catch (error) {
            this.plugin.logger.error(`Failed to handle rename for ${oldPath} -> ${file.path}:`, error);
            throw error;
        }
    }

    private calculateDiff(oldContent: string, newContent: string): { added: number, removed: number } {
        const oldLength = oldContent.length;
        const newLength = newContent.length;
        const lengthDiff = newLength - oldLength;

        // If content got longer, we count the difference as added characters
        // If content got shorter, we count the difference as removed characters
        return {
            added: Math.max(0, lengthDiff),
            removed: Math.max(0, -lengthDiff)
        };
    }

    private countWords(content: string): number {
        return content.trim().split(/\s+/).length;
    }

    private async handleFileDelete(file: TFile) {
        const pendingChange = this.fileContents.get(file.path);
        if (!pendingChange) return;

        const timestamp = Date.now();
        const event: FileEvent = {
            timestamp,
            filePath: file.path,
            eventType: 'delete',
            contentDiff: {
                added: 0,
                removed: pendingChange.content.length,
                wordCountBefore: this.countWords(pendingChange.content),
                wordCountAfter: 0,
                charCountBefore: pendingChange.content.length,
                charCountAfter: 0,
                lastDebounceTimestamp: timestamp
            }
        };

        this.fileContents.delete(file.path);
        await this.database.recordEvent(event);
    }

    public async loadInitialFileStates() {
        try {
            const files = this.vault.getFiles();
            this.plugin.logger.info(`Loading initial states for ${files.length} files...`);

            // Load files in batches to prevent memory spikes
            const BATCH_SIZE = 100;
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);

                for (const file of batch) {
                    try {
                        const content = await this.vault.read(file);
                        const timestamp = Date.now();
                        this.fileContents.set(file.path, {
                            content,
                            lastUpdate: timestamp,
                            accumulatedChanges: {
                                added: 0,
                                removed: 0,
                                wordCountBefore: 0,
                                wordCountAfter: this.countWords(content),
                                charCountBefore: 0,
                                charCountAfter: content.length
                            },
                            retryCount: 0
                        });
                    } catch (error) {
                        this.plugin.logger.error(`Failed to load initial state for ${file.path}:`, error);
                    }
                }

                // Small delay between batches to allow other operations
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            this.plugin.logger.info(`Loaded initial states for ${this.fileContents.size} files.`);
        } catch (error) {
            this.plugin.logger.error('Failed to load initial file states:', error);
            new Notice('Failed to initialize activity tracking. Some files may not be tracked.');
        }
    }

    public clearFailedOperations() {
        this.plugin.logger.debug(`Clearing ${this.failedOperations.size} failed operations`);
        this.failedOperations.clear();
        this.plugin.logger.debug('Failed operations cleared');
    }

    public cleanup() {
        this.plugin.logger.debug('Starting event handler cleanup...');

        // Cancel all pending debounced operations
        const debouncedCount = this.debouncedTrackers.size;
        for (const [filePath] of this.debouncedTrackers) {
            this.cancelDebounced(filePath);
        }
        this.plugin.logger.debug(`Cancelled ${debouncedCount} debounced operations`);

        // Clear retry interval
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
            this.retryInterval = null;
            this.plugin.logger.debug('Cleared retry interval');
        }

        // Clear all maps
        const failedOpsCount = this.failedOperations.size;
        this.fileContents.clear();
        this.debouncedTrackers.clear();
        this.debouncedUpdaters.clear();
        this.failedOperations.clear();
        this.plugin.logger.debug(`Cleared maps: ${failedOpsCount} failed operations cleared`);

        this.plugin.logger.debug('Event handler cleanup complete');
    }
}