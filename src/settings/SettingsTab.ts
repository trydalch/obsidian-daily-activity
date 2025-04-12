import { App, PluginSettingTab, Setting, TextAreaComponent, DropdownComponent, Notice } from 'obsidian';
import DailyActivityPlugin from '../main';
import { LogLevel } from '../Logger';
import { DailyActivitySettings } from '../settings';

export class DailyActivitySettingsTab extends PluginSettingTab {
    plugin: DailyActivityPlugin;
    // Store references to filter settings
    private filterSettings: Setting[] = [];
    // Store references to all textareas
    private textareas: TextAreaComponent[] = [];
    activityTrackingSection: HTMLElement;
    exportSettingsSection: HTMLElement;
    activityFilterSettings: Setting[] = [];

    constructor(app: App, plugin: DailyActivityPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Daily Activity Plugin Settings' });

        // Add donate section at the top
        this.addDonateSection(containerEl);

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

        // Dashboard Settings Section - Moved up
        containerEl.createEl('h3', { text: 'Dashboard Settings' });
        const dashboardSection = containerEl.createDiv();

        new Setting(dashboardSection)
            .setName('Enable dashboard')
            .setDesc('Create a markdown dashboard with visualizations of your activity data')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableDashboard)
                .onChange(async (value) => {
                    this.plugin.settings.enableDashboard = value;
                    await this.plugin.saveSettings();

                    // Toggle visibility of other dashboard settings
                    dashboardSection.querySelectorAll('.dashboard-setting').forEach(el => {
                        (el as HTMLElement).style.display = value ? '' : 'none';
                    });

                    // Generate dashboard immediately if enabled
                    if (value) {
                        try {
                            await this.generateDashboard();
                            new Notice('Dashboard generated successfully');
                        } catch (error) {
                            console.error('Failed to generate dashboard:', error);
                            new Notice('Failed to generate dashboard. Check console for details.');
                        }
                    }
                }));

        new Setting(dashboardSection)
            .setName('Dashboard path')
            .setDesc('Path in your vault where the dashboard will be created')
            .setClass('dashboard-setting')
            .addText(text => text
                .setValue(this.plugin.settings.dashboardPath)
                .setPlaceholder('Activity Dashboard.md')
                .onChange(async (value) => {
                    this.plugin.settings.dashboardPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(dashboardSection)
            .setName('Auto-update dashboard')
            .setDesc('Automatically update the dashboard at a specified interval')
            .setClass('dashboard-setting')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoUpdateDashboard)
                .onChange(async (value) => {
                    this.plugin.settings.autoUpdateDashboard = value;
                    await this.plugin.saveSettings();

                    // Set up or clear dashboard update interval
                    if (value) {
                        this.plugin.setupDashboardInterval();
                    } else {
                        this.plugin.clearDashboardInterval();
                    }
                }));

        new Setting(dashboardSection)
            .setName('Update interval (hours)')
            .setDesc('How often to update the dashboard automatically')
            .setClass('dashboard-setting')
            .addSlider(slider => slider
                .setLimits(1, 72, 1)
                .setValue(this.plugin.settings.dashboardUpdateInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.dashboardUpdateInterval = value;
                    await this.plugin.saveSettings();

                    // Reset interval if auto-update is enabled
                    if (this.plugin.settings.autoUpdateDashboard) {
                        this.plugin.setupDashboardInterval();
                    }
                }))
            .addText(text => text
                .setValue(String(this.plugin.settings.dashboardUpdateInterval))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 72) {
                        this.plugin.settings.dashboardUpdateInterval = numValue;
                        await this.plugin.saveSettings();

                        // Reset interval if auto-update is enabled
                        if (this.plugin.settings.autoUpdateDashboard) {
                            this.plugin.setupDashboardInterval();
                        }
                    }
                }));

        new Setting(dashboardSection)
            .setName('Use Charts Plugin')
            .setDesc('Use the Obsidian Charts plugin for enhanced visualizations (if installed)')
            .setClass('dashboard-setting')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useChartsPlugin)
                .onChange(async (value) => {
                    this.plugin.settings.useChartsPlugin = value;
                    await this.plugin.saveSettings();

                    // Regenerate dashboard if it's enabled
                    if (this.plugin.settings.enableDashboard) {
                        try {
                            await this.updateDashboard();
                            new Notice('Dashboard updated with new chart settings');
                        } catch (error) {
                            console.error('Failed to update dashboard:', error);
                            new Notice('Failed to update dashboard. Check console for details.');
                        }
                    }
                }));

        // Initial state of dashboard settings
        const dashboardEnabled = this.plugin.settings.enableDashboard;
        dashboardSection.querySelectorAll('.dashboard-setting').forEach(el => {
            (el as HTMLElement).style.display = dashboardEnabled ? '' : 'none';
        });

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
        this.filterSettings.push(includeRegexSetting);

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
        this.filterSettings.push(excludeRegexSetting);

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
        this.filterSettings.push(includePathsSetting);

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
        this.filterSettings.push(excludePathsSetting);

        // Add filter settings to array for easy toggling
        this.filterSettings = [
            includeRegexSetting,
            excludeRegexSetting,
            includePathsSetting,
            excludePathsSetting
        ];

        // Initial state for filter settings
        this.toggleFilterSettings(!this.plugin.settings.showFilterDialog);

        // Activity Tracking Section
        containerEl.createEl('h3', { text: 'Activity Tracking Settings' });
        this.activityTrackingSection = containerEl.createDiv();

        new Setting(this.activityTrackingSection)
            .setName('Enable Activity Tracking')
            .setDesc('Track file creation, modification, deletion, and renames')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableActivityTracking)
                .onChange(async (value) => {
                    this.plugin.settings.enableActivityTracking = value;
                    this.toggleActivitySettings(value);
                    await this.plugin.saveSettings();
                }));

        // Event type settings
        new Setting(this.activityTrackingSection)
            .setName('Events to track')
            .setDesc('Select which file events to track')
            .setClass('event-tracking-settings')
            .addToggle(toggle => toggle
                .setTooltip('Track file creation')
                .setValue(this.plugin.settings.trackFileCreation)
                .onChange(async (value) => {
                    this.plugin.settings.trackFileCreation = value;
                    await this.plugin.saveSettings();
                }))
            .addExtraButton(button => button
                .setTooltip('Track file creation')
                .setIcon('file-plus')
                .setDisabled(true))
            .addToggle(toggle => toggle
                .setTooltip('Track file modification')
                .setValue(this.plugin.settings.trackFileModification)
                .onChange(async (value) => {
                    this.plugin.settings.trackFileModification = value;
                    await this.plugin.saveSettings();
                }))
            .addExtraButton(button => button
                .setTooltip('Track file modification')
                .setIcon('file-edit')
                .setDisabled(true))
            .addToggle(toggle => toggle
                .setTooltip('Track file deletion')
                .setValue(this.plugin.settings.trackFileDeletion)
                .onChange(async (value) => {
                    this.plugin.settings.trackFileDeletion = value;
                    await this.plugin.saveSettings();
                }))
            .addExtraButton(button => button
                .setTooltip('Track file deletion')
                .setIcon('file-minus')
                .setDisabled(true))
            .addToggle(toggle => toggle
                .setTooltip('Track file rename')
                .setValue(this.plugin.settings.trackFileRename)
                .onChange(async (value) => {
                    this.plugin.settings.trackFileRename = value;
                    await this.plugin.saveSettings();
                }))
            .addExtraButton(button => button
                .setTooltip('Track file rename')
                .setIcon('file-symlink')
                .setDisabled(true));

        // Debounce intervals
        new Setting(this.activityTrackingSection)
            .setName('Content tracking debounce interval')
            .setDesc('Minimum time between content change tracking (in milliseconds)')
            .addSlider(slider => slider
                .setLimits(1000, 60000, 1000)
                .setValue(this.plugin.settings.contentTrackingDebounceInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.contentTrackingDebounceInterval = value;
                    await this.plugin.saveSettings();
                }))
            .addText(text => text
                .setValue(String(this.plugin.settings.contentTrackingDebounceInterval))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 1000 && numValue <= 60000) {
                        this.plugin.settings.contentTrackingDebounceInterval = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(this.activityTrackingSection)
            .setName('Database write debounce interval')
            .setDesc('Minimum time between database writes (in milliseconds)')
            .addSlider(slider => slider
                .setLimits(10000, 300000, 10000)
                .setValue(this.plugin.settings.dbWriteDebounceInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.dbWriteDebounceInterval = value;
                    await this.plugin.saveSettings();
                }))
            .addText(text => text
                .setValue(String(this.plugin.settings.dbWriteDebounceInterval))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 10000 && numValue <= 300000) {
                        this.plugin.settings.dbWriteDebounceInterval = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        // Batch modification settings
        this.activityTrackingSection.createEl('h4', { text: 'Batch Modification Settings' });

        new Setting(this.activityTrackingSection)
            .setName('Enable modification batching')
            .setDesc('Combine multiple modifications into a single event after inactivity')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.modifyBatchingEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.modifyBatchingEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(this.activityTrackingSection)
            .setName('Inactivity threshold')
            .setDesc('Record modifications after this period of inactivity (milliseconds)')
            .addSlider(slider => slider
                .setLimits(5000, 60000, 5000)
                .setValue(this.plugin.settings.modifyInactivityThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.modifyInactivityThreshold = value;
                    await this.plugin.saveSettings();
                }))
            .addText(text => text
                .setValue(String(this.plugin.settings.modifyInactivityThreshold))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 5000 && numValue <= 60000) {
                        this.plugin.settings.modifyInactivityThreshold = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(this.activityTrackingSection)
            .setName('Maximum batch duration')
            .setDesc('Maximum time to accumulate changes before forcing a record (milliseconds)')
            .addSlider(slider => slider
                .setLimits(60000, 600000, 60000)
                .setValue(this.plugin.settings.modifyMaxBatchDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.modifyMaxBatchDuration = value;
                    await this.plugin.saveSettings();
                }))
            .addText(text => text
                .setValue(String(this.plugin.settings.modifyMaxBatchDuration))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 60000 && numValue <= 600000) {
                        this.plugin.settings.modifyMaxBatchDuration = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        // Path filtering
        this.activityTrackingSection.createEl('h4', { text: 'Activity Tracking Filters' });

        // Include paths for activity tracking
        const includeActivityPathsSetting = new Setting(this.activityTrackingSection)
            .setName('Include paths')
            .setDesc('Only track files in these paths (one path per line, leave empty to include all)')
            .addTextArea(textarea => {
                this.setupTextarea(textarea);
                textarea.setValue(this.plugin.settings.activityTrackingIncludePaths.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.activityTrackingIncludePaths = this.parseTextareaLines(value);
                        await this.plugin.saveSettings();
                    });
            });
        this.activityFilterSettings.push(includeActivityPathsSetting);

        // Exclude paths for activity tracking
        const excludeActivityPathsSetting = new Setting(this.activityTrackingSection)
            .setName('Exclude paths')
            .setDesc('Do not track files in these paths (one path per line)')
            .addTextArea(textarea => {
                this.setupTextarea(textarea);
                textarea.setValue(this.plugin.settings.activityTrackingExcludePaths.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.activityTrackingExcludePaths = this.parseTextareaLines(value);
                        await this.plugin.saveSettings();
                    });
            });
        this.activityFilterSettings.push(excludeActivityPathsSetting);

        // Export Settings
        containerEl.createEl('h3', { text: 'Data Export Settings' });
        this.exportSettingsSection = containerEl.createDiv();

        new Setting(this.exportSettingsSection)
            .setName('Default export format')
            .setDesc('Format to use when exporting activity data')
            .addDropdown(dropdown => dropdown
                .addOption('csv', 'CSV')
                .addOption('json', 'JSON')
                .setValue(this.plugin.settings.defaultExportFormat)
                .onChange(async (value: 'json' | 'csv') => {
                    this.plugin.settings.defaultExportFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(this.exportSettingsSection)
            .setName('Auto-export schedule')
            .setDesc('Automatically export activity data on a schedule')
            .addDropdown(dropdown => dropdown
                .addOption('never', 'Never')
                .addOption('daily', 'Daily')
                .addOption('weekly', 'Weekly')
                .addOption('monthly', 'Monthly')
                .setValue(this.plugin.settings.autoExportSchedule)
                .onChange(async (value: 'never' | 'daily' | 'weekly' | 'monthly') => {
                    this.plugin.settings.autoExportSchedule = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(this.exportSettingsSection)
            .setName('Auto-export path')
            .setDesc('Path in your vault to save exported files (leave empty for root)')
            .addText(text => text
                .setValue(this.plugin.settings.autoExportPath)
                .setPlaceholder('Example: activity-logs/')
                .onChange(async (value) => {
                    this.plugin.settings.autoExportPath = value;
                    await this.plugin.saveSettings();
                }));

        // Export field selection
        const availableFields = [
            'timestamp', 'eventType', 'filePath', 'oldPath',
            'added', 'removed', 'wordCountBefore', 'wordCountAfter',
            'charCountBefore', 'charCountAfter'
        ];

        new Setting(this.exportSettingsSection)
            .setName('Export fields')
            .setDesc('Select which fields to include in exports')
            .setClass('export-fields-setting');

        const fieldContainer = this.exportSettingsSection.createDiv({ cls: 'export-fields-container' });

        for (const field of availableFields) {
            const fieldSetting = new Setting(fieldContainer)
                .setName(field)
                .setClass('export-field-item')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.exportFields.includes(field))
                    .onChange(async (value) => {
                        if (value && !this.plugin.settings.exportFields.includes(field)) {
                            this.plugin.settings.exportFields.push(field);
                        } else if (!value && this.plugin.settings.exportFields.includes(field)) {
                            this.plugin.settings.exportFields = this.plugin.settings.exportFields.filter(f => f !== field);
                        }
                        await this.plugin.saveSettings();
                    }));
        }

        // Add logging section
        containerEl.createEl('h3', { text: 'Logging' });

        new Setting(containerEl)
            .setName('Log Level')
            .setDesc('Set the level of logging detail. Higher levels include all lower levels. NONE disables logging.')
            .addDropdown(dropdown => dropdown
                .addOption(LogLevel.NONE.toString(), 'None')
                .addOption(LogLevel.ERROR.toString(), 'Error')
                .addOption(LogLevel.WARN.toString(), 'Warning')
                .addOption(LogLevel.INFO.toString(), 'Info')
                .addOption(LogLevel.DEBUG.toString(), 'Debug')
                .setValue(this.plugin.settings.logLevel.toString())
                .onChange(async (value) => {
                    this.plugin.settings.logLevel = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        // Initialize UI state based on current settings
        this.toggleActivitySettings(this.plugin.settings.enableActivityTracking);
    }

    // Helper method to toggle visibility of activity tracking settings
    private toggleActivitySettings(visible: boolean): void {
        const elements = this.activityTrackingSection.querySelectorAll('.event-tracking-settings, h4');
        elements.forEach(el => {
            (el as HTMLElement).style.display = visible ? '' : 'none';
        });

        this.activityFilterSettings.forEach(setting => {
            setting.settingEl.style.display = visible ? '' : 'none';
        });

        this.exportSettingsSection.style.display = visible ? '' : 'none';
    }

    // Helper method to toggle visibility of filter settings
    private toggleFilterSettings(visible: boolean): void {
        this.filterSettings.forEach(setting => {
            setting.settingEl.style.display = visible ? '' : 'none';
        });
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

    private async generateDashboard(): Promise<void> {
        try {
            await this.plugin.generateDashboard();
        } catch (error) {
            this.plugin.logger.error('Failed to generate dashboard:', error);
        }
    }

    private async updateDashboard(): Promise<void> {
        try {
            await this.plugin.generateDashboard();
        } catch (error) {
            this.plugin.logger.error('Failed to update dashboard:', error);
        }
    }

    // Add the donation section
    private addDonateSection(containerEl: HTMLElement): void {
        const donateDiv = containerEl.createDiv({ cls: 'daily-activity-donate-section' });

        const donateText = donateDiv.createEl('p');
        donateText.innerHTML = 'If you find this plugin useful, please consider supporting its development:';

        const donateLink = donateDiv.createEl('a', {
            cls: 'daily-activity-donate-link',
            href: 'https://ko-fi.com/trydalch',
            text: 'Support on Ko-fi'
        });
        donateLink.setAttr('target', '_blank');

        // Add some space after the donate section
        containerEl.createEl('hr');
    }
} 