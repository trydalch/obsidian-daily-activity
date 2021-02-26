/** @format */

import { Moment } from 'moment'
import { MarkdownView, Plugin } from 'obsidian'
import { ActivityLogger } from 'src/ActivityLogger'
import DateParser from 'src/DateParser'

interface DailyActivityPluginSettings {
  // TODO:
  // insert location: cursor, top of file, end of file
  // lists to generate: Created & modified? Just created? Just modified?
  // Exclude modified from created table
  // exclude file regex
  // include file regex
  // include file paths
  // exclude file paths
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
      name: 'Links to Files Created Today',
      checkCallback: (checking: boolean) => {
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (activeView == null) {
          return false
        }

        if (checking) {
          return true
        }

        this.activityLogger.insertActivityLog({ insertCreatedToday: true, activeView })
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
      name: 'Links to Files Modified Today',
      checkCallback: (checking: boolean) => {
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (activeView == null) {
          return false
        }

        if (checking) {
          return true
        }

        this.activityLogger.insertActivityLog({ insertModifiedToday: true, activeView })
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
      name: 'Plain Text List of Files Created Today',
      checkCallback: (checking: boolean) => {
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (activeView == null) {
          return false
        }

        if (checking) {
          return true
        }

        this.activityLogger.insertActivityLog({ insertCreatedToday: true, activeView, makeLink: false })
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
      name: 'Plain Text List of Files Modified Today',
      checkCallback: (checking: boolean) => {
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (activeView == null) {
          return false
        }

        if (checking) {
          return true
        }

        this.activityLogger.insertActivityLog({ insertModifiedToday: true, activeView, makeLink: false })
      },
      hotkeys: [
        {
          modifiers: ['Alt'],
          key: 'm',
        },
      ],
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
    let editor = activeView.sourceMode.cmEditor
    const dp = new DateParser()

    if (!editor || !editor.somethingSelected()) {
      // Return today for start & end
      return [window.moment()]
    }

    let selection = editor.getSelection()
    console.log(selection.contains('to'))

    let moments: Moment[] = []
    if (selection.contains('to')) {
      moments = dp.parseDateRangeFromSelection(selection)
    } else {
      moments.push(window.moment(dp.parseDate(selection)))
    }

    return moments
  }
}
