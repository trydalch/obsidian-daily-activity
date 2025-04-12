/** @format */
import * as chrono from 'chrono-node'
import { Moment } from 'moment'
import { moment } from 'obsidian';
import DailyActivityPlugin from './main';

export interface DateRange {
    start: moment.Moment;
    end: moment.Moment;
}

export default class DateParser {
    private plugin: DailyActivityPlugin;

    constructor(plugin: DailyActivityPlugin) {
        this.plugin = plugin;
    }

    parseDateRangeFromSelection(selection: string): moment.Moment[] {
        const { start, end } = this.parseDateRange(selection);
        this.plugin.logger.debug('Start: ' + start);
        this.plugin.logger.debug('End: ' + end);

        const moments: moment.Moment[] = [];
        let next = start.clone();
        while (next.isSameOrBefore(end, 'day')) {
            this.plugin.logger.debug('Next: ' + next);
            moments.push(next.clone());
            next.add(1, 'day');
        }

        return moments;
    }

    public parseDateRange(input: string): DateRange {
        const { start, end } = this.parseRange(input);
        this.plugin.logger.debug('Start: ' + start);
        this.plugin.logger.debug('End: ' + end);

        return { start, end };
    }

    private parseRange(input: string): DateRange {
        this.plugin.logger.debug('entered parseDate with input: ', input);

        const parsed = this.parseDate(input);
        this.plugin.logger.debug('parsed: ', parsed);

        return parsed;
    }

    public parseDate(input: string): DateRange {
        try {
            // Handle 'today'
            if (input.toLowerCase() === 'today') {
                const start = moment().startOf('day');
                const end = moment().endOf('day');
                return { start, end };
            }

            // Handle 'yesterday'
            if (input.toLowerCase() === 'yesterday') {
                const start = moment().subtract(1, 'day').startOf('day');
                const end = moment().subtract(1, 'day').endOf('day');
                return { start, end };
            }

            // Handle 'this week'
            if (input.toLowerCase() === 'this week') {
                const start = moment().startOf('week');
                const end = moment().endOf('week');
                return { start, end };
            }

            // Handle 'last week'
            if (input.toLowerCase() === 'last week') {
                const start = moment().subtract(1, 'week').startOf('week');
                const end = moment().subtract(1, 'week').endOf('week');
                return { start, end };
            }

            // Handle 'this month'
            if (input.toLowerCase() === 'this month') {
                const start = moment().startOf('month');
                const end = moment().endOf('month');
                return { start, end };
            }

            // Handle 'last month'
            if (input.toLowerCase() === 'last month') {
                const start = moment().subtract(1, 'month').startOf('month');
                const end = moment().subtract(1, 'month').endOf('month');
                return { start, end };
            }

            // Handle date range (e.g., '2021-01-01 to 2021-01-31')
            if (input.toLowerCase().includes('to')) {
                const [startStr, endStr] = input.split('to').map(s => s.trim());
                const start = moment(startStr, 'YYYY-MM-DD').startOf('day');
                const end = moment(endStr, 'YYYY-MM-DD').endOf('day');
                return { start, end };
            }

            // Handle single date (e.g., '2021-01-01')
            const start = moment(input, 'YYYY-MM-DD').startOf('day');
            const end = moment(input, 'YYYY-MM-DD').endOf('day');
            return { start, end };
        } catch (exception) {
            this.plugin.logger.error(exception);
            throw exception;
        }
    }
}
