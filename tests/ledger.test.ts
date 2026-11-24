import { trendSeries } from '../src/domain/analytics.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSubscriptionView, subscriptionInView } from '../src/domain/subscription-view.ts';
import { readProfile } from '../server/profile.ts';
import { presentProviderAliases } from '../src/domain/merchant-breakdown.ts';
import { buildLedger, emptyFilters, filterLedger, summarize } from '../src/domain/ledger.ts';
import { completeMonths, limitToMonth, monthSpan } from '../src/domain/dates.ts';
import { activitySeries, byMerchant } from '../src/domain/merchant-breakdown.ts';
import { availableMonths, intersectDates, periodBounds, periodInYear, periodNavigation, trendCalendar } from '../src/domain/periods.ts';
import { planningBaseline, projectGoals, savingsScenario } from '../src/domain/planning.ts';
import { recurringItems } from '../src/domain/subscriptions.ts';
import { compensationTag, reimbursedTag, returnedMoneyTag, returnedPurchaseTag, returnTag, transactionTags } from '../src/domain/tags.ts';
import { isWork, workTag } from '../src/domain/work.ts';
import type { Ledger, RawTransaction, Statement } from '../src/domain/types.ts';

const raw = (id: string, amount: number, merchant: string, attrs: Partial<RawTransaction> = {}): RawTransaction => ({
  id, accountId: 'bank', source: 'bank', date: '2026-11-10', amount, code: 'id',
  merchant, details: '', counterparty: '', ownCounterparty: false, order: 0, page: 1, ...attrs,
});
const card = (id: string, amount: number, merchant: string, attrs: Partial<RawTransaction> = {}) =>
  raw(id, amount, merchant, { accountId: 'card', source: 'card', code: 'card', ...attrs });
const ledger = (transactions: RawTransaction[], fields: Partial<Ledger> = {}): Ledger => ({
  transactions, statements: [], corrections: {}, goals: [], scenario: { income: null, cuts: {} }, ...fields,
});
const statement = (accountId: string, from: string, to: string): Statement => ({
  id: `${accountId}:${from}`, accountId, from, to, source: accountId === 'card' ? 'card' : 'bank',
  label: accountId, debit: 0, credit: 0, count: 0, pages: 1,
});

test('month selection intersects the current date range and category', () => {
  const rows = buildLedger(ledger([
    raw('previous-year', -500, 'Jumbo', { date: '2025-10-24' }),
    raw('before-start', -500, 'Jumbo', { date: '2026-10-01' }),
    raw('included', -500, 'Jumbo', { date: '2026-10-24' }),
    raw('other-category', -500, 'Voorbeeldfietsen', { date: '2026-10-23' }),
    raw('next-month', -500, 'Jumbo', { date: '2026-11-02' }),
  ]));
  const base = { ...emptyFilters, from: '2026-10-08', to: '2026-11-22', category: 'groceries' };
  assert.deepEqual(filterLedger(rows, { ...base, period: { unit: 'month', month: '2026-10' } }).map(row => row.id), ['included']);
  assert.deepEqual(limitToMonth(base.from, base.to, '2026-10'), { from: '2026-10-08', to: '2026-10-31' });
  assert.deepEqual(limitToMonth(base.from, base.to, '2026-11'), { from: '2026-11-01', to: '2026-11-22' });
  assert.deepEqual(monthSpan('2026-11-25', '2026-11-22'), []);
});

test('card funding, card settlement and savings transfers add zero to income and expense', () => {
  const rows = buildLedger(ledger([
    raw('top-up', -30_000, 'Overboeking naar creditcard', { code: 'cc' }),
    card('funded', 30_000, 'Bijschrijving saldo op uw creditcard'),
    card('purchase', -2_999, 'OPENAI *CHATGPT SUBSCR'),
    raw('settlement', -2_999, 'Rabobank Nederland', { code: 'cc' }),
    card('settled', 2_999, 'Verrekening vorig overzicht'),
    raw('savings', 100_000, 'Eigen rekening', { code: 'tb' }),
  ]));
  assert.deepEqual(summarize(rows), { spent: 2_999, income: 0, refunds: 0, transfers: 5, pending: 0 });
  assert.equal(rows.find(row => row.id === 'settled')?.linkedId, 'settlement');
  assert.equal(rows.find(row => row.id === 'savings')?.kind, 'transfer');
  assert.equal(summarize(filterLedger(rows, { ...emptyFilters, subscriptions: false })).spent, 0);
});

