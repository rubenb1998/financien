import { groupOf, isProtectedBudget } from './categories.ts';
import { normalize } from './classify.ts';
import { isWork, workTag } from './work.ts';
import type { Transaction } from './types.ts';

export const returnTag = 'Retour';
export const returnedPurchaseTag = 'Retour ontvangen';
export const reimbursedTag = 'Vergoed';
export const compensationTag = 'Vergoeding ontvangen';
export const returnedMoneyTag = 'Geld teruggekregen';
export const fixedSpendTag = 'Vaste lasten';
export const careSpendTag = 'Zorgkosten';
const automaticTags = [workTag, returnTag, returnedPurchaseTag, reimbursedTag, compensationTag, returnedMoneyTag, fixedSpendTag, careSpendTag];

export function transactionTags(row: Transaction): string[] {
  const tags = new Set(row.tags ?? []);
  if (row.kind === 'refund') tags.add(row.category === 'sharedrefund' ? returnedMoneyTag : returnTag);
  if (row.returnedPurchase) tags.add(returnedPurchaseTag);
  if (row.kind === 'expense' && isWork(row) && row.claimStatus === 'paid') tags.add(reimbursedTag);
  if (row.kind === 'income' && row.category === 'reimbursement' && !row.review) tags.add(compensationTag);
  if ((row.kind === 'expense' || row.kind === 'refund') && isProtectedBudget(row.category)) {
    if (groupOf(row.category) === 'fixed') tags.add(fixedSpendTag);
    if (row.category === 'health' || row.category === 'healthinsurance') tags.add(careSpendTag);
  }
  return [...tags];
}

export function tagOptions(rows: Transaction[]) {
  const tags = new Map(automaticTags.map(tag => [normalize(tag), tag]));
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const key = normalize(tag);
      if (key && !tags.has(key)) tags.set(key, tag);
    }
  }
  return [...tags.values()];
}

export function matchesTags(row: Transaction, selected: ReadonlySet<string>) {
  return !selected.size || transactionTags(row).some(tag => selected.has(normalize(tag)));
}
