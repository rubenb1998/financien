import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSavingsRequest } from '../server/savings-request.ts';
import { buildLedger } from '../src/domain/ledger.ts';
import { savingsBaseline } from '../src/domain/savings-baseline.ts';
import { projectSavings } from '../src/domain/savings-projection.ts';
import type { SavingsBaseline, SavingsPlan } from '../src/domain/savings-types.ts';
import { careSpendTag, fixedSpendTag, transactionTags } from '../src/domain/tags.ts';
import type { RawTransaction, Statement } from '../src/domain/types.ts';

const baseline: SavingsBaseline = {
  income: [{ label: 'Salaris', monthly: 250_000 }],
  months: ['2026-10'], reserveMonths: ['2026-10'], spentMonthly: 238_000, exclusions: [],
  lines: [
    { id: 'rent', kind: 'fixed', monthly: 100_000, months: 1, activeMonths: 1 },
    { id: 'groceries', kind: 'usual', monthly: 70_000, months: 1, activeMonths: 1 },
    { id: 'health', kind: 'reserve', monthly: 68_000, months: 1, activeMonths: 1 },
  ],
};

const plan: SavingsPlan = {
  id: 'test', title: 'Test', target: 50_000, saved: 0, reserve: 30_000, startMonth: '2026-12', endMonth: '2027-05',
  analysisDate: '2026-11-23', baseline,
  caps: { groceries: { monthly: 40_000, action: 'Weekbudget' } },
};

test('savings projection keeps the reserve available and caps the final deposit to the target', () => {
  const result = projectSavings(plan);
  assert.equal(result.needed, 8_334);
  assert.equal(result.ending, 50_000);
  assert.equal(result.free, 33_666);
  assert.equal(result.schedule[5].deposit, 8_330);
  assert.equal(result.schedule[5].month, '2027-05');
});

test('protected costs are never cut and a shortfall stays visible through the deadline', () => {
  const result = projectSavings({
    ...plan, target: 100_000,
    caps: { ...plan.caps, rent: { monthly: 0, action: 'Proef' }, health: { monthly: 0, action: 'Proef' } },
  });
  assert.equal(result.cuts, 30_000);
  assert.equal(result.monthlyDeposit, 12_000);
  assert.equal(result.shortfall, 28_000);
  assert.equal(result.extraNeeded, 4_667);
  assert.equal(result.finish, '2027-08');
  assert.throws(() => readSavingsRequest({ analysisDate: plan.analysisDate, plans: [{ ...plan, caps: { health: { monthly: 0, action: 'Proef' } } }] }),
    /beschermde post/);
});

test('a confirmed one-off and its refund stay outside the forecast, with protected tags on bills', () => {
  const statement: Statement = {
    id: 'test', accountId: 'bank', source: 'bank', label: 'Bank', from: '2026-10-01', to: '2026-10-31',
    debit: 200_000, credit: 50_000, count: 4, pages: 1,
  };
  const row = (id: string, amount: number, merchant: string, more: Partial<RawTransaction> = {}): RawTransaction => ({
    id, date: '2026-10-04', amount, merchant, code: 'bc', accountId: 'bank', source: 'bank', details: '',
    counterparty: '', ownCounterparty: false, order: 0, page: 1, ...more,
  });
  const rows = buildLedger({
    statements: [statement], corrections: { rent: { kind: 'expense', category: 'rent' } }, goals: [], scenario: { income: null, cuts: {} },
    transactions: [
      row('rent', -56_000, 'Woonstichting Voorbeeld'), row('care', -9_500, 'VGZ'), row('bike', -100_000, 'Canyon'),
      row('refund', 100_000, 'Canyon', { date: '2026-10-07', code: 'cb', details: 'Retour: fiets' }),
    ],
  });
  const result = savingsBaseline(rows, [statement], [{ label: 'Fiets', ids: ['bike'] }], '2026-11-23');
  assert.equal(result.exclusions[0].amount, 0);
  assert.equal(result.lines.some(line => line.id === 'bike'), false);
  assert.ok(transactionTags(rows.find(row => row.id === 'rent')!).includes(fixedSpendTag));
  assert.ok(transactionTags(rows.find(row => row.id === 'care')!).includes(careSpendTag));
});
