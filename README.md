# Obsidian Activity Plugin

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/trydalch/obsidian-daily-activity?style=for-the-badge&sort=semver)](https://github.com/trydalch/obsidian-daily-activity/releases/latest)
![GitHub All Releases](https://img.shields.io/github/downloads/trydalch/obsidian-daily-activity/total?style=for-the-badge)

This is a plugin for Obsidian (https://obsidian.md).

This plugin is very young and written quickly, but can be used effectively with daily notes to keep a record of the work done and which files you continue to come back to.

Please open an issue for any bugs, feature requests, or feedback at https://github.com/trydalch/obsidian-daily-activity/issues/new

## Commands

| Command                                             | Description                                                                                                                                                                                                      |
|-----------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Links to Files Created from date to date            | Inserts a list of links to files created between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters. Supports natural language dates.                |
| Links to Files Modified from date to date           | Inserts a list of links to files modified between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters. Supports natural language dates.               |
| Plain Text List of Files Created from date to date  | Inserts a list of files created between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters. Supports natural language dates.                         |
| Plain Text List of Files Modified from date to date | Inserts a list of files modified between two dates. You can specify dates and filters in the modal window. The default is today and there are no filters. Supports natural language dates.                        |
| Stats for date                                      | Inserts a table with counts of files modified & files created by date. Defaults for today, but dates can be specified by selecting them in the editor. Supports natural language dates. See below for an example. |
| (Deprecated) Today's Stats                          | Inserts a table containing stats from today's writing activity. <br\> **Will be removed in future version**                                                                                                      |
| View Recent Activity Logs                           | Displays a formatted log of your recent activity from the last 24 hours, including event types and file changes.                                                                                                 |
| Daily Summary                                       | Inserts a summary of today's activity including total events, event types breakdown, and content changes.                                                                                                        |
| Weekly Overview                                     | Generates a comprehensive overview of your activity for the past 7 days, with daily breakdowns and weekly totals.                                                                                                |
| Today's Timeline                                    | Creates a chronological timeline of today's activity, organized by hour and event type.                                                                                                                          |
| Export Activity Data                                | Exports your activity data to CSV or JSON format with customizable date ranges and fields.                                                                                                                       |
| Generate Activity Dashboard                         | Creates a comprehensive dashboard with visualizations of your activity data.                                                                                                                                     |
| Refresh Dashboard                                   | Updates your activity dashboard with the latest data.                                                                                                                                                            |
| Clear Failed Operations                             | Clears any failed database operations that may have occurred during plugin operation.                                                                                                                            |

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

### Activity Tracking Settings

| Setting | Description |
|---------|-------------|
| Enable activity tracking | Turns on/off the detailed tracking of file events |
| Track file creation | When enabled, tracks creation of new files |
| Track file modification | When enabled, tracks modifications to existing files |
| Track file deletion | When enabled, tracks when files are deleted |
| Track file rename | When enabled, tracks when files are renamed |
| Content tracking debounce interval | The minimum time (in milliseconds) between content tracking events |
| Database write debounce interval | The minimum time (in milliseconds) between database writes |
| Activity tracking include paths | Paths to include in activity tracking |
| Activity tracking exclude paths | Paths to exclude from activity tracking |

### Batch Modification Settings

| Setting | Description |
|---------|-------------|
| Enable modification batching | When enabled, combines multiple modifications into a single event after inactivity |
| Inactivity threshold | Records modifications after this period of inactivity (in milliseconds) |

### Export Settings

| Setting | Description |
|---------|-------------|
| Default export format | Choose between CSV or JSON format for data exports |
| Auto-export schedule | Set to never, daily, weekly, or monthly |
| Auto-export path | Path in your vault to save exported files |
| Export fields | Select which fields to include in your exports |

### Dashboard Settings

| Setting | Description |
|---------|-------------|
| Enable dashboard | Turns on/off the activity dashboard feature |
| Dashboard path | The file path where the dashboard will be created |
| Auto-update dashboard | When enabled, automatically updates the dashboard at set intervals |
| Update interval (hours) | How often to automatically update the dashboard |
| Use Charts plugin | When enabled, uses the Obsidian Charts plugin for visualizations if available |

### Logging Settings

| Setting | Description |
|---------|-------------|
| Log level | Controls the verbosity of plugin logs |

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
- [ ] Add background file monitoring with detailed stats
- [ ] Implement memory optimizations for large vaults

## Future Features

### Enhanced Statistics Tracking (Coming in 1.0.0+)

The plugin will soon support advanced statistics tracking including:

1. **Writing Velocity Metrics**
   - Track words written per hour/day
   - Monitor your most productive times
   - Compare performance across different time periods

2. **File Interaction Analytics**
   - Identify your most frequently edited files
   - Track files with most additions/deletions
   - Analyze which files receive continuous attention vs. occasional edits

3. **Time Pattern Analysis**
   - Discover your most productive hours
   - Identify weekly activity patterns
   - Track long-term productivity trends

4. **Content Evolution Tracking**
   - Monitor how files grow and mature over time
   - Analyze editing vs. adding content patterns
   - Track when files stabilize (editing decreases)

### Memory Optimizations for Large Vaults

For users with large vaults, we're planning several optimizations:

1. **Smart Content Tracking**
   - Configurable file size limits for detailed tracking
   - Metadata-only tracking for very large files
   - Efficient storage of file differences

2. **Adaptive Memory Management**
   - Automatically unload inactive files from memory
   - Prioritize actively edited files
   - Balance between tracking accuracy and memory usage

## For Developers

### Releasing a New Version

This plugin uses GitHub Actions to automate the release process. To release a new version:

1. Make sure your changes are committed to the feature branch
2. Merge your feature branch to master
3. Check out the master branch locally
4. Make sure you have no uncommitted changes
5. Run the release command:
   ```bash
   npm run release
   ```

This will:
- Build the plugin
- Bump the version number in package.json
- Update manifest.json and versions.json via the version script
- Create a git commit with all version changes
- Create a git tag
- Push the commit and tag to GitHub

The GitHub Action will automatically:
- Create a new release on GitHub
- Generate release notes
- Attach the necessary plugin files

For a major or minor version instead of a patch:
```bash
npm run release-minor
# or
npm run release-major
```

### Manual Version Process

If you need more control over the process:

1. Make sure all your changes are committed
2. Build the plugin:
   ```bash
   npm run build
   ```
3. Bump the version (creates a commit and tag):
   ```bash
   npm version patch  # or minor/major
   ```
4. Push changes and tags:
   ```bash
   git push --follow-tags
   ```
