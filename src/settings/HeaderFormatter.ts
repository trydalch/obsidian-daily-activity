import type { FilePeriod } from '../DateParser';

export class HeaderFormatter {
    static formatHeader(template: string, type: string, period: FilePeriod): string {
        const date = 'start' in period
            ? `${period.start.format('YYYY-MM-DD HH:mm')} – ${period.end.format('YYYY-MM-DD HH:mm')}`
            : period.format('YYYY-MM-DD');
        return template
            .replace('{type}', type)
            .replace('{date}', date);
    }
} 