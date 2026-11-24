import { groupOf } from './categories.ts';
import { completeMonths } from './dates.ts';
import { netSpend } from './ledger.ts';
import { median } from './subscriptions.ts';
import { isWork } from './work.ts';
import type { BudgetKind, OneOff, SavingsBaseline } from './savings-types.ts';
import type { Statement, Transaction } from './types.ts';

const periodic = new Set(['taxes', 'utilities', 'race', 'gear', 'travel', 'tech', 'education', 'health']);

function excludeOneOffs(rows: Transaction[], oneOffs: OneOff[]) {
  const excluded = new Set<string>();
  const exclusions = oneOffs.map(item => {
    const ids = new Set(item.ids);
    const purchases = rows.filter(row => ids.has(row.id) && row.kind === 'expense' && !isWork(row));
    if (!ids.size || purchases.length !== ids.size) throw new Error(`Ongeldige bevestigde eenmalige uitgave: ${item.label}.`);
    const related = new Set(purchases.flatMap(row => row.linkedId ? [row.linkedId] : []));
    const transactions = rows.filter(row => ids.has(row.id) || related.has(row.id)
      || (row.linkedId !== undefined && ids.has(row.linkedId)));
    for (const row of transactions) {
      if (excluded.has(row.id)) throw new Error('Eenmalige uitgaven overlappen.');
      excluded.add(row.id);
    }
    const dates = purchases.map(row => row.date).sort();
    return { label: item.label, amount: transactions.reduce((sum, row) => sum + netSpend(row), 0),
      from: dates[0], to: dates[dates.length - 1] };
  });
  return { excluded, exclusions };
}

export function savingsBaseline(rows: Transaction[], statements: Statement[], oneOffs: OneOff[], analysisDate: string, incomeOverride?: number): SavingsBaseline {
  const reserveMonths = completeMonths(statements).filter(month => month < analysisDate.slice(0, 7)).slice(-12);
  const months = reserveMonths.slice(-6);
  if (!months.length) throw new Error('Een spaarscenario vereist ten minste één volledige afschriftmaand.');
  const { excluded, exclusions } = excludeOneOffs(rows, oneOffs);
  const history = rows.filter(row => !isWork(row) && !excluded.has(row.id) && reserveMonths.includes(row.date.slice(0, 7)));
  const byMonth = Map.groupBy(history, row => row.date.slice(0, 7));
  const income = incomeOverride !== undefined ? [{ label: 'Opgegeven netto maandinkomen', monthly: incomeOverride }]
    : (['salary', 'benefits'] as const).map(category => ({
      label: category === 'salary' ? 'Netto salaris' : 'Terugkerende toeslagen',
      monthly: median(months.slice(-3).map(month => (byMonth.get(month) ?? []).filter(row => row.kind === 'income' && row.category === category)
        .reduce((sum, row) => sum + row.amount, 0))),
    })).filter(line => line.monthly > 0);
  const costs = history.filter(row => ['expense', 'refund'].includes(row.kind) && row.category !== 'sharedrefund');
  const lines = [...Map.groupBy(costs, row => row.category)].map(([id, entries]) => {
    const fixed = groupOf(id) === 'fixed';
    const latestPayments = new Set(entries.filter(row => row.kind === 'expense' && months.includes(row.date.slice(0, 7)))
      .map(row => row.date.slice(0, 7)));
    const kind: BudgetKind = fixed ? 'fixed' : periodic.has(id) || latestPayments.size < Math.min(3, months.length) ? 'reserve' : 'usual';
    const annual = kind === 'reserve' || periodic.has(id);
    const sample = annual ? reserveMonths : fixed ? months.slice(-3) : months;
    const sampled = entries.filter(row => sample.includes(row.date.slice(0, 7)));
    // Use outgoing fixed bills to avoid extrapolating one-off settlements as a monthly credit.
    const monthlyTotals = sample.map(month => sampled.filter(row => row.date.startsWith(month))
      .reduce((sum, row) => sum + (fixed && row.kind === 'refund' ? 0 : netSpend(row)), 0));
    const monthly = fixed && !annual ? median(monthlyTotals)
      : Math.round(monthlyTotals.reduce((sum, amount) => sum + amount, 0) / sample.length);
    const activeMonths = new Set(sampled.filter(row => row.kind === 'expense').map(row => row.date.slice(0, 7))).size;
    return { id, kind, monthly: Math.max(0, monthly), months: sample.length, activeMonths };
  }).filter(line => line.monthly > 0).sort((a, b) => b.monthly - a.monthly);
  const spentMonthly = Math.round(rows.filter(row => !isWork(row) && months.includes(row.date.slice(0, 7)))
    .reduce((sum, row) => sum + netSpend(row), 0) / months.length);
  return { income, months, reserveMonths, spentMonthly, lines, exclusions };
}
