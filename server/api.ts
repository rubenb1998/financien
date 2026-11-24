import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AiImportResult, AiProgress, AiSelection } from '../src/domain/ai.ts';
import { buildLedger } from '../src/domain/ledger.ts';
import { readAiPageContext } from './ai/context.ts';
import { rememberChat } from './ai/memory.ts';
import { runChat } from './ai/chat.ts';
import { classifyStatement } from './ai/classify.ts';
import { AiProviderError, connectProvider, providerStatus, requireProvider, runAi } from './ai/cli.ts';
import { listAiModels } from './ai/models.ts';
import { verifyAiConnection } from './ai/connection.ts';
import { aiProvider, object, readAiSelection, readAiSettings } from './ai/input.ts';
import { loadProfile } from './profile.ts';
import { reportPdf } from './report-pdf.ts';
import { localReportModel } from './report-model.ts';
import { generateChatReport, isReportId, readChatRequest } from './reports.ts';
import { healthPath, instanceHeader, localInstance } from './local-instance.ts';
import { parsePdf } from './pdf.ts';
import { openStore } from './store.ts';
import { InputError, isBalanceAccount, readBalance, readCorrection, readGoal, readSavingsRate, readScenario, readSubscriptionView } from './validation.ts';

const maxPdfBytes = 50 * 1024 * 1024;

async function body(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new InputError('Het bestand of de invoer is te groot.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function json(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type'] !== 'application/json') throw new InputError('Verwacht JSON-invoer.');
  try { return JSON.parse((await body(request, 32_768)).toString('utf8')); } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError('De invoer is ongeldig.');
  }
}

