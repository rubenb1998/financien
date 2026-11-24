import { groupOf } from './categories.ts';
import { applyCorrection, classify, normalize } from './classify.ts';
import { attachCardFees, linkRefunds, linkTransfers } from './matching.ts';
import { matchesTags } from './tags.ts';
import { emptyRules } from './profile.ts';
import { applyWorkRules } from './work.ts';
import type { Filters, Ledger, Transaction } from './types.ts';

export function buildLedger(ledger: Ledger, rules = emptyRules): Transaction[] {
  const ownAccounts = new Set(ledger.statements.filter(row => row.source === 'bank').map(row => row.accountId));
  const transactions = ledger.transactions.map(raw => ({
    ...raw,
    originalMerchant: raw.merchant,
    ...applyWorkRules(raw, classify(raw, ownAccounts, rules), rules.work),
  }));
  // Apply manual corrections on purchases before propagating their category to linked refunds and fees.
  for (const [index, row] of transactions.entries()) {
    if (row.kind !== 'refund' && !/^koersopslag/i.test(row.merchant)) {
      transactions[index] = applyCorrection(row, ledger.corrections[row.id]);
    }
  }
  linkRefunds(transactions, new Set(Object.keys(ledger.corrections)));
  attachCardFees(transactions);
  const corrected = transactions.map(row => applyCorrection(row, ledger.corrections[row.id]));
  const byId = new Map(corrected.map(row => [row.id, row]));
  for (const row of corrected) {
    if (row.kind === 'expense' && row.linkedId && byId.get(row.linkedId)?.kind === 'refund') {
      row.returnedPurchase = true;
    }
  }
  linkTransfers(corrected);
  return corrected.sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
}

export const emptyFilters: Filters = {
  year: '', month: '', from: '', to: '', account: '', group: '', category: '', kind: '', query: '', subscriptions: true, tags: [], includeWork: false,
};

export function filterLedger(rows: Transaction[], filters: Filters) {
  const search = normalize(filters.query);
  const selectedTags = new Set(filters.tags.map(normalize));
  return rows.filter(row =>
    (!filters.year || row.date.startsWith(filters.year)) &&
    (!filters.month || row.date.slice(0, 7) === filters.month) &&
    (!filters.from || row.date >= filters.from) &&
    (!filters.to || row.date <= filters.to) &&
    (!filters.account || row.accountId === filters.account) &&
    (!filters.group || groupOf(row.category) === filters.group) &&
    (!filters.category || row.category === filters.category) &&
    (!filters.kind || row.kind === filters.kind) &&
    (filters.subscriptions || !row.subscription) &&
    matchesTags(row, selectedTags) &&
    (!search || normalize(`${row.merchant} ${row.details} ${row.counterparty}`).includes(search)));
}

export function netSpend(row: Transaction) {
  return row.kind === 'expense' || row.kind === 'refund' ? -row.amount : 0;
}

export function summarize(rows: Transaction[]) {
  return rows.reduce((total, row) => {
    total.spent += netSpend(row);
    if (row.kind === 'income') total.income += row.amount;
    if (row.kind === 'refund') total.refunds += row.amount;
    if (row.kind === 'transfer') total.transfers += 1;
    if (row.kind === 'pending') total.pending += 1;
    return total;
  }, { spent: 0, income: 0, refunds: 0, transfers: 0, pending: 0 });
}