const bicycleShopRules = readProfile({
  version: 1, merchants: [{ pattern: 'voorbeeldfietsen', category: 'bike' }],
}).rules;

test('exact amount alone does not identify a transfer or a return', () => {
  const rows = buildLedger(ledger([
    raw('purchase', -23_741, 'Voorbeeldfietsen'),
    raw('credit', 23_741, 'Andere afzender', { code: 'cb' }),
    card('purchase-card', -23_741, 'Betaald aan winkel'),
  ]), bicycleShopRules);
  assert.equal(rows.find(row => row.id === 'credit')?.kind, 'income');
  assert.equal(rows.some(row => row.linkedId), false);
});

test('matched merchant return offsets the original category and links both directions', () => {
  const rows = buildLedger(ledger([
    raw('purchase', -23_741, 'Voorbeeldfietsen'),
    raw('refund', 23_741, 'Voorbeeldfietsen', { code: 'cb', date: '2026-11-14' }),
  ]), bicycleShopRules);
  assert.equal(summarize(rows).spent, 0);
  assert.equal(summarize(rows).income, 0);
  assert.equal(rows[0].category, 'bike');
  assert.equal(rows[0].linkedId, 'purchase');
  assert.equal(rows[1].linkedId, 'refund');
});

test('a matching name inside a wrapped payment request offsets spending', () => {
  const rows = buildLedger(ledger([
    raw('purchase', -6_273, 'Voorbeeldfietsen'),
    raw('refund', 6_273, 'Rabo Betaalverzoek', { code: 'bv', details: 'Referentie:Naam:Voorbeeld\nfietsen\nVerwerkingsdatum: 14-11-2026' }),
  ]), bicycleShopRules);
  assert.equal(rows.find(row => row.id === 'refund')?.kind, 'refund');
  assert.equal(summarize(rows).spent, 0);
});

test('local provider grouping combines rent and a heating refund across categories', t => {
  const profile = readProfile({
    version: 1,
    merchants: [{ pattern: 'voorbeeldwonen', category: 'rent', name: 'Voorbeeldwonen' }],
    classifications: [{
      match: { merchant: 'voorbeeldwonen', details: 'warmte', minAmount: 1 },
      result: { kind: 'refund', category: 'utilities', merchant: 'Voorbeeldwonen · Warmte' },
    }],
    display: { providerAliases: { 'Voorbeeldwonen · Warmte': 'Voorbeeldwonen' } },
  });
  presentProviderAliases(profile.presentation.providerAliases);
  t.after(() => presentProviderAliases({}));
  const rows = buildLedger(ledger([
    raw('rent', -61_000, 'Stichting Voorbeeldwonen'),
    raw('heating', 13_500, 'Voorbeeldwonen', { code: 'cb', details: 'Teruggave warmtekosten' }),
  ]), profile.rules);
  assert.deepEqual(byMerchant(rows).map(({ name, key, net }) => ({ name, key, net })),
    [{ name: 'Voorbeeldwonen', key: 'voorbeeldwonen', net: 47_500 }]);
  assert.equal(rows.find(row => row.id === 'rent')?.category, 'rent');
  assert.equal(rows.find(row => row.id === 'heating')?.category, 'utilities');
});

test('manual corrections override a local rule for possible own transfers', () => {
  const info = ledger([raw('question', -3_200, 'A. Voorbeeld via Rabo Betaalverzoek')]);
  const { rules } = readProfile({
    version: 1, classifications: [{
      match: { merchant: '^a\\. voorbeeld' },
      result: { kind: 'pending', category: 'pending', review: true },
    }],
  });
  assert.equal(buildLedger(info)[0].kind, 'expense');
  const pending = buildLedger(info, rules);
  assert.equal(summarize(pending).spent, 0);
  assert.equal(pending[0].review, true);
  info.corrections.question = { kind: 'expense', category: 'groceries' };
  const confirmed = buildLedger(info, rules);
  assert.equal(summarize(confirmed).spent, 3_200);
  assert.equal(confirmed[0].review, false);
});

