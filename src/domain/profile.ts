import type { Classification, Kind, RawTransaction, Source } from './types.ts';

export type MerchantRule = readonly [pattern: RegExp, category: string, name?: string, evidence?: string];
export type SubscriptionRule = readonly [pattern: RegExp, name: string, category: string];

export interface BookingMatch {
  merchant?: RegExp;
  details?: RegExp;
  sender?: RegExp;
  exceptDetails?: RegExp;
  source?: Source;
  code?: string;
  exceptCode?: string;
  date?: string;
  before?: string;
  amount?: number;
  minAmount?: number;
  maxAmount?: number;
  minAbsoluteAmount?: number;
}

interface WorkMatch extends BookingMatch {
  category?: string;
  subscription?: string;
}

export interface ClassificationRules {
  classifications: { match: BookingMatch; result: Omit<Classification, 'merchant'> & { merchant?: string } }[];
  merchants: MerchantRule[];
  subscriptions: SubscriptionRule[];
  work: WorkMatch[];
}

export const emptyRules: ClassificationRules = { classifications: [], merchants: [], subscriptions: [], work: [] };

export const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

export function matchesBooking(raw: RawTransaction, match: BookingMatch) {
  const sender = match.sender && /^rabo betaalverzoek$/i.test(raw.merchant)
    ? raw.details.match(/^[a-z]{2}\d{2}[a-z\d]+:([^:]{2,70}):/i)?.[1] ?? raw.merchant
    : raw.merchant;
  return (!match.merchant || match.merchant.test(normalize(raw.merchant)))
    && (!match.details || match.details.test(normalize(raw.details)))
    && (!match.sender || match.sender.test(sender))
    && (!match.exceptDetails || !match.exceptDetails.test(normalize(raw.details)))
    && (!match.source || match.source === raw.source)
    && (!match.code || match.code === raw.code)
    && match.exceptCode !== raw.code
    && (!match.date || match.date === raw.date)
    && (!match.before || raw.date < match.before)
    && (match.amount === undefined || match.amount === raw.amount)
    && (match.minAmount === undefined || raw.amount >= match.minAmount)
    && (match.maxAmount === undefined || raw.amount <= match.maxAmount)
    && (match.minAbsoluteAmount === undefined || Math.abs(raw.amount) >= match.minAbsoluteAmount);
}

export function matchesKind(amount: number, kind: Kind) {
  if (kind === 'expense') return amount <= 0;
  if (kind === 'income' || kind === 'refund') return amount >= 0;
  return true;
}