function respond(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

async function importFile(request: IncomingMessage) {
  if (request.headers['content-type'] !== 'application/pdf') throw new InputError('Selecteer een PDF.');
  if (Number(request.headers['content-length']) > maxPdfBytes) throw new InputError('De maximale PDF-grootte is 50 MB.');
  const file = await body(request, maxPdfBytes);
  if (file.subarray(0, 5).toString() !== '%PDF-') throw new InputError('Dit bestand is geen leesbare PDF.');
  const folder = await mkdtemp(join(tmpdir(), 'financien-'));
  try {
    const path = join(folder, 'afschrift.pdf');
    await writeFile(path, file, { mode: 0o600 });
    try { return await parsePdf(path); } catch (error) {
      throw new InputError(error instanceof Error ? error.message : 'PDF-import mislukt.');
    }
  } finally {
    await rm(folder, { force: true, recursive: true });
  }
}

export function createApi() {
  const instance = localInstance();
  let store: ReturnType<typeof openStore> | undefined;
  let aiBusy = false;
  let progress: AiProgress | null = null;

  async function runModel<T>(response: ServerResponse, task: (signal: AbortSignal) => Promise<T>) {
    if (aiBusy) throw new InputError('Er is al een AI-opdracht bezig. Probeer het zodra die klaar is.');
    aiBusy = true;
    const controller = new AbortController();
    const abort = () => controller.abort();
    response.once('close', abort);
    try {
      controller.signal.throwIfAborted();
      return await task(controller.signal);
    } finally {
      response.off('close', abort);
      aiBusy = false;
      progress = null;
    }
  }

  function selection(db: ReturnType<typeof openStore>): AiSelection {
    const settings = db.aiSettings();
    if (!settings.provider) throw new InputError('Kies eerst een AI-provider in AI-chat.');
    return { provider: settings.provider, model: settings.model, effort: settings.effort };
  }

  function classify(db: ReturnType<typeof openStore>, response: ServerResponse, statementId: string, model: AiSelection) {
    return runModel(response, async signal => {
      await requireProvider(model.provider);
      const { rules, presentation } = loadProfile();
      return classifyStatement(db, statementId, model, rules, presentation.categories.labels, runAi, signal, value => { progress = value; });
    });
  }
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = request.url?.split('?')[0] ?? '';
    if (!url.startsWith('/api/')) return next();
    const origin = request.headers.origin;
    const host = request.headers.host ?? '';
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host) ||
      (origin && origin !== `http://${host}`) || request.headers['sec-fetch-site'] === 'cross-site') {
      return respond(response, 403, { error: 'Open het dashboard via localhost.' });
    }
    if (request.method === 'GET' && url === healthPath) {
      response.writeHead(204, { [instanceHeader]: instance, 'Cache-Control': 'no-store' });
      return response.end();
    }
    try {
      store ??= openStore();
      const method = request.method;
      if (method === 'GET' && url === '/api/ledger') {
        const ledger = store.load();
        const { rules, presentation } = loadProfile();
        return respond(response, 200, {
          statements: ledger.statements, transactions: buildLedger(ledger, rules), corrections: ledger.corrections,
          goals: ledger.goals, scenario: ledger.scenario, plans: ledger.plans,
          balances: ledger.balances, savingsRate: ledger.savingsRate,
          presentation, subscriptionView: store.subscriptionView(), aiSettings: store.aiSettings(),
        });
      }
      if (method === 'GET' && url === '/api/reports') return respond(response, 200, store.reports());
      if (method === 'GET' && url === '/api/reports/ai') {
        const [model, ...providers] = await Promise.all([localReportModel(), providerStatus('codex'), providerStatus('claude')]);
        return respond(response, 200, { model: model?.name ?? null, providers });
      }
      if (method === 'POST' && url === '/api/reports/chat') {
        const { question, previousId, pending, selection: chosen } = readChatRequest(await json(request));
        const previous = previousId ? store.report(previousId) : undefined;
        if (previousId && !previous) throw new InputError('De eerdere rapportage bestaat niet meer.');
        const db = store;
        return respond(response, 200, await runModel(response, signal => generateChatReport(db, question, previous, pending, chosen, signal)));
      }
      const reportRoute = url.match(/^\/api\/reports\/([^/]+)(\/pdf)?$/);
      if (method === 'GET' && reportRoute && isReportId(reportRoute[1])) {
        const report = store.report(reportRoute[1]);
        if (!report) return respond(response, 404, { error: 'Deze rapportage bestaat niet.' });
        if (!reportRoute[2]) return respond(response, 200, report);
        const selection = new URLSearchParams(request.url?.split('?')[1]).get('charts');
        if (selection !== null) {
          const ids = selection ? selection.split(',') : [];
          if (ids.some(id => !report.charts.some(chart => chart.id === id))) throw new InputError('Kies grafieken uit deze rapportage.');
          report.charts = report.charts.filter(chart => ids.includes(chart.id));
        }
        const pdf = await reportPdf(report);
        const name = report.title.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'rapportage';
        response.writeHead(200, {
          'Content-Type': 'application/pdf', 'Content-Length': pdf.length, 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="financien-${name}-${report.date}.pdf"`,
        });
        return response.end(pdf);
      }
      if (method === 'PUT' && url === '/api/preferences/subscriptions') {
        store.saveSubscriptionView(readSubscriptionView(await json(request)));
        return respond(response, 200, { ok: true });
      }
      if (method === 'POST' && url === '/api/import') {
        const classifyImport = request.headers['x-financien-classify'] === 'yes';
        const provider = request.headers['x-financien-ai-provider'];
        const importModel = classifyImport && provider !== undefined ? readAiSelection({
          provider, model: request.headers['x-financien-ai-model'], effort: request.headers['x-financien-ai-effort'],
        }) : undefined;
        const { statement, transactions } = await importFile(request);
        const result: AiImportResult = store.import(statement, transactions);
        if (classifyImport) {
          try {
            result.ai = await classify(store, response, statement.id, importModel ?? selection(store));
          } catch (error) {
            if (response.destroyed) return;
            result.aiError = error instanceof InputError ? error.message : 'AI-classificatie mislukt. Probeer opnieuw, het afschrift is opgeslagen.';
          }
        }
        return respond(response, 200, result);
      }
      if (method === 'GET' && url === '/api/ai/progress') return respond(response, 200, progress);
      const modelsRoute = url.match(/^\/api\/ai\/models\/(codex|claude)$/);
      if (method === 'GET' && modelsRoute) return respond(response, 200, await listAiModels(aiProvider(modelsRoute[1])));
      if (method === 'GET' && url === '/api/ai/status') {
        const db = store;
        const selected = db.aiSettings();
        return respond(response, 200, await Promise.all((['codex', 'claude'] as const).map(async provider => ({
          ...await providerStatus(provider), check: db.aiConnection(provider, provider === selected.provider ? selected.model : undefined, selected.effort),
        }))));
      }
      if (method === 'PUT' && url === '/api/ai/settings') {
        const settings = readAiSettings(await json(request));
        store.saveAiSettings(settings);
        return respond(response, 200, settings);
      }
      if (method === 'POST' && url === '/api/ai/check') {
        const db = store;
        const model = readAiSelection(await json(request));
        return respond(response, 200, await runModel(response, signal => verifyAiConnection(db, model, signal)));
      }
      if (method === 'POST' && url === '/api/ai/connect') {
        const db = store;
        const model = readAiSelection(await json(request));
        return respond(response, 200, await runModel(response,
          signal => verifyAiConnection(db, model, signal, runAi, connectProvider)));
      }
      if (method === 'POST' && url === '/api/ai/classify') {
        const { statementId, model } = object(await json(request));
        if (typeof statementId !== 'string' || !/^[a-f0-9]{64}$/.test(statementId)) throw new InputError('Kies een geldig afschrift.');
        return respond(response, 200, await classify(store, response, statementId, model === undefined ? selection(store) : readAiSelection(model)));
      }
      if (method === 'DELETE' && /^\/api\/ai\/memory\/\d{1,15}$/.test(url)) {
        if (aiBusy) throw new InputError('Wacht tot de AI-opdracht klaar is.');
        store.forget(Number(url.split('/').at(-1)));
        return respond(response, 200, store.memory());
      }
      if (method === 'GET' && url === '/api/ai/chat') {
        return respond(response, 200, { messages: store.chatHistory(), memory: store.memory(), canUndo: store.aiUndo().length > 0, changed: false });
      }
      if (method === 'DELETE' && url === '/api/ai/chat') {
        if (aiBusy) throw new InputError('Wacht tot de AI-opdracht klaar is.');
        store.clearChat();
        return respond(response, 200, { messages: [], canUndo: store.aiUndo().length > 0, changed: false });
      }
      if (method === 'POST' && url === '/api/ai/chat') {
        const { text, allowChanges, activePage } = object(await json(request));
        if (typeof text !== 'string' || !text.trim() || text.length > 6_000 || typeof allowChanges !== 'boolean') {
          throw new InputError('Vul een bericht in van maximaal 6000 tekens.');
        }
        const context = readAiPageContext(activePage);
        if (aiBusy) throw new InputError('Wacht tot de AI-opdracht klaar is.');
        const remembered = rememberChat(store, text.trim());
        if (remembered) return respond(response, 200, remembered);
        const db = store;
        const model = selection(db);
        return respond(response, 200, await runModel(response, async signal => {
          await requireProvider(model.provider);
          try {
            const result = await runChat(db, model, text.trim(), allowChanges, runAi, signal, context);
            db.saveAiConnection({ ...model, outcome: 'verified', checkedAt: new Date().toISOString() });
            return result;
          } catch (error) {
            if (error instanceof AiProviderError && !signal.aborted) {
              db.saveAiConnection({ ...model, outcome: 'failed', checkedAt: new Date().toISOString(), error: error.message });
            }
            throw error;
          }
        }));
      }
      if (method === 'POST' && url === '/api/ai/undo') {
        if (aiBusy) throw new InputError('Wacht tot de AI-opdracht klaar is.');
        return respond(response, 200, store.undoAiCorrections());
      }
      if (method === 'PUT' && url === '/api/scenario') {
        store.saveScenario(readScenario(await json(request)));
        return respond(response, 200, { ok: true });
      }
      if (method === 'PUT' && url === '/api/balances') {
        const { balance, previousId } = readBalance(await json(request));
        store.saveBalance(balance, previousId);
        return respond(response, 200, { ok: true });
      }
      const balanceId = url.match(/^\/api\/balances\/([^/]+)$/)?.[1];
      if (method === 'DELETE' && isBalanceAccount(balanceId)) {
        store.removeBalance(balanceId);
        return respond(response, 200, { ok: true });
      }
      if (method === 'PUT' && url === '/api/savings-rate') {
        store.saveSavingsRate(readSavingsRate(await json(request)));
        return respond(response, 200, { ok: true });
      }
      if (method === 'PUT' && url === '/api/goals') {
        store.saveGoal(readGoal(await json(request)));
        return respond(response, 200, { ok: true });
      }
      const goal = url.match(/^\/api\/goals\/([a-f0-9-]{36})$/);
      if (method === 'DELETE' && goal) {
        store.removeGoal(goal[1]);
        return respond(response, 200, { ok: true });
      }
      const correction = url.match(/^\/api\/corrections\/([a-f0-9]{28}-\d+)$/);
      if (correction && store.hasTransaction(correction[1]) && ['PUT', 'DELETE'].includes(method ?? '')) {
        store.correct(correction[1], method === 'DELETE' ? null : readCorrection(await json(request)));
        return respond(response, 200, { ok: true });
      }
      respond(response, 404, { error: 'Het gevraagde onderdeel bestaat niet.' });
    } catch (error) {
      if (response.destroyed) return;
      if (!(error instanceof InputError)) console.error(error instanceof Error ? error.message : 'Onbekende lokale serverfout.');
      respond(response, error instanceof InputError ? 400 : 500, {
        error: error instanceof InputError ? error.message : 'Opslaan of laden is mislukt. Probeer het opnieuw.',
      });
    }
  };
}