test('planning uses complete common months and allocates available monthly savings once', () => {
  const statements = [statement('bank', '2026-07-01', '2026-11-22'), statement('card', '2026-08-01', '2026-11-22')];
  const rows = buildLedger(ledger([
    raw('salary', 240_000, 'Werkgever', { date: '2026-10-24', code: 'sb' }),
    raw('groceries', -300_00, 'Albert Heijn 1206', { date: '2026-10-10', code: 'bc' }),
  ]));
  assert.deepEqual(completeMonths(statements), ['2026-08', '2026-09', '2026-10']);
  const baseline = planningBaseline(rows, statements);
  const scenario = savingsScenario(baseline, { income: 29_000, cuts: { groceries: 20_000 } });
  assert.equal(scenario.savings, 10_000);
  assert.equal(scenario.room, 29_000);
  const goals = projectGoals([
    { id: 'a', title: 'Vakantie', target: 50_000, saved: 0, monthly: null, due: '' },
    { id: 'b', title: 'Fiets', target: 50_000, saved: 0, monthly: 9_000, due: '' },
  ], scenario.room, '2026-11-23');
  assert.equal(goals[0].plannedMonthly, 20_000);
  assert.equal(goals[0].projection, 3);
  assert.equal(goals[0].targetMonth, '2027-02');
  assert.equal(goals[1].plannedMonthly, 9_000);
});

test('local work rules are separate from private spending and pass through to card fees', () => {
  const statements = [statement('bank', '2026-11-01', '2026-11-30'), statement('card', '2026-11-01', '2026-11-30')];
  const { rules } = readProfile({
    version: 1, work: [{ merchant: '^voorbeeldcloud' }],
    classifications: [{
      match: { merchant: '^werkgever$', details: '^onkosten' },
      result: { kind: 'income', category: 'reimbursement' },
    }],
  });
  const input = ledger([
    card('cloud', -11_500, 'Voorbeeldcloud', { order: 1 }),
    card('fee', -182, 'Koersopslag', { order: 2 }),
    card('private', -2_100, 'Netflix', { order: 3 }),
    raw('decl', 19_800, 'Werkgever', { code: 'cb', details: 'Onkosten november' }),
  ], { statements });
  assert.equal(buildLedger(input).some(isWork), false);
  const rows = buildLedger(input, rules);
  assert.deepEqual(rows.filter(isWork).map(row => row.id).sort(), ['cloud', 'decl', 'fee']);
  assert.equal(filterLedger(rows, { ...emptyFilters, tags: [workTag] }).length, 3);
  assert.equal(planningBaseline(rows, statements).spending, 2_100);
  assert.equal(summarize(rows.filter(row => !isWork(row))).income, 0);
});

test('a confirmed recurring health insurance payment is a fixed cost', () => {
  const { rules } = readProfile({
    version: 1, classifications: [{
      match: { merchant: '^voorbeeldpolis$', details: 'polisbijdrage', before: '2028-01-01' },
      result: { kind: 'expense', category: 'healthinsurance' },
    }],
  });
  const [row] = buildLedger(ledger([
    raw('health', -8_250, 'Voorbeeldpolis', { code: 'bg', details: 'Polisbijdrage' }),
  ]), rules);
  assert.equal(row.category, 'healthinsurance');
  assert.equal(row.review, false);
  assert.equal(summarize([row]).spent, 8_250);
});

