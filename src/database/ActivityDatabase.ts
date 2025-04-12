import { App } from 'obsidian';
import moment from 'moment';

export interface FileEvent {
    id?: number;
    timestamp: number;
    filePath: string;
    eventType: 'create' | 'modify' | 'delete' | 'rename';
    oldPath?: string;  // For rename events
    contentDiff?: {
        added: number;
        removed: number;
        wordCountBefore?: number;
        wordCountAfter?: number;
        charCountBefore?: number;
        charCountAfter?: number;
        lastDebounceTimestamp?: number;
    };
}

export interface ExportOptions {
    format: 'json' | 'csv';
    startDate?: number;
    endDate?: number;
    includeTypes?: ('create' | 'modify' | 'delete' | 'rename')[];
    fields?: string[];
}

export class ActivityDatabase {
    private static DB_NAME = 'daily-activity-db';
    private static DB_VERSION = 3;
    private static EVENTS_STORE = 'file_events';
    private static DAILY_STATS_STORE = 'daily_stats';
    private static FILE_STATS_STORE = 'file_stats';

    private static instance: ActivityDatabase;
    private app: App;
    private db: IDBDatabase | null = null;
    private plugin: any;

    private constructor(app: App, plugin: any) {
        this.app = app;
        this.plugin = plugin;
    }

    public static getInstance(app: App, plugin?: any): ActivityDatabase {
        if (!ActivityDatabase.instance) {
            if (!plugin) {
                throw new Error('Plugin instance must be provided when creating ActivityDatabase');
            }
            ActivityDatabase.instance = new ActivityDatabase(app, plugin);
        }
        return ActivityDatabase.instance;
    }

    public static destroyInstance(): void {
        if (ActivityDatabase.instance) {
            ActivityDatabase.instance.close();
            ActivityDatabase.instance = null;
        }
    }

    public isInitialized(): boolean {
        return this.db !== null;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized()) {
            this.plugin.logger.debug('Database already initialized');
            return;
        }

        this.plugin.logger.debug('Opening IndexedDB database...');

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(ActivityDatabase.DB_NAME, ActivityDatabase.DB_VERSION);

