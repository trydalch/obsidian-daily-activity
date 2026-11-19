import { App, ButtonComponent, Modal, Notice, TextComponent } from 'obsidian';
import DateParser, { FilePeriod, rollingPeriod } from '../DateParser';
import DailyActivityPlugin from '../main';
import moment from 'moment';

export default class FilterModal extends Modal {
    private onSubmit: (periods: FilePeriod[], includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => void;
    private plugin: DailyActivityPlugin;

    constructor(app: App, plugin: DailyActivityPlugin, onSubmit: (periods: FilePeriod[], includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        const dateParser = new DateParser(this.plugin);

        // Date range
        contentEl.createEl('h3', { text: 'Date Range' });
        contentEl.createEl('p', {
            text: 'Leave both fields empty for today. For a rolling period, use digits for the number of hours or days. '
                + 'Enter a phrase like “last 12 hours” or “past 3 days” in the first field and leave the second empty.'
        });

        const dateContainer = contentEl.createDiv();
        const inputFromDateField = new TextComponent(dateContainer)
            .setPlaceholder('From date or period');
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

                const rolling = rollingPeriod(fromDateStr);
                let periods: FilePeriod[];
                if (rolling) {
                    if (toDateStr) {
                        new Notice('Leave the end date empty for a rolling period.');
                        return;
                    }
                    periods = [rolling];
                } else {
                    const today = moment().format('YYYY-MM-DD');
                    const from = fromDateStr ? dateParser.parseDate(fromDateStr).start.format('YYYY-MM-DD') : today;
                    const to = toDateStr ? dateParser.parseDate(toDateStr).end.format('YYYY-MM-DD') : today;
                    periods = dateParser.parseDateRangeFromSelection(`${from} to ${to}`);
                }

                // Parse filters
                const includeRegex = includeRegexField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const excludeRegex = excludeRegexField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const includePaths = includePathsField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const excludePaths = excludePathsField.getValue().split('\n').map(s => s.trim()).filter(s => s.length > 0);

                this.onSubmit(periods, includeRegex, excludeRegex, includePaths, excludePaths);
                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
