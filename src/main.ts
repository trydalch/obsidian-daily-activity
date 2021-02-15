import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile } from 'obsidian';
import { ActivityLogger } from 'src/ActivityLogger';

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

const DEFAULT_SETTINGS: DailyActivityPluginSettings = {};

export default class DailyActivityPlugin extends Plugin {
  settings: DailyActivityPluginSettings;
  activityLogger: ActivityLogger;

  async onload() {
    console.log('loading plugin');

    // await this.loadSettings();

    this.activityLogger = new ActivityLogger(this.app, this);

    this.addCommand({
      id: 'files-created-today',
      name: 'Links to Files Created Today',
      checkCallback: (checking: boolean) => {
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView == null) {
          return false;
        }

        if (checking) {
          return true;
        }

        this.activityLogger.insertActivityLog({ insertCreatedToday: true, activeView });
      },
      hotkeys: [
        {
          modifiers: ['Alt'],
          key: 'c',
        },
      ],
    });

    this.addCommand({
      id: 'files-modified-today',
      name: 'Links to Files Modified Today',
      checkCallback: (checking: boolean) => {
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView == null) {
          return false;
        }

        if (checking) {
          return true;
        }

        this.activityLogger.insertActivityLog({ insertModifiedToday: true, activeView });
      },
      hotkeys: [
        {
          modifiers: ['Alt'],
          key: 'm',
        },
      ],
    });

    this.addCommand({
      id: 'file-stats-today',
      name: "Today's Stats",
      checkCallback: (checking: boolean) => {
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView == null) {
          return false;
        }

        if (checking) {
          return true;
        }

        this.activityLogger.insertFileStats({ activeView });
      },
    });
  }

  onunload() {
    console.log('unloading plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
