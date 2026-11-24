import { InputError, isManualAccount } from './validation.ts';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultAiSettings } from '../src/domain/ai.ts';
import type { AiChatMessage, AiClassification, AiConnectionCheck, AiEffort, AiMemoryNote, AiProvider, AiSettings } from '../src/domain/ai.ts';
import type { AccountBalance, Correction, Goal, ImportResult, Ledger, RawTransaction, Scenario, Statement } from '../src/domain/types.ts';
import type { SubscriptionView } from '../src/domain/subscription-view.ts';
import type { FinancialReport, ReportSummary } from '../src/domain/reports.ts';
import type { SavingsPlan } from '../src/domain/savings-types.ts';

export const dataDirectory = (root = process.cwd()) => resolve(root, process.env.FINANCIEN_DATA_DIR ?? '.private');

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
    CREATE TABLE IF NOT EXISTS ai_classifications (
      id TEXT PRIMARY KEY REFERENCES transactions(id), payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, summary TEXT NOT NULL, payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preferences (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_chat_messages (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_memory (id INTEGER PRIMARY KEY, text TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS account_balances (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
  `);

  function payloads<T>(table: 'statements' | 'transactions' | 'goals' | 'savings_plans' | 'account_balances'): T[] {
    return db.prepare(`SELECT payload FROM ${table}`).all().map(row => JSON.parse(String(row.payload)) as T);
  }

  function preference<T>(id: string): T | undefined {
    const row = db.prepare('SELECT payload FROM preferences WHERE id = ?').get(id);
    return row ? JSON.parse(String(row.payload)) as T : undefined;
  }

  function savePreference(id: string, value: unknown) {
    db.prepare('INSERT OR REPLACE INTO preferences VALUES (?, ?)').run(id, JSON.stringify(value));
  }

  const insertChatMessage = db.prepare('INSERT INTO ai_chat_messages (payload) VALUES (?)');
  if (preference<AiChatMessage[]>('ai_chat')) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const message of preference<AiChatMessage[]>('ai_chat') ?? []) insertChatMessage.run(JSON.stringify(message));
      db.prepare("DELETE FROM preferences WHERE id = 'ai_chat'").run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  const store = {
    aiConnection(provider: AiProvider, model?: string, effort?: AiEffort) {
      const key = 'ai_connection_' + provider;
      const latest = preference<AiConnectionCheck>(key);
      return model === undefined || (latest?.model === model && latest.effort === effort) ? latest
        : preference<AiConnectionCheck>(effort ? key + '/' + JSON.stringify([model, effort]) : key + ':' + model);
    },
    saveAiConnection(check: AiConnectionCheck) {
      const key = 'ai_connection_' + check.provider;
      const payload = JSON.stringify(check);
      db.prepare('INSERT OR REPLACE INTO preferences VALUES (?, ?), (?, ?)').run(key, payload, check.effort ? key + '/' + JSON.stringify([check.model, check.effort]) : key + ':' + check.model, payload);
    },
    aiSettings: () => preference<AiSettings>('ai_settings') ?? defaultAiSettings,
    saveAiSettings: (value: AiSettings) => savePreference('ai_settings', value),
    chatHistory(limit = 32): AiChatMessage[] {
      return db.prepare('SELECT payload FROM ai_chat_messages ORDER BY id DESC LIMIT ?').all(limit)
        .reverse().map(item => JSON.parse(String(item.payload)) as AiChatMessage);
    },
    earlierChat(keywords: string[]) {
      const cutoff = db.prepare('SELECT id FROM ai_chat_messages ORDER BY id DESC LIMIT 1 OFFSET 11').get()?.id;
      if (!cutoff || !keywords.length) return [];
      const matches = keywords.map(() => "instr(lower(json_extract(payload, '$.text')), ?) > 0").join(' OR ');
      return db.prepare(`SELECT json_extract(payload, '$.text') AS text FROM ai_chat_messages
        WHERE id < ? AND json_extract(payload, '$.role') = 'user' AND (${matches})
        ORDER BY id DESC LIMIT 12`).all(cutoff, ...keywords).map(row => String(row.text));
    },
    appendChat(user: AiChatMessage, assistant: AiChatMessage) {
      db.prepare('INSERT INTO ai_chat_messages (payload) VALUES (?), (?)').run(JSON.stringify(user), JSON.stringify(assistant));
    },
    clearChat() {
      db.prepare('DELETE FROM ai_chat_messages').run();
    },
    memory(): AiMemoryNote[] {
      return db.prepare('SELECT id, text FROM ai_memory ORDER BY id DESC').all()
        .map(row => ({ id: Number(row.id), text: String(row.text) }));
    },
    remember(text: string, user: AiChatMessage, assistant: AiChatMessage) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT OR IGNORE INTO ai_memory (text) VALUES (?)').run(text);
        store.appendChat(user, assistant);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    forget(id: number) {
      db.prepare('DELETE FROM ai_memory WHERE id = ?').run(id);
    },
    aiUndo: () => preference<{ id: string; before: Correction | null; after: Correction }[]>('ai_undo') ?? [],
    applyAiCorrections(
      edits: { id: string; make: (ledger: Ledger) => Correction }[],
    ) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const ledger = store.load();
        const existing = db.prepare('SELECT payload FROM corrections WHERE id = ?');
        const changes = edits.map(({ id, make }) => {
          const prior = existing.get(id);
          return { id, before: prior ? JSON.parse(String(prior.payload)) as Correction : null, after: make(ledger) };
        });
        for (const { id, after } of changes) store.correct(id, after);
        savePreference('ai_undo', changes);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    undoAiCorrections() {
      db.exec('BEGIN IMMEDIATE');
      try {
        const changes = store.aiUndo();
        const existing = db.prepare('SELECT payload FROM corrections WHERE id = ?');
        const eligible = changes.filter(({ id, after }) => existing.get(id)?.payload === JSON.stringify(after));
        for (const { id, before } of eligible) store.correct(id, before);
        savePreference('ai_undo', []);
        db.exec('COMMIT');
        return { restored: eligible.length, skipped: changes.length - eligible.length };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    saveAiClassifications(entries: { id: string; value: AiClassification }[]) {
      const insert = db.prepare('INSERT OR IGNORE INTO ai_classifications VALUES (?, ?)');
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const { id, value } of entries) insert.run(id, JSON.stringify(value));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    subscriptionView(): SubscriptionView | null {
      const row = db.prepare("SELECT payload FROM preferences WHERE id = 'subscription_view'").get();
      return row ? JSON.parse(String(row.payload)) as SubscriptionView : null;
    },
    saveSubscriptionView(view: SubscriptionView) {
      db.prepare("INSERT OR REPLACE INTO preferences VALUES ('subscription_view', ?)").run(JSON.stringify(view));
    },
    load(): Ledger {
      const correctionRows = db.prepare('SELECT id, payload FROM corrections').all();
      const aiRows = db.prepare('SELECT id, payload FROM ai_classifications').all();
      const scenario = db.prepare("SELECT payload FROM preferences WHERE id = 'scenario'").get();
      return {
        statements: payloads<Statement>('statements'),
        transactions: payloads<RawTransaction>('transactions'),
        corrections: Object.fromEntries(correctionRows.map(row => [row.id, JSON.parse(String(row.payload))])),
        aiClassifications: Object.fromEntries(aiRows.map(row => [row.id, JSON.parse(String(row.payload))])),
        goals: payloads<Goal>('goals'),
        plans: payloads<SavingsPlan>('savings_plans'),
        balances: payloads<AccountBalance>('account_balances'),
        savingsRate: preference<number | null>('savingsRate') ?? null,
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
    saveBalance(balance: AccountBalance, previousId?: string) {
      const { accountId } = balance;
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!isManualAccount(accountId) && !payloads<Statement>('statements').some(row => row.source === 'bank' && row.accountId === accountId)) {
          throw new InputError('Kies een geïmporteerde bankrekening.');
        }
        if (previousId) {
          if (db.prepare('SELECT 1 FROM account_balances WHERE id = ?').get(accountId)) {
            throw new InputError('Voor deze bankrekening is al een saldo ingesteld.');
          }
          if (!db.prepare('DELETE FROM account_balances WHERE id = ?').run(previousId).changes) {
            throw new InputError('Deze handmatige rekening bestaat niet meer.');
          }
        }
        db.prepare('INSERT OR REPLACE INTO account_balances VALUES (?, ?)').run(accountId, JSON.stringify(balance));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    removeBalance(accountId: string) {
      db.prepare('DELETE FROM account_balances WHERE id = ?').run(accountId);
    },
    saveSavingsRate: (rate: number | null) => savePreference('savingsRate', rate),
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
    reports() {
      return db.prepare('SELECT summary FROM reports ORDER BY created_at DESC, rowid DESC').all()
        .map(row => JSON.parse(String(row.summary)) as ReportSummary);
    },
    report(id: string) {
      const row = db.prepare('SELECT payload FROM reports WHERE id = ?').get(id);
      return row ? JSON.parse(String(row.payload)) as FinancialReport : undefined;
    },
    saveReport(report: FinancialReport, replace = false) {
      const { id, date, title, question, mode, target } = report;
      const summary = JSON.stringify({ id, date, title, question, mode, target });
      const payload = JSON.stringify(report);
      if (replace) {
        const updated = db.prepare('UPDATE reports SET summary = ?, payload = ? WHERE id = ?').run(summary, payload, id);
        if (!updated.changes) throw new InputError('Deze rapportage bestaat niet.');
      } else db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?)').run(id, new Date().toISOString(), summary, payload);
    },
    close: () => db.close(),
  };
  return store;
}

export type Store = ReturnType<typeof openStore>;
