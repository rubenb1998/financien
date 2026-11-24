import { normalize } from './classify.ts';
import type { Transaction } from './types.ts';

const DAY = 86_400_000;
export const dayDistance = (left: string, right: string) =>
  Math.abs(Date.parse(left) - Date.parse(right)) / DAY;

export function linkTransfers(transactions: Transaction[]) {
  const transfers = transactions.filter(row => row.kind === 'transfer');
  const byAmount = Map.groupBy(transfers, row => row.amount);
  for (const row of transfers) {
    if (row.linkedId) continue;
    const candidates = (byAmount.get(-row.amount) ?? []).filter(other =>
      !other.linkedId && other.accountId !== row.accountId && dayDistance(other.date, row.date) <= 4);
    candidates.sort((a, b) => dayDistance(a.date, row.date) - dayDistance(b.date, row.date));
    const nearest = candidates[0];
    if (!nearest || (candidates[1] && dayDistance(nearest.date, row.date) === dayDistance(candidates[1].date, row.date))) continue;
    const competing = (byAmount.get(row.amount) ?? []).some(other =>
      other.id !== row.id && !other.linkedId && other.accountId !== nearest.accountId
      && dayDistance(other.date, nearest.date) <= dayDistance(row.date, nearest.date));
    if (competing) continue;
    row.linkedId = nearest.id;
    nearest.linkedId = row.id;
  }
}

const isRequest = (row: Transaction) => row.kind === 'refund' && row.category === 'sharedrefund' && row.code === 'bv';
const isUnrecognizedCredit = (row: Transaction) => row.kind === 'income' && row.category === 'otherincome' && row.code === 'cb';
const refundKey = (row: Transaction) => normalize(row.merchant).replace(/\b\d+\b/g, '').trim();

function matchReturn(refund: Transaction, purchase: Transaction) {
  const cardReversal = refund.source === 'card' && /^vergoeding transactie/.test(normalize(refund.merchant));
  const bankRequest = isRequest(refund);
  const matchWindow = cardReversal ? 2 : bankRequest ? 30 : 120;
  if (purchase.accountId !== refund.accountId || purchase.date > refund.date
    || purchase.amount !== -refund.amount || dayDistance(purchase.date, refund.date) > matchWindow) return false;
  if (cardReversal) return true;
  const key = refundKey(purchase);
  if (!bankRequest) {
    return (!isUnrecognizedCredit(refund) || !purchase.review) && key === refundKey(refund);
  }
  const description = normalize(refund.details.split(/Verwerkingsdatum:|Transactiereferentie:/i, 1)[0])
    .split(/[:/]/).map(part => part.trim().replace(/\s+/g, ''));
  return !purchase.review && key.length >= 4 && description.some(part => part === key.replace(/\s+/g, ''));
}

export function linkRefunds(transactions: Transaction[], correctedIds: ReadonlySet<string>) {
  const purchases = transactions.filter(row => row.kind === 'expense');
  const available = new Set(purchases.map(row => row.id));
  const returns = transactions.filter(row => !correctedIds.has(row.id)
    && (row.kind === 'refund' || isRequest(row) || isUnrecognizedCredit(row)))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const refund of returns) {
    const matches = purchases.filter(purchase => available.has(purchase.id) && matchReturn(refund, purchase))
      .sort((a, b) => b.date.localeCompare(a.date));
    const match = matches[0];
    if (!match || ((isRequest(refund) || refund.kind !== 'refund') && matches.length !== 1)) continue;
    const reason = isRequest(refund) ? 'Betaalverzoek gekoppeld op handelsnaam in de omschrijving en hetzelfde bedrag'
      : /^vergoeding transactie/.test(normalize(refund.merchant)) ? 'Kaartcorrectie gekoppeld op bedrag en boekingsdatum'
        : 'Retour gekoppeld op handelsnaam en exact bedrag';
    available.delete(match.id);
    refund.kind = 'refund';
    refund.linkedId = match.id;
    match.linkedId = refund.id;
    refund.category = match.category;
    refund.subscription = match.subscription;
    refund.tags = [...new Set([...(refund.tags ?? []), ...(match.tags ?? [])])];
    refund.merchant = match.merchant;
    refund.review = match.review;
    refund.reason = reason;
  }
}

export function attachCardFees(transactions: Transaction[]) {
  const groups = Map.groupBy(transactions.filter(row => row.source === 'card'), row => row.statementId ?? row.accountId);
  for (const rows of groups.values()) {
    let previous: Transaction | undefined;
    for (const card of rows.sort((a, b) => a.order - b.order)) {
      if (/^koersopslag/.test(normalize(card.merchant))) {
        const parent = previous?.kind === 'expense' && previous.date === card.date && card.order === previous.order + 1
          ? previous : undefined;
        card.category = parent?.category ?? 'bankfees';
        card.subscription = parent?.subscription;
        card.tags = parent?.tags ?? card.tags;
        card.linkedId = parent?.id;
        card.merchant = parent ? `${parent.merchant} · koersopslag` : 'Koersopslag';
        card.reason = 'Valutakosten op de creditcard';
        card.review = parent?.review ?? false;
        if (parent) previous = { ...parent, order: card.order };
      } else {
        previous = card;
      }
    }
  }
}
