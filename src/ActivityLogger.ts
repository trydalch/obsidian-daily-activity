import DailyActivityPlugin from 'src/main';
import { App, getLinkpath, MarkdownView, Plugin } from 'obsidian';
import { Moment } from 'moment';

export class ActivityLogger {
  app: App;
  plugin: Plugin;

  constructor(app: App, plugin: DailyActivityPlugin) {
    this.app = app;
    this.plugin = plugin;
  }

  private getLinksToFilesModifiedOnDate(moment: Moment) {
    let files = this.app.vault.getFiles();
    let links: string[] = [];
    files.forEach((f) => {
      if (moment.isSame(new Date(f.stat.mtime), 'day')) {
        links.push(`[[${getLinkpath(f.path)}]]`);
      }
    });

    return links;
  }

  private getLinksToFilesCreatedOnDate(moment: Moment) {
    let files = this.app.vault.getFiles();
    let links: string[] = [];
    files.forEach((f) => {
      if (moment.isSame(new Date(f.stat.ctime), 'day')) {
        links.push(`[[${getLinkpath(f.path)}]]`);
      }
    });

    return links;
  }

  appendLinksToContent(existingContent: string, links: string[], header: string) {
    return (
      existingContent +
      `

## ${header} Today: 
${links.join('\n')}
`
    );
  }

  async insertActivityLog({
    insertCreatedToday = false,
    insertModifiedToday = false,
    moment = window.moment(),
    activeView = null,
  }: {
    insertCreatedToday?: boolean;
    insertModifiedToday?: boolean;
    moment?: any;
    activeView?: MarkdownView;
  }) {
    if (activeView == null) {
      return;
    }
    let editor = activeView.sourceMode.cmEditor;
    let doc = editor.getDoc();

    let content = await this.app.vault.read(activeView.file);
    let createdTodayLinks: string[] = [];
    if (insertCreatedToday) {
      createdTodayLinks = this.getLinksToFilesCreatedOnDate(moment);
      content = this.appendLinksToContent(content, createdTodayLinks, 'Created');
    }
    if (insertModifiedToday) {
      let modifiedTodayLinks: string[] = this.getLinksToFilesModifiedOnDate(moment).filter(
        (link) => createdTodayLinks.indexOf(link) === -1
      );
      content = this.appendLinksToContent(content, modifiedTodayLinks, 'Modified');
    }

    await this.app.vault.modify(activeView.file, content);
  }

  async insertFileStats({
    stats = ['created', 'modified'],
    moment = window.moment(),
    activeView = null,
    allTime = false
  }: {
    stats?: string[];
    moment?: any;
    activeView?: MarkdownView;
    allTime?: boolean
  }) {
    if (activeView == null) {
      return;
    }

    let content = await this.app.vault.read(activeView.file);

    let header =
      `| Date |` +
      stats.join(' | ') +
      `|
|-------|${stats.map((s) => '----------').join('|')}|`;
    let table = header;
    let row = `|${window.moment(moment).format('YYYY-MM-DD')}|`;
    stats.forEach((stat) => {
      let statValue;
      if (stat == 'created') {
        statValue = this.getLinksToFilesCreatedOnDate(moment).length;
      }
      if (stat == 'modified') {
        statValue = this.getLinksToFilesModifiedOnDate(moment).length;
      }

      row = row + `${statValue}|`;
    });

    table =
      table +
      `
${row}`;

    let newContent =
      content +
      `

${table}`;
    await this.app.vault.modify(activeView.file, newContent);
  }
}