test('returns, received compensation and confirmed reimbursements have distinct filter tags', () => {
  const rows = buildLedger(ledger([
    raw('purchase', -23_741, 'Voorbeeldfietsen'),
    raw('refund', 23_741, 'Voorbeeldfietsen', { code: 'cb', date: '2026-11-14' }),
    raw('compensation', 30_000, 'Werkgever', { code: 'cb', details: 'Declaratie november' }),
    card('paid', -8_800, 'OPENAI *CHATGPT SUBSCR'),
    card('unconfirmed', -8_800, 'OPENAI *CHATGPT SUBSCR'),
  ], { corrections: {
    compensation: { kind: 'income', category: 'reimbursement', tags: [workTag] },
    paid: { kind: 'expense', category: 'software', subscription: 'ChatGPT', tags: [workTag], claimStatus: 'paid' },
  } }), bicycleShopRules);
  assert.ok(transactionTags(rows.find(row => row.id === 'purchase')!).includes(returnedPurchaseTag));
  const seen = filterLedger(rows, { ...emptyFilters, tags: [returnTag, compensationTag, reimbursedTag] });
  assert.deepEqual(seen.map(row => row.id).sort(), ['compensation', 'paid', 'refund']);
});

test('subscription estimates keep work, personal and fixed costs separate', () => {
  const dates = ['2026-09-10', '2026-10-10', '2026-11-10'];
  const { rules } = readProfile({ version: 1, work: [{ subscription: 'ChatGPT', minAbsoluteAmount: 10_000 }] });
  const rows = buildLedger(ledger(dates.flatMap((date, n) => [
    card(`personal-${n}`, -1_999, 'OPENAI *CHATGPT SUBSCR', { date, order: 0 }),
    card(`work-${n}`, -14_900, 'OPENAI *CHATGPT SUBSCR', { date, order: 1 }),
    raw(`fixed-${n}`, -5_000, 'KPN B.V.', { date, code: 'ei' }),
  ])), rules);
  const items = recurringItems(rows, []);
  const personal = items.find(item => item.type === 'personal');
  assert.deepEqual(personal?.ids.sort(), ['personal-0', 'personal-1', 'personal-2']);
  assert.equal(personal?.monthlyCost, 1_999);
  assert.equal(items.find(item => item.type === 'work')?.monthlyCost, 14_900);
  assert.equal(items.find(item => item.type === 'fixed')?.name, 'KPN B.V.');
  assert.equal(recurringItems(rows, [], new Set(['work-2']))[0]?.total, 14_900);
});

test('irregular charges and one-off refunds do not inflate or erase the recurring rate', () => {
  const rows = buildLedger(ledger([
    card('sport-may', -11_800, 'Voorbeeldclub', { date: '2026-05-10' }),
    card('sport-sep', -3_500, 'Voorbeeldclub', { date: '2026-09-10' }),
    card('sport-oct', -8_720, 'Voorbeeldclub', { date: '2026-10-10' }),
    card('media-aug', -1_099, 'Spotify', { date: '2026-08-10' }),
    card('media-sep', -1_099, 'Spotify', { date: '2026-09-10' }),
    card('media-oct', -1_099, 'Spotify', { date: '2026-10-10' }),
    card('media-return', 1_099, 'Spotify', { date: '2026-10-11' }),
  ]), readProfile({
    version: 1, subscriptions: [{ pattern: 'voorbeeldclub', name: 'Voorbeeldclub', category: 'fitness' }],
  }).rules);
  const items = recurringItems(rows, []);
  assert.equal(items.find(item => item.name === 'Voorbeeldclub')?.monthlyCost, null);
  assert.equal(items.find(item => item.name === 'Spotify')?.monthlyCost, 1_099);
  assert.equal(items.find(item => item.name === 'Spotify')?.total, 2_198);
});

