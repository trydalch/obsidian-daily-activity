import { App, ButtonComponent, Modal, TextComponent } from 'obsidian';
import DateParser from '../DateParser';
import DailyActivityPlugin from '../main';

export default class ExportModal extends Modal {
    private onSubmit: (format: 'json' | 'csv', startDate?: number, endDate?: number, exportPath?: string, fields?: string[]) => void;
    private plugin: DailyActivityPlugin;

    constructor(app: App, plugin: DailyActivityPlugin, onSubmit: (format: 'json' | 'csv', startDate?: number, endDate?: number, exportPath?: string, fields?: string[]) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        const dateParser = new DateParser(this.plugin);

        // Format selection
        contentEl.createEl('h3', { text: 'Export Format' });
        const formatContainer = contentEl.createDiv();
        const formatSelect = new TextComponent(formatContainer)
            .setValue(this.plugin.settings.defaultExportFormat)
            .setPlaceholder('json or csv');

        // Date range
        contentEl.createEl('h3', { text: 'Date Range (Optional)' });
        contentEl.createEl('p', { text: 'Leave empty to export all data' });

        const dateContainer = contentEl.createDiv();
        const inputStartDateField = new TextComponent(dateContainer)
            .setPlaceholder('Start date (YYYY-MM-DD)');
        dateContainer.createEl('br');
        const inputEndDateField = new TextComponent(dateContainer)
            .setPlaceholder('End date (YYYY-MM-DD)');

        // Export path
        contentEl.createEl('h3', { text: 'Export Path (Optional)' });
        contentEl.createEl('p', { text: 'Leave empty to use default path' });
        const pathContainer = contentEl.createDiv();
        const exportPathField = new TextComponent(pathContainer)
            .setValue(this.plugin.settings.autoExportPath)
            .setPlaceholder('Example: activity-logs/');

        // Fields selection
        contentEl.createEl('h3', { text: 'Fields to Export (Optional)' });
        contentEl.createEl('p', { text: 'Leave empty to use default fields' });
        const fieldsContainer = contentEl.createDiv();
        const fieldsField = new TextComponent(fieldsContainer)
            .setValue(this.plugin.settings.exportFields.join(', '))
            .setPlaceholder('timestamp, eventType, filePath, etc.');

        // Submit button
        const submitBtn = new ButtonComponent(contentEl)
            .setButtonText('Export')
            .onClick(async () => {
                let startDate = null;
                let endDate = null;

                // Parse dates if provided
                const startDateStr = inputStartDateField.getValue().trim();
                const endDateStr = inputEndDateField.getValue().trim();

                if (startDateStr) {
                    const dateRange = dateParser.parseDate(startDateStr);
                    startDate = dateRange.start.valueOf();
                }

                if (endDateStr) {
                    const dateRange = dateParser.parseDate(endDateStr);
                    endDate = dateRange.end.valueOf();
                }

                // Parse fields if provided
                const fieldsStr = fieldsField.getValue().trim();
                const fields = fieldsStr ? fieldsStr.split(',').map(f => f.trim()) : undefined;

                // Call onSubmit with gathered data
                this.onSubmit(
                    formatSelect.getValue() as 'json' | 'csv',
                    startDate,
                    endDate,
                    exportPathField.getValue().trim(),
                    fields
                );

                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 