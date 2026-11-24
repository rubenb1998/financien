import { categories, isProtectedBudget } from '../src/domain/categories.ts';
import { monthSpan } from '../src/domain/dates.ts';
import type { OneOff, PlanRequest } from '../src/domain/savings-types.ts';

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Verwacht een JSON-object.');
  return input as Record<string, unknown>;
}

function text(input: unknown, field: string) {
  if (typeof input !== 'string' || !input.trim()) throw new Error(`Vul ${field} in.`);
  return input.trim();
}

function cents(input: unknown, field: string): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 0) throw new Error(`${field} moet in hele eurocenten staan.`);
  return input;
}

function month(input: unknown, field: string) {
  const value = text(input, field);
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(value)) throw new Error(`${field} moet YYYY-MM zijn.`);
  return value;
}

function planRequest(input: unknown): PlanRequest {
  const raw = object(input);
  const id = text(raw.id, 'een plan-id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Gebruik letters, cijfers en streepjes in het plan-id.');
  const startMonth = month(raw.startMonth, 'Startmaand');
  const endMonth = month(raw.endMonth, 'Eindmaand');
  if (!monthSpan(startMonth, endMonth).length) throw new Error('Kies een eindmaand vanaf de startmaand.');
  const target = cents(raw.target, 'Spaardoel');
  if (!target) throw new Error('Het spaardoel moet positief zijn.');

  const caps = Object.fromEntries(Object.entries(object(raw.caps ?? {})).map(([category, entry]) => {
    if (!Object.hasOwn(categories, category) || ['income', 'ignored'].includes(categories[category].group)) {
      throw new Error(`Ongeldige uitgavencategorie: ${category}.`);
    }
    if (isProtectedBudget(category)) throw new Error(`${categories[category].label} is een beschermde post.`);
    const cap = object(entry);
    return [category, { monthly: cents(cap.monthly, category), action: text(cap.action, `een actie voor ${category}`) }];
  }));
  const provision = raw.provision === undefined ? undefined : object(raw.provision);

  return {
    id, title: text(raw.title, 'een titel'), target, saved: cents(raw.saved ?? 0, 'Al gespaard'),
    reserve: cents(raw.reserve ?? 0, 'Overhouden per maand'), startMonth, endMonth, caps,
    provision: provision ? { monthly: cents(provision.monthly, 'Voorziening'), label: text(provision.label, 'een omschrijving voor de voorziening') } : undefined,
  };
}

export function readSavingsRequest(input: unknown) {
  const raw = object(input);
  const analysisDate = text(raw.analysisDate, 'de analysedatum');
  if (!/^20\d\d-\d\d-\d\d$/.test(analysisDate) || !Number.isFinite(Date.parse(analysisDate))
    || new Date(analysisDate).toISOString().slice(0, 10) !== analysisDate) throw new Error('Gebruik een geldige analysedatum in YYYY-MM-DD.');
  if (!Array.isArray(raw.plans) || !raw.plans.length) throw new Error('Geef één of meer spaarscenario’s op.');
  const plans = raw.plans.map(planRequest);
  if (new Set(plans.map(plan => plan.id)).size !== plans.length) throw new Error('De plan-id’s moeten uniek zijn.');

  const exclusions = raw.oneOffs ?? [];
  if (!Array.isArray(exclusions)) throw new Error('Geef een lijst van eenmalige uitgaven op.');
  const oneOffs: OneOff[] = exclusions.map(input => {
    const item = object(input);
    if (!Array.isArray(item.ids) || !item.ids.length) throw new Error('Geef de bijbehorende transactie-id’s op.');
    return { label: text(item.label, 'een naam voor de eenmalige uitgave'), ids: item.ids.map(id => text(id, 'een transactie-id')) };
  });

  return { analysisDate, plans, oneOffs, income: raw.income === undefined ? undefined : cents(raw.income, 'Maandinkomen') };
}
