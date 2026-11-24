import { groupOf } from './categories.ts';
import { coverage, shiftMonth } from './dates.ts';
import type { Statement, Transaction } from './types.ts';
import { normalize } from './classify.ts';
import { netSpend } from './ledger.ts';
import { isWork } from './work.ts';

export const subscriptionTypes = {
  personal: 'Persoonlijke abonnementen',
  work: 'Werkdeclaraties',
  fixed: 'Vaste lasten',
} as const;
export type SubscriptionType = keyof typeof subscriptionTypes;

function subscriptionType(row: Transaction): SubscriptionType {
  if (isWork(row)) return 'work';
  return groupOf(row.category) === 'fixed' ? 'fixed' : 'personal';
}

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const copy = [...values].sort((a, b) => a - b);
  const middle = Math.floor(copy.length / 2);
  return copy.length % 2 ? copy[middle] : Math.round((copy[middle - 1] + copy[middle]) / 2);
};

export function recurringItems(rows: Transaction[], statements: Statement[], selection?: ReadonlySet<string>) {
  const key = (row: Transaction) => `${subscriptionType(row)}:${normalize(row.subscription ?? row.merchant)}`;
  const tracked = Map.groupBy(rows.filter(row => row.subscription && ['expense', 'refund'].includes(row.kind)), key);

  // Add strong monthly patterns for recurring charges without a known description.
  const unlabeled = Map.groupBy(rows.filter(row => !row.subscription && row.kind === 'expense'
    && !row.review && ['ei', 'card'].includes(row.code)
    && ['telecom', 'insurance', 'healthinsurance', 'utilities'].includes(row.category)), key);
  for (const [id, charges] of unlabeled) {
    const perMonth = Map.groupBy(charges, row => row.date.slice(0, 7));
    const amounts = charges.map(row => -row.amount);
    const typical = median(amounts);
    if (perMonth.size >= 3 && amounts.filter(amount => Math.abs(amount - typical) <= typical * .15).length >= 3) {
      tracked.set(id, [...(tracked.get(id) ?? []), ...charges]);
    }
  }

  return [...tracked].flatMap(([id, entries]) => {
    const selected = selection ? entries.filter(row => selection.has(row.id)) : entries;
    if (!selected.length) return [];
    const charges = entries.filter(row => row.kind === 'expense' && !/^koersopslag/.test(normalize(row.originalMerchant)))
      .sort((a, b) => b.date.localeCompare(a.date));
    const last = charges[0];
    if (!last) return [];
    const relevantAccounts = new Set(charges.map(row => row.accountId));
    const lastCoverage = coverage(statements.filter(row => relevantAccounts.has(row.accountId))).to || last.date;
    const month = lastCoverage.slice(0, 7);
    const perMonth = Map.groupBy(entries.filter(row => row.kind === 'expense'), row => row.date.slice(0, 7));
    const patternMonths = [...new Set(charges.map(row => row.date.slice(0, 7)))].sort().reverse();
    const latestMonth = patternMonths[0];
    const active = latestMonth >= shiftMonth(month, -1);
    const recentAmounts = patternMonths.filter(value => value >= shiftMonth(latestMonth, -3))
      .map(value => (perMonth.get(value) ?? []).reduce((sum, row) => sum - row.amount, 0));
    const typical = median(recentAmounts);
    const similarMonths = recentAmounts.filter(amount => Math.abs(amount - typical) <= Math.max(100, typical * .25));
    const monthlyCost = similarMonths.length >= 3 ? median(similarMonths) : null;
    const perAccount = [...relevantAccounts];
    return [{
      name: last.subscription ?? last.merchant, id, type: subscriptionType(last), accountId: last.accountId, accounts: perAccount,
      date: last.date, amount: -last.amount, monthlyCost, active,
      total: selected.reduce((sum, row) => sum + netSpend(row), 0),
      count: selected.length, evidence: Boolean(last.subscription), category: last.category,
      ids: selected.map(row => row.id),
    }];
  }).sort((a, b) => Number(b.active) - Number(a.active)
    || Number(b.monthlyCost !== null) - Number(a.monthlyCost !== null)
    || (b.monthlyCost ?? b.amount) - (a.monthlyCost ?? a.amount));
}
