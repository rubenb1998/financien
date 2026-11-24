import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openStore } from '../server/store.ts';
import type { SavingsPlan } from '../src/domain/savings-types.ts';
import type { RawTransaction, Statement } from '../src/domain/types.ts';

test('overlapping imports are idempotent and preserve local corrections and goals', () => {
  const root = mkdtempSync(join(tmpdir(), 'financien-test-'));
  const previous = process.env.FINANCIEN_DATA_DIR;
  process.env.FINANCIEN_DATA_DIR = root;
  const source: Statement = { id: 'a', accountId: 'bank', source: 'bank', label: 'Bank', from: '2026-11-01',
    to: '2026-11-22', debit: 2500, credit: 0, count: 1, pages: 1 };
  const row: RawTransaction = { id: 'x', accountId: 'bank', source: 'bank', date: '2026-11-08', amount: -2500,
    code: 'bc', merchant: 'Winkel', counterparty: '', details: '', ownCounterparty: false, order: 0, page: 1 };
  const store = openStore();
  try {
    assert.equal(store.subscriptionView(), null);
    store.saveSubscriptionView({ types: ['fixed'], period: 'recent', includeUtilities: true });
    assert.equal(store.import(source, [row]).added, 1);
    store.correct(row.id, { kind: 'expense', category: 'groceries' });
    store.saveGoal({ id: 'a', title: 'Vakantie', target: 50_000, saved: 0, monthly: null, due: '' });
    const plan: SavingsPlan = {
      id: 'vakantie', title: 'Vakantie', target: 50_000, saved: 0, reserve: 0, startMonth: '2026-12', endMonth: '2027-05',
      analysisDate: '2026-11-23', caps: {}, baseline: { income: [], lines: [], months: [], reserveMonths: [], spentMonthly: 0, exclusions: [] },
    };
    store.savePlans([plan, { ...plan, id: 'vakantie-met-buffer', reserve: 30_000 }]);
    store.savePlans([{ ...plan, endMonth: '2027-06' }]);
    assert.equal(store.import(source, [row]).duplicates, 1);
    assert.equal(store.import({ ...source, id: 'overlap' }, [row]).duplicates, 1);
    const reopened = openStore();
    try {
      assert.deepEqual(reopened.subscriptionView(), { types: ['fixed'], period: 'recent', includeUtilities: true });
    } finally {
      reopened.close();
    }
    const imported = store.load();
    assert.equal(imported.transactions.length, 1);
    assert.equal(imported.corrections[row.id].category, 'groceries');
    assert.equal(imported.goals[0].target, 50_000);
    assert.equal(imported.plans?.length, 2);
    assert.equal(imported.plans?.find(saved => saved.id === 'vakantie')?.endMonth, '2027-06');
    assert.equal(imported.plans?.find(saved => saved.id === 'vakantie-met-buffer')?.reserve, 30_000);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.FINANCIEN_DATA_DIR;
    else process.env.FINANCIEN_DATA_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
