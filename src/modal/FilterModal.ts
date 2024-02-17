import {App, ButtonComponent, Modal, TextComponent} from 'obsidian';
import DateParser from 'src/DateParser';

export default class FilterModal extends Modal {
    constructor(app: App, public onSubmit: (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => void) {
        super(app);
    }

    onOpen() {
        const dateParser = new DateParser(); // Создаем экземпляр DateParser

        let inputFromDateField = new TextComponent(this.contentEl).setPlaceholder('From (any format)');
        let inputToDateField = new TextComponent(this.contentEl).setPlaceholder('To (any format)');
        let includeRegexField = new TextComponent(this.contentEl).setPlaceholder('Include regex (comma separated)');
        let excludeRegexField = new TextComponent(this.contentEl).setPlaceholder('Exclude regex (comma separated)');
        let includePathsField = new TextComponent(this.contentEl).setPlaceholder('Include paths (comma separated)');
        let excludePathsField = new TextComponent(this.contentEl).setPlaceholder('Exclude paths (comma separated)');

        new ButtonComponent(this.contentEl)
            .setButtonText('Apply')
            .onClick(() => {
                let fromDate = dateParser.parseDate(inputFromDateField.getValue().trim());
                let toDate = dateParser.parseDate(inputToDateField.getValue().trim());
                const includeRegex = includeRegexField.getValue().split(',').map(s => s.trim());
                const excludeRegex = excludeRegexField.getValue().split(',').map(s => s.trim());
                const includePaths = includePathsField.getValue().split(',').map(s => s.trim());
                const excludePaths = excludePathsField.getValue().split(',').map(s => s.trim());

                fromDate = fromDate ? fromDate : new Date();
                toDate = toDate ? toDate : new Date();

                this.onSubmit(fromDate.toString(), toDate.toString(), includeRegex, excludeRegex, includePaths, excludePaths);
                this.close();
            });
    }
}
