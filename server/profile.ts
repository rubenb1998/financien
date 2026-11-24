import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { categories, categoriesFor, groupOf } from '../src/domain/categories.ts';
import type { CategoryCollection } from '../src/domain/categories.ts';
import type { BookingMatch, ClassificationRules, MerchantRule, SubscriptionRule } from '../src/domain/profile.ts';
import type { DashboardPresentation } from '../src/domain/types.ts';
import { dataDirectory } from './store.ts';
import { readCorrection } from './validation.ts';

const initialNotes = '# Mijn financiële voorkeuren\n\nLeg hier je bevestigde keuzes vast over categorieën, tags, declaraties, abonnementen en de dashboardweergave.\n';

function createOnce(path: string, text: string) {
  try {
    writeFileSync(path, text, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Verwacht een JSON-object.');
  return value as Record<string, unknown>;
}

function allowed(value: Record<string, unknown>, keys: readonly string[]) {
  const key = Object.keys(value).find(item => !keys.includes(item));
  if (key) throw new Error(`Onbekend veld: ${key}.`);
}

function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) throw new Error('Verwacht tekst van 1 tot 500 tekens.');
  return value.trim();
}

function list<T>(value: unknown, read: (item: unknown) => T): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Verwacht een lijst.');
  return value.map(read);
}

function pattern(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('Gebruik een patroon van 1 tot 2048 tekens.');
  return new RegExp(value, 'i');
}

function date(value: unknown) {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result))
    || new Date(result).toISOString().slice(0, 10) !== result) throw new Error('Gebruik een datum in YYYY-MM-DD.');
  return result;
}

function category(value: unknown) {
  const id = text(value);
  if (!Object.hasOwn(categories, id)) throw new Error(`Onbekende categorie: ${id}.`);
  return id;
}

const patternKeys = ['merchant', 'details', 'sender', 'exceptDetails'] as const;
const dateKeys = ['date', 'before'] as const;
const amountKeys = ['amount', 'minAmount', 'maxAmount', 'minAbsoluteAmount'] as const;
const codeKeys = ['code', 'exceptCode'] as const;
const matchKeys = [...patternKeys, ...dateKeys, ...amountKeys, ...codeKeys, 'source'];

function readMatch(input: Record<string, unknown>): BookingMatch {
  const match: BookingMatch = {};
  if (!Object.keys(input).some(key => matchKeys.includes(key) && !key.startsWith('except')
    || key === 'category' || key === 'subscription')) throw new Error('Geef ten minste één voorwaarde op.');
  for (const key of patternKeys) if (input[key] !== undefined) match[key] = pattern(input[key]);
  for (const key of dateKeys) if (input[key] !== undefined) match[key] = date(input[key]);
  for (const key of codeKeys) if (input[key] !== undefined) match[key] = text(input[key]);
  for (const key of amountKeys) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || (key === 'minAbsoluteAmount' && value < 0)) {
      throw new Error('Gebruik geldige bedragen in hele eurocenten.');
    }
    match[key] = value;
  }
  if (input.source !== undefined) {
    if (input.source !== 'bank' && input.source !== 'card') throw new Error('Gebruik bank of card als bron.');
    match.source = input.source;
  }
  return match;
}

function readRule(value: unknown) {
  const input = object(value);
  allowed(input, ['match', 'result']);
  const match = object(input.match);
  allowed(match, matchKeys);
  const result = object(input.result);
  allowed(result, ['kind', 'category', 'merchant', 'subscription', 'claimStatus', 'tags', 'review', 'reason']);
  if (result.review !== undefined && typeof result.review !== 'boolean') throw new Error('Gebruik true of false voor review.');
  const correction = readCorrection(result);
  return {
    match: readMatch(match),
    result: {
      kind: correction.kind, category: correction.category, merchant: correction.merchant || undefined,
      subscription: correction.subscription || undefined, claimStatus: correction.claimStatus, tags: correction.tags,
      review: result.review === true, reason: result.reason === undefined ? 'Bevestigde persoonlijke regel' : text(result.reason),
    },
  };
}

function readMerchant(value: unknown): MerchantRule {
  const input = object(value);
  allowed(input, ['pattern', 'category', 'name', 'evidence']);
  const evidence = input.evidence === undefined ? undefined : text(input.evidence);
  if (evidence && !['https:', 'http:'].includes(new URL(evidence).protocol)) throw new Error('Gebruik een HTTP(S)-bron.');
  return [pattern(input.pattern), category(input.category), input.name === undefined ? undefined : text(input.name), evidence];
}

function readSubscription(value: unknown): SubscriptionRule {
  const input = object(value);
  allowed(input, ['pattern', 'name', 'category']);
  const id = category(input.category);
  if (!categoriesFor('expense').some(([key]) => key === id)) throw new Error('Kies een uitgavencategorie voor het abonnement.');
  return [pattern(input.pattern), text(input.name), id];
}

function readWork(value: unknown) {
  const input = object(value);
  allowed(input, [...matchKeys, 'category', 'subscription']);
  return {
    ...readMatch(input),
    category: input.category === undefined ? undefined : category(input.category),
    subscription: input.subscription === undefined ? undefined : text(input.subscription),
  };
}

function readCollection(id: string, value: unknown): CategoryCollection {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Ongeldige collectie-ID: ${id}.`);
  const input = object(value);
  allowed(input, ['label', 'categories']);
  const ids = [...new Set(list(input.categories, category))];
  const group = groupOf(ids[0]);
  if (!ids.length || group === 'ignored' || ids.some(key => groupOf(key) !== group)) {
    throw new Error('Kies categorieën uit één groep voor een collectie.');
  }
  return { label: text(input.label), group, categories: ids };
}

export function readProfile(value: unknown): { rules: ClassificationRules; presentation: DashboardPresentation } {
  const input = object(value);
  allowed(input, ['version', 'classifications', 'merchants', 'subscriptions', 'work', 'display']);
  if (input.version !== 1) throw new Error('Gebruik profielversie 1.');
  const view = object(input.display ?? {});
  allowed(view, ['labels', 'collections', 'featuredCollection', 'providerAliases', 'period']);
  const period = view.period ?? 'latestYear';
  if (period !== 'latestYear' && period !== 'allTime') throw new Error('Gebruik latestYear of allTime als periode.');
  const collections = Object.fromEntries(Object.entries(object(view.collections ?? {})).map(([id, entry]) => [id, readCollection(id, entry)]));
  const featuredCollection = view.featuredCollection === undefined ? undefined : text(view.featuredCollection);
  if (featuredCollection && !Object.hasOwn(collections, featuredCollection)) throw new Error('Kies een bestaande collectie om uit te lichten.');
  return {
    rules: {
      classifications: list(input.classifications, readRule), merchants: list(input.merchants, readMerchant),
      subscriptions: list(input.subscriptions, readSubscription), work: list(input.work, readWork),
    },
    presentation: {
      categories: {
        labels: Object.fromEntries(Object.entries(object(view.labels ?? {})).map(([id, label]) => [category(id), text(label)])),
        collections, featuredCollection,
      },
      providerAliases: Object.fromEntries(Object.entries(object(view.providerAliases ?? {})).map(([name, alias]) => [text(name), text(alias)])),
      period,
    },
  };
}

export function loadProfile() {
  const folder = dataDirectory();
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const path = join(folder, 'regels.json');
  createOnce(path, '{ "version": 1 }\n');
  createOnce(join(folder, 'profiel.md'), initialNotes);
  try {
    return readProfile(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    throw new Error(`Lokaal regels.json is ongeldig. ${error instanceof Error ? error.message : String(error)}`);
  }
}