test('merchant drill-down consolidates branches and counts payments separately from returns and fees', () => {
  const rows = buildLedger(ledger([
    raw('plus-1', -5_000, 'PLUS Supermarkt Stad', { date: '2026-11-05' }),
    raw('plus-2', -1_200, 'PLUS Supermarkt Dorp'),
    raw('plus-return', 1_200, 'PLUS Supermarkt Dorp', { code: 'cb', date: '2026-11-12', details: 'Retour: boodschappen' }),
    raw('kruidvat-1', -1_000, 'Kruidvat'),
    raw('kruidvat-2', -2_000, 'Kruidvat 6289'),
    card('dinner', -4_800, 'Pizzeria', { order: 1 }),
    card('fee', -100, 'Koersopslag', { order: 2 }),
  ]));
  const merchants = byMerchant(rows);
  assert.deepEqual(merchants.find(item => item.name === 'PLUS'), {
    key: 'plus', name: 'PLUS', net: 5_000, payments: 2, average: 3_100, lastPayment: '2026-11-10',
  });
  assert.equal(merchants.find(item => item.name === 'Kruidvat')?.payments, 2);
  assert.equal(merchants.find(item => item.name === 'Pizzeria')?.payments, 1);
  assert.equal(merchants.find(item => item.name === 'Pizzeria')?.net, 4_900);
});

test('chain variants share one group and retain month totals and frequency', () => {
  const rows = buildLedger(ledger([
    raw('ah-1', -3_000, 'Albert Heijn 1206', { date: '2026-10-14', code: 'bc' }),
    raw('ah-2', -1_500, 'ALBERTHEIJN3120', { date: '2026-11-11', code: 'bc' }),
    raw('ah-return', 1_500, 'AH Van Gameren', { date: '2026-11-12', code: 'cb', details: 'Retour: supermarkt' }),
    raw('jumbo-1', -3_750, 'Jumbo Ciboga', { date: '2026-10-08', code: 'bc' }),
    raw('jumbo-2', -800, 'BCK*JUMBO3210', { date: '2026-11-05', code: 'bc' }),
  ]));
  const groups = byMerchant(rows.filter(row => row.category === 'groceries'));
  assert.deepEqual(groups.map(({ name, payments, net }) => ({ name, payments, net })), [
    { name: 'Jumbo', payments: 2, net: 4_550 },
    { name: 'Albert Heijn', payments: 2, net: 3_000 },
  ]);
  const period = { from: '2026-10-01', to: '2026-11-30' };
  const monthly = activitySeries(rows.filter(row => row.merchant === 'Albert Heijn'), 'spending', trendCalendar(undefined, period, [period]));
  assert.deepEqual(monthly.map(({ spent, payments }) => ({ spent, payments })), [
    { spent: 3_000, payments: 1 }, { spent: 0, payments: 1 },
  ]);
});

test('private examples only receive confirmed classifications when the local profile is loaded', () => {
  const input = ledger([
    raw('salary', 210_000, 'Voorbeeld BV', { code: 'cb', details: 'Salaris november' }),
    raw('work', 19_200, 'Voorbeeld BV', { code: 'cb', details: 'Declaratie november' }),
    raw('gift', 5_000, 'Rabo Betaalverzoek', { code: 'bv', details: 'NL02FAKE0123456789:Afzender Voorbeeld:Verjaardag' }),
    raw('shared', 2_600, 'Rabo Betaalverzoek', { code: 'bv' }),
    raw('purchase', -9_200, 'Verkoper Voorbeeld', { code: 'bg', date: '2026-10-14' }),
  ]);
  const { rules } = readProfile({
    version: 1, classifications: [
      {
        match: { merchant: '^voorbeeld bv$', details: '^declaratie' },
        result: { kind: 'income', category: 'reimbursement' },
      },
      {
        match: { sender: '^afzender voorbeeld$' },
        result: { kind: 'income', category: 'gift' },
      },
      {
        match: { merchant: '^verkoper voorbeeld$', date: '2026-10-14', amount: -9_200 },
        result: { kind: 'expense', category: 'tech' },
      },
    ],
  });
  const suggestion = buildLedger(input).find(row => row.id === 'work')!;
  assert.equal(suggestion.review, true);
  assert.equal(isWork(suggestion), false);
  assert.equal(transactionTags(suggestion).includes(compensationTag), false);
  const rows = buildLedger(input, rules);
  assert.deepEqual(Object.fromEntries(rows.map(row => [row.id, row.category])), {
    salary: 'salary', work: 'reimbursement', gift: 'gift', shared: 'sharedrefund', purchase: 'tech',
  });
  assert.equal(isWork(rows.find(row => row.id === 'work')!), true);
  assert.ok(transactionTags(rows.find(row => row.id === 'shared')!).includes(returnedMoneyTag));
});

