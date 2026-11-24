import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBalance, readSavingsRate } from '../server/validation.ts';
import { balanceTrend, bankAccounts, savingsInsights } from '../src/domain/wealth.ts';
import type { Ledger, RawTransaction, Statement, Transaction } from '../src/domain/types.ts';

const statement = (accountId: string, from: string, to: string, source: Statement['source'] = 'bank'): Statement => ({
  id: `${accountId}:${from}`, accountId, source, label: accountId, from, to, debit: 0, credit: 0, count: 0, pages: 1,
});
const booking = (id: string, accountId: string, date: string, amount: number, source: RawTransaction['source'] = 'bank'): RawTransaction => ({
  id, date, accountId, source, amount, code: '', merchant: id, details: '', counterparty: '', ownCounterparty: false, order: 0, page: 1,
});
const empty: Ledger = { statements: [], transactions: [], corrections: {}, goals: [], scenario: { income: null, cuts: {} } };

test('bank balances use signed bookings on their own account in both directions from the closing balance', () => {
  const sep = (id: string, day: string, amount: number, account = 'bank') => booking(id, account, `2026-09-${day}`, amount);
  const ledger: Ledger = {
    ...empty,
    statements: [statement('bank', '2026-09-01', '2026-09-30'), statement('savings', '2026-09-01', '2026-09-30'),
      statement('card', '2026-09-01', '2026-09-30', 'card')],
    balances: [{ accountId: 'bank', amount: 75_000, date: '2026-09-02' }, { accountId: 'savings', amount: 50_000, date: '2026-08-31' }],
    transactions: [sep('groceries', '02', -25_000), sep('transfer-out', '04', -20_000), sep('transfer-in', '04', 20_000, 'savings'),
      booking('card purchase', 'card', '2026-09-03', -10_000, 'card'), booking('card funding', 'card', '2026-09-05', 10_000, 'card'),
      sep('card settlement', '05', -10_000), sep('work expense', '06', -5_000), sep('employer reimbursement', '09', 5_000)],
    corrections: { 'work expense': { kind: 'expense', category: 'education', claimStatus: 'paid' } },
  };
  const accounts = bankAccounts(ledger, '2026-11-24');
  assert.deepEqual(accounts.map(account => account.id), ['bank', 'savings']);
  assert.equal(accounts[0].daily.get('2026-08-31'), 100_000);
  assert.equal(accounts[0].daily.get('2026-09-02'), 75_000);
  assert.equal(accounts[0].daily.get('2026-09-04'), 55_000);
  assert.equal(accounts[1].daily.get('2026-09-04'), 70_000);
  const trend = balanceTrend(accounts, 90);
  assert.equal(trend.find(day => day.date === '2026-09-04')?.amount, 125_000);
  assert.equal(trend.find(day => day.date === '2026-09-05')?.amount, 115_000);
  assert.equal(trend.find(day => day.date === '2026-09-06')?.amount, 110_000);
  assert.deepEqual(trend.at(-1), { date: '2026-09-30', amount: 115_000 });
});

test('balance history stops at missing statements and totals use a shared date', () => {
  const october = statement('bank', '2026-10-01', '2026-10-31');
  const november = statement('bank', '2026-11-01', '2026-11-22');
  const ledger: Ledger = {
    ...empty,
    statements: [statement('bank', '2026-09-01', '2026-09-30'), november],
    transactions: [booking('november', 'bank', '2026-11-20', 10_000)],
    balances: [{ accountId: 'bank', amount: -1000, date: '2026-09-30' }],
  };
  assert.deepEqual(balanceTrend(bankAccounts(ledger, '2026-11-24'), 90).at(-1), { date: '2026-09-30', amount: -1000 });
  ledger.statements.push(october);
  assert.deepEqual(balanceTrend(bankAccounts(ledger, '2026-11-24'), 90).at(-1), { date: '2026-11-22', amount: 9000 });
  ledger.balances!.push({ accountId: 'manual', label: 'Spaarrekening', amount: 20_000, date: '2026-11-10' });
  assert.deepEqual(balanceTrend(bankAccounts(ledger, '2026-11-24'), 90), [{ date: '2026-11-10', amount: 19_000 }]);
  ledger.balances![1].date = '2026-11-24';
  assert.deepEqual(balanceTrend(bankAccounts(ledger, '2026-11-24'), 90), []);
});

