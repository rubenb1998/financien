import type { Statement } from './types.ts';

const dayMs = 86_400_000;
export const shortDate = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('nl-NL', { month: 'short', timeZone: 'UTC' });
const monthYearFormat = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const displayDate = (date: string) => shortDate.format(new Date(date));
export const displayMonth = (month: string) => monthFormat.format(new Date(`${month}-01`)).replace('.', '');
export const displayMonthYear = (month: string) => monthYearFormat.format(new Date(`${month}-01`));
export const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10);

export const todayInAmsterdam = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());

export function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function monthSpan(from: string, to: string) {
  if (!from || !to || from > to) return [];
  const months = [];
  for (let month = from.slice(0, 7); month <= to.slice(0, 7); month = shiftMonth(month, 1)) {
    months.push(month);
  }
  return months;
}

export function limitToMonth(from: string, to: string, month: string) {
  if (!month) return { from, to };
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  return { from: from > first ? from : first, to: to && to < last ? to : last };
}

export function coverage(statements: Statement[]) {
  const ordered = [...statements].sort((a, b) => a.from.localeCompare(b.from));
  return { from: ordered[0]?.from ?? '', to: ordered.map(row => row.to).sort().at(-1) ?? '' };
}

export function covers(statements: Statement[], from: string, to: string) {
  let cursor = from;
  for (const statement of [...statements].sort((a, b) => a.from.localeCompare(b.from))) {
    if (statement.from > cursor) return false;
    if (statement.to >= to) return true;
    if (statement.to >= cursor) cursor = addDays(statement.to, 1);
  }
  return false;
}

export function completeMonths(statements: Statement[]) {
  if (!statements.length) return [];
  const { from, to } = coverage(statements);
  const accounts = [...new Set(statements.map(row => row.accountId))];
  return monthSpan(from, to).filter(month => accounts.every(id => {
    const sources = statements.filter(row => row.accountId === id);
    return covers(sources, `${month}-01`, addDays(`${shiftMonth(month, 1)}-01`, -1));
  }));
}
