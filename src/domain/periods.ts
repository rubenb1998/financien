import { addDays, displayMonthYear, monthSpan, shiftMonth } from './dates.ts';
import type { Period, PeriodUnit, Statement } from './types.ts';

export const periodLabels = { year: 'Jaar', quarter: 'Kwartaal', month: 'Maand' };
export const periodUnits: PeriodUnit[] = ['year', 'quarter', 'month'];

const quarter = (month: string) => Math.ceil(Number(month.slice(5)) / 3);
const periodStart = ({ unit, month }: Period) => unit === 'month' ? month
  : unit === 'year' ? `${month.slice(0, 4)}-01`
  : `${month.slice(0, 4)}-${String(quarter(month) * 3 - 2).padStart(2, '0')}`;

export function periodLabel({ unit, month }: Period, includeYear = true) {
  const year = month.slice(0, 4);
  if (unit === 'year') return year;
  if (unit === 'quarter') return `K${quarter(month)}${includeYear ? ` ${year}` : ''}`;
  const label = displayMonthYear(month);
  return includeYear ? label : label.split(' ')[0];
}

export function periodBounds(period: Period) {
  const start = periodStart(period);
  const length = { month: 1, quarter: 3, year: 12 }[period.unit];
  return { from: `${start}-01`, to: addDays(`${shiftMonth(start, length)}-01`, -1) };
}

export type DateRange = Pick<Statement, 'from' | 'to'>;

export function availableMonths(statements: DateRange[]) {
  return [...new Set(statements.flatMap(({ from, to }) => monthSpan(from, to)))].sort();
}

export function periodChoices(unit: PeriodUnit, months: string[]) {
  const choices = new Map<string, Period>();
  for (const month of months) {
    const period = { unit, month };
    choices.set(periodStart(period), period);
  }
  return [...choices.values()];
}

export function periodNavigation(period: Period, months: string[]) {
  const start = periodStart(period);
  const choices = periodChoices(period.unit, months);
  return {
    previous: choices.findLast(choice => periodStart(choice) < start),
    next: choices.find(choice => periodStart(choice) > start),
  };
}

export function periodInYear(period: Period, year: string, months: string[]) {
  const options = months.filter(month => month.startsWith(year));
  const target = year + period.month.slice(4);
  const month = options.includes(target) ? target
    : options.findLast(month => periodStart({ ...period, month }) === periodStart({ ...period, month: target }))
      ?? options.at(-1) ?? target;
  return { ...period, month };
}

export function intersectDates(left: DateRange, right: DateRange): DateRange | undefined {
  const from = left.from > right.from ? left.from : right.from;
  const to = !right.to || (left.to && left.to < right.to) ? left.to : right.to;
  return from && to && from <= to ? { from, to } : undefined;
}

export function trendCalendar(period: Period | undefined, bounds: DateRange, covered: DateRange[]) {
  const unit = period?.unit === 'month' ? 'day' : 'month';
  const { from, to } = period ? periodBounds(period) : bounds;
  const dates = unit === 'day'
    ? Array.from({ length: Number(to.slice(-2)) }, (_, index) => addDays(from, index))
    : monthSpan(from, to);
  const buckets = dates.map(date => {
    const range = unit === 'day' ? { from: date, to: date } : periodBounds({ unit: 'month', month: date });
    return { date, covered: covered.some(statement => Boolean(intersectDates(statement, range))) };
  });
  return { unit, buckets } as const;
}

export type TrendCalendar = ReturnType<typeof trendCalendar>;
