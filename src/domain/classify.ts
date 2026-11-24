import type { Classification, Correction, RawTransaction, Transaction } from './types.ts';
import { merchantRules } from './merchant-rules.ts';
import { subscriptionRules } from './subscription-rules.ts';

import { emptyRules, matchesBooking, matchesKind, normalize } from './profile.ts';
import type { ClassificationRules } from './profile.ts';

export { normalize };
const cardTransfer = /verrekening vorig overzicht|bijschrijving saldo op uw creditcar|overboeking van betaalrekening naar|overboeking van creditcard naar|boeking naar betaalreke|overschrijving saldo afkomstig van/;

function isPaymentRequest(raw: RawTransaction) {
  return ['bv', 'we', 'wr'].includes(raw.code)
    || /tikkie|betaalverzoek/i.test(raw.merchant + raw.details.slice(0, 70));
}

function shortMerchant(raw: RawTransaction) {
  return raw.merchant.replace(/^(?:bcc?|bck|ccv|sumup|mol|mgp|sp|goc|nya)\s*\*?\s+(?=[a-z])/i, '')
    .replace(/^(?:bck|ccv|sumup|mol|mgp|goc|nya)\*/i, '')
    .replace(/\s+via\s+(?:stripe|stichting|worldline|worldpay|hipay|mangopay|multisafepay).*$/i, '').trim()
    || 'Onbekende tegenpartij';
}

function merchantGuess(raw: RawTransaction, rules: ClassificationRules): Omit<Classification, 'kind'> {
  const merchant = shortMerchant(raw);
  const name = normalize(raw.merchant);
  const details = normalize(raw.details);
  const subscription = [...rules.subscriptions, ...subscriptionRules].find(([pattern]) => pattern.test(name)
    || (raw.amount > 0 && /refund from amazon prime vid/.test(details) && pattern.test('amazon prime video')));
  if (subscription) {
    return {
      merchant: subscription[1], category: subscription[2], subscription: subscription[1],
      review: false, reason: 'Herkenbare aanbieder of abonnementsomschrijving',
    };
  }
  if (name === 'amazon eu sarl' && Math.abs(raw.amount) === 499 && raw.code === 'ei') {
    return { merchant: 'Amazon Prime', category: 'streaming', subscription: 'Amazon Prime',
      review: true, reason: 'Vaste incasso van € 4,99 wijst op Prime. Controleer de dienst.' };
  }
  const catalog = [...rules.merchants, ...merchantRules];
  const found = catalog.find(([pattern]) => pattern.test(name))
    ?? (raw.code === 'id' ? catalog.find(([pattern]) => pattern.test(details.slice(0, 190))) : undefined);
  if (found) {
    const marketplace = /\b(?:bol\.com|bolcom|amazonretail|amzn mktp|temu)\b/.test(name);
    return {
      merchant: found[2] ?? merchant, category: found[1], evidence: found[3],
      review: marketplace, reason: marketplace ? 'Winkel herkend. Het gekochte product staat niet op het afschrift.' : 'Categorie afgeleid uit de tegenpartij',
    };
  }
  if (isPaymentRequest(raw)) {
    return { category: 'shared', merchant, review: false, reason: 'Overig betaalverzoek, ingedeeld bij gedeelde uitgaven' };
  }
  if (raw.code === 'ga') {
    return { category: 'cash', merchant, review: true, reason: 'Contante opname. De besteding van het contante geld is onbekend.' };
  }
  return { category: 'unknown', merchant, review: true, reason: 'De omschrijving geeft onvoldoende zekerheid voor een categorie.' };
}

export function classify(raw: RawTransaction, ownAccounts: ReadonlySet<string>, rules = emptyRules): Classification {
  const name = normalize(raw.merchant);
  const details = normalize(raw.details);
  const merchant = shortMerchant(raw);

  if (raw.code === 'tb' || raw.code === 'cc' || (raw.source === 'card' && cardTransfer.test(`${name} ${details}`))
    || (raw.counterpartyAccountId && ownAccounts.has(raw.counterpartyAccountId) && !raw.ownCounterparty)) {
    const purpose = raw.code === 'tb' ? 'Rabobank-code voor overboeking tussen eigen rekeningen'
      : raw.source === 'card' || raw.code === 'cc' ? 'Kaartafrekening, bijstorting of overboeking van kaarttegoed' : 'Tegenrekening is een geïmporteerde eigen rekening';
    return { kind: 'transfer', category: 'transfer', merchant, review: false, reason: purpose };
  }
  const local = rules.classifications.find(({ match, result }) =>
    matchesKind(raw.amount, result.kind) && matchesBooking(raw, match));
  if (local) return { ...local.result, merchant: local.result.merchant ?? merchant };
  if (raw.code === 'db' && /rabobank/.test(name) && /kosten/.test(details)) {
    return { kind: 'expense', category: 'bankfees', merchant: 'Rabobank', review: false, reason: 'Kosten bankpakket' };
  }
  if (raw.amount < 0) return { ...merchantGuess(raw, rules), kind: 'expense' };
  const income = (category: string, reason: string, review = false): Classification =>
    ({ kind: 'income', category, merchant, reason, review });
  if (isPaymentRequest(raw)) {
    return { kind: 'refund', category: 'sharedrefund', merchant, review: false, reason: 'Geld terug via een betaalverzoek' };
  }
  if (raw.source === 'card' || /\bretour\s*:|\brefund\b|terugbetaling|terugboeking|correctie d\.d\.|bestelling geannuleerd|jaarafr(?:ekening)?/.test(details)) {
    return { ...merchantGuess(raw, rules), kind: 'refund' };
  }
  if (raw.code === 'sb' || /^salaris\b/.test(details)) return income('salary', 'Salarisomschrijving of Rabobank-salariscode');
  if (/decla\s*ratie|\bdecl\./.test(details) && !/verrekening/.test(details)) {
    return income('reimbursement', 'Mogelijke declaratiebetaling. Bevestig de vergoeding.', true);
  }
  if (/toeslag/.test(details) && /belastingdienst/.test(name)) return income('benefits', 'Betaalde toeslag');
  if (/belastingdienst/.test(name)) return income('taxback', 'Belastingdienst-bijschrijving');
  if (/duo hoofdrekening/.test(name)) return income('study', 'DUO-bijschrijving');
  if (/verrekening.*decla\s*ratie/.test(details)) return income('reimbursement', 'Gecombineerde verrekening van salaris en declaratie', true);
  return income('otherincome', 'Ontvangst met nog te bevestigen herkomst', true);
}

export function applyCorrection(transaction: Transaction, correction?: Correction): Transaction {
  if (!correction) return transaction;
  return {
    ...transaction,
    kind: correction.kind,
    category: correction.category,
    merchant: correction.merchant?.trim() || transaction.merchant,
    subscription: correction.subscription?.trim() || undefined,
    reason: correction.note?.trim() || 'Handmatig bevestigd',
    tags: correction.tags ?? transaction.tags,
    claimStatus: correction.claimStatus,
    review: false,
  };
}
