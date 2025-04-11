# Obsidian Activity Plugin

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/trydalch/obsidian-daily-activity?style=for-the-badge&sort=semver)](https://github.com/trydalch/obsidian-daily-activity/releases/latest)
![GitHub All Releases](https://img.shields.io/github/downloads/trydalch/obsidian-daily-activity/total?style=for-the-badge)

This is a plugin for Obsidian (https://obsidian.md).

This plugin is very young and written quickly, but can be used effectively with daily notes to keep a record of the work done and which files you continue to come back to.

Please open an issue for any bugs, feature requests, or feedback at https://github.com/trydalch/obsidian-daily-activity/issues/new

## Commands

| Command                                             | Description                                                                                                                                                                                                      |
|-----------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Links to Files Created from date to date            | Inserts a list of links to files created  between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters.      Supports natural language dates.         |
| Links to Files Modified from date to date           | Inserts a list of links to files modified  between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters.      Supports natural language dates.        |
| Plain Text List of Files Created from date to date  | Inserts a list of files created between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters.  Supports natural language dates.                       |
| Plain Text List of Files Modified from date to date | Inserts a list of files modified between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters.         Supports natural language dates.               |
| Stats for date                                      | Inserts a table with counts of files modified & files created by date. Defaults for today, but dates can be specified by selecting them in the editor. Supports natural language dates See below for an example. |
| (Deprecated) Today's Stats                          | Inserts a table containing stats from today's writing activity. <br\> **Will be removed in future version**                                                                                                      |

## Settings

The plugin now includes settings to customize its behavior:

### General Settings

| Setting | Description |
|---------|-------------|
| Insert location | Choose whether to insert content at the cursor position or append to the end of the document |
| Default link style | Set whether to use wiki-style links or plain text by default |
| Include header | Toggle whether to include a header above inserted lists |
| Header template | Customize the header format. You can use {type} for file type (Created/Modified) and {date} for the date |
| Exclude current note | When enabled, excludes the current note from the generated lists |

### Filter Settings

| Setting | Description |
|---------|-------------|
| Show filter dialog | Controls whether to show the filter dialog when running commands. If enabled (default), you'll be prompted each time and the settings below will be disabled. If disabled, the plugin will use the filters defined below. |
| Include regex patterns | Files matching these regex patterns will be included in the results (only available when "Show filter dialog" is disabled) |
| Exclude regex patterns | Files matching these regex patterns will be excluded from the results (only available when "Show filter dialog" is disabled) |
| Include paths | Files containing these path segments will be included in the results (only available when "Show filter dialog" is disabled) |
| Exclude paths | Files containing these path segments will be excluded from the results (only available when "Show filter dialog" is disabled) |

## Examples
- **Stats for date**
  - No selection: Outputs stats for today
  - `yesterday`: Stats for yesterday
  - `2021-02-20`: Stats for 2021-02-20
  - `2021-02-15 to 2021-02-20`: Stats between those dates, inclusive range.
  - `5 days ago to today`: Stats for that range

  For more examples of natural language date formats, see here: https://github.com/wanasit/chrono

## Roadmap

- [x] Add Activity Stats Command (# files created, # modified)
- [x] Add option to insert stats for dates
- [x] Add stats for date range
- [x] Add support for natural language dates
- [x] Add settings page
- [x] Add filtering options
- [ ] Add templating
- [ ] Add filtering stats by tag
