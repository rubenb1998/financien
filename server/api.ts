import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildLedger } from '../src/domain/ledger.ts';
import { healthPath, instanceHeader, localInstance } from './local-instance.ts';
import { loadProfile } from './profile.ts';
import { parsePdf } from './pdf.ts';
import { openStore } from './store.ts';
import { InputError, readCorrection, readGoal, readScenario, readSubscriptionView } from './validation.ts';

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
          ...ledger, transactions: buildLedger(ledger, rules), presentation, subscriptionView: store.subscriptionView(),
        });
      }
      if (method === 'PUT' && url === '/api/preferences/subscriptions') {
        store.saveSubscriptionView(readSubscriptionView(await json(request)));
        return respond(response, 200, { ok: true });
      }
      if (method === 'POST' && url === '/api/import') {
        const { statement, transactions } = await importFile(request);
        return respond(response, 200, store.import(statement, transactions));
      }
      if (method === 'PUT' && url === '/api/scenario') {
        store.saveScenario(readScenario(await json(request)));
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
      if (!(error instanceof InputError)) console.error(error instanceof Error ? error.message : 'Onbekende lokale serverfout.');
      respond(response, error instanceof InputError ? 400 : 500, {
        error: error instanceof InputError ? error.message : 'Opslaan of laden is mislukt. Probeer het opnieuw.',
      });
    }
  };
}
