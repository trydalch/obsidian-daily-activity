/** @format */

import { Moment } from 'moment'
import { MarkdownView, Plugin, App, Editor, Modal, Notice, PluginSettingTab, Setting } from 'obsidian'
import { ActivityLogger } from 'src/ActivityLogger'
import DateParser from 'src/DateParser'
import FilterModal from 'src/modal/FilterModal'
import { DailyActivitySettingsTab } from 'src/settings/SettingsTab'
import { ActivityDatabase, FileEvent } from './database/ActivityDatabase'
import { EventHandler } from './EventHandler'
import ExportModal from 'src/modal/ExportModal'
import { DashboardGenerator } from './dashboard/DashboardGenerator'
import { Logger, LogLevel } from './Logger'

interface DailyActivityPluginSettings {
    insertLocation: 'cursor' | 'end';
    defaultLinkStyle: 'link' | 'plain';
    includeHeader: boolean;
    headerStyle: string;
    excludeCurrentNote: boolean;
    // Filter settings
    includeRegex: string[];
    excludeRegex: string[];
    includePaths: string[];
    excludePaths: string[];
    // Whether to show filter dialog
    showFilterDialog: boolean;
    // Activity tracking settings
    enableActivityTracking: boolean;
    trackFileCreation: boolean;
    trackFileModification: boolean;
    trackFileDeletion: boolean;
    trackFileRename: boolean;
    contentTrackingDebounceInterval: number;
    dbWriteDebounceInterval: number;
    // Batch modification settings
    modifyBatchingEnabled: boolean;
    modifyInactivityThreshold: number; // in milliseconds
    modifyMaxBatchDuration: number; // in milliseconds
    // Path filtering for activity tracking
    activityTrackingIncludePaths: string[];
    activityTrackingExcludePaths: string[];
    // Export settings
    defaultExportFormat: 'json' | 'csv';
    autoExportSchedule: 'never' | 'daily' | 'weekly' | 'monthly';
    autoExportPath: string;
    exportFields: string[];
    // Dashboard settings
    enableDashboard: boolean;
    dashboardPath: string;
    autoUpdateDashboard: boolean;
    dashboardUpdateInterval: number; // in hours
    useChartsPlugin: boolean; // Whether to use the Obsidian Charts plugin for visualizations
    // Logging settings
    logLevel: LogLevel;
}

// TODO:
// Track activity using events (file created, file modified, file opened, track additions/deletions by capturing file length on open/close (or focus/lose focus))

const DEFAULT_SETTINGS: DailyActivityPluginSettings = {
    insertLocation: 'cursor',
    defaultLinkStyle: 'link',
    includeHeader: true,
    headerStyle: '## Files {type} on {date}',
    excludeCurrentNote: false,
    // Default empty filters
    includeRegex: [],
    excludeRegex: [],
    includePaths: [],
    excludePaths: [],
    // Default to show filter dialog
    showFilterDialog: true,
    // Default activity tracking settings
    enableActivityTracking: true,
    trackFileCreation: true,
    trackFileModification: true,
    trackFileDeletion: true,
    trackFileRename: true,
    contentTrackingDebounceInterval: 10000, // 10 seconds
    dbWriteDebounceInterval: 60000, // 1 minute
    // Batch modification settings
    modifyBatchingEnabled: true,
    modifyInactivityThreshold: 15000, // 15 seconds
    modifyMaxBatchDuration: 300000, // 5 minutes
    // Default empty activity tracking filters
    activityTrackingIncludePaths: [],
    activityTrackingExcludePaths: [],
    // Default export settings
    defaultExportFormat: 'csv',
    autoExportSchedule: 'never',
    autoExportPath: '',
    exportFields: ['timestamp', 'eventType', 'filePath', 'added', 'removed'],
    // Default dashboard settings
    enableDashboard: false,
    dashboardPath: 'Activity Dashboard.md',
    autoUpdateDashboard: true,
    dashboardUpdateInterval: 24, // Update daily
    useChartsPlugin: true, // Default to use Charts plugin if available
    // Default logging settings
    logLevel: LogLevel.NONE
}

export default class DailyActivityPlugin extends Plugin {
    settings: DailyActivityPluginSettings
    activityLogger: ActivityLogger
    database: ActivityDatabase
    eventHandler: EventHandler
    private dashboardGenerator: DashboardGenerator
    private dashboardUpdateInterval: NodeJS.Timeout | null = null
    logger: Logger

