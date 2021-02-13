import DailyActivityPlugin from "src/main";
import moment from "moment";
import { App, MarkdownView, Plugin } from "obsidian";

export class ActivityLogger {

    app: App
    plugin: Plugin


    constructor(app: App, plugin: DailyActivityPlugin) {
        this.app = app
        this.plugin = plugin
    }



    private getLinksToFilesModifiedToday() {
        let files = this.app.vault.getFiles()
        let links: string[] = [];
        files.forEach(f => {
            if (moment().isSame(new Date(f.stat.mtime), 'day')) {
                links.push(`[[${f.basename}]]`);
            }
        });

        return links
    }

    private getLinksToFilesCreatedToday() {
        let files = this.app.vault.getFiles()
        let links: string[] = [];
        files.forEach(f => {
            if (moment().isSame(new Date(f.stat.ctime), 'day')) {
                links.push(`[[${f.basename}]]`);
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
        let activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
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