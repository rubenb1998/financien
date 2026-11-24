import { emptyRules, matchesBooking } from './profile.ts';
import type { Classification, RawTransaction, Transaction } from './types.ts';

export const workTag = 'Declareren werk';
export const claimStatuses = {
  toSubmit: 'Te declareren',
  submitted: 'Ingediend',
  paid: 'Vergoed',
} as const;
export type ClaimStatus = keyof typeof claimStatuses;

export const isWork = (row: Pick<Transaction, 'tags'>) =>
  row.tags?.some(tag => tag.trim().toLowerCase() === workTag.toLowerCase()) ?? false;

export function applyWorkRules(raw: RawTransaction, classification: Classification, rules = emptyRules.work): Classification {
  const charge = classification.kind === 'expense' || classification.kind === 'refund';
  const workExpense = charge && rules.some(rule => matchesBooking(raw, rule)
    && (!rule.category || rule.category === classification.category)
    && (!rule.subscription || rule.subscription === classification.subscription));
  const workIncome = classification.kind === 'income' && classification.category === 'reimbursement' && !classification.review;
  if (!workExpense && !workIncome) return classification;
  return { ...classification, tags: [...new Set([...(classification.tags ?? []), workTag])] };
}
