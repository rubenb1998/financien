import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildLedger } from '../src/domain/ledger.ts';
import { emptyRules } from '../src/domain/profile.ts';
import type { AiSelection } from '../src/domain/ai.ts';
import type { RawTransaction, Statement } from '../src/domain/types.ts';
import { runChat } from '../server/ai/chat.ts';
import { readAiPageContext } from '../server/ai/context.ts';
import { rememberChat } from '../server/ai/memory.ts';
import { classifyStatement } from '../server/ai/classify.ts';
import { officialLoginUrl } from '../server/ai/cli.ts';
import { verifyAiConnection } from '../server/ai/connection.ts';
import { resolveCli } from '../server/ai/executable.ts';
import { prepareReport } from '../server/reports.ts';
import { openStore } from '../server/store.ts';

const bank: Statement = {
  id: 'example', source: 'bank', accountId: 'example-account', label: 'Fictieve bank', from: '2026-04-01',
  to: '2026-10-31', debit: 0, credit: 0, count: 4, pages: 1,
};
const booking = (id: string, amount: number, patch: Partial<RawTransaction> = {}): RawTransaction => ({
  id, amount, accountId: bank.accountId, source: 'bank', date: '2026-10-01', code: 'bc', details: '',
  merchant: 'Voorbeeldwinkel', counterparty: '', ownCounterparty: false, order: 0, page: 1, ...patch,
});

function trial(rows: RawTransaction[]) {
  const folder = mkdtempSync(join(tmpdir(), 'financien-ai-test-'));
  const previous = process.env.FINANCIEN_DATA_DIR;
  process.env.FINANCIEN_DATA_DIR = folder;
  const store = openStore();
  store.import(bank, rows);
  return { store, close() {
    store.close();
    if (previous === undefined) delete process.env.FINANCIEN_DATA_DIR;
    else process.env.FINANCIEN_DATA_DIR = previous;
    rmSync(folder, { recursive: true, force: true });
  } };
}

test('AI classifies an imported selection, saves review suggestions and preserves transfers and manual corrections', async t => {
  const { store, close } = trial([
    booking('expense', -2500, { details: 'Voorbeeldtekst NL02FAKE0123456789' }),
    booking('income', 800, { code: 'cb', merchant: 'Voorbeeld BV' }),
    booking('transfer', -1200, { code: 'tb' }),
    booking('manual', -800),
  ]);
  t.after(close);
  store.correct('manual', { kind: 'expense', category: 'shopping' });
  const selection: AiSelection = { provider: 'claude', model: 'haiku' };
  const progress: number[] = [];
  const result = await classifyStatement(store, bank.id, selection, emptyRules, {}, async (chosen, prompt) => {
    assert.equal(chosen, selection);
    assert.match(prompt, /\[rekening\]/);
    assert.doesNotMatch(prompt, /NL02FAKE0123456789/);
    const rows = JSON.parse(prompt.split('\n').at(-1)!);
    assert.equal(rows.length, 2);
    return { entries: rows.map(({ number, kind }: { number: number; kind: string }) => ({
      number, category: kind === 'income' ? 'reimbursement' : 'dining', subscription: null, confidence: 'confident',
      reason: 'Fictieve aanwijzing.',
    })) };
  }, undefined, value => progress.push(value.reviewed));
  assert.deepEqual(progress, [0, 2]);
  assert.deepEqual(result, { classified: 2, review: 1, remaining: 0 });
  const rows = new Map(buildLedger(store.load()).map(row => [row.id, row]));
  assert.equal(rows.get('expense')?.category, 'dining');
  assert.equal(rows.get('income')?.category, 'otherincome');
  assert.equal(rows.get('income')?.suggestedCategory, 'reimbursement');
  assert.equal(rows.get('transfer')?.kind, 'transfer');
  assert.equal(rows.get('manual')?.category, 'shopping');
  assert.equal((await classifyStatement(store, bank.id, selection, emptyRules, {}, async () => {
    assert.fail('Already classified transactions should not consume model usage.');
  })).classified, 0);
});

