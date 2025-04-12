import { App, TFile } from 'obsidian';
import { ActivityDatabase, FileEvent } from '../database/ActivityDatabase';
import DailyActivityPlugin from '../main';

export interface DashboardSection {
    title: string;
    content: string;
}

export class DashboardGenerator {
    private app: App;
    private database: ActivityDatabase;
    private plugin: DailyActivityPlugin;
    private chartsPluginAvailable: boolean = false;

    constructor(app: App, database: ActivityDatabase, plugin: DailyActivityPlugin) {
        this.app = app;
        this.database = database;
        this.plugin = plugin;
        this.checkChartsPluginAvailability();
    }

    /**
     * Check if the Obsidian Charts plugin is installed and enabled
     */
    private checkChartsPluginAvailability(): void {
        // Log all installed plugins to help with debugging
        this.plugin.logger.debug('Checking for Charts plugin...');

        try {
            // @ts-ignore - Obsidian API has plugins property but TypeScript definition may not include it
            const pluginList = Object.keys(this.app.plugins?.plugins || {});
            this.plugin.logger.debug('All installed plugins:', pluginList);

            // Check if the app has the communityPluginsController
            // @ts-ignore - Accessing internal API
            const communityPlugins = this.app.plugins?.enabledPlugins;
            if (communityPlugins) {
                this.plugin.logger.debug('Enabled community plugins:', Array.from(communityPlugins));
            }

            // The plugin ID might be different from 'charts' - check for common variations
            const possiblePluginIds = ['charts', 'obsidian-charts', 'chart', 'obsidian-chart'];

            // Check if any of the possible IDs are found
            for (const id of possiblePluginIds) {
                // @ts-ignore - Obsidian API has plugins property but TypeScript definition may not include it
                if (this.app.plugins?.plugins?.hasOwnProperty(id)) {
                    this.plugin.logger.debug(`Charts plugin found with ID: ${id}`);
                    this.chartsPluginAvailable = true;
                    return;
                }

                // Also check in the enabled plugins set
                // @ts-ignore - Accessing internal API
                if (communityPlugins && communityPlugins.has(id)) {
                    this.plugin.logger.debug(`Charts plugin found in enabled plugins with ID: ${id}`);
                    this.chartsPluginAvailable = true;
                    return;
                }
            }

            // Final check: Try to find a plugin with 'chart' in its name
            const chartRelatedPlugins = pluginList.filter(id =>
                id.toLowerCase().includes('chart')
            );

            if (chartRelatedPlugins.length > 0) {
                this.plugin.logger.debug('Found plugins that might be Charts plugin:', chartRelatedPlugins);
                // Check if any of these are enabled
                for (const id of chartRelatedPlugins) {
                    // @ts-ignore - Accessing internal API
                    if (communityPlugins && communityPlugins.has(id)) {
                        this.plugin.logger.debug(`Using Chart-related plugin with ID: ${id}`);
                        this.chartsPluginAvailable = true;
                        return;
                    }
                }
            }

            this.chartsPluginAvailable = false;
            this.plugin.logger.debug('Charts plugin not found among installed plugins');
        }
        catch (error) {
            this.plugin.logger.error('Error while checking for Charts plugin:', error);
            this.chartsPluginAvailable = false;
        }
    }

    /**
     * Determine if we should use the Charts plugin based on settings and availability
     */
    private shouldUseChartsPlugin(): boolean {
        return this.plugin.settings.useChartsPlugin && this.chartsPluginAvailable;
    }

