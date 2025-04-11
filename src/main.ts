/** @format */

import { Moment } from 'moment'
import { MarkdownView, Plugin } from 'obsidian'
import { ActivityLogger } from 'src/ActivityLogger'
import DateParser from 'src/DateParser'
import FilterModal from 'src/modal/FilterModal'
import { DailyActivitySettingsTab } from 'src/settings/SettingsTab'

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
    showFilterDialog: true
}

export default class DailyActivityPlugin extends Plugin {
    settings: DailyActivityPluginSettings
    activityLogger: ActivityLogger

    async onload() {
        console.log('loading plugin')

        await this.loadSettings();

        this.activityLogger = new ActivityLogger(this.app, this)

        // Add settings tab
        this.addSettingTab(new DailyActivitySettingsTab(this.app, this));

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
                    new FilterModal(this.app, (fromDate, toDate, includeRegex: any, excludeRegex: any, includePaths: any, excludePaths: any) => {
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
                    new FilterModal(this.app, (fromDate, toDate, includeRegex: any, excludeRegex: any, includePaths: any, excludePaths: any) => {
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
                    new FilterModal(this.app, (fromDate, toDate, includeRegex: any, excludeRegex: any, includePaths: any, excludePaths: any) => {
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
                    new FilterModal(this.app, (fromDate, toDate, includeRegex: any, excludeRegex: any, includePaths: any, excludePaths: any) => {
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
    }

    private getMoments(fromDate: string, toDate: string, activeView: MarkdownView) {
        if (fromDate && toDate) {
            const dp = new DateParser();
            return dp.parseDateRangeFromSelection(`${fromDate} to ${toDate}`);
        } else {
            return this.getDates(activeView);
        }
    }

    onunload() {
        console.log('unloading plugin')
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
    }

    async saveSettings() {
        await this.saveData(this.settings)
    }

    getDates(activeView: MarkdownView): Moment[] {
        let editor = activeView.editor
        const dp = new DateParser()

        if (!editor || !editor.somethingSelected()) {
            // Return today for start & end
            return [window.moment()]
        }

        let selection = editor.getSelection()
        console.log('Selection contains a date range: ', selection.contains('to'))

        let moments: Moment[] = []
        if (selection.contains('to')) {
            moments = dp.parseDateRangeFromSelection(selection)
        } else {
            moments.push(window.moment(dp.parseDate(selection)))
        }

        return moments
    }
}
