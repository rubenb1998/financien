import { byCategory } from './analytics.ts';
import { groupOf } from './categories.ts';
import { addDays, completeMonths, monthSpan, shiftMonth } from './dates.ts';
import { summarize } from './ledger.ts';
import { periodBounds } from './periods.ts';
import type { DateRange } from './periods.ts';
import type { AccountBalance, Ledger, Statement, Transaction } from './types.ts';
import { isWork } from './work.ts';

export interface AccountHistory {
  id: string;
  label: string;
  latestStatement?: string;
  anchor?: AccountBalance;
  from: string;
  to: string;
  daily: Map<string, number>;
}

export interface BalanceSnapshot {
  date: string;
  amount: number;
}

function balanceWindow(statements: Statement[], date: string, today: string) {
  let from = date;
  let to = date;
  for (const statement of [...statements].sort((a, b) => a.from.localeCompare(b.from))) {
    if (statement.from <= addDays(to, 1) && statement.to > to) to = statement.to;
  }
  for (const statement of [...statements].sort((a, b) => b.to.localeCompare(a.to))) {
    if (statement.to >= from && statement.from <= from) from = addDays(statement.from, -1);
  }
  return { from, to: to > today ? today : to };
}

export function bankAccounts(ledger: Ledger, today: string): AccountHistory[] {
  const statements = Map.groupBy(ledger.statements.filter(row => row.source === 'bank'), row => row.accountId);
  const bookings = Map.groupBy(ledger.transactions.filter(row => row.source === 'bank'), row => row.accountId);
  const anchors = new Map((ledger.balances ?? []).map(anchor => [anchor.accountId, anchor]));
  const ids = new Set([...statements.keys(), ...anchors.keys()]);

  return [...ids].map(id => {
    const sources = (statements.get(id) ?? []).sort((a, b) => b.to.localeCompare(a.to));
    const latest = sources[0];
    const anchor = anchors.get(id);
    const label = latest?.label ?? anchor?.label ?? id;
    const daily = new Map<string, number>();
    if (!anchor || anchor.date > today) return { id, label, latestStatement: latest?.to, anchor, from: '', to: '', daily };
    const { from, to } = balanceWindow(sources, anchor.date, today);
    // Each raw booking changes only its own bank account, regardless of its analysis category.
    const movements = new Map<string, number>();
    for (const { date, amount } of bookings.get(id) ?? []) {
      if (date > from && date <= to) movements.set(date, (movements.get(date) ?? 0) + amount);
    }
    daily.set(anchor.date, anchor.amount);
    let amount = anchor.amount;
    for (let day = addDays(anchor.date, 1); day <= to; day = addDays(day, 1)) {
      amount += movements.get(day) ?? 0;
      daily.set(day, amount);
    }
    amount = anchor.amount;
    for (let day = anchor.date; day > from; day = addDays(day, -1)) {
      amount -= movements.get(day) ?? 0;
      daily.set(addDays(day, -1), amount);
    }
    return { id, label, latestStatement: latest?.to, anchor, from, to, daily };
  });
}

function balanceRange(accounts: AccountHistory[]) {
  const included = accounts.filter(account => account.to);
  const from = included.map(account => account.from).sort().at(-1);
  const to = included.map(account => account.to).sort()[0];
  if (!from || !to || from > to) return undefined;
  const amountAt = (date: string) => included.reduce((sum, account) => sum + account.daily.get(date)!, 0);
  return { from, to, amountAt };
}

export function latestBankBalance(accounts: AccountHistory[]) {
  const range = balanceRange(accounts);
  return range && { date: range.to, amount: range.amountAt(range.to), accounts: accounts.filter(account => account.to).length };
}

export function balanceTrend(accounts: AccountHistory[], days: number | undefined, from?: string, to?: string) {
  const range = balanceRange(accounts);
  if (!range) return [];
  const end = to && to < range.to ? to : range.to;
  if (end < range.from) return [];
  const start = [range.from, from ?? '', days === undefined ? '' : addDays(end, 1 - days)].sort().at(-1)!;
  const points: BalanceSnapshot[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    points.push({ date, amount: range.amountAt(date) });
  }
  return points;
}

export function savingsInsights(rows: Transaction[], statements: Statement[], today: string, rate: number | null, range?: DateRange) {
  const currentMonth = today.slice(0, 7);
  const complete = completeMonths(statements).filter(month => {
    if (month >= currentMonth) return false;
    if (!range) return true;
    const { from, to } = periodBounds({ unit: 'month', month });
    return (!range.from || from >= range.from) && (!range.to || to <= range.to);
  });
  const latest = complete.at(-1);
  if (!latest) return undefined;
  const covered = range ? complete : complete.filter(month => month >= shiftMonth(latest, -5));
  const months = monthSpan(covered[0], latest);
  const included = new Set(covered);
  const personal = rows.filter(row => included.has(row.date.slice(0, 7)) && !isWork(row));
  const byMonth = Map.groupBy(personal, row => row.date.slice(0, 7));
  const data = months.map(month => {
    if (!included.has(month)) return { month, income: null, room: null };
    const bookings = byMonth.get(month) ?? [];
    const income = bookings.filter(row => row.kind === 'income' && ['salary', 'benefits'].includes(row.category))
      .reduce((sum, row) => sum + row.amount, 0);
    return { month, income, room: income - summarize(bookings).spent };
  });
  const average = (total: number) => Math.round(total / covered.length);
  const income = average(data.reduce((sum, month) => sum + (month.income ?? 0), 0));
  const room = average(data.reduce((sum, month) => sum + (month.room ?? 0), 0));
  const fixedRows = personal.filter(row => ['fixed', 'subscriptions'].includes(groupOf(row.category)));
  const fixed = average(summarize(fixedRows).spent);
  const categories = byCategory(fixedRows).map(item => ({ ...item, total: average(item.total) })).filter(item => item.total > 0);
  return { data, covered, income, room, fixed, categories,
    target: rate === null || income <= 0 ? null : Math.round(income * rate / 100) };
}