    async onload() {
        // Load settings first
        await this.loadSettings()

        // Initialize logger after settings are loaded
        this.logger = new Logger(this)
        this.logger.info('Loading daily activity plugin...')

        // Initialize database
        try {
            this.logger.info('Initializing database...')
            this.database = ActivityDatabase.getInstance(this.app, this)
            await this.database.initialize()
            this.logger.info('Database initialized')
        } catch (error) {
            this.logger.error('Failed to initialize database:', error)
            this.logger.error('Error details:', {
                message: error.message,
                stack: error.stack,
                code: error.code
            })
            return // Exit if database fails to initialize
        }

        // Initialize event handler
        try {
            this.logger.info('Initializing event handler...')
            this.eventHandler = new EventHandler(this.app, this)
            await this.eventHandler.loadInitialFileStates()
            this.logger.info('Event handler initialized')
        } catch (error) {
            this.logger.error('Failed to initialize event handler:', error)
            return
        }

        // Set up auto-export if configured
        if (this.settings.autoExportSchedule !== 'never') {
            this.registerAutoExport()
        }

        this.logger.info('Initializing activity logger...')
        this.activityLogger = new ActivityLogger(this.app, this)
        this.logger.info('Activity logger initialized')

        // Initialize dashboard generator
        this.dashboardGenerator = new DashboardGenerator(this.app, this.database, this)

        // Set up dashboard auto-update if enabled
        if (this.settings.enableDashboard && this.settings.autoUpdateDashboard) {
            this.setupDashboardInterval()
        }

        // Add settings tab
        this.addSettingTab(new DailyActivitySettingsTab(this.app, this))

        // Add commands
        this.addCommands()

        // Add donate button to plugin description
        this.addDonateButton()

        this.logger.info('Daily activity plugin loaded')
    }

