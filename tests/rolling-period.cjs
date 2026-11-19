// Run from the repository root with node tests/rolling-period.cjs.
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const moment = require('moment');

// Obsidian provides these classes at runtime. Exercise the registered commands
// against an in-memory vault with the same timestamps on every run.
const fields = [];
let apply;
const el = {createEl() {}, createDiv() { return this; }, empty() {}};
const obsidian = {
    moment, Plugin: class {}, PluginSettingTab: class {}, MarkdownView: class {},
    Modal: class {
        constructor() { this.contentEl = el; }
        open() { this.onOpen(); }
        close() { this.onClose(); }
    },
    TextComponent: class {
        constructor() { this.value = ''; fields.push(this); }
        setPlaceholder() { return this; }
        getValue() { return this.value; }
    },
    ButtonComponent: class {
        setButtonText() { return this; }
        onClick(fn) { apply = fn; return this; }
    },
    getLinkpath: p => p.replace(/\.md$/, ''),
};
const sources = new Map();
function load(file) {
    file = path.resolve(file + '.ts');
    if (sources.has(file)) return sources.get(file);
    const exports = {};
    sources.set(file, exports);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    }}).outputText;
    const resolve = id => id === 'obsidian' ? obsidian : id.startsWith('src/') ? load(id)
        : id.startsWith('.') ? load(path.join(path.dirname(file), id)) : require(id);
    new Function('require', 'exports', js)(resolve, exports);
    return exports;
}
global.window = {moment};
moment.now = () => new Date(2026, 10, 19, 2).getTime();
const Plugin = load('src/main').default;
const {ActivityLogger} = load('src/ActivityLogger');
const now = moment.now();
const hours = 3600000;
const files = [['old', -6], ['before', -5 - 1 / hours], ['start', -5], ['night', -1],
    ['end', 0], ['future', 1 / hours]].map(([name, offset]) => ({
    path: name + '.md', stat: {ctime: now + offset * hours, mtime: now - 10 * hours},
}));
files[0].stat.mtime = now - hours;

async function run(id, selection, dialog = false, headerStyle) {
    const plugin = new Plugin();
    let text;
    const view = {file: {path: 'report.md'}, editor: {
        getCursor() {}, posToOffset() { return 0; },
        somethingSelected: () => Boolean(selection), getSelection: () => selection,
    }};
    plugin.app = {workspace: {getActiveViewOfType: () => view}, vault: {
        getFiles: () => files, read: async () => '', modify: async (_, value) => { text = value; },
    }};
    plugin.logger = {debug() {}};
    plugin.settings = {showFilterDialog: dialog, includePaths: [], excludePaths: [],
        includeRegex: [], excludeRegex: [], includeHeader: Boolean(headerStyle), headerStyle};
    plugin.activityLogger = new ActivityLogger(plugin.app, plugin);
    const commands = {};
    plugin.addCommand = c => { commands[c.id] = c; };
    plugin.addCommands();
    fields.length = 0;
    commands[id].checkCallback(false);
    if (dialog) { fields[0].value = selection; await apply(); }
    await new Promise(resolve => setImmediate(resolve));
    return text.trim().split('\n').filter(Boolean);
}
(async () => {
    for (const dialog of [false, true]) {
        const template = '## Files {type} on {date}';
        assert.equal((await run('links-to-files-created-today', 'last 5 hours', dialog, template))[0],
            '## Files Created on 2026-11-18 21:00 – 2026-11-19 02:00');
        assert.equal((await run('files-modified-today', 'last 5 hours', dialog, '{type} | {date}'))[0],
            'Modified | 2026-11-18 21:00 – 2026-11-19 02:00');
        assert.equal((await run('files-created-today', '', dialog, template))[0], '## Files Created on 2026-11-19');
        assert.deepEqual(await run('links-to-files-created-today', 'last 5 hours', dialog), ['[[start]]','[[night]]','[[end]]']);
        assert.deepEqual(await run('files-modified-today', 'last 5 hours', dialog), ['old']);
        assert.deepEqual(await run('files-created-today', 'last 1 day', dialog), ['old','before','start','night','end']);
        assert.deepEqual(await run('files-created-today', '', dialog), ['night','end','future']);
    }
    console.log('All rolling-period command checks passed.');
})().catch(err => { console.error(err); process.exitCode = 1; });