test('saving insights use complete months and keep card purchases and work flows distinct', () => {
  const period = [statement('bank', '2026-09-01', '2026-11-22'), statement('card', '2026-09-01', '2026-09-30', 'card')];
  const row = (id: string, amount: number, kind: Transaction['kind'], category: string, source: RawTransaction['source'] = 'bank',
    tags?: string[]): Transaction => ({
    ...booking(id, source, '2026-09-12', amount, source), originalMerchant: id, kind, category, reason: '', review: false, tags,
  });
  const rows = [row('salary', 300_000, 'income', 'salary'), row('benefits', 20_000, 'income', 'benefits'),
    row('gift', 50_000, 'income', 'gift'), row('rent', -100_000, 'expense', 'rent'), row('streaming', -2_000, 'expense', 'streaming', 'card'),
    row('groceries', -50_000, 'expense', 'groceries', 'card'), row('refund', 8_000, 'refund', 'groceries', 'card'),
    row('settlement', -44_000, 'transfer', 'transfer'), row('work expense', -20_000, 'expense', 'education', 'bank', ['Declareren werk']),
    row('reimbursement', 12_000, 'income', 'reimbursement', 'bank', ['Declareren werk'])];
  const result = savingsInsights(rows, period, '2026-11-24', 30)!;
  assert.deepEqual(result.covered, ['2026-09']);
  assert.equal(result.income, 320_000);
  assert.equal(result.fixed, 102_000);
  assert.equal(result.room, 176_000);
  assert.equal(result.target, 96_000);
  assert.deepEqual(result.categories.map(item => item.id), ['rent', 'streaming']);
  assert.deepEqual(result.data.at(-1), { month: '2026-09', income: 320_000, room: 176_000 });
  assert.equal(result.data.length, 1);
});

test('an explicit wealth period shows the full balance range without inventing dates beyond coverage', () => {
  const ledger: Ledger = {
    ...empty,
    statements: [statement('bank', '2025-01-01', '2026-06-30')],
    balances: [{ accountId: 'bank', amount: 20_000, date: '2025-01-01' }],
    transactions: [booking('first', 'bank', '2025-02-02', 10_000), booking('last', 'bank', '2026-05-04', -1_000)],
  };
  const accounts = bankAccounts(ledger, '2026-11-24');
  const selected = balanceTrend(accounts, undefined, '2025-02-10', '2026-05-31');
  assert.deepEqual(selected[0], { date: '2025-02-10', amount: 30_000 });
  assert.deepEqual(selected.at(-1), { date: '2026-05-31', amount: 29_000 });
  assert.ok(selected.length > 365);
  assert.deepEqual(balanceTrend(accounts, undefined, '2026-07-01', '2026-07-31'), []);
});

test('wealth period filters keep whole months with complete coverage of all sources', () => {
  const sources = [
    statement('bank', '2025-01-01', '2025-10-31'),
    statement('card', '2025-01-01', '2025-01-31', 'card'),
    statement('card', '2025-03-01', '2025-10-31', 'card'),
  ];
  const row = (id: string, date: string, amount: number, kind: Transaction['kind'], category: string,
    source: RawTransaction['source']): Transaction =>
    ({ ...booking(id, source, date, amount, source), originalMerchant: id, kind, category, reason: '', review: false });
  const rows = [
    row('pay', '2025-03-01', 200_000, 'income', 'salary', 'bank'),
    row('subscription', '2025-03-10', -3_000, 'expense', 'streaming', 'card'),
  ];
  const today = '2025-10-26';
  assert.deepEqual(savingsInsights(rows, sources, today, null)?.covered, ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09']);
  assert.equal(savingsInsights(rows, sources, today, null, { from: '', to: '' })?.covered.length, 8);
  const selected = savingsInsights(rows, sources, today, 20, { from: '2025-01-10', to: '2025-04-20' });
  assert.deepEqual(selected?.covered, ['2025-03']);
  assert.equal(selected?.room, 197_000);
  assert.equal(selected?.fixed, 3_000);
  assert.equal(selected?.target, 40_000);
  assert.equal(savingsInsights(rows, sources, today, null, { from: '2025-02-01', to: '2025-02-28' }), undefined);
});

test('balance and savings settings reject invalid dates, balances and percentages', () => {
  const valid = { accountId: '123456789abcdef01234', amount: -100, date: '2026-01-31' };
  assert.equal(readBalance(valid).balance.amount, -100);
  assert.equal(readBalance({ ...valid, amount: 0 }).balance.amount, 0);
  assert.throws(() => readBalance({ ...valid, date: '2026-02-30' }));
  assert.throws(() => readBalance({ ...valid, date: '9999-01-01' }));
  assert.throws(() => readBalance({ ...valid, amount: 10.25 }));
  assert.equal(readSavingsRate({ rate: 0 }), 0);
  assert.equal(readSavingsRate({ rate: null }), null);
  assert.throws(() => readSavingsRate({ rate: 101 }));
});
