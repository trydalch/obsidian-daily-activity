/** @format */

import {Moment} from 'moment'
import {MarkdownView, Plugin} from 'obsidian'
import {ActivityLogger} from 'src/ActivityLogger'
import DateParser from 'src/DateParser'
import FilterModal from 'src/modal/FilterModal'

interface DailyActivityPluginSettings {
    // TODO:
    // insert location: cursor, top of file, end of file
    // lists to generate: Created & modified? Just created? Just modified?
    // Exclude modified from created table
    // Include current note?
    // Include header?
    // Custom header values
    // template for inserting?
    // plain text or link?
}

// TODO:
// Track activity using events (file created, file modified, file opened, track additions/deletions by capturing file length on open/close (or focus/lose focus))

const DEFAULT_SETTINGS: DailyActivityPluginSettings = {}

export default class DailyActivityPlugin extends Plugin {
    settings: DailyActivityPluginSettings
    activityLogger: ActivityLogger

    async onload() {
        console.log('loading plugin')

        // await this.loadSettings();

        this.activityLogger = new ActivityLogger(this.app, this)

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

                this.activityLogger.insertFileStats({activeView})
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

                this.activityLogger.insertFileStats({activeView, moments})
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
