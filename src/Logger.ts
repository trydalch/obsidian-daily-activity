import DailyActivityPlugin from './main';

export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4
}

export class Logger {
    private plugin: DailyActivityPlugin;

    constructor(plugin: DailyActivityPlugin) {
        this.plugin = plugin;
    }

    public debug(message: string, ...args: any[]) {
        if (this.plugin.settings.logLevel >= LogLevel.DEBUG) {
            console.debug(`[Daily Activity] ${message}`, ...args);
        }
    }

    public info(message: string, ...args: any[]) {
        if (this.plugin.settings.logLevel >= LogLevel.INFO) {
            console.info(`[Daily Activity] ${message}`, ...args);
        }
    }

    public warn(message: string, ...args: any[]) {
        if (this.plugin.settings.logLevel >= LogLevel.WARN) {
            console.warn(`[Daily Activity] ${message}`, ...args);
        }
    }

    public error(message: string, ...args: any[]) {
        if (this.plugin.settings.logLevel >= LogLevel.ERROR) {
            console.error(`[Daily Activity] ${message}`, ...args);
        }
    }
} 