    /**
     * Generate and save the dashboard
     */
    public async generateDashboard(dashboardPath: string): Promise<void> {
        try {
            // Refresh charts plugin availability check
            this.checkChartsPluginAvailability();

            const content = await this.createDashboardContent();

            // Check if file exists
            const normalizedPath = this.normalizePath(dashboardPath);
            const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);

            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, content);
            } else {
                await this.app.vault.create(normalizedPath, content);
            }

            this.plugin.logger.info(`Dashboard generated successfully at ${normalizedPath}`);
        } catch (error) {
            this.plugin.logger.error('Failed to generate dashboard:', error);
            throw error;
        }
    }

    /**
     * Create the dashboard content with various visualizations
     */
    private async createDashboardContent(): Promise<string> {
        // Gather data for the dashboard
        const allEvents = await this.database.getAllEvents();
        const allFileStats = await this.database.getAllFileStats();

        // Get the date range
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const last30DaysEvents = allEvents.filter(event =>
            event.timestamp >= thirtyDaysAgo.getTime() && event.timestamp <= now.getTime()
        );

        // Generate dashboard sections
        const sections: DashboardSection[] = [
            this.createHeader(),
            await this.createActivitySummary(last30DaysEvents, allFileStats),
            await this.createTopFilesSection(allFileStats),
            await this.createTimeDistributionSection(last30DaysEvents),
            await this.createActivityHeatmap(last30DaysEvents),
            await this.createActivityTrendsSection(last30DaysEvents),
            await this.createWritingPatternsSection(last30DaysEvents)
        ];

        // Combine all sections
        return sections.map(section => {
            return `# ${section.title}\n\n${section.content}\n\n`;
        }).join('---\n\n');
    }

    /**
     * Create the dashboard header section
     */
    private createHeader(): DashboardSection {
        const now = new Date();
        let content = `*Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}*

> [!button] Refresh Dashboard
> \`\`\`command
> daily-activity: Refresh dashboard
> \`\`\`

This dashboard provides visualizations and insights from your Obsidian activity data.`;

        if (this.shouldUseChartsPlugin()) {
            content += ` Advanced charts are rendered using the Charts plugin.`;
        } else {
            content += ` Charts use Mermaid.js and are compatible with Obsidian's built-in rendering.`;
        }

        content += `

> [!NOTE]
> This dashboard is automatically generated by the Daily Activity plugin. Manual edits will be overwritten when the dashboard is updated.`;

        // Add warning that dashboard edits are not tracked
        content += `

> [!info] Activity Tracking Notice
> This dashboard is excluded from activity tracking. Any changes you make to this file will not affect your activity metrics.`;

        if (this.plugin.settings.useChartsPlugin && !this.chartsPluginAvailable) {
            content += `

> [!WARNING]
> You have enabled Charts plugin integration, but the Charts plugin is not installed or enabled. Install the "Obsidian Charts" plugin for enhanced visualizations.`;
        }

        return {
            title: "📊 Activity Dashboard",
            content: content
        };
    }

    /**
     * Create a summary of overall activity
     */
    private async createActivitySummary(events: FileEvent[], fileStats: any[]): Promise<DashboardSection> {
        // Calculate summary statistics
        const totalEvents = events.length;
        const createEvents = events.filter(e => e.eventType === 'create').length;
        const modifyEvents = events.filter(e => e.eventType === 'modify').length;
        const deleteEvents = events.filter(e => e.eventType === 'delete').length;
        const renameEvents = events.filter(e => e.eventType === 'rename').length;

        // Calculate content changes
        const totalAdded = events.reduce((sum, event) => sum + (event.contentDiff?.added || 0), 0);
        const totalRemoved = events.reduce((sum, event) => sum + (event.contentDiff?.removed || 0), 0);

        // Count unique files
        const uniqueFiles = new Set(events.map(e => e.filePath)).size;

        return {
            title: "Activity Summary (Last 30 Days)",
            content: `## Key Metrics

- **Total Events:** ${totalEvents}
- **Unique Files:** ${uniqueFiles}
- **Lines Added:** ${totalAdded}
- **Lines Removed:** ${totalRemoved}
- **Net Change:** ${totalAdded - totalRemoved} lines

## Event Breakdown

\`\`\`mermaid
pie
    title Event Types
    "Created" : ${createEvents}
    "Modified" : ${modifyEvents}
    "Deleted" : ${deleteEvents}
    "Renamed" : ${renameEvents}
\`\`\`

## Activity Snapshot

| Metric | Value |
|--------|-------|
| Most Active Day | ${this.getMostActiveDay(events)} |
| Most Active Hour | ${this.getMostActiveHour(events)} |
| Most Edited File | ${this.getMostEditedFile(fileStats)} |
| Average Daily Events | ${Math.round(totalEvents / 30)} |
| Average Edits Per File | ${Math.round(modifyEvents / (uniqueFiles || 1))} |`
        };
    }

    /**
     * Create a section showing top files by activity
     */
    private async createTopFilesSection(fileStats: any[]): Promise<DashboardSection> {
        // Filter out Untitled.md and similar files
        fileStats = fileStats.filter(file => {
            const fileName = file.filePath.split('/').pop();
            return fileName !== 'Untitled.md' && !fileName.startsWith('Untitled ');
        });

        // Ensure all stats have totalEdits initialized to 0 if undefined
        fileStats = fileStats.map(stat => ({
            ...stat,
            totalEdits: stat.totalEdits || 0,
            totalAdded: stat.totalAdded || 0,
            totalRemoved: stat.totalRemoved || 0
        }));

        // Sort by total edits
        const topEditedFiles = [...fileStats]
            .sort((a, b) => b.totalEdits - a.totalEdits)
            .slice(0, 10);

        // Sort by lines added
        const topAddedFiles = [...fileStats]
            .sort((a, b) => b.totalAdded - a.totalAdded)
            .slice(0, 10);

        // Create table of top edited files
        let topFilesTable = '## Top 10 Most Edited Files\n\n';
        topFilesTable += '| File | Edits | Lines Added | Lines Removed |\n';
        topFilesTable += '|------|-------|-------------|---------------|\n';

        topEditedFiles.forEach(file => {
            const fileName = file.filePath.split('/').pop().replace(/\.md$/, '');
            const fileLink = `[[${fileName}]]`;
            topFilesTable += `| ${fileLink} | ${file.totalEdits} | ${file.totalAdded} | ${file.totalRemoved} |\n`;
        });

        let chartSection = '';

        if (this.shouldUseChartsPlugin()) {
            // Create bar chart using Charts plugin
            chartSection = '## Top Files by Edit Count\n\n```chart\n';
            chartSection += 'type: bar\n';
            chartSection += 'labels: [';

            // Only include files that have edits
            const filesWithEdits = topEditedFiles
                .filter(file => file.totalEdits > 0)
                .slice(0, 5);

            const fileNames = filesWithEdits.map(file =>
                `"${file.filePath.split('/').pop().replace(/\.md$/, '').slice(0, 15)}"`
            );
            chartSection += fileNames.join(', ');
            chartSection += ']\n';

            chartSection += 'series:\n';
            chartSection += '  - title: Edits\n';
            chartSection += '    data: [';
            chartSection += filesWithEdits.map(file => file.totalEdits).join(', ');
            chartSection += ']\n';

            chartSection += 'tension: 0.2\n';
            chartSection += 'width: 80%\n';
            chartSection += 'labelColors: true\n';
            chartSection += 'beginAtZero: true\n';
            chartSection += '```\n\n';
        } else {
            // Create pie chart with Mermaid as fallback
            chartSection = '## Top Files by Edit Count\n\n```mermaid\npie\n';
            chartSection += '    title Top 5 Most Edited Files\n';

            // Only include files that have edits
            const filesWithEdits = topEditedFiles
                .filter(file => file.totalEdits > 0)
                .slice(0, 5);

            filesWithEdits.forEach(file => {
                const shortName = file.filePath.split('/').pop().replace(/\.md$/, '').slice(0, 15);
                chartSection += `    "${shortName}" : ${file.totalEdits}\n`;
            });

            chartSection += '```\n\n';
        }

        return {
            title: "Top Files Analysis",
            content: `${topFilesTable}\n\n${chartSection}`
        };
    }

    /**
     * Create a section showing activity distribution over time
     */
    private async createTimeDistributionSection(events: FileEvent[]): Promise<DashboardSection> {
        // Group events by day of week
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const eventsByDay: Record<string, number> = {};
        daysOfWeek.forEach(day => eventsByDay[day] = 0);

        events.forEach(event => {
            const date = new Date(event.timestamp);
            const day = daysOfWeek[date.getDay()];
            eventsByDay[day]++;
        });

        // Group events by hour
        const eventsByHour: Record<number, number> = {};
        for (let i = 0; i < 24; i++) {
            eventsByHour[i] = 0;
        }

        events.forEach(event => {
            const date = new Date(event.timestamp);
            const hour = date.getHours();
            eventsByHour[hour]++;
        });

        let dayChart = '';
        let hourChart = '';

        if (this.shouldUseChartsPlugin()) {
            // Day of week chart with Charts plugin
            dayChart = '## Activity by Day of Week\n\n```chart\n';
            dayChart += 'type: bar\n';
            dayChart += 'labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]\n';
            dayChart += 'series:\n';
            dayChart += '  - title: Events\n';
            dayChart += '    data: [';
            dayChart += daysOfWeek.map(day => eventsByDay[day]).join(', ');
            dayChart += ']\n';
            dayChart += 'width: 80%\n';
            dayChart += 'labelColors: true\n';
            dayChart += 'beginAtZero: true\n';
            dayChart += '```\n\n';

            // Hour of day chart with Charts plugin
            hourChart = '## Activity by Hour of Day\n\n```chart\n';
            hourChart += 'type: bar\n';
            hourChart += 'labels: [';

            const hourLabels = [];
            for (let i = 0; i < 24; i += 2) {
                hourLabels.push(`"${i.toString().padStart(2, '0')}:00"`);
            }
            hourChart += hourLabels.join(', ');
            hourChart += ']\n';

            hourChart += 'series:\n';
            hourChart += '  - title: Events\n';
            hourChart += '    data: [';

            const hourData = [];
            for (let i = 0; i < 24; i += 2) {
                const sum = eventsByHour[i] + eventsByHour[i + 1];
                hourData.push(sum);
            }
            hourChart += hourData.join(', ');
            hourChart += ']\n';

            hourChart += 'width: 80%\n';
            hourChart += 'labelColors: true\n';
            hourChart += 'beginAtZero: true\n';
            hourChart += '```\n\n';
        } else {
            // Create day of week chart with Mermaid
            dayChart = '## Activity by Day of Week\n\n```mermaid\npie\n';
            dayChart += '    title Activity Distribution by Day\n';

            daysOfWeek.forEach(day => {
                dayChart += `    "${day.slice(0, 3)}" : ${eventsByDay[day]}\n`;
            });

            dayChart += '```\n\n';

            // Create hour chart with Mermaid
            hourChart = '## Activity by Hour of Day\n\n```mermaid\npie\n';
            hourChart += '    title Activity Distribution by Hour\n';

            for (let i = 0; i < 24; i += 4) {
                const hourLabel = i.toString().padStart(2, '0') + ':00';
                const hourCount = eventsByHour[i] + eventsByHour[i + 1] + eventsByHour[i + 2] + eventsByHour[i + 3];
                hourChart += `    "${hourLabel}-${(i + 3).toString().padStart(2, '0')}:59" : ${hourCount}\n`;
            }

            hourChart += '```\n\n';
        }

        return {
            title: "Time Distribution",
            content: `${dayChart}${hourChart}## Insights\n\n${this.describeDayPattern(eventsByDay, daysOfWeek)}\n\n${this.describeHourPattern(eventsByHour)}`
        };
    }

    /**
     * Create a heatmap showing activity patterns
     */
    private async createActivityHeatmap(events: FileEvent[]): Promise<DashboardSection> {
        // Create heatmap data structure (day x hour)
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const heatmapData: number[][] = [];

        for (let i = 0; i < 7; i++) {
            heatmapData.push(Array(24).fill(0));
        }

        // Populate heatmap data
        events.forEach(event => {
            const date = new Date(event.timestamp);
            const dayIndex = date.getDay();
            const hour = date.getHours();
            heatmapData[dayIndex][hour]++;
        });

        let heatmapContent = '';

        if (this.shouldUseChartsPlugin()) {
            // Create a custom heatmap visualization using Charts plugin
            heatmapContent = '```chart\n';
            heatmapContent += 'type: polarArea\n';
            heatmapContent += 'labels: ["Morning", "Afternoon", "Evening", "Night"]\n';
            heatmapContent += 'series:\n';

            // Create time period data for each day
            for (let day = 0; day < 7; day++) {
                const dayName = daysOfWeek[day].slice(0, 3);

                const morningSum = heatmapData[day].slice(5, 12).reduce((a, b) => a + b, 0);
                const afternoonSum = heatmapData[day].slice(12, 18).reduce((a, b) => a + b, 0);
                const eveningSum = heatmapData[day].slice(18, 24).reduce((a, b) => a + b, 0);
                const nightSum = heatmapData[day].slice(0, 5).reduce((a, b) => a + b, 0);

                heatmapContent += `  - title: ${dayName}\n`;
                heatmapContent += `    data: [${morningSum}, ${afternoonSum}, ${eveningSum}, ${nightSum}]\n`;
            }

            heatmapContent += 'width: 70%\n';
            heatmapContent += 'labelColors: true\n';
            heatmapContent += '```\n\n';

            // Daily breakdown table
            heatmapContent += '### Activity by Time of Day\n\n';
            heatmapContent += '| Day | Morning (5-11) | Afternoon (12-17) | Evening (18-23) | Night (0-4) | Total |\n';
            heatmapContent += '|-----|---------------|------------------|----------------|------------|-------|\n';

            for (let day = 0; day < 7; day++) {
                const dayName = daysOfWeek[day];
                const morningSum = heatmapData[day].slice(5, 12).reduce((a, b) => a + b, 0);
                const afternoonSum = heatmapData[day].slice(12, 18).reduce((a, b) => a + b, 0);
                const eveningSum = heatmapData[day].slice(18, 24).reduce((a, b) => a + b, 0);
                const nightSum = heatmapData[day].slice(0, 5).reduce((a, b) => a + b, 0);
                const dayTotal = morningSum + afternoonSum + eveningSum + nightSum;

                heatmapContent += `| ${dayName} | ${morningSum} | ${afternoonSum} | ${eveningSum} | ${nightSum} | ${dayTotal} |\n`;
            }
        } else {
            // Convert to Mermaid flowchart as heatmap isn't supported
            heatmapContent = '```mermaid\nflowchart TD\n';
            heatmapContent += '    title["Activity Heatmap (Day × Hour)"]\n';

            // Add a note explaining the visualization
            heatmapContent += '    note["Darker squares indicate more activity"]\n';
            heatmapContent += '    title --> note\n';

            // We'll create a simplified representation with colored nodes for each day/period
            const periods = ["Morning", "Afternoon", "Evening", "Night"];

            for (let day = 0; day < 7; day++) {
                const dayName = daysOfWeek[day].slice(0, 3);
                heatmapContent += `    ${dayName}["${dayName}"]\n`;

                // Create 4 time periods instead of 24 hours
                const morningSum = heatmapData[day].slice(5, 12).reduce((a, b) => a + b, 0);
                const afternoonSum = heatmapData[day].slice(12, 18).reduce((a, b) => a + b, 0);
                const eveningSum = heatmapData[day].slice(18, 24).reduce((a, b) => a + b, 0);
                const nightSum = heatmapData[day].slice(0, 5).reduce((a, b) => a + b, 0);

                const periodSums = [morningSum, afternoonSum, eveningSum, nightSum];

                for (let p = 0; p < 4; p++) {
                    const count = periodSums[p];
                    const fillColor = count === 0 ? "#ffffff" :
                        count < 5 ? "#d3d3d3" :
                            count < 10 ? "#a9a9a9" :
                                count < 20 ? "#696969" : "#2f4f4f";

                    heatmapContent += `    ${dayName}_${periods[p]}["${periods[p]}"]:::intensity${count > 20 ? 4 : count > 10 ? 3 : count > 5 ? 2 : count > 0 ? 1 : 0}\n`;
                    heatmapContent += `    ${dayName} --- ${dayName}_${periods[p]}\n`;
                }
            }

            // Add CSS classes for intensity levels
            heatmapContent += '    classDef intensity0 fill:#ffffff\n';
            heatmapContent += '    classDef intensity1 fill:#d3d3d3\n';
            heatmapContent += '    classDef intensity2 fill:#a9a9a9\n';
            heatmapContent += '    classDef intensity3 fill:#696969\n';
            heatmapContent += '    classDef intensity4 fill:#2f4f4f\n';

            heatmapContent += '```\n\n';
        }

        return {
            title: "Activity Heatmap",
            content: heatmapContent
        };
    }

    /**
     * Create a section showing activity trends over time
     */
    private async createActivityTrendsSection(events: FileEvent[]): Promise<DashboardSection> {
        // Group events by date and type
        const dateData: Record<string, { total: number, create: number, modify: number, delete: number, rename: number }> = {};
        const dates: string[] = [];

        // Generate dates for the last 30 days
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = this.formatDate(date);
            dates.push(dateStr);
            dateData[dateStr] = { total: 0, create: 0, modify: 0, delete: 0, rename: 0 };
        }

        // Count events by date and type
        events.forEach(event => {
            const dateStr = this.formatDate(new Date(event.timestamp));
            if (dateData[dateStr]) {
                dateData[dateStr].total++;
                dateData[dateStr][event.eventType]++;
            }
        });

        let trendsContent = '';

        if (this.shouldUseChartsPlugin()) {
            // Line chart with Charts plugin
            trendsContent = '## Activity Over Time\n\n```chart\n';
            trendsContent += 'type: line\n';
            trendsContent += 'labels: [';

            // Use every 3rd date as label to avoid crowding
            const dateLabels = [];
            for (let i = 0; i < dates.length; i += 3) {
                dateLabels.push(`"${dates[i].slice(5)}"`);  // MM-DD format
            }
            trendsContent += dateLabels.join(', ');
            trendsContent += ']\n';

            trendsContent += 'series:\n';

            // Total events line
            trendsContent += '  - title: Total\n';
            trendsContent += '    data: [';
            const totalData = [];
            for (let i = 0; i < dates.length; i += 3) {
                let sum = 0;
                for (let j = 0; j < 3 && i + j < dates.length; j++) {
                    sum += dateData[dates[i + j]].total;
                }
                totalData.push(sum);
            }
            trendsContent += totalData.join(', ');
            trendsContent += ']\n';

            // Created events line
            trendsContent += '  - title: Created\n';
            trendsContent += '    data: [';
            const createData = [];
            for (let i = 0; i < dates.length; i += 3) {
                let sum = 0;
                for (let j = 0; j < 3 && i + j < dates.length; j++) {
                    sum += dateData[dates[i + j]].create;
                }
                createData.push(sum);
            }
            trendsContent += createData.join(', ');
            trendsContent += ']\n';

            // Modified events line
            trendsContent += '  - title: Modified\n';
            trendsContent += '    data: [';
            const modifyData = [];
            for (let i = 0; i < dates.length; i += 3) {
                let sum = 0;
                for (let j = 0; j < 3 && i + j < dates.length; j++) {
                    sum += dateData[dates[i + j]].modify;
                }
                modifyData.push(sum);
            }
            trendsContent += modifyData.join(', ');
            trendsContent += ']\n';

            trendsContent += 'tension: 0.2\n';
            trendsContent += 'width: 90%\n';
            trendsContent += 'fill: false\n';
            trendsContent += 'beginAtZero: true\n';
            trendsContent += '```\n\n';

            // Pie chart for event types
            trendsContent += '## Event Type Distribution\n\n```chart\n';
            trendsContent += 'type: pie\n';
            trendsContent += 'labels: ["Created", "Modified", "Deleted", "Renamed"]\n';
            trendsContent += 'series:\n';
            trendsContent += '  - data: [';

            const createTotal = dates.reduce((sum, date) => sum + dateData[date].create, 0);
            const modifyTotal = dates.reduce((sum, date) => sum + dateData[date].modify, 0);
            const deleteTotal = dates.reduce((sum, date) => sum + dateData[date].delete, 0);
            const renameTotal = dates.reduce((sum, date) => sum + dateData[date].rename, 0);

            trendsContent += `${createTotal}, ${modifyTotal}, ${deleteTotal}, ${renameTotal}`;
            trendsContent += ']\n';

            trendsContent += 'width: 60%\n';
            trendsContent += 'labelColors: true\n';
            trendsContent += '```\n\n';
        } else {
            // Group data by week for better visualization with Mermaid
            const weeksData: Record<string, number> = {};
            const weekLabels: string[] = [];

            // Calculate weeks from dates
            for (let i = 0; i < dates.length; i += 7) {
                const weekStart = dates[i].slice(5); // MM-DD
                const weekEnd = i + 6 < dates.length ? dates[i + 6].slice(5) : dates[dates.length - 1].slice(5);
                const weekLabel = `${weekStart} to ${weekEnd}`;
                weekLabels.push(weekLabel);

                let weekSum = 0;
                for (let j = i; j < i + 7 && j < dates.length; j++) {
                    weekSum += dateData[dates[j]].total;
                }
                weeksData[weekLabel] = weekSum;
            }

            // Create a pie chart for weeks using Mermaid
            trendsContent = '## Activity Over Time\n\n```mermaid\npie\n';
            trendsContent += '    title Events by Week\n';

            for (const label of weekLabels) {
                trendsContent += `    "${label}" : ${weeksData[label]}\n`;
            }

            trendsContent += '```\n\n';

            // Add a pie chart for event types
            const eventTypes = {
                'Created': dates.reduce((sum, date) => sum + dateData[date].create, 0),
                'Modified': dates.reduce((sum, date) => sum + dateData[date].modify, 0),
                'Deleted': dates.reduce((sum, date) => sum + dateData[date].delete, 0),
                'Renamed': dates.reduce((sum, date) => sum + dateData[date].rename, 0)
            };

            trendsContent += '## Event Type Distribution\n\n```mermaid\npie\n';
            trendsContent += '    title Events by Type\n';

            for (const [type, count] of Object.entries(eventTypes)) {
                if (count > 0) {
                    trendsContent += `    "${type}" : ${count}\n`;
                }
            }

            trendsContent += '```\n\n';
        }

        // Add trend analysis
        trendsContent += '## Trend Analysis\n\n' + this.analyzeTrends(dateData);

        return {
            title: "Activity Trends",
            content: trendsContent
        };
    }

    /**
     * Create a section analyzing writing patterns
     */
    private async createWritingPatternsSection(events: FileEvent[]): Promise<DashboardSection> {
        // Filter to only modifications with content changes
        const modifyEvents = events.filter(e =>
            e.eventType === 'modify' && e.contentDiff &&
            (e.contentDiff.added > 0 || e.contentDiff.removed > 0)
        );

        if (modifyEvents.length === 0) {
            return {
                title: "Writing Patterns",
                content: "No content modification data available for analysis."
            };
        }

        // Analyze content changes
        const totalAdditions = modifyEvents.reduce((sum, e) => sum + e.contentDiff!.added, 0);
        const totalDeletions = modifyEvents.reduce((sum, e) => sum + e.contentDiff!.removed, 0);

        const avgAdditionsPerEdit = totalAdditions / modifyEvents.length;
        const avgDeletionsPerEdit = totalDeletions / modifyEvents.length;

        // Categorize edits by size
        const smallEdits = modifyEvents.filter(e => e.contentDiff!.added + e.contentDiff!.removed < 10).length;
        const mediumEdits = modifyEvents.filter(e => {
            const total = e.contentDiff!.added + e.contentDiff!.removed;
            return total >= 10 && total < 50;
        }).length;
        const largeEdits = modifyEvents.filter(e => e.contentDiff!.added + e.contentDiff!.removed >= 50).length;

        let writingContent = '## Content Changes\n\n';

        if (this.shouldUseChartsPlugin()) {
            // Edit size distribution with Charts plugin
            writingContent += '```chart\n';
            writingContent += 'type: pie\n';
            writingContent += 'labels: ["Small Edits (<10 lines)", "Medium Edits (10-49 lines)", "Large Edits (50+ lines)"]\n';
            writingContent += 'series:\n';
            writingContent += `  - data: [${smallEdits}, ${mediumEdits}, ${largeEdits}]\n`;
            writingContent += 'width: 60%\n';
            writingContent += 'labelColors: true\n';
            writingContent += '```\n\n';

            // Additions vs deletions chart
            writingContent += '```chart\n';
            writingContent += 'type: bar\n';
            writingContent += 'labels: ["Lines Added", "Lines Removed"]\n';
            writingContent += 'series:\n';
            writingContent += `  - data: [${totalAdditions}, ${totalDeletions}]\n`;
            writingContent += 'width: 50%\n';
            writingContent += 'labelColors: true\n';
            writingContent += 'beginAtZero: true\n';
            writingContent += '```\n\n';
        } else {
            // Edit size distribution with Mermaid
            writingContent += '```mermaid\npie\n';
            writingContent += '    title Edit Size Distribution\n';
            writingContent += `    "Small Edits (<10 lines)" : ${smallEdits}\n`;
            writingContent += `    "Medium Edits (10-49 lines)" : ${mediumEdits}\n`;
            writingContent += `    "Large Edits (50+ lines)" : ${largeEdits}\n`;
            writingContent += '```\n\n';

            // Simple stats table
            writingContent += '| Metric | Value |\n';
            writingContent += '|--------|-------|\n';
            writingContent += `| Total Lines Added | ${totalAdditions} |\n`;
            writingContent += `| Total Lines Removed | ${totalDeletions} |\n`;
            writingContent += `| Average Lines Added per Edit | ${avgAdditionsPerEdit.toFixed(1)} |\n`;
            writingContent += `| Average Lines Removed per Edit | ${avgDeletionsPerEdit.toFixed(1)} |\n\n`;
        }

        // Add writing style analysis
        writingContent += '## Writing Style Analysis\n\n';
        writingContent += this.analyzeWritingStyle(smallEdits, mediumEdits, largeEdits, avgAdditionsPerEdit, avgDeletionsPerEdit);

        return {
            title: "Writing Patterns",
            content: writingContent
        };
    }

    /**
     * Helper method to describe day of week patterns
     */
    private describeDayPattern(eventsByDay: Record<string, number>, daysOfWeek: string[]): string {
        const totalByDay = Object.values(eventsByDay);
        const maxDay = daysOfWeek[totalByDay.indexOf(Math.max(...totalByDay))];
        const minDay = daysOfWeek[totalByDay.indexOf(Math.min(...totalByDay))];

        const weekdayTotal = totalByDay[1] + totalByDay[2] + totalByDay[3] + totalByDay[4] + totalByDay[5];
        const weekendTotal = totalByDay[0] + totalByDay[6];

        if (weekdayTotal > weekendTotal * 2) {
            return `You are primarily active on weekdays, especially on ${maxDay}s`;
        } else if (weekendTotal > weekdayTotal) {
            return `You are more active on weekends than weekdays`;
        } else {
            return `You are most active on ${maxDay}s and least active on ${minDay}s`;
        }
    }

    /**
     * Helper method to describe hourly patterns
     */
    private describeHourPattern(eventsByHour: Record<number, number>): string {
        const hourlyTotals = Object.values(eventsByHour);
        const morningTotal = hourlyTotals.slice(5, 12).reduce((sum, count) => sum + count, 0);
        const afternoonTotal = hourlyTotals.slice(12, 18).reduce((sum, count) => sum + count, 0);
        const eveningTotal = hourlyTotals.slice(18, 24).reduce((sum, count) => sum + count, 0);
        const nightTotal = hourlyTotals.slice(0, 5).reduce((sum, count) => sum + count, 0);

        const timeBlocks = [
            { name: 'morning (5AM-12PM)', total: morningTotal },
            { name: 'afternoon (12PM-6PM)', total: afternoonTotal },
            { name: 'evening (6PM-12AM)', total: eveningTotal },
            { name: 'night (12AM-5AM)', total: nightTotal }
        ];

        timeBlocks.sort((a, b) => b.total - a.total);

        return `You are most active during the ${timeBlocks[0].name} and least active during the ${timeBlocks[3].name}`;
    }

    /**
     * Helper method to get the most active day
     */
    private getMostActiveDay(events: FileEvent[]): string {
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const eventsByDay: Record<string, number> = {};
        daysOfWeek.forEach(day => eventsByDay[day] = 0);

        events.forEach(event => {
            const date = new Date(event.timestamp);
            const day = daysOfWeek[date.getDay()];
            eventsByDay[day]++;
        });

        let maxDay = daysOfWeek[0];
        let maxCount = eventsByDay[maxDay];

        for (const day of daysOfWeek) {
            if (eventsByDay[day] > maxCount) {
                maxDay = day;
                maxCount = eventsByDay[day];
            }
        }

        return maxDay;
    }

    /**
     * Helper method to get the most active hour
     */
    private getMostActiveHour(events: FileEvent[]): string {
        const eventsByHour: Record<number, number> = {};
        for (let i = 0; i < 24; i++) {
            eventsByHour[i] = 0;
        }

        events.forEach(event => {
            const date = new Date(event.timestamp);
            const hour = date.getHours();
            eventsByHour[hour]++;
        });

        let maxHour = 0;
        let maxCount = eventsByHour[0];

        for (let hour = 1; hour < 24; hour++) {
            if (eventsByHour[hour] > maxCount) {
                maxHour = hour;
                maxCount = eventsByHour[hour];
            }
        }

        return `${maxHour}:00-${(maxHour + 1) % 24}:00`;
    }

    /**
     * Helper method to get the most edited file
     */
    private getMostEditedFile(fileStats: any[]): string {
        if (!fileStats || fileStats.length === 0) {
            return 'No data';
        }

        // Filter out Untitled files
        const filteredStats = fileStats.filter(file => {
            const fileName = file.filePath.split('/').pop();
            return fileName !== 'Untitled.md' && !fileName.startsWith('Untitled ');
        });

        if (filteredStats.length === 0) {
            return 'No data (excluding untitled files)';
        }

        const topFile = [...filteredStats].sort((a, b) => b.totalEdits - a.totalEdits)[0];
        const fileName = topFile.filePath.split('/').pop().replace(/\.md$/, '');
        return `[[${fileName}]] (${topFile.totalEdits} edits)`;
    }

    /**
     * Helper method to analyze trends
     */
    private analyzeTrends(dateData: Record<string, { total: number, create: number, modify: number, delete: number, rename: number }>): string {
        const dates = Object.keys(dateData).sort();

        // Calculate 7-day averages
        const firstWeekAvg = dates.slice(0, 7).reduce((sum, date) => sum + dateData[date].total, 0) / 7;
        const lastWeekAvg = dates.slice(-7).reduce((sum, date) => sum + dateData[date].total, 0) / 7;

        // Calculate percent change
        const percentChange = firstWeekAvg > 0
            ? Math.round(((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100)
            : 0;

        // Find most active day
        let maxDate = dates[0];
        let maxCount = dateData[maxDate].total;

        for (const date of dates) {
            if (dateData[date].total > maxCount) {
                maxDate = date;
                maxCount = dateData[date].total;
            }
        }

        // Check for consistent patterns
        const hasConsistentActivity = dates.filter(date => dateData[date].total > 0).length > dates.length * 0.7;

        let analysis = `- **Activity Trend:** Your activity has `;
        if (percentChange > 10) {
            analysis += `increased by ${percentChange}% over the last month`;
        } else if (percentChange < -10) {
            analysis += `decreased by ${Math.abs(percentChange)}% over the last month`;
        } else {
            analysis += `remained relatively stable over the last month`;
        }

        analysis += `\n- **Peak Activity:** Your most active day was ${maxDate} with ${maxCount} events`;

        if (hasConsistentActivity) {
            analysis += `\n- **Consistency:** You have consistent daily activity in Obsidian`;
        } else {
            analysis += `\n- **Consistency:** Your activity pattern shows some gaps or inconsistency`;
        }

        return analysis;
    }

    /**
     * Helper method to analyze writing style
     */
    private analyzeWritingStyle(smallEdits: number, mediumEdits: number, largeEdits: number, avgAdded: number, avgRemoved: number): string {
        const totalEdits = smallEdits + mediumEdits + largeEdits;

        if (totalEdits === 0) {
            return "Insufficient data to analyze writing style.";
        }

        const smallEditsPct = Math.round((smallEdits / totalEdits) * 100);
        const mediumEditsPct = Math.round((mediumEdits / totalEdits) * 100);
        const largeEditsPct = Math.round((largeEdits / totalEdits) * 100);

        let style = "";

        // Determine primary style
        if (smallEditsPct > 60) {
            style += "- **Incremental Writer:** You tend to make many small edits, refining your content gradually.\n";
        } else if (largeEditsPct > 40) {
            style += "- **Bulk Writer:** You often write large chunks of content at once, with significant additions.\n";
        } else {
            style += "- **Balanced Writer:** You have a mix of small tweaks and larger content additions.\n";
        }

        // Add editing style
        if (avgRemoved > avgAdded * 0.8) {
            style += "- **Extensive Editor:** You frequently revise and trim your writing, removing almost as much as you add.\n";
        } else if (avgRemoved < avgAdded * 0.3) {
            style += "- **Additive Writer:** You primarily add new content with minimal deletion of existing text.\n";
        } else {
            style += "- **Thoughtful Reviser:** You balance adding new content with revising existing material.\n";
        }

        // Add timeframe insights
        if (totalEdits / 30 > 3) {
            style += "- **Regular Contributor:** You edit your notes frequently, showing consistent engagement.\n";
        } else {
            style += "- **Focused Sessions:** You tend to edit in less frequent but possibly more concentrated sessions.\n";
        }

        return style;
    }

    /**
     * Format a date as YYYY-MM-DD
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Normalize a path to comply with Obsidian vault path structure
     */
    private normalizePath(path: string): string {
        // Ensure path doesn't start with a slash
        return path.startsWith('/') ? path.substring(1) : path;
    }
} 