    private addCommands() {
        // View logs command
        this.addCommand({
            id: 'view-activity-logs',
            name: "View Recent Activity Logs",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                // Get events from the last 24 hours
                const now = Date.now();
                const oneDayAgo = now - (24 * 60 * 60 * 1000);
                this.database.getEventsInTimeRange(oneDayAgo, now)
                    .then(events => {
                        // Format events into markdown
                        let content = '# Recent Activity Log\n\n';
                        content += '| Time | Event | File | Changes |\n';
                        content += '|------|--------|------|---------|';

                        for (const event of events) {
                            const time = window.moment(event.timestamp).format('HH:mm:ss');
                            const eventType = event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1);
                            const changes = event.contentDiff
                                ? `+${event.contentDiff.added}/-${event.contentDiff.removed}`
                                : '';

                            content += `\n| ${time} | ${eventType} | ${event.filePath} | ${changes} |`;
                        }

                        // Insert at cursor
                        const editor = activeView.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange(content + '\n\n', cursor);
                    })
                    .catch(error => {
                        console.error('Failed to get events:', error);
                    });
            }
        });

        this.addCommand({
            id: 'debug-view-all-events',
            name: 'Debug: View All Database Events',
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                this.database.getAllEvents()
                    .then(events => {
                        // Format events into markdown
                        let content = '# All Database Events\n\n';
                        content += '| Time | Event | File | Changes | Words | Characters |\n';
                        content += '|------|--------|------|----------|--------|------------|';

                        for (const event of events) {
                            const time = window.moment(event.timestamp).format('YYYY-MM-DD HH:mm:ss');
                            const eventType = event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1);
                            const changes = event.contentDiff
                                ? `+${event.contentDiff.added}/-${event.contentDiff.removed}`
                                : '';
                            const words = event.contentDiff
                                ? `${event.contentDiff.wordCountBefore} → ${event.contentDiff.wordCountAfter}`
                                : '';
                            const chars = event.contentDiff
                                ? `${event.contentDiff.charCountBefore} → ${event.contentDiff.charCountAfter}`
                                : '';

                            content += `\n| ${time} | ${eventType} | ${event.filePath} | ${changes} | ${words} | ${chars} |`;
                        }

                        // Insert at cursor
                        const editor = activeView.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange(content + '\n\n', cursor);
                    })
                    .catch(error => {
                        console.error('Failed to get events:', error);
                    });
            }
        });

        this.addCommand({
            id: 'links-to-files-created-today',
            name: "Links to Files Created Today for date (default's for today)",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                if (this.settings.showFilterDialog) {
                    // Show filter dialog
                    new FilterModal(this.app, this, (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => {
                        let moments = this.getMoments(fromDate, toDate, activeView);
                        this.activityLogger.insertActivityLog(
                            {
                                insertCreatedOnDateFiles: true,
                                insertModifiedOnDateFiles: false,
                                moments: moments,
                                activeView,
                                makeLink: true,
                                includeRegex,
                                excludeRegex,
                                includePaths,
                                excludePaths
                            });
                    }).open();
                } else {
                    // Use filters from settings
                    let moments = this.getDates(activeView);
                    this.activityLogger.insertActivityLog(
                        {
                            insertCreatedOnDateFiles: true,
                            insertModifiedOnDateFiles: false,
                            moments: moments,
                            activeView,
                            makeLink: true,
                            includeRegex: this.settings.includeRegex,
                            excludeRegex: this.settings.excludeRegex,
                            includePaths: this.settings.includePaths,
                            excludePaths: this.settings.excludePaths
                        });
                }
            },
            hotkeys: [
                {
                    modifiers: ['Alt'],
                    key: 'c',
                },
            ],
        })

        this.addCommand({
            id: 'links-to-files-modified-today',
            name: "Links to Files Modified for date (default's for today)",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                if (this.settings.showFilterDialog) {
                    // Show filter dialog
                    new FilterModal(this.app, this, (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => {
                        let moments = this.getMoments(fromDate, toDate, activeView);
                        this.activityLogger.insertActivityLog(
                            {
                                insertCreatedOnDateFiles: false,
                                insertModifiedOnDateFiles: true,
                                moments: moments,
                                activeView,
                                makeLink: true,
                                includeRegex,
                                excludeRegex,
                                includePaths,
                                excludePaths
                            });
                    }).open();
                } else {
                    // Use filters from settings
                    let moments = this.getDates(activeView);
                    this.activityLogger.insertActivityLog(
                        {
                            insertCreatedOnDateFiles: false,
                            insertModifiedOnDateFiles: true,
                            moments: moments,
                            activeView,
                            makeLink: true,
                            includeRegex: this.settings.includeRegex,
                            excludeRegex: this.settings.excludeRegex,
                            includePaths: this.settings.includePaths,
                            excludePaths: this.settings.excludePaths
                        });
                }
            },
            hotkeys: [
                {
                    modifiers: ['Alt'],
                    key: 'm',
                },
            ],
        })

        this.addCommand({
            id: 'files-created-today',
            name: "Plain Text List of Files Created for date (default's for today)",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                if (this.settings.showFilterDialog) {
                    // Show filter dialog
                    new FilterModal(this.app, this, (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => {
                        let moments = this.getMoments(fromDate, toDate, activeView);
                        this.activityLogger.insertActivityLog(
                            {
                                insertCreatedOnDateFiles: true,
                                insertModifiedOnDateFiles: false,
                                moments: moments,
                                activeView,
                                makeLink: false,
                                includeRegex,
                                excludeRegex,
                                includePaths,
                                excludePaths
                            });
                    }).open();
                } else {
                    // Use filters from settings
                    let moments = this.getDates(activeView);
                    this.activityLogger.insertActivityLog(
                        {
                            insertCreatedOnDateFiles: true,
                            insertModifiedOnDateFiles: false,
                            moments: moments,
                            activeView,
                            makeLink: false,
                            includeRegex: this.settings.includeRegex,
                            excludeRegex: this.settings.excludeRegex,
                            includePaths: this.settings.includePaths,
                            excludePaths: this.settings.excludePaths
                        });
                }
            },
            hotkeys: [],
        })

        this.addCommand({
            id: 'files-modified-today',
            name: "Plain Text List of Files Modified for date (default's for today)",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                if (this.settings.showFilterDialog) {
                    // Show filter dialog
                    new FilterModal(this.app, this, (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => {
                        let moments = this.getMoments(fromDate, toDate, activeView);
                        this.activityLogger.insertActivityLog(
                            {
                                insertCreatedOnDateFiles: false,
                                insertModifiedOnDateFiles: true,
                                moments: moments,
                                makeLink: false,
                                includeRegex,
                                excludeRegex,
                                includePaths,
                                excludePaths
                            });
                    }).open();
                } else {
                    // Use filters from settings
                    let moments = this.getDates(activeView);
                    this.activityLogger.insertActivityLog(
                        {
                            insertCreatedOnDateFiles: false,
                            insertModifiedOnDateFiles: true,
                            moments: moments,
                            activeView,
                            makeLink: false,
                            includeRegex: this.settings.includeRegex,
                            excludeRegex: this.settings.excludeRegex,
                            includePaths: this.settings.includePaths,
                            excludePaths: this.settings.excludePaths
                        });
                }
            },
            hotkeys: [],
        })

        this.addCommand({
            id: 'file-stats-today',
            name: "(Deprecated) Today's Stats",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                this.activityLogger.insertFileStats({ activeView })
            },
        })

        this.addCommand({
            id: 'obsidian-stats',
            name: "Stats for date (default's for today)",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                let moments = this.getDates(activeView)
                console.log(`${moments}`)

                this.activityLogger.insertFileStats({ activeView, moments })
            },
        })

        // New database-backed commands

        // Daily Activity Summary
        this.addCommand({
            id: 'db-daily-activity-summary',
            name: "Daily Summary",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                // Get today's date and format as ISO string (YYYY-MM-DD)
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];

                // Get stats for today from daily stats store
                this.database.getDailyStats(todayStr)
                    .then(stats => {
                        if (!stats) {
                            // No activity today
                            const content = '# Daily Activity Summary\n\n' +
                                `**Date:** ${window.moment(today).format('YYYY-MM-DD')}\n\n` +
                                'No activity recorded for today.\n\n';

                            const editor = activeView.editor;
                            const cursor = editor.getCursor();
                            editor.replaceRange(content, cursor);
                            return;
                        }

                        // Create summary content
                        let content = '# Daily Activity Summary\n\n';
                        content += `**Date:** ${window.moment(today).format('YYYY-MM-DD')}\n\n`;
                        content += '## Activity Overview\n\n';
                        content += `- **Total Events:** ${stats.totalEvents}\n`;

                        // Add event type breakdown
                        content += '- **Event Types:**\n';
                        const eventCounts = stats.eventCounts || {};
                        for (const [type, count] of Object.entries(eventCounts)) {
                            const typeFormatted = type.charAt(0).toUpperCase() + type.slice(1);
                            content += `  - ${typeFormatted}: ${count}\n`;
                        }

                        // Add content changes
                        if (stats.totalAdded > 0 || stats.totalRemoved > 0) {
                            content += '\n## Content Changes\n\n';
                            content += `- **Lines Added:** ${stats.totalAdded}\n`;
                            content += `- **Lines Removed:** ${stats.totalRemoved}\n`;
                            content += `- **Net Change:** ${stats.totalAdded - stats.totalRemoved}\n`;
                        }

                        // Insert at cursor
                        const editor = activeView.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange(content, cursor);
                    })
                    .catch(error => {
                        console.error('Failed to get daily stats:', error);
                        new Notice('Failed to get activity data.');
                    });
            }
        });

        // Most Active Files
        this.addCommand({
            id: 'db-most-active-files',
            name: "Most Active Files",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                // Fetch all file stats from the database
                this.database.getAllFileStats()
                    .then(stats => {
                        if (!stats || stats.length === 0) {
                            const content = '# Most Active Files\n\n' +
                                'No file activity data available.\n\n';

                            const editor = activeView.editor;
                            const cursor = editor.getCursor();
                            editor.replaceRange(content, cursor);
                            return;
                        }

                        // Sort by total edits (descending)
                        stats.sort((a, b) => b.totalEdits - a.totalEdits);

                        // Create markdown content
                        let content = '# Most Active Files\n\n';
                        content += '## Top 20 Most Edited Files\n\n';
                        content += '| File | Total Edits | Last Modified | Lines Added | Lines Removed |\n';
                        content += '|------|-------------|---------------|-------------|---------------|\n';

                        // Add top 20 files
                        const topFiles = stats.slice(0, 20);
                        for (const file of topFiles) {
                            const filePath = file.filePath;
                            // Get just the filename without extension for display
                            const fileName = filePath.split('/').pop() || filePath;
                            // Remove .md extension for both the link target and display text
                            const fileNameWithoutExt = fileName.replace(/\.md$/, '');
                            const linkPath = filePath.replace(/\.md$/, '');
                            const lastModified = window.moment(file.lastModified).format('YYYY-MM-DD HH:mm');

                            // Create a proper Obsidian markdown link - [[path|display name]]
                            const fileLink = `[[${linkPath}|${fileNameWithoutExt}]]`;

                            content += `| ${fileLink} | ${file.totalEdits} | ${lastModified} | ${file.totalAdded} | ${file.totalRemoved} |\n`;
                        }

                        // Insert at cursor
                        const editor = activeView.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange(content, cursor);
                    })
                    .catch(error => {
                        console.error('Failed to get file stats:', error);
                        new Notice('Failed to get file activity data.');
                    });
            }
        });

        // Weekly Activity Overview
        this.addCommand({
            id: 'db-weekly-activity-overview',
            name: "Weekly Overview",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                // Get the dates for the last 7 days
                const dates: string[] = [];
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    dates.push(date.toISOString().split('T')[0]);
                }

                // Fetch activity data for each day
                Promise.all(dates.map(date => this.database.getDailyStats(date)))
                    .then(results => {
                        // Create summary content
                        let content = '# Weekly Activity Overview\n\n';
                        content += `**Period:** ${window.moment(dates[0]).format('MMM DD')} - ${window.moment(dates[dates.length - 1]).format('MMM DD, YYYY')}\n\n`;

                        // Create a summary table
                        content += '| Date | Total Events | Created | Modified | Deleted | Renamed | Lines Added | Lines Removed |\n';
                        content += '|------|--------------|---------|----------|---------|---------|-------------|---------------|\n';

                        // Weekly totals
                        let weeklyEvents = 0;
                        let weeklyCreated = 0;
                        let weeklyModified = 0;
                        let weeklyDeleted = 0;
                        let weeklyRenamed = 0;
                        let weeklyAdded = 0;
                        let weeklyRemoved = 0;

                        // Add data for each day
                        dates.forEach((date, index) => {
                            const stats = results[index];
                            const formattedDate = window.moment(date).format('ddd, MMM DD');

                            if (!stats) {
                                // No data for this day
                                content += `| ${formattedDate} | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n`;
                                return;
                            }

                            const eventCounts = stats.eventCounts || {};
                            const created = eventCounts['create'] || 0;
                            const modified = eventCounts['modify'] || 0;
                            const deleted = eventCounts['delete'] || 0;
                            const renamed = eventCounts['rename'] || 0;

                            // Update weekly totals
                            weeklyEvents += stats.totalEvents || 0;
                            weeklyCreated += created;
                            weeklyModified += modified;
                            weeklyDeleted += deleted;
                            weeklyRenamed += renamed;
                            weeklyAdded += stats.totalAdded || 0;
                            weeklyRemoved += stats.totalRemoved || 0;

                            content += `| ${formattedDate} | ${stats.totalEvents || 0} | ${created} | ${modified} | ${deleted} | ${renamed} | ${stats.totalAdded || 0} | ${stats.totalRemoved || 0} |\n`;
                        });

                        // Add weekly totals row
                        content += `| **Totals** | **${weeklyEvents}** | **${weeklyCreated}** | **${weeklyModified}** | **${weeklyDeleted}** | **${weeklyRenamed}** | **${weeklyAdded}** | **${weeklyRemoved}** |\n\n`;

                        // Add a summary section
                        content += '## Weekly Summary\n\n';
                        content += `- **Total Events:** ${weeklyEvents}\n`;
                        content += `- **Files Created:** ${weeklyCreated}\n`;
                        content += `- **Files Modified:** ${weeklyModified}\n`;
                        content += `- **Files Deleted:** ${weeklyDeleted}\n`;
                        content += `- **Files Renamed:** ${weeklyRenamed}\n`;
                        content += `- **Lines Added:** ${weeklyAdded}\n`;
                        content += `- **Lines Removed:** ${weeklyRemoved}\n`;
                        content += `- **Net Change:** ${weeklyAdded - weeklyRemoved} lines\n`;

                        // Insert at cursor
                        const editor = activeView.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange(content, cursor);
                    })
                    .catch(error => {
                        console.error('Failed to get weekly stats:', error);
                        new Notice('Failed to get weekly activity data.');
                    });
            }
        });

        // Activity Timeline
        this.addCommand({
            id: 'db-activity-timeline',
            name: "Today's Timeline",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                // Get timestamps for today (midnight to midnight)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Get events for today
                this.database.getEventsInTimeRange(today.getTime(), tomorrow.getTime())
                    .then(events => {
                        if (!events || events.length === 0) {
                            const content = '# Today\'s Activity Timeline\n\n' +
                                `**Date:** ${window.moment(today).format('YYYY-MM-DD')}\n\n` +
                                'No activity recorded for today.\n\n';

                            const editor = activeView.editor;
                            const cursor = editor.getCursor();
                            editor.replaceRange(content, cursor);
                            return;
                        }

                        // Sort events by timestamp (ascending)
                        events.sort((a, b) => a.timestamp - b.timestamp);

                        // Group events by hour
                        const hourlyEvents: Record<number, FileEvent[]> = {};
                        for (let i = 0; i < 24; i++) {
                            hourlyEvents[i] = [];
                        }

                        events.forEach(event => {
                            const date = new Date(event.timestamp);
                            const hour = date.getHours();
                            hourlyEvents[hour].push(event);
                        });

                        // Create content
                        let content = '# Today\'s Activity Timeline\n\n';
                        content += `**Date:** ${window.moment(today).format('YYYY-MM-DD')}\n\n`;

                        // Add timeline
                        for (let hour = 0; hour < 24; hour++) {
                            const hourEvents = hourlyEvents[hour];
                            if (hourEvents.length === 0) continue; // Skip empty hours

                            const hourLabel = hour.toString().padStart(2, '0') + ':00';
                            content += `## ${hourLabel}\n\n`;

                            // Group by event type within each hour
                            const eventsByType: Record<string, FileEvent[]> = {};
                            hourEvents.forEach(event => {
                                if (!eventsByType[event.eventType]) {
                                    eventsByType[event.eventType] = [];
                                }
                                eventsByType[event.eventType].push(event);
                            });

                            // Add events by type
                            for (const [type, typeEvents] of Object.entries(eventsByType)) {
                                const typeFormatted = type.charAt(0).toUpperCase() + type.slice(1);
                                content += `### ${typeFormatted} (${typeEvents.length})\n\n`;

                                typeEvents.forEach(event => {
                                    const time = window.moment(event.timestamp).format('HH:mm:ss');
                                    const fileName = event.filePath.split('/').pop() || event.filePath;
                                    const fileNameWithoutExt = fileName.replace(/\.md$/, '');
                                    const linkPath = event.filePath.replace(/\.md$/, '');
                                    const fileLink = `[[${linkPath}|${fileNameWithoutExt}]]`;

                                    content += `- ${time} - ${fileLink}`;

                                    // Add details based on event type
                                    if (event.eventType === 'modify' && event.contentDiff) {
                                        content += ` (+${event.contentDiff.added}/-${event.contentDiff.removed})`;
                                    } else if (event.eventType === 'rename' && event.oldPath) {
                                        const oldName = event.oldPath.split('/').pop() || event.oldPath;
                                        const oldNameWithoutExt = oldName.replace(/\.md$/, '');
                                        content += ` (renamed from ${oldNameWithoutExt})`;
                                    }

                                    content += '\n';
                                });

                                content += '\n';
                            }
                        }

                        // Insert at cursor
                        const editor = activeView.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange(content, cursor);
                    })
                    .catch(error => {
                        console.error('Failed to get events:', error);
                        new Notice('Failed to get activity timeline data.');
                    });
            }
        });

        // Export Activity Data
        this.addCommand({
            id: 'db-export-activity-data',
            name: "Export Activity Data",
            checkCallback: (checking: boolean) => {
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
                if (activeView == null) {
                    return false
                }

                if (checking) {
                    return true
                }

                // Show export modal to configure export
                new ExportModal(this.app, this, async (format: 'json' | 'csv', startDate?: number, endDate?: number, exportPath?: string, fields?: string[]) => {
                    try {
                        // Convert dates to timestamps
                        const startTimestamp = startDate ? new Date(startDate).getTime() : (Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
                        const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();

                        // If no path specified, use default from settings
                        const finalPath = exportPath || this.settings.autoExportPath;

                        // If fields not specified, use default from settings
                        const finalFields = fields && fields.length > 0 ? fields : this.settings.exportFields;

                        // Perform the export
                        await this.database.scheduleExport({
                            format: format, // format is now properly typed as 'json' | 'csv'
                            startDate: startTimestamp,
                            endDate: endTimestamp,
                            fields: finalFields
                        }, finalPath, this.app);

                        new Notice(`Activity data exported successfully to ${finalPath}`);
                    } catch (error) {
                        console.error('Failed to export data:', error);
                        new Notice('Failed to export activity data. Check console for details.');
                    }
                }).open();
            }
        });

        // Add a command to generate the dashboard
        this.addCommand({
            id: 'generate-activity-dashboard',
            name: "Generate Activity Dashboard",
            checkCallback: (checking: boolean) => {
                // Only enable command if dashboard is enabled in settings
                if (checking) {
                    return this.settings.enableDashboard;
                }

                // Generate the dashboard
                this.generateDashboard()
                    .then(() => {
                        new Notice('Activity dashboard generated successfully');
                    })
                    .catch(error => {
                        console.error('Failed to generate dashboard:', error);
                        new Notice('Failed to generate dashboard. Check console for details.');
                    });

                return true;
            }
        });

        // Add dashboard refresh command
        this.addCommand({
            id: 'refresh-dashboard',
            name: 'Refresh dashboard',
            callback: async () => {
                if (!this.settings.enableDashboard) {
                    new Notice('Dashboard is disabled. Enable it in plugin settings first.');
                    return;
                }

                new Notice('Generating dashboard... This may take a moment.');

                try {
                    await this.generateDashboard();
                    new Notice('Dashboard refreshed successfully!');
                } catch (error) {
                    console.error('Failed to refresh dashboard:', error);
                    new Notice('Failed to refresh dashboard. Check console for details.');
                }
            }
        });

        // Add a command to clear failed operations
        this.addCommand({
            id: 'clear-failed-operations',
            name: 'Clear Failed Operations',
            callback: () => {
                if (this.eventHandler) {
                    this.eventHandler.clearFailedOperations();
                    new Notice('Cleared failed operations');
                }
            }
        });
    }

    private getMoments(fromDate: string, toDate: string, activeView: MarkdownView) {
        if (fromDate && toDate) {
            const dp = new DateParser(this)
            return dp.parseDateRangeFromSelection(`${fromDate} to ${toDate}`)
        } else {
            return this.getDates(activeView)
        }
    }

    onunload() {
        this.logger.info('Unloading daily activity plugin...');

        // Clear dashboard interval
        this.clearDashboardInterval();

        if (this.eventHandler) {
            this.logger.info('Cleaning up event handler...');
            this.eventHandler.cleanup();
            this.logger.info('Event handler cleanup complete');
        }

        // Properly destroy the database instance
        ActivityDatabase.destroyInstance();
        this.logger.info('Database instance destroyed');

        this.logger.info('Daily activity plugin unloaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
    }

    async saveSettings() {
        await this.saveData(this.settings)
    }

    getDates(activeView: MarkdownView): Moment[] {
        let editor = activeView.editor
        const dp = new DateParser(this)

        if (!editor || !editor.somethingSelected()) {
            // Return today for start & end
            return [window.moment()]
        }

        let selection = editor.getSelection()
        this.logger.debug('Selection contains a date range: ', selection.includes('to'))

        let moments: Moment[] = []
        if (selection.includes('to')) {
            moments = dp.parseDateRangeFromSelection(selection)
        } else {
            const dateRange = dp.parseDate(selection)
            moments.push(dateRange.start)
        }

        return moments
    }

    private registerAutoExport() {
        let interval: number;

        switch (this.settings.autoExportSchedule) {
            case 'daily':
                interval = 24 * 60 * 60 * 1000; // 24 hours
                break;
            case 'weekly':
                interval = 7 * 24 * 60 * 60 * 1000; // 7 days
                break;
            case 'monthly':
                interval = 30 * 24 * 60 * 60 * 1000; // ~30 days
                break;
            default:
                return; // No auto-export
        }

        // Schedule first export
        this.scheduleNextExport(interval);
    }

    private scheduleNextExport(interval: number) {
        setTimeout(async () => {
            try {
                // Perform the export
                const now = Date.now();
                const lastPeriod = now - interval;

                await this.database.scheduleExport({
                    format: this.settings.defaultExportFormat,
                    startDate: lastPeriod,
                    endDate: now,
                    fields: this.settings.exportFields
                }, this.settings.autoExportPath, this.app);

                // Schedule next export
                this.scheduleNextExport(interval);
            } catch (error) {
                console.error('Failed to perform scheduled export:', error);
                // Try again in an hour if there was an error
                setTimeout(() => this.scheduleNextExport(interval), 60 * 60 * 1000);
            }
        }, this.calculateNextExportDelay());
    }

    private calculateNextExportDelay(): number {
        const now = new Date();
        const targetHour = 2; // 2 AM

        // Create tomorrow at the target hour
        const nextExport = new Date(now);
        nextExport.setDate(nextExport.getDate() + 1);
        nextExport.setHours(targetHour, 0, 0, 0);

        // Calculate delay in milliseconds
        let delay = nextExport.getTime() - now.getTime();

        // If the delay is less than an hour, add a day to make sure we don't export too soon
        if (delay < 60 * 60 * 1000) {
            nextExport.setDate(nextExport.getDate() + 1);
            delay = nextExport.getTime() - now.getTime();
        }

        return delay;
    }

    /**
     * Generate the dashboard
     */
    public async generateDashboard(): Promise<void> {
        if (!this.settings.enableDashboard) {
            return;
        }

        try {
            // Show progress indicator
            const progressNotice = new Notice('Generating dashboard...', 0);

            if (!this.dashboardGenerator) {
                this.dashboardGenerator = new DashboardGenerator(this.app, this.database, this);
            }
            await this.dashboardGenerator.generateDashboard(this.settings.dashboardPath);

            // Remove progress indicator and show success notice
            progressNotice.hide();
            this.logger.info('Dashboard generated successfully');
        } catch (error) {
            this.logger.error('Failed to generate dashboard:', error);
        }
    }

    /**
     * Set up interval for auto-updating the dashboard
     */
    public setupDashboardInterval(): void {
        // Clear any existing interval
        this.clearDashboardInterval();

        // Convert hours to milliseconds
        const intervalMs = this.settings.dashboardUpdateInterval * 60 * 60 * 1000;

        // Set up new interval
        this.dashboardUpdateInterval = setInterval(async () => {
            if (this.settings.enableDashboard) {
                try {
                    await this.generateDashboard();
                    this.logger.info('Auto-updated dashboard');
                } catch (error) {
                    this.logger.error('Failed to auto-update dashboard:', error);
                }
            }
        }, intervalMs);

        this.logger.info(`Dashboard auto-update scheduled every ${this.settings.dashboardUpdateInterval} hours`);
    }

    /**
     * Clear the dashboard update interval
     */
    public clearDashboardInterval(): void {
        if (this.dashboardUpdateInterval) {
            clearInterval(this.dashboardUpdateInterval);
            this.dashboardUpdateInterval = null;
            this.logger.info('Dashboard auto-update disabled');
        }
    }

    /**
     * Adds a donate button to the plugin's description in the plugins list
     */
    private addDonateButton(): void {
        const donateEl = document.createElement('a');
        donateEl.setAttr('href', 'https://ko-fi.com/trydalch');
        donateEl.setAttr('target', '_blank');
        donateEl.addClass('daily-activity-donate-button');

        // Create button element
        const donateBtn = document.createElement('button');
        donateBtn.setText('Donate');
        donateBtn.addClass('mod-cta');
        donateEl.appendChild(donateBtn);

        // Add this element after plugin is registered
        const interval = setInterval(() => {
            const pluginEl = document.querySelector('.community-plugin-details[data-plugin-id="daily-activity"]');
            if (pluginEl) {
                clearInterval(interval);

                // Find the description element and append our button
                const descEl = pluginEl.querySelector('.community-plugin-desc');
                if (descEl) {
                    descEl.appendChild(document.createTextNode(' '));
                    descEl.appendChild(donateEl);
                }
            }
        }, 200);
    }
}
