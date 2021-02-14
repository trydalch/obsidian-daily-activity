import DailyActivityPlugin from "src/main";
import { App, getLinkpath, MarkdownView, Plugin } from "obsidian";

export class ActivityLogger {

    app: App
    plugin: Plugin
    moment: any


    constructor(app: App, plugin: DailyActivityPlugin) {
        this.app = app
        this.plugin = plugin
    }

    private getLinksToFilesModifiedToday() {
        let files = this.app.vault.getFiles()
        let links: string[] = [];
        files.forEach(f => {
            if (this.moment.isSame(new Date(f.stat.mtime), 'day')) {
                links.push(`[[${getLinkpath(f.path)}]]`);
            }
        });

        return links
    }

    private getLinksToFilesCreatedToday() {
        let files = this.app.vault.getFiles()
        let links: string[] = [];
        files.forEach(f => {
            if (this.moment.isSame(new Date(f.stat.ctime), 'day')) {
                links.push(`[[${getLinkpath(f.path)}]]`);
            }
        });

        return links
    }

    appendLinksToContent(existingContent: string, links: string[], header: string) {
        return existingContent +  `

## ${header} Today: 
${links.join('\n')}
`
    }

    async insertActivityLog({insertCreatedToday = false, insertModifiedToday = false}) {
        this.moment = window.moment();

        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (activeView == null) {
            return;
        }
        let editor = activeView.sourceMode.cmEditor;
        let doc = editor.getDoc();

        let content = await this.app.vault.read(activeView.file)
        let createdTodayLinks: string[] = []
        if (insertCreatedToday) {
            createdTodayLinks = this.getLinksToFilesCreatedToday();
            content = this.appendLinksToContent(content, createdTodayLinks, 'Created')
        }
        if (insertModifiedToday) {
            let modifiedTodayLinks: string[] = this.getLinksToFilesModifiedToday().filter(link => createdTodayLinks.indexOf(link) === -1);
            content = this.appendLinksToContent(content, modifiedTodayLinks, 'Modified')
        }
        
        
        await this.app.vault.modify(activeView.file, content);
    }
}