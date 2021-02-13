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
}

const DEFAULT_SETTINGS: DailyActivityPluginSettings = {
	mySetting: 'default'
}

export default class DailyActivityPlugin extends Plugin {
	settings: DailyActivityPluginSettings;
	activityLogger: ActivityLogger;

	async onload() {
		console.log('loading plugin');

		// await this.loadSettings();

		this.activityLogger = new ActivityLogger(this.app, this);

		this.addCommand({
			id: 'files-created-today',
			name: 'Insert Links to Files Created Today',
			checkCallback: (checking: boolean) => {
				let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (activeView == null) {
					return false;
				}

				if (checking) {
					return true;
				}
				
				this.activityLogger.insertActivityLog({insertCreatedToday: true});
			},
			hotkeys: [
				{
				modifiers: ["Alt"],
				key: 'c',
				}
			]
		})

		this.addCommand({
			id: 'files-modified-today',
			name: 'Insert Links to Files modified Today',
			checkCallback: (checking: boolean) => {
				let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (activeView == null) {
					return false;
				}

				if (checking) {
					return true;
				}
				
				this.activityLogger.insertActivityLog({insertModifiedToday: true});
			},
			hotkeys: [
				{
				modifiers: ["Alt"],
				key: 'm',
				}
			]
		})

		this.addSettingTab(new SampleSettingTab(this.app, this));
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: DailyActivityPlugin;

	constructor(app: App, plugin: DailyActivityPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		// new Setting(containerEl)
		// 	.setName('Setting #1')
		// 	.setDesc('It\'s a secret')
		// 	.addText(text => text
		// 		.setPlaceholder('Enter your secret')
		// 		.setValue('')
		// 		.onChange(async (value) => {
		// 			console.log('Secret: ' + value);
		// 			this.plugin.settings.mySetting = value;
		// 			await this.plugin.saveSettings();
		// 		}));
	}
}
