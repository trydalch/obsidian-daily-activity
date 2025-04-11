import { Moment } from "moment";

export class HeaderFormatter {
    static formatHeader(template: string, type: string, date: Moment): string {
        return template
            .replace('{type}', type)
            .replace('{date}', date.format('YYYY-MM-DD'));
    }
} 