            request.onerror = (event) => {
                this.plugin.logger.error('Failed to open database:', event);
                reject(event);
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                this.plugin.logger.debug('Database opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                this.plugin.logger.debug('Database upgrade needed...');
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains(ActivityDatabase.EVENTS_STORE)) {
                    const eventsStore = db.createObjectStore(ActivityDatabase.EVENTS_STORE, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    eventsStore.createIndex('timestamp', 'timestamp');
                    eventsStore.createIndex('filePath', 'filePath');
                    eventsStore.createIndex('eventType', 'eventType');
                    eventsStore.createIndex('date', 'date');
                }

                if (!db.objectStoreNames.contains(ActivityDatabase.DAILY_STATS_STORE)) {
                    db.createObjectStore(ActivityDatabase.DAILY_STATS_STORE, {
                        keyPath: 'date'
                    });
                }

                if (!db.objectStoreNames.contains(ActivityDatabase.FILE_STATS_STORE)) {
                    db.createObjectStore(ActivityDatabase.FILE_STATS_STORE, {
                        keyPath: 'filePath'
                    });
                }
            };
        });
    }

    public async recordEvent(event: FileEvent): Promise<void> {
        if (!this.isInitialized()) {
            this.plugin.logger.error('Database not initialized, cannot record event:', event);
            throw new Error('Database not initialized');
        }

        this.plugin.logger.debug('Recording event:', {
            type: event.eventType,
            file: event.filePath,
            timestamp: event.timestamp
        });

        const eventDate = new Date(event.timestamp).toISOString().split('T')[0];
        const eventWithDate = { ...event, date: eventDate };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(
                [ActivityDatabase.EVENTS_STORE, ActivityDatabase.DAILY_STATS_STORE, ActivityDatabase.FILE_STATS_STORE],
                'readwrite'
            );

            try {
                // Record the event
                const eventsStore = transaction.objectStore(ActivityDatabase.EVENTS_STORE);
                eventsStore.add(eventWithDate);

                // Update daily stats
                const dailyStatsStore = transaction.objectStore(ActivityDatabase.DAILY_STATS_STORE);
                const dailyStatsRequest = dailyStatsStore.get(eventDate);

                dailyStatsRequest.onsuccess = () => {
                    // Add debug logging for modify events
                    if (event.eventType === 'modify') {
                        this.plugin.logger.debug('Debug modify event - Initial dailyStatsRequest.result:', dailyStatsRequest.result);
                    }

                    // Ensure we have a valid dailyStats object with all required properties
                    const dailyStats = {
                        date: eventDate,
                        totalEvents: 0,
                        eventCounts: {
                            create: 0,
                            modify: 0,
                            delete: 0,
                            rename: 0
                        },
                        ...dailyStatsRequest.result // Spread existing values after defaults
                    };

                    // Add more debug logging for modify events
                    if (event.eventType === 'modify') {
                        this.plugin.logger.debug('Debug modify event - Constructed dailyStats:', {
                            date: dailyStats.date,
                            totalEvents: dailyStats.totalEvents,
                            eventCounts: dailyStats.eventCounts,
                            hasEventCounts: !!dailyStats.eventCounts,
                            modifyCount: dailyStats.eventCounts?.modify
                        });
                    }

                    // Increment counters
                    dailyStats.totalEvents++;

                    // Add safety check and logging
                    if (event.eventType === 'modify') {
                        if (!dailyStats.eventCounts) {
                            this.plugin.logger.error('Debug modify event - eventCounts is undefined after spread');
                            dailyStats.eventCounts = {
                                create: 0,
                                modify: 0,
                                delete: 0,
                                rename: 0
                            };
                        }
                        if (typeof dailyStats.eventCounts[event.eventType] === 'undefined') {
                            this.plugin.logger.error('Debug modify event - specific event type counter is undefined');
                            dailyStats.eventCounts[event.eventType] = 0;
                        }
                    }

                    dailyStats.eventCounts[event.eventType]++;

                    // Final state logging for modify events
                    if (event.eventType === 'modify') {
                        this.plugin.logger.debug('Debug modify event - Final dailyStats state:', {
                            totalEvents: dailyStats.totalEvents,
                            eventCounts: dailyStats.eventCounts,
                            modifyCount: dailyStats.eventCounts?.modify
                        });
                    }

                    // Put the updated stats back in the store
                    dailyStatsStore.put(dailyStats);
                };

                // Update file stats
                const fileStatsStore = transaction.objectStore(ActivityDatabase.FILE_STATS_STORE);
                const fileStatsRequest = fileStatsStore.get(event.filePath);

                fileStatsRequest.onsuccess = () => {
                    let stats = fileStatsRequest.result || {
                        filePath: event.filePath,
                        totalEdits: 0,
                        totalAdded: 0,
                        totalRemoved: 0,
                        lastModified: event.timestamp
                    };

                    // Update stats based on event type
                    stats.totalEdits++;
                    stats.lastModified = event.timestamp;
                    if (event.contentDiff) {
                        stats.totalAdded = (stats.totalAdded || 0) + (event.contentDiff.added || 0);
                        stats.totalRemoved = (stats.totalRemoved || 0) + (event.contentDiff.removed || 0);
                    }

                    fileStatsStore.put(stats);
                };

                transaction.oncomplete = () => {
                    this.plugin.logger.debug('Event and stats recorded successfully');
                    resolve();
                };

                transaction.onerror = (error) => {
                    this.plugin.logger.error('Error recording event:', error);
                    reject(error);
                };
            } catch (error) {
                this.plugin.logger.error('Error recording event:', error);
                reject(error);
            }
        });
    }

    private async addToStore(tx: IDBTransaction, storeName: string, value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const store = tx.objectStore(storeName);
                const request = store.put(value);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    private async getFromStore(tx: IDBTransaction, storeName: string, key: any): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                const store = tx.objectStore(storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    public async close(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.plugin.logger.debug('Database connection closed');
        }
    }

    // Query methods for the new stores
    public async getDailyStats(date: string): Promise<any> {
        if (!this.isInitialized()) throw new Error('Database not initialized');

        const tx = this.db!.transaction([ActivityDatabase.DAILY_STATS_STORE], 'readonly');
        return this.getFromStore(tx, ActivityDatabase.DAILY_STATS_STORE, date);
    }

    public async getFileStats(filePath: string): Promise<any> {
        if (!this.isInitialized()) throw new Error('Database not initialized');

        const tx = this.db!.transaction([ActivityDatabase.FILE_STATS_STORE], 'readonly');
        return this.getFromStore(tx, ActivityDatabase.FILE_STATS_STORE, filePath);
    }

    /**
     * Get events in a time range
     */
    public async getEventsInTimeRange(startTime: number, endTime: number): Promise<FileEvent[]> {
        if (!this.isInitialized()) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([ActivityDatabase.EVENTS_STORE], 'readonly');
                const store = transaction.objectStore(ActivityDatabase.EVENTS_STORE);
                const index = store.index('timestamp');

                const range = IDBKeyRange.bound(startTime, endTime);
                const request = index.getAll(range);

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    this.plugin.logger.error('Error getting events:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                this.plugin.logger.error('Failed to get events:', error);
                reject(error);
            }
        });
    }

    public async exportEvents(options: ExportOptions): Promise<string> {
        const events = await this.getEventsForExport(options);

        if (options.format === 'json') {
            return this.convertToJSON(events, options.fields);
        } else {
            return this.convertToCSV(events, options.fields);
        }
    }

    private async getEventsForExport(options: ExportOptions): Promise<FileEvent[]> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([ActivityDatabase.EVENTS_STORE], 'readonly');
                const store = transaction.objectStore(ActivityDatabase.EVENTS_STORE);
                const request = store.getAll();

                request.onsuccess = () => {
                    let events = request.result;

                    // Filter by date range if specified
                    if (options.startDate && options.endDate) {
                        events = events.filter(event =>
                            event.timestamp >= options.startDate! &&
                            event.timestamp <= options.endDate!
                        );
                    }

                    // Filter by event types if specified
                    if (options.includeTypes && options.includeTypes.length > 0) {
                        events = events.filter(event =>
                            options.includeTypes!.includes(event.eventType)
                        );
                    }

                    resolve(events);
                };

                request.onerror = () => {
                    this.plugin.logger.error('Error exporting events:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                this.plugin.logger.error('Failed to export events:', error);
                reject(error);
            }
        });
    }

    private convertToCSV(events: FileEvent[], fields?: string[]): string {
        // Define default headers if fields not specified
        const defaultFields = ['timestamp', 'eventType', 'filePath', 'oldPath', 'added', 'removed'];
        const fieldList = fields || defaultFields;

        const rows = events.map(event => {
            const row: Record<string, any> = {};

            // Format basic fields
            row['timestamp'] = new Date(event.timestamp).toISOString();
            row['eventType'] = event.eventType;
            row['filePath'] = event.filePath;
            row['oldPath'] = event.oldPath || '';

            // Format content diff fields
            row['added'] = event.contentDiff?.added || 0;
            row['removed'] = event.contentDiff?.removed || 0;
            row['wordCountBefore'] = event.contentDiff?.wordCountBefore || 0;
            row['wordCountAfter'] = event.contentDiff?.wordCountAfter || 0;
            row['charCountBefore'] = event.contentDiff?.charCountBefore || 0;
            row['charCountAfter'] = event.contentDiff?.charCountAfter || 0;

            // Return only requested fields
            return fieldList.map(field => this.escapeCsvValue(String(row[field] || '')));
        });

        // Create header row
        const headerRow = fieldList.map(field => this.escapeCsvValue(field));

        // Combine header and data rows
        return [headerRow.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    private convertToJSON(events: FileEvent[], fields?: string[]): string {
        if (!fields) return JSON.stringify(events, null, 2);

        // Filter events to only include specified fields
        const filteredEvents = events.map(event => {
            const filtered: Record<string, any> = {};
            fields.forEach(field => {
                if (field === 'timestamp') {
                    filtered[field] = event.timestamp;
                } else if (field === 'eventType') {
                    filtered[field] = event.eventType;
                } else if (field === 'filePath') {
                    filtered[field] = event.filePath;
                } else if (field === 'oldPath') {
                    filtered[field] = event.oldPath;
                } else if (field.startsWith('contentDiff.')) {
                    const subField = field.split('.')[1];
                    if (event.contentDiff && subField in event.contentDiff) {
                        filtered[field] = (event.contentDiff as any)[subField];
                    }
                } else if (field === 'added' || field === 'removed' ||
                    field === 'wordCountBefore' || field === 'wordCountAfter' ||
                    field === 'charCountBefore' || field === 'charCountAfter') {
                    filtered[field] = event.contentDiff ? (event.contentDiff as any)[field] || 0 : 0;
                }
            });
            return filtered;
        });

        return JSON.stringify(filteredEvents, null, 2);
    }

    private escapeCsvValue(value: string): string {
        // If the value contains a comma, newline, or double quote, wrap it in quotes
        const needsQuotes = /[",\n\r]/.test(value);
        if (needsQuotes) {
            // Replace any double quotes with two double quotes
            const escaped = value.replace(/"/g, '""');
            return `"${escaped}"`;
        }
        return value;
    }

    public async scheduleExport(options: ExportOptions, path: string, app: App): Promise<string> {
        try {
            const exportData = await this.exportEvents(options);
            const extension = options.format === 'json' ? 'json' : 'csv';
            const now = new Date();
            const filename = `activity-export-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.${extension}`;

            // Ensure path ends with a slash
            const exportPath = path ? (path.endsWith('/') ? path : path + '/') : '';
            const fullPath = exportPath + filename;

            await app.vault.create(fullPath, exportData);
            this.plugin.logger.info(`Activity data exported to ${fullPath}`);
            return fullPath;
        } catch (error) {
            this.plugin.logger.error('Failed to export activity data:', error);
            throw error;
        }
    }

    /**
     * Get all events
     */
    public async getAllEvents(): Promise<FileEvent[]> {
        if (!this.isInitialized()) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([ActivityDatabase.EVENTS_STORE], 'readonly');
                const store = transaction.objectStore(ActivityDatabase.EVENTS_STORE);
                const request = store.getAll();

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    this.plugin.logger.error('Error getting all events:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                this.plugin.logger.error('Failed to get all events:', error);
                reject(error);
            }
        });
    }

    /**
     * Calculate statistics for all files
     */
    public async getAllFileStats(): Promise<any[]> {
        if (!this.isInitialized()) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([ActivityDatabase.FILE_STATS_STORE], 'readonly');
                const store = transaction.objectStore(ActivityDatabase.FILE_STATS_STORE);
                const request = store.getAll();

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    this.plugin.logger.error('Error getting all file stats:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                this.plugin.logger.error('Failed to get all file stats:', error);
                reject(error);
            }
        });
    }

    /**
     * Get file statistics for a specific file
     */
    public async getFileStatistics(startTime: number, endTime: number): Promise<any[]> {
        if (!this.isInitialized()) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([ActivityDatabase.FILE_STATS_STORE], 'readonly');
                const store = transaction.objectStore(ActivityDatabase.FILE_STATS_STORE);
                const request = store.getAll();

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    this.plugin.logger.error('Error getting file statistics:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('Failed to get file statistics:', error);
                reject(error);
            }
        });
    }
} 