test('a malformed model response leaves the checked import intact and retry starts at the unclassified rows', async t => {
  const { store, close } = trial(Array.from({ length: 56 }, (_, n) => booking('sample-' + n, -2500)));
  t.after(close);
  const selection: AiSelection = { provider: 'codex', model: 'example' };
  let calls = 0;
  await assert.rejects(classifyStatement(store, bank.id, selection, emptyRules, {}, async () => {
    if (calls++) return { entries: [] };
    return { entries: Array.from({ length: 55 }, (_, n) => ({
      number: n + 1, category: null, subscription: null, confidence: 'keep', reason: '',
    })) };
  }), /overgeslagen/);
  assert.equal(store.load().transactions.length, 56);
  assert.equal(Object.keys(store.load().aiClassifications ?? {}).length, 55);
  const retry = await classifyStatement(store, bank.id, selection, emptyRules, {}, async () => ({
    entries: [{ number: 1, category: 'tech', subscription: null, confidence: 'confident', reason: 'Fictief.' }],
  }));
  assert.equal(retry.classified, 1);
});

test('chat searches before correcting a work reimbursement and undo protects later edits', async t => {
  const { store, close } = trial([booking('first', 6300, { code: 'cb' }), booking('second', 6300, { code: 'cb' })]);
  t.after(close);
  const selection: AiSelection = { provider: 'codex', model: '' };
  const pick = {
    message: '', lookup: { query: null, from: '2026-10-01', to: '2026-10-01', amount: 6300,
      category: null, kind: null, includeWork: true, transfers: false },
    corrections: [], subscriptions: null, plan: null,
  };
  const apply = {
    message: 'Vergoeding opgeslagen.', lookup: null, corrections: [
      { id: 'first', kind: 'income', category: 'reimbursement' },
      { id: 'second', kind: 'income', category: 'reimbursement' },
    ], subscriptions: null, plan: null,
  };
  await assert.rejects(runChat(store, selection, 'Wijzig een boeking', true, async () => apply), /niet eenduidig opgezocht/);
  assert.deepEqual(store.load().corrections, {});
  let turns = 0;
  const answer = await runChat(store, selection, 'Markeer beide bijschrijvingen als werkvergoeding.', true, async () => turns++ ? apply : pick);
  assert.equal(answer.changed, true);
  assert.equal(answer.canUndo, true);
  assert.deepEqual(store.load().corrections.first.tags, ['Declareren werk']);
  store.correct('second', { kind: 'income', category: 'gift' });
  assert.deepEqual(store.undoAiCorrections(), { restored: 1, skipped: 1 });
  assert.equal(store.load().corrections.first, undefined);
  assert.equal(store.load().corrections.second.category, 'gift');
});

test('chat can read overview totals, bank coverage and saved goals from the dashboard', async t => {
  const { store, close } = trial([
    booking('personal', -2500),
    booking('work', -1900),
    booking('transfer', -1700, { code: 'tb' }),
  ]);
  t.after(close);
  store.correct('work', { kind: 'expense', category: 'transport', tags: ['Declareren werk'] });
  store.saveGoal({ id: 'fictief-doel', title: 'Fictief spaardoel', target: 90000, saved: 15000, due: '2027-05-01', monthly: 12500 });
  const scopes = ['overview', 'sources', 'goals'];
  let step = 0;
  const answer = await runChat(store, { provider: 'codex', model: '' }, 'Wat staat er op het dashboard?', false, async (_, prompt) => {
    const { lookups } = JSON.parse(prompt.split('\n').at(-1)!);
    if (step === 1) {
      assert.equal(lookups.at(-1).totals.spent, 2500);
      assert.deepEqual(lookups.at(-1).rows, []);
    }
    if (step === 2) {
      assert.equal(lookups.at(-1).sourceCount, 1);
      assert.deepEqual(lookups.at(-1).coverage, { from: bank.from, to: bank.to });
    }
    if (step === 3) assert.equal(lookups.at(-1).goals[0].saved, 15000);
    const scope = scopes[step++];
    return {
      message: scope ? '' : 'Uitgaven, afschriften en spaardoel opgehaald.',
      lookup: scope ? { scope, query: null, from: null, to: null, amount: null, category: null,
        kind: null, includeWork: false, transfers: false } : null,
      corrections: [], subscriptions: null, plan: null,
    };
  });
  assert.equal(answer.messages.at(-1)?.text, 'Uitgaven, afschriften en spaardoel opgehaald.');
  assert.equal(answer.changed, false);
});

test('the chat uses the active report, keeps memory across restarts and lets the user forget a preference', async t => {
  const { store, close } = trial([booking('private-test-row', -2500)]);
  let reopened: ReturnType<typeof openStore> | undefined;
  t.after(() => { reopened?.close(); close(); });
  const note = 'ik bij vakantiesparen eerst een grafiek wil zien';
  const remembered = rememberChat(store, 'Onthoud dat ' + note);
  assert.equal(remembered?.memory?.[0].text, note);
  store.appendChat({ role: 'user', text: 'Hoeveel kan ik opzijzetten voor vakantiesparen?' }, { role: 'assistant', text: 'Voorbeeldantwoord' });
  for (let i = 0; i < 12; i++) {
    store.appendChat({ role: 'user', text: 'Andere vraag ' + i }, { role: 'assistant', text: 'Antwoord ' + i });
  }
  reopened = openStore();
  const reportId = 'd5cb9d6e-4242-4fd6-ad51-63e2ff671af1';
  const { report } = prepareReport(reopened, { mode: 'saving', question: 'Vakantiesparen', target: 25_000, income: 185_000, charts: ['projection'] }, reportId);
  reopened.saveReport(report);
  let lookedUp = false;
  const context = readAiPageContext({ page: 'reports', reportId, from: '2026-10-01', merchant: 'Voorbeeldwinkel',
    to: '2026-02-31', statementId: 'a'.repeat(64) });
  const selection: AiSelection = { provider: 'codex', model: '' };
  await runChat(reopened, selection, 'Hoe ziet mijn vakantiesparen eruit in dit rapport?', false, async (_, prompt) => {
    const input = JSON.parse(prompt.split('\n').at(-1)!);
    assert.deepEqual(input.activePage, { title: 'Rapportages', page: 'reports', reportId, from: '2026-10-01', merchant: 'Voorbeeldwinkel' });
    assert.deepEqual(input.memory, [note]);
    assert.deepEqual(input.earlierQuestions, ['Hoeveel kan ik opzijzetten voor vakantiesparen?']);
    assert.doesNotMatch(prompt, /private-test-row/);
    const result = { message: '', lookup: null, corrections: [], subscriptions: null, plan: null };
    if (!lookedUp) {
      lookedUp = true;
      return { ...result, lookup: { scope: 'reports', query: null } };
    }
    assert.equal(input.lookups[0].report.title, report.title.replaceAll(/\s+/g, ' '));
    assert.equal(input.lookups[0].report.projection.rows.length, 7);
    return { ...result, message: 'Je vakantieoverzicht.' };
  }, undefined, context);
  assert.ok(lookedUp);
  reopened.clearChat();
  assert.deepEqual(reopened.chatHistory(), []);
  assert.equal(reopened.memory()[0].text, note);
  reopened.forget(remembered!.memory![0].id);
  assert.deepEqual(reopened.memory(), []);
});

test('the model check records results for the requested provider and model without sharing bookings', async t => {
  const { store, close } = trial([booking('private-test-row', -2500)]);
  t.after(close);
  const authenticate = async () => {};
  const codex: AiSelection = { provider: 'codex', model: 'example-codex' };
  const claude: AiSelection = { provider: 'claude', model: 'haiku' };
  const result = await verifyAiConnection(store, codex, undefined, async (selection, prompt) => {
    assert.deepEqual(selection, codex);
    assert.doesNotMatch(prompt, /private-test-row|2500/);
    return { ok: true };
  }, authenticate);
  assert.equal(result.outcome, 'verified');
  const failed = await verifyAiConnection(store, claude, undefined, async () => ({ ok: false }), authenticate);
  assert.equal(failed.outcome, 'failed');
  assert.match(failed.error ?? '', /geen geldig testantwoord/);
  assert.deepEqual(store.aiConnection('codex'), result);
  assert.deepEqual(store.aiConnection('claude'), failed);
  const second = await verifyAiConnection(store, { ...claude, model: 'sonnet' }, undefined, async () => ({ ok: true }), authenticate);
  assert.equal(store.aiConnection('claude', 'haiku')?.outcome, 'failed');
  assert.deepEqual(store.aiConnection('claude', 'sonnet'), second);
  assert.equal(store.aiConnection('claude', '')?.outcome, undefined);
  const high = await verifyAiConnection(store, { ...codex, effort: 'high' }, undefined, async (selection) => {
    assert.equal(selection.effort, 'high');
    return { ok: true };
  }, authenticate);
  assert.deepEqual(store.aiConnection('codex', codex.model), result);
  assert.deepEqual(store.aiConnection('codex', codex.model, 'high'), high);
  assert.equal(store.aiConnection('codex', codex.model, 'low'), undefined);
});

test('chat can read the same closing balance and sharing date as the wealth page', async t => {
  const { store, close } = trial([booking('expense', -2500)]);
  t.after(close);
  store.saveBalance({ accountId: bank.accountId, amount: 100_000, date: '2026-09-30' });
  store.saveSavingsRate(25);
  const answer = await runChat(store, { provider: 'codex', model: '' }, 'Hoe hoog is het banksaldo?', false, async (_, prompt) => {
    const { lookups } = JSON.parse(prompt.split('\n').at(-1)!);
    if (lookups.length) {
      assert.deepEqual(lookups[0].last, { date: '2026-10-31', amount: 97_500 });
      assert.equal(lookups[0].rate, 25);
      return { message: 'Banksaldo opgehaald.', lookup: null, corrections: [], subscriptions: null, plan: null };
    }
    return {
      message: '',
      lookup: { scope: 'wealth', query: null, from: null, to: null, amount: null, category: null,
        kind: null, includeWork: false, transfers: false },
      corrections: [], subscriptions: null, plan: null,
    };
  });
  assert.equal(answer.changed, false);
});

test('CLI discovery handles native Windows installs and npm shims with spaces in the path', () => {
  const home = String.raw`C:\Users\Finance Example`;
  const local = home + String.raw`\AppData\Local`;
  const roaming = home + String.raw`\AppData\Roaming`;
  const env = { Path: '"C:\\Custom Tools";C:\\Windows', APPDATA: roaming, LOCALAPPDATA: local };
  const native = local + String.raw`\Programs\OpenAI\Codex\bin\codex.exe`;
  const external = String.raw`C:\Custom Tools\claude.exe`;
  const codexEntry = roaming + String.raw`\npm\node_modules\@openai\codex\bin\codex.js`;
  const claudeEntry = roaming + String.raw`\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe`;
  assert.deepEqual(resolveCli('codex', 'win32', env, home, file => file === native), [native]);
  assert.deepEqual(resolveCli('claude', 'win32', env, home, file => file === external), [external]);
  assert.deepEqual(resolveCli('codex', 'win32', env, home, file => file === codexEntry), [process.execPath, codexEntry]);
  assert.deepEqual(resolveCli('claude', 'win32', env, home, file => file === claudeEntry), [claudeEntry]);
  assert.equal(resolveCli('codex', 'win32', env, home, () => false), undefined);
});

test('CLI discovery sees macOS installations outside the launcher PATH', () => {
  const home = '/Users/example';
  const native = '/opt/homebrew/bin/claude';
  const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
  assert.deepEqual(resolveCli('claude', 'darwin', { PATH: '/usr/bin' }, home, file => file === native), [native]);
  assert.deepEqual(resolveCli('codex', 'darwin', {}, home, file => file === bundled), [bundled]);
});

test('the CLI sign-in link accepts only official authorization URLs for the chosen provider', () => {
  const codex = 'https://auth.openai.com/oauth/authorize?client_id=test&state=fictitious';
  const claude = 'https://claude.com/oauth/authorize?client_id=test&state=fictitious';
  const unrelated = 'https://auth.openai.com.example.org/oauth/authorize?client_id=test&state=fictitious';
  assert.equal(officialLoginUrl('codex', unrelated + '\n' + codex), codex);
  assert.equal(officialLoginUrl('claude', codex + '\n' + claude), claude);
  assert.equal(officialLoginUrl('claude', codex), undefined);
  assert.equal(officialLoginUrl('codex', 'https://auth.openai.com/other?client_id=test&state=fictitious'), undefined);
});
