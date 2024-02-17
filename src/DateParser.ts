/** @format */
import * as chrono from 'chrono-node'
import {Moment} from 'moment'

export default class DateParser {
    parseDateRangeFromSelection(selection: string) {
        let moments: Moment[] = []
        const [start, end] = selection.split(' to ').map((s) => window.moment(this.parseDate(s)))
        console.debug('Start: ' + start)
        console.debug('End: ' + end)

        let next = start
        do {
            console.debug('Next: ' + next)
            moments.push(window.moment(next))
            next.add(1, 'd')
        } while (next.isSameOrBefore(end, 'day'))

        return moments
    }

    parseDate(input: string) {
        console.debug('entered parseDate with input: ', input)
        try {
            const parsed = chrono.parseDate(input)
            console.debug('parsed: ', parsed)

            return parsed
        } catch (exception) {
            console.error(exception)
        }
    }
}
