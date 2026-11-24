import { categoryLabel, groupOf } from './categories.ts';
import { displayMonth, monthSpan } from './dates.ts';
import { netSpend, summarize } from './ledger.ts';
import type { Transaction } from './types.ts';

export function spendBy(rows: Transaction[], key: (row: Transaction) => string) {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== 'expense' && row.kind !== 'refund') continue;
    const group = key(row);
    result.set(group, (result.get(group) ?? 0) + netSpend(row));
  }
  return [...result].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total);
}

export const byCategory = (rows: Transaction[]) => spendBy(rows, row => row.category)
  .map(item => ({ ...item, name: categoryLabel(item.id) }));

export const byGroup = (rows: Transaction[]) => spendBy(rows, row => groupOf(row.category));

export function incomeByCategory(rows: Transaction[]) {
  return [...Map.groupBy(rows.filter(row => row.kind === 'income'), row => row.category)]
    .map(([id, entries]) => ({ id, name: categoryLabel(id), total: entries.reduce((total, row) => total + row.amount, 0) }))
    .sort((a, b) => b.total - a.total);
}

export function monthlySeries(rows: Transaction[], from: string, to: string) {
  return monthSpan(from, to).map(month => {
    const subset = rows.filter(row => row.date.startsWith(month));
    const { spent, income } = summarize(subset);
    return { month, label: displayMonth(month), spent, income };
  });
}
