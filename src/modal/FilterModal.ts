import { App, ButtonComponent, Modal, TextComponent } from 'obsidian';
import DateParser from '../DateParser';
import DailyActivityPlugin from '../main';
import moment from 'moment';

export default class FilterModal extends Modal {
    private onSubmit: (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => void;
    private plugin: DailyActivityPlugin;

    constructor(app: App, plugin: DailyActivityPlugin, onSubmit: (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        const dateParser = new DateParser(this.plugin);

        // Date range
        contentEl.createEl('h3', { text: 'Date Range' });
        contentEl.createEl('p', { text: 'Leave empty to use today\'s date' });

        const dateContainer = contentEl.createDiv();
        const inputFromDateField = new TextComponent(dateContainer)
            .setPlaceholder('From date (YYYY-MM-DD)');
        dateContainer.createEl('br');
        const inputToDateField = new TextComponent(dateContainer)
            .setPlaceholder('To date (YYYY-MM-DD)');

        // Filters
        contentEl.createEl('h3', { text: 'Filters (Optional)' });
        contentEl.createEl('p', { text: 'One item per line' });

        // Include regex
        const includeRegexContainer = contentEl.createDiv();
        contentEl.createEl('h4', { text: 'Include Regex Patterns' });
        const includeRegexField = new TextComponent(includeRegexContainer)
            .setPlaceholder('Regex patterns to include');

        // Exclude regex
        const excludeRegexContainer = contentEl.createDiv();
        contentEl.createEl('h4', { text: 'Exclude Regex Patterns' });
        const excludeRegexField = new TextComponent(excludeRegexContainer)
            .setPlaceholder('Regex patterns to exclude');

        // Include paths
        const includePathsContainer = contentEl.createDiv();
        contentEl.createEl('h4', { text: 'Include Paths' });
        const includePathsField = new TextComponent(includePathsContainer)
            .setPlaceholder('Paths to include');

        // Exclude paths
        const excludePathsContainer = contentEl.createDiv();
        contentEl.createEl('h4', { text: 'Exclude Paths' });
        const excludePathsField = new TextComponent(excludePathsContainer)
            .setPlaceholder('Paths to exclude');

        // Submit button
        const submitBtn = new ButtonComponent(contentEl)
            .setButtonText('Apply Filters')
            .onClick(async () => {
                // Parse dates
                const fromDateStr = inputFromDateField.getValue().trim();
                const toDateStr = inputToDateField.getValue().trim();

                let fromDate = fromDateStr ? dateParser.parseDate(fromDateStr).start.format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
                let toDate = toDateStr ? dateParser.parseDate(toDateStr).end.format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');

                // Parse filters
                const includeRegex = includeRegexField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const excludeRegex = excludeRegexField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const includePaths = includePathsField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const excludePaths = excludePathsField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);

                this.onSubmit(fromDate, toDate, includeRegex, excludeRegex, includePaths, excludePaths);
                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
