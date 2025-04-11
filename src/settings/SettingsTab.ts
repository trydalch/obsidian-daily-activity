import { App, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import DailyActivityPlugin from '../main';

export class DailyActivitySettingsTab extends PluginSettingTab {
    plugin: DailyActivityPlugin;
    // Store references to filter settings
    private filterSettings: Setting[] = [];
    // Store references to all textareas
    private textareas: TextAreaComponent[] = [];

    constructor(app: App, plugin: DailyActivityPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Daily Activity Plugin Settings' });

        // General Settings Section
        containerEl.createEl('h3', { text: 'General Settings' });

        new Setting(containerEl)
            .setName('Insert location')
            .setDesc('Where to insert the content when running commands')
            .addDropdown(dropdown => dropdown
                .addOption('cursor', 'At cursor position')
                .addOption('end', 'End of document')
                .setValue(this.plugin.settings.insertLocation)
                .onChange(async (value: 'cursor' | 'end') => {
                    this.plugin.settings.insertLocation = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default link style')
            .setDesc('How file references should be displayed by default')
            .addDropdown(dropdown => dropdown
                .addOption('link', 'Wiki links')
                .addOption('plain', 'Plain text')
                .setValue(this.plugin.settings.defaultLinkStyle)
                .onChange(async (value: 'link' | 'plain') => {
                    this.plugin.settings.defaultLinkStyle = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include header')
            .setDesc('Add a header above the inserted file list')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeHeader)
                .onChange(async (value) => {
                    this.plugin.settings.includeHeader = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Header template')
            .setDesc('Template for the header. Use {type} for file type (Created/Modified) and {date} for date')
            .addText(text => text
                .setPlaceholder('## Files {type} on {date}')
                .setValue(this.plugin.settings.headerStyle)
                .onChange(async (value) => {
                    this.plugin.settings.headerStyle = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Exclude current note')
            .setDesc('Exclude the current note from the generated lists')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.excludeCurrentNote)
                .onChange(async (value) => {
                    this.plugin.settings.excludeCurrentNote = value;
                    await this.plugin.saveSettings();
                }));

        // Filter Settings Section
        containerEl.createEl('h3', { text: 'Filter Settings' });

        new Setting(containerEl)
            .setName('Show filter dialog')
            .setDesc('Show filter dialog when running commands (uncheck to use filters defined below)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFilterDialog)
                .onChange(async (value) => {
                    this.plugin.settings.showFilterDialog = value;

                    // If enabling filter dialog, clear filter settings since they won't be used
                    if (value) {
                        this.plugin.settings.includeRegex = [];
                        this.plugin.settings.excludeRegex = [];
                        this.plugin.settings.includePaths = [];
                        this.plugin.settings.excludePaths = [];

                        // Clear all textareas
                        this.textareas.forEach(textarea => {
                            textarea.setValue('');
                        });
                    }

                    // Toggle filter settings visibility
                    this.toggleFilterSettings(!value);

                    await this.plugin.saveSettings();
                }));

        // Include regex patterns
        const includeRegexSetting = new Setting(containerEl)
            .setName('Include regex patterns')
            .setDesc('Files matching these regex patterns will be included (one pattern per line)')
            .addTextArea(textarea => {
                this.setupTextarea(textarea);
                textarea.setValue(this.plugin.settings.includeRegex.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.includeRegex = this.parseTextareaLines(value);
                        await this.plugin.saveSettings();
                    });
                this.textareas.push(textarea);
            });

        // Exclude regex patterns
        const excludeRegexSetting = new Setting(containerEl)
            .setName('Exclude regex patterns')
            .setDesc('Files matching these regex patterns will be excluded (one pattern per line)')
            .addTextArea(textarea => {
                this.setupTextarea(textarea);
                textarea.setValue(this.plugin.settings.excludeRegex.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.excludeRegex = this.parseTextareaLines(value);
                        await this.plugin.saveSettings();
                    });
                this.textareas.push(textarea);
            });

        // Include paths
        const includePathsSetting = new Setting(containerEl)
            .setName('Include paths')
            .setDesc('Files containing these path segments will be included (one path per line)')
            .addTextArea(textarea => {
                this.setupTextarea(textarea);
                textarea.setValue(this.plugin.settings.includePaths.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.includePaths = this.parseTextareaLines(value);
                        await this.plugin.saveSettings();
                    });
                this.textareas.push(textarea);
            });

        // Exclude paths
        const excludePathsSetting = new Setting(containerEl)
            .setName('Exclude paths')
            .setDesc('Files containing these path segments will be excluded (one path per line)')
            .addTextArea(textarea => {
                this.setupTextarea(textarea);
                textarea.setValue(this.plugin.settings.excludePaths.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.excludePaths = this.parseTextareaLines(value);
                        await this.plugin.saveSettings();
                    });
                this.textareas.push(textarea);
            });

        // Add filter settings to array for easy toggling
        this.filterSettings = [
            includeRegexSetting,
            excludeRegexSetting,
            includePathsSetting,
            excludePathsSetting
        ];

        // Initial state for filter settings
        this.toggleFilterSettings(!this.plugin.settings.showFilterDialog);
    }

    // Helper method to set up textarea components
    private setupTextarea(textarea: TextAreaComponent): void {
        textarea.inputEl.rows = 4;
        textarea.inputEl.cols = 25;
    }

    // Helper method to parse textarea lines into array
    private parseTextareaLines(text: string): string[] {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    // Toggle all filter settings based on whether they should be enabled
    private toggleFilterSettings(enabled: boolean): void {
        this.filterSettings.forEach(setting => {
            // Set the setting opacity to indicate enabled/disabled state
            setting.settingEl.style.opacity = enabled ? '1' : '0.5';

            // Get all input elements in this setting
            const inputs = setting.settingEl.querySelectorAll('textarea');
            inputs.forEach((input: HTMLTextAreaElement) => {
                input.disabled = !enabled;
                if (!enabled) {
                    input.style.cursor = 'not-allowed';
                } else {
                    input.style.cursor = 'text';
                }
            });

            // Add a note if disabled
            if (!enabled) {
                if (!setting.settingEl.querySelector('.setting-disabled-note')) {
                    const note = document.createElement('div');
                    note.className = 'setting-disabled-note';
                    note.style.color = 'var(--text-muted)';
                    note.style.fontStyle = 'italic';
                    note.style.marginTop = '4px';
                    note.textContent = 'Disabled when filter dialog is shown';
                    setting.settingEl.appendChild(note);
                }
            } else {
                const note = setting.settingEl.querySelector('.setting-disabled-note');
                if (note) note.remove();
            }
        });
    }
} 