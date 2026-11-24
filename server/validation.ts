import { isSubscriptionType } from '../src/domain/subscription-view.ts';
import type { SubscriptionView } from '../src/domain/subscription-view.ts';
import { categories, categoriesFor, kinds } from '../src/domain/categories.ts';
import { todayInAmsterdam } from '../src/domain/dates.ts';
import { claimStatuses } from '../src/domain/work.ts';
import type { ClaimStatus } from '../src/domain/work.ts';
import type { AccountBalance, Correction, Goal, Kind, Scenario } from '../src/domain/types.ts';

class InputError extends Error {}
export { InputError };

const validAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_00;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9-]{20,45}$/.test(value);

export const isManualAccount = (value: unknown): value is string =>
  typeof value === 'string' && /^manual-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
export const isBalanceAccount = (value: unknown): value is string => isManualAccount(value)
  || (typeof value === 'string' && /^[a-f0-9]{20}$/.test(value));

function record(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('De invoer is ongeldig.');
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max) throw new InputError('Controleer de tekstvelden.');
  return value.trim();
}

export function readCorrection(value: unknown): Correction {
  const entry = record(value);
  const kind = entry.kind as Kind;
  if (!Object.hasOwn(kinds, kind) || !categoriesFor(kind).some(([key]) => key === entry.category)) {
    throw new InputError('Kies een geldige categorie en een geldig transactietype.');
  }
  const tags = entry.tags === undefined ? undefined
    : Array.isArray(entry.tags) && entry.tags.length <= 12 ? [...new Set(entry.tags.map(tag => text(tag, 48)).filter(Boolean))] : null;
  if (tags === null || (entry.claimStatus !== undefined
    && (typeof entry.claimStatus !== 'string' || !Object.hasOwn(claimStatuses, entry.claimStatus)))) {
    throw new InputError('Controleer de tags en declaratiestatus.');
  }
  return {
    tags, claimStatus: entry.claimStatus as ClaimStatus | undefined,
    kind, category: entry.category as string,
    merchant: text(entry.merchant ?? '', 160),
    subscription: kind === 'expense' || kind === 'refund' ? text(entry.subscription ?? '', 100) : '',
    note: text(entry.note ?? '', 500),
  };
}

export function readGoal(value: unknown): Goal {
  const entry = record(value);
  const title = text(entry.title, 80);
  const due = text(entry.due, 10);
  if (!validId(entry.id) || !title || !validAmount(entry.target) || entry.target === 0
    || !validAmount(entry.saved) || !(entry.monthly === null || validAmount(entry.monthly))
    || (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)) || new Date(due).toISOString().slice(0, 10) !== due))) {
    throw new InputError('Vul een naam, geldig doelbedrag en een geldige doeldatum in.');
  }
  return { id: entry.id, title, due, target: entry.target, saved: entry.saved, monthly: entry.monthly };
}

export function readScenario(value: unknown): Scenario {
  const entry = record(value);
  if (!(entry.income === null || validAmount(entry.income))) throw new InputError('Vul een geldig maandinkomen in.');
  const cuts = Object.entries(record(entry.cuts));
  if (cuts.some(([key, amount]) => !Object.hasOwn(categories, key) || !validAmount(amount))) {
    throw new InputError('Vul geldige bespaarbedragen in.');
  }
  return { income: entry.income, cuts: Object.fromEntries(cuts) as Record<string, number> };
}

export function readSubscriptionView(value: unknown): SubscriptionView {
  const { types, period, includeUtilities } = record(value);
  if (!Array.isArray(types) || !types.every(isSubscriptionType)
    || (period !== 'recent' && period !== 'all') || typeof includeUtilities !== 'boolean') {
    throw new InputError('Controleer de periode en soorten kosten voor abonnementen.');
  }
  return { types: [...new Set(types)], period, includeUtilities };
}

export function readBalance(value: unknown): { balance: AccountBalance; previousId?: string } {
  const { accountId, amount, date, label, previousId } = record(value);
  if (!isBalanceAccount(accountId) || typeof amount !== 'number' || !validAmount(Math.abs(amount))) {
    throw new InputError('Kies een rekening en vul een geldig saldo in.');
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > todayInAmsterdam()
    || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new InputError('Vul een geldige saldodatum in.');
  }
  const name = isManualAccount(accountId) ? text(label, 80) : undefined;
  if (name === '') throw new InputError('Geef de rekening een naam.');
  if (previousId !== undefined && (!isManualAccount(previousId) || isManualAccount(accountId))) {
    throw new InputError('Kies een geïmporteerde bankrekening om te koppelen.');
  }
  return { balance: { accountId, amount, date, label: name }, previousId };
}

export function readSavingsRate(value: unknown) {
  const { rate } = record(value);
  if (rate === null) return null;
  if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 0 || rate > 100) {
    throw new InputError('Vul een heel percentage van 0 tot 100 in.');
  }
  return rate;
}
