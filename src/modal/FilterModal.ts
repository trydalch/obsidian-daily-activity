import {App, ButtonComponent, Modal, TextComponent} from 'obsidian';
import DateParser from 'src/DateParser';

export default class FilterModal extends Modal {
    constructor(app: App, public onSubmit: (fromDate: string, toDate: string, includeRegex: string[], excludeRegex: string[], includePaths: string[], excludePaths: string[]) => void) {
        super(app);
    }

    onOpen() {
        const titleElement = document.createElement('h3');
        titleElement.textContent = 'Filters';
        this.contentEl.appendChild(titleElement);

        const descriptionElement = document.createElement('p');
        descriptionElement.textContent = "Use filters as needed. Leave fields blank to skip filtering. Default date is 'today'.";
        descriptionElement.style.fontSize = '14px';
        this.contentEl.appendChild(descriptionElement);


        const dateParser = new DateParser();

        let inputFromDateField = new TextComponent(this.contentEl).setPlaceholder('From (any format)');
        let inputToDateField = new TextComponent(this.contentEl).setPlaceholder('To (any format)');
        let includeRegexField = new TextComponent(this.contentEl).setPlaceholder('Include regex (comma separated)');
        let excludeRegexField = new TextComponent(this.contentEl).setPlaceholder('Exclude regex (comma separated)');
        let includePathsField = new TextComponent(this.contentEl).setPlaceholder('Include paths (comma separated)');
        let excludePathsField = new TextComponent(this.contentEl).setPlaceholder('Exclude paths (comma separated)');

        const buttonContainer = this.contentEl.createDiv();
        buttonContainer.style.marginTop = '20px';

        new ButtonComponent(buttonContainer)
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
