import { isProtectedBudget } from './categories.ts';
import { shiftMonth } from './dates.ts';
import { netSpend } from './ledger.ts';
import type { BudgetLine } from './savings-types.ts';
import type { Transaction } from './types.ts';

export const flexibleAmount = (line: BudgetLine) => line.monthly - (line.subscriptionMonthly ?? 0);

export function reportSpendingPattern(rows: Transaction[], lines: BudgetLine[], months: string[], date: string) {
  const current = date.slice(0, 7);
  const recentMonths = [3, 2, 1].map(offset => shiftMonth(current, -offset)).filter(month => months.includes(month));
  const proposalBudgets = new Map<string, number>();
  if (!recentMonths.length) return { lines, recentMonths, changes: [], proposalBudgets };

  const earlierMonths = [6, 5, 4].map(offset => shiftMonth(current, -offset));
  const fullComparison = recentMonths.length === 3 && earlierMonths.every(month => months.includes(month));
  const totals = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.subscription || (row.kind !== 'expense' && row.kind !== 'refund')) continue;
    const month = row.date.slice(0, 7);
    if (!recentMonths.includes(month) && !earlierMonths.includes(month)) continue;
    const buckets = totals.get(row.category) ?? new Map<string, number>();
    buckets.set(month, (buckets.get(month) ?? 0) + netSpend(row));
    totals.set(row.category, buckets);
  }

  const changes: { id: string; before: number; recent: number }[] = [];
  const estimates = lines.map(line => {
    if (isProtectedBudget(line.id)) return line;
    const flexible = flexibleAmount(line);
    const monthly = totals.get(line.id);
    const recent = recentMonths.map(month => monthly?.get(month) ?? 0);
    const average = Math.max(0, Math.round(recent.reduce((sum, amount) => sum + amount, 0) / recent.length));
    const olderAverage = earlierMonths.reduce((sum, month) => sum + (monthly?.get(month) ?? 0), 0) / earlierMonths.length;
    const lower = fullComparison && olderAverage > 0 && average <= olderAverage * .6
      && recent.filter(amount => amount <= olderAverage * .6).length >= 2;

    if (!lower && recent.filter(amount => amount > 0).length >= Math.min(2, recentMonths.length)) {
      proposalBudgets.set(line.id, Math.min(flexible, average));
    }
    if (line.kind !== 'usual' || !lower || average >= flexible) return line;
    changes.push({ id: line.id, before: flexible, recent: average });
    return { ...line, monthly: average + (line.subscriptionMonthly ?? 0) };
  });
  changes.sort((a, b) => (b.before - b.recent) - (a.before - a.recent));
  return { lines: estimates, recentMonths, changes, proposalBudgets };
}