test('utilities can be displayed independently of all other fixed charges', () => {
  const dates = ['2026-09-10', '2026-10-10', '2026-11-10'];
  const rows = buildLedger(ledger(dates.flatMap((date, n) => [
    raw(`energy-${n}`, -7_000, 'Vattenfall', { date, code: 'ei' }),
    raw(`phone-${n}`, -2_000, 'KPN', { date, code: 'ei' }),
    card(`media-${n}`, -1_000, 'Netflix', { date }),
  ])));
  const items = recurringItems(rows, []);
  const shown = (view: typeof defaultSubscriptionView) =>
    items.filter(item => subscriptionInView(item, view)).map(item => item.category);
  assert.deepEqual(shown(defaultSubscriptionView), ['streaming']);
  assert.deepEqual(shown({ ...defaultSubscriptionView, types: [], includeUtilities: true }), ['utilities']);
  assert.deepEqual(shown({ ...defaultSubscriptionView, types: ['fixed'] }), ['telecom']);
});

test('calendar quarter filters totals and plots three month buckets', () => {
  const period = { unit: 'quarter', month: '2026-11' } as const;
  const bounds = periodBounds(period);
  assert.deepEqual(bounds, { from: '2026-10-01', to: '2026-12-31' });
  const rows = buildLedger(ledger([
    raw('before', -900, 'Jumbo', { date: '2026-09-30' }),
    raw('first', -500, 'Jumbo', { date: '2026-10-01' }),
    raw('last', -700, 'Jumbo', { date: '2026-12-31' }),
    raw('after', -800, 'Jumbo', { date: '2027-01-01' }),
  ]));
  const filtered = filterLedger(rows, { ...emptyFilters, period });
  const series = trendSeries(filtered, trendCalendar(period, bounds, [bounds]));
  assert.deepEqual(series.map(({ date, spent }) => [date, spent]), [
    ['2026-10', 500], ['2026-11', 0], ['2026-12', 700],
  ]);
  assert.equal(summarize(filtered).spent, 1200);
});

test('month charts distinguish unavailable days from covered days with zero bookings', () => {
  const period = { unit: 'month', month: '2028-02' } as const;
  const bounds = periodBounds(period);
  const covered = intersectDates(bounds, { from: '2028-02-26', to: '2028-03-04' });
  assert.deepEqual(covered, { from: '2028-02-26', to: '2028-02-29' });
  const rows = buildLedger(ledger([raw('leap', -500, 'Jumbo', { date: '2028-02-29' })]));
  const series = activitySeries(rows, 'spending', trendCalendar(period, bounds, covered ? [covered] : []));
  assert.equal(series.length, 29);
  assert.deepEqual(series.slice(-5).map(({ date, spent, payments }) => [date, spent, payments]), [
    ['2028-02-25', null, undefined], ['2028-02-26', 0, 0], ['2028-02-27', 0, 0],
    ['2028-02-28', 0, 0], ['2028-02-29', 500, 1],
  ]);
});

test('period arrows navigate available periods across year boundaries', () => {
  const months = availableMonths([
    { from: '2025-11-20', to: '2026-01-15' },
    { from: '2026-05-01', to: '2026-05-31' },
    { from: '2026-05-22', to: '2026-06-04' },
  ]);
  assert.deepEqual(months, ['2025-11', '2025-12', '2026-01', '2026-05', '2026-06']);
  assert.deepEqual(periodNavigation({ unit: 'quarter', month: '2026-01' }, months), {
    previous: { unit: 'quarter', month: '2025-12' },
    next: { unit: 'quarter', month: '2026-06' },
  });
  assert.equal(periodNavigation({ unit: 'month', month: '2026-06' }, months).next, undefined);
  assert.deepEqual(periodInYear({ unit: 'month', month: '2026-05' }, '2025', months),
    { unit: 'month', month: '2025-12' });
});
