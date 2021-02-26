# Obsidian Activity Plugin

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/trydalch/obsidian-daily-activity?style=for-the-badge&sort=semver)](https://github.com/trydalch/obsidian-daily-activity/releases/latest)
![GitHub All Releases](https://img.shields.io/github/downloads/trydalch/obsidian-daily-activity/total?style=for-the-badge)

This is a plugin for Obsidian (https://obsidian.md).

This plugin is very young and written quickly, but can be used effectively with daily notes to keep a record of the work done and which files you continue to come back to.

Please open an issue for any bugs, feature requests, or feedback at https://github.com/trydalch/obsidian-daily-activity/issues/new

## Commands

| Command                                 | Description|
| --------------------------------------- |  |
| Links to Files Created Today            |                                                                                                                                                                    |
| Links to Files Modified Today           |                                                                                                                                                                   |
| Plain Text List of Files Created Today  | Inserts a list of files created today|
| Plain Text List of Files Modified Today | Inserts a list of files modified today                                                                            |
| Stats for date                          | Inserts a table with counts of files modified & files created by date. Defaults for today, but dates can be specified by selecting them in the editor. Supports natural language dates See below for an example. |
| (Deprecated) Today's Stats              | Inserts a table containing stats from today's writing activity. <br\> \*\*Will be removed in future version\*\*|


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
- [ ] Add templating
- [ ] Add filtering stats by tag
