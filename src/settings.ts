import { LogLevel } from './Logger';

export interface DailyActivitySettings {
    trackingEnabled: boolean;
    excludeFolders: string[];
    excludeFiles: string[];
    commandsVisible: boolean;
    activityLogDirectory: string;
    dataRetentionDays: number;
    dashboardEnabled: boolean;
    dashboardPath: string;
    dashboardAutoUpdate: boolean;
    dashboardUpdateTime: string;
    useChartsPlugin: boolean;
    logLevel: LogLevel;
}

export const DEFAULT_SETTINGS: DailyActivitySettings = {
    trackingEnabled: true,
    excludeFolders: [],
    excludeFiles: [],
    commandsVisible: true,
    activityLogDirectory: 'activity_logs',
    dataRetentionDays: 30,
    dashboardEnabled: true,
    dashboardPath: 'activity_dashboard',
    dashboardAutoUpdate: true,
    dashboardUpdateTime: '23:00',
    useChartsPlugin: true,
    logLevel: LogLevel.INFO
} 