import { trendSeries } from './analytics.ts';
import { normalize } from './classify.ts';
import { netSpend } from './ledger.ts';
import type { TrendCalendar } from './periods.ts';
import type { Transaction } from './types.ts';

let providerAliases: ReadonlyMap<string, string> = new Map();

export function presentProviderAliases(aliases: Record<string, string>) {
  providerAliases = new Map(Object.entries(aliases).map(([name, alias]) => [normalize(name), alias]));
}

function isCardFee(row: Transaction) {
  return row.source === 'card' && /^koersopslag\b/i.test(row.originalMerchant);
}

export function merchantName(row: Transaction) {
  const name = isCardFee(row) ? row.merchant.replace(/ · koersopslag$/i, '') : row.merchant;
  return providerAliases.get(normalize(name)) ?? name;
}

export const merchantKey = (row: Transaction) => normalize(merchantName(row));
export const canonicalMerchantKey = (key: string) => normalize(providerAliases.get(normalize(key)) ?? key);
export const isProviderBooking = (row: Transaction) => row.kind !== 'transfer' && row.kind !== 'pending';
export type ActivityKind = 'spending' | 'income';

export function isActivity(row: Transaction, kind: ActivityKind) {
  return kind === 'income' ? row.kind === 'income' : row.kind === 'expense' || row.kind === 'refund';
}

export function spendingActivity(rows: Transaction[], kind: ActivityKind = 'spending') {
  const paymentKind = kind === 'income' ? 'income' : 'expense';
  const payments = rows.filter(row => row.kind === paymentKind && !isCardFee(row));
  const value = kind === 'income' ? (row: Transaction) => row.kind === 'income' ? row.amount : 0 : netSpend;
  const grossPaid = payments.reduce((sum, row) => sum + value(row), 0);
  return {
    net: rows.reduce((sum, row) => sum + value(row), 0),
    payments: payments.length,
    average: payments.length ? Math.round(grossPaid / payments.length) : null,
    lastPayment: payments.reduce((latest, row) => row.date > latest ? row.date : latest, ''),
  };
}

export function byMerchant(rows: Transaction[], kind: ActivityKind = 'spending') {
  const groups = Map.groupBy(rows.filter(row => isActivity(row, kind)), merchantKey);
  return [...groups].map(([key, entries]) => ({
    key, name: merchantName(entries[0]), ...spendingActivity(entries, kind),
  })).sort((a, b) => b.net - a.net || b.payments - a.payments || a.name.localeCompare(b.name, 'nl'));
}

export function activitySeries(rows: Transaction[], kind: ActivityKind, calendar: TrendCalendar) {
  return trendSeries(rows, calendar, entries => {
    const { net, payments } = spendingActivity(entries, kind);
    return { spent: net, payments };
  });
}
