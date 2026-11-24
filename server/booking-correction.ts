import { matchesKind } from '../src/domain/profile.ts';
import { isWork, workTag } from '../src/domain/work.ts';
import type { Correction, Transaction } from '../src/domain/types.ts';
import { InputError, readCorrection } from './validation.ts';

export function bookingCorrection(row: Transaction, previous: Correction | undefined, patch: Record<string, unknown>) {
  const next = readCorrection({
    kind: row.kind, category: row.category, merchant: row.merchant, subscription: row.subscription,
    tags: row.tags, claimStatus: row.claimStatus, note: previous?.note, ...patch,
  });
  if (!matchesKind(row.amount, next.kind)) throw new InputError('Dit transactietype past niet bij het afschriftbedrag.');
  if (next.kind === 'income' && next.category === 'reimbursement' && patch.tags === undefined && !isWork(next)) {
    next.tags = [...(next.tags ?? []), workTag];
  }
  if (patch.claimStatus !== undefined && (next.kind !== 'expense' || !isWork(next))) {
    throw new InputError('Een declaratiestatus hoort bij een uitgave met de tag Declareren werk.');
  }
  if (next.kind !== 'expense' || !isWork(next)) next.claimStatus = undefined;
  return next;
}
