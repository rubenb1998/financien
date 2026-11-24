import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Correction, Goal, ImportResult, Ledger, RawTransaction, Scenario, Statement } from '../src/domain/types.ts';
import type { SubscriptionView } from '../src/domain/subscription-view.ts';
import type { SavingsPlan } from '../src/domain/savings-types.ts';

export const dataDirectory = () => resolve(process.env.FINANCIEN_DATA_DIR ?? '.private');

export function openStore() {
  const folder = dataDirectory();
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(folder, 'financien.sqlite'));
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS statements (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, statement_id TEXT NOT NULL REFERENCES statements(id), payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY REFERENCES transactions(id), payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS savings_plans (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS preferences (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
  `);

  function payloads<T>(table: 'statements' | 'transactions' | 'goals' | 'savings_plans'): T[] {
    return db.prepare(`SELECT payload FROM ${table}`).all().map(row => JSON.parse(String(row.payload)) as T);
  }

  const store = {
    subscriptionView(): SubscriptionView | null {
      const row = db.prepare("SELECT payload FROM preferences WHERE id = 'subscription_view'").get();
      return row ? JSON.parse(String(row.payload)) as SubscriptionView : null;
    },
    saveSubscriptionView(view: SubscriptionView) {
      db.prepare("INSERT OR REPLACE INTO preferences VALUES ('subscription_view', ?)").run(JSON.stringify(view));
    },
    load(): Ledger {
      const correctionRows = db.prepare('SELECT id, payload FROM corrections').all();
      const scenario = db.prepare("SELECT payload FROM preferences WHERE id = 'scenario'").get();
      return {
        statements: payloads<Statement>('statements'),
        transactions: payloads<RawTransaction>('transactions'),
        corrections: Object.fromEntries(correctionRows.map(row => [row.id, JSON.parse(String(row.payload))])),
        goals: payloads<Goal>('goals'),
        plans: payloads<SavingsPlan>('savings_plans'),
        scenario: scenario ? JSON.parse(String(scenario.payload)) as Scenario : { income: null, cuts: {} },
      };
    },
    import(statement: Statement, transactions: RawTransaction[]): ImportResult {
      const stored = { ...statement, importedAt: new Date().toISOString() };
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db.prepare('INSERT OR IGNORE INTO statements VALUES (?, ?)').run(stored.id, JSON.stringify(stored));
        const insert = db.prepare('INSERT OR IGNORE INTO transactions VALUES (?, ?, ?)');
        let added = 0;
        if (result.changes) {
          for (const row of transactions) {
            added += Number(insert.run(row.id, stored.id, JSON.stringify({ ...row, statementId: stored.id })).changes);
          }
        }
        db.exec('COMMIT');
        return { statement: stored, added, duplicates: transactions.length - added };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    hasTransaction(id: string) {
      return Boolean(db.prepare('SELECT 1 FROM transactions WHERE id = ?').get(id));
    },
    correct(id: string, value: Correction | null) {
      if (value === null) db.prepare('DELETE FROM corrections WHERE id = ?').run(id);
      else db.prepare('INSERT OR REPLACE INTO corrections VALUES (?, ?)').run(id, JSON.stringify(value));
    },
    updateCorrection(id: string, update: (ledger: Ledger) => Correction) {
      db.exec('BEGIN IMMEDIATE');
      try {
        store.correct(id, update(store.load()));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    saveGoal(goal: Goal) {
      db.prepare('INSERT OR REPLACE INTO goals VALUES (?, ?)').run(goal.id, JSON.stringify(goal));
    },
    removeGoal(id: string) {
      db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    },
    saveScenario(scenario: Scenario) {
      db.prepare("INSERT OR REPLACE INTO preferences VALUES ('scenario', ?)").run(JSON.stringify(scenario));
    },
    savePlans(plans: SavingsPlan[]) {
      const upsert = db.prepare('INSERT INTO savings_plans VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET payload = excluded.payload');
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const plan of plans) upsert.run(plan.id, JSON.stringify(plan));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
  return store;
}

export type Store = ReturnType<typeof openStore>;
