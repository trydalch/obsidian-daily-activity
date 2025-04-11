import DailyActivityPlugin from 'src/main';
import { App, getLinkpath, MarkdownView, Plugin } from 'obsidian';
import { Moment } from 'moment';
import { HeaderFormatter } from './settings/HeaderFormatter';

export class ActivityLogger {
    app: App;
    plugin: Plugin;

    constructor(app: App, plugin: DailyActivityPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    private getLinks(moment: Moment, makeLink: boolean, includeRegex: string[] = [], excludeRegex: string[] = [], includePaths: string[] = [], excludePaths: string[] = [], statType: 'mtime' | 'ctime'): string[] {
        console.log(`Getting links for moment: ${moment.format()}, makeLink: ${makeLink}, statType: ${statType}`);
        return this.app.vault.getFiles()
            .filter(f => moment.isSame(new Date(f.stat[statType]), 'day') && this.fileMatchesFilters(f.path, includeRegex, excludeRegex, includePaths, excludePaths))
            .map(f => makeLink ? `[[${getLinkpath(f.path)}]]` : getLinkpath(f.path));
    }

    private getLinksToFilesModifiedOnDate(moment: Moment, makeLink = true, includeRegex: string[] = [], excludeRegex: string[] = [], includePaths: string[] = [], excludePaths: string[] = []): string[] {
        return this.getLinks(moment, makeLink, includeRegex, excludeRegex, includePaths, excludePaths, 'mtime');
    }

    private getLinksToFilesCreatedOnDate(moment: Moment, makeLink = true, includeRegex: string[] = [], excludeRegex: string[] = [], includePaths: string[] = [], excludePaths: string[] = []): string[] {
        return this.getLinks(moment, makeLink, includeRegex, excludeRegex, includePaths, excludePaths, 'ctime');
    }

    private isArrayNotEmptyAndNoEmptyStrings(arr: string[]): boolean {
        return arr.length > 0 && arr.every(item => item !== "");
    }

    private fileMatchesFilters(filePath: string, includeRegex: string[] = [], excludeRegex: string[] = [], includePaths: string[] = [], excludePaths: string[] = []): boolean {
        const matches = this.isArrayNotEmptyAndNoEmptyStrings(excludeRegex) && excludeRegex.some(regex => new RegExp(regex).test(filePath)) ? false :
            this.isArrayNotEmptyAndNoEmptyStrings(excludePaths) && excludePaths.some(part => filePath.includes(part)) ? false :
                (includeRegex.length === 0 || includeRegex.some(regex => new RegExp(regex).test(filePath))) &&
                (includePaths.length === 0 || includePaths.some(part => filePath.includes(part)));
        console.log(`File ${filePath} matches filters: ${matches}`);
        return matches;
    }

    appendLinksToContent(existingContent: string, links: string[], header: string, cursorOffset?: number): string {
        if (links.length === 0) {
            return existingContent;
        }

        const plugin = this.plugin as any;
        const settings = plugin.settings;

        let headerText = '';
        if (settings.includeHeader) {
            const currentMoment = window.moment();
            headerText = HeaderFormatter.formatHeader(settings.headerStyle, header, currentMoment) + '\n\n';
        }

        if (settings.insertLocation === 'cursor' && cursorOffset !== undefined) {
            // Insert at cursor position
            const contentToInsert = `\n\n${headerText}${links.join('\n')}\n`;
            const beforeCursor = existingContent.substring(0, cursorOffset);
            const afterCursor = existingContent.substring(cursorOffset);
            return `${beforeCursor}${contentToInsert}${afterCursor}`;
        } else {
            // Append at the end, ensuring there's a blank line before
            // Check if the existingContent already ends with newlines
            const endsWithNewline = existingContent.endsWith('\n');
            const endsWithTwoNewlines = existingContent.endsWith('\n\n');

            if (endsWithTwoNewlines) {
                return `${existingContent}${headerText}${links.join('\n')}\n`;
            } else if (endsWithNewline) {
                return `${existingContent}\n${headerText}${links.join('\n')}\n`;
            } else {
                return `${existingContent}\n\n${headerText}${links.join('\n')}\n`;
            }
        }
    }

    async insertActivityLog({
        insertCreatedOnDateFiles = false,
        insertModifiedOnDateFiles = false,
        moments = [window.moment()],
        activeView = null,
        makeLink = null,
        includeRegex = [],
        excludeRegex = [],
        includePaths = [],
        excludePaths = []
    }: {
        insertCreatedOnDateFiles?: boolean,
        insertModifiedOnDateFiles?: boolean,
        moments?: Moment[],
        activeView?: MarkdownView,
        makeLink?: boolean | null,
        includeRegex?: string[],
        excludeRegex?: string[],
        includePaths?: string[],
        excludePaths?: string[]
    }) {
        if (!activeView) return;
        let editor = activeView.editor;

        // Get cursor position
        const cursorPosition = editor.getCursor();
        // Convert cursor position to character offset
        const cursorOffset = editor.posToOffset(cursorPosition);

        // Use settings for makeLink if not explicitly provided
        const plugin = this.plugin as any;
        const settings = plugin.settings;
        const shouldMakeLink = makeLink !== null ? makeLink : settings.defaultLinkStyle === 'link';

        let content = await this.app.vault.read(activeView.file);
        let createdTodayLinks: string[] = [];

        // Filter out current note if set in settings
        const excludeCurrentNoteFilter = (filePath: string) => {
            if (settings.excludeCurrentNote && activeView && activeView.file) {
                return filePath !== activeView.file.path;
            }
            return true;
        };

        if (insertCreatedOnDateFiles) {
            createdTodayLinks = moments.flatMap(moment =>
                this.getLinksToFilesCreatedOnDate(moment, shouldMakeLink, includeRegex, excludeRegex, includePaths, excludePaths)
                    .filter(excludeCurrentNoteFilter)
            );
            content = this.appendLinksToContent(content, createdTodayLinks, 'Created', cursorOffset);
        }

        if (insertModifiedOnDateFiles) {
            let modifiedTodayLinks: string[] = moments.flatMap(moment =>
                this.getLinksToFilesModifiedOnDate(moment, shouldMakeLink, includeRegex, excludeRegex, includePaths, excludePaths)
                    .filter(excludeCurrentNoteFilter)
                    .filter(link => !createdTodayLinks.includes(link))
            );
            // If we've already inserted created links, we need to append to the end
            const adjustedCursorOffset = insertCreatedOnDateFiles ? undefined : cursorOffset;
            content = this.appendLinksToContent(content, modifiedTodayLinks, 'Modified', adjustedCursorOffset);
        }

        await this.app.vault.modify(activeView.file, content);
    }

    generateFileStatRow(moment: Moment, stats: string[]): string {
        // Get plugin settings for filters
        const plugin = this.plugin as any;
        const settings = plugin.settings;
        const { includeRegex, excludeRegex, includePaths, excludePaths } = settings;

        let row = `|${moment.format('YYYY-MM-DD')}|`;
        stats.forEach(stat => {
            let statValue = 0;
            if (stat === 'created') {
                statValue = this.getLinksToFilesCreatedOnDate(moment, false, includeRegex, excludeRegex, includePaths, excludePaths).length;
            } else if (stat === 'modified') {
                statValue = this.getLinksToFilesModifiedOnDate(moment, false, includeRegex, excludeRegex, includePaths, excludePaths).length;
            }
            row += `${statValue}|`;
        });
        return row;
    }


    generateFileStatHeader(stats: string[]): string {
        return `| Date |${stats.map(s => ` ${s.charAt(0).toUpperCase() + s.slice(1)} `).join('|')}|\n|-------|${stats.map(() => '----------').join('|')}|`;
    }

    async insertFileStats({
        stats = ['created', 'modified'],
        moments = [window.moment()],
        activeView = null,
        allTime = false
    }: { stats?: string[], moments?: Moment[], activeView?: MarkdownView, allTime?: boolean }) {
        if (!activeView) return;
        let editor = activeView.editor;

        // Get cursor position
        const cursorPosition = editor.getCursor();
        // Convert cursor position to character offset
        const cursorOffset = editor.posToOffset(cursorPosition);

        // Get plugin settings
        const plugin = this.plugin as any;
        const settings = plugin.settings;

        let content = await this.app.vault.read(activeView.file);
        let header = this.generateFileStatHeader(stats);
        let rows: string[] = moments.map(moment => this.generateFileStatRow(moment, stats));
        let table = `${header}\n${rows.join('\n')}`;

        // Insert table based on settings
        if (settings.insertLocation === 'cursor') {
            // Insert table at cursor position
            const beforeCursor = content.substring(0, cursorOffset);
            const afterCursor = content.substring(cursorOffset);
            const newContent = `${beforeCursor}\n${table}\n${afterCursor}`;
            await this.app.vault.modify(activeView.file, newContent);
        } else {
            // Append to the end, ensuring there's a blank line above
            const endsWithNewline = content.endsWith('\n');
            const endsWithTwoNewlines = content.endsWith('\n\n');

            let newContent;
            if (endsWithTwoNewlines) {
                newContent = `${content}${table}`;
            } else if (endsWithNewline) {
                newContent = `${content}\n${table}`;
            } else {
                newContent = `${content}\n\n${table}`;
            }

            await this.app.vault.modify(activeView.file, newContent);
        }
    }
}
