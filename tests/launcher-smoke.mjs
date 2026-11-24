import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { localInstance } from '../server/local-instance.ts';

const execute = promisify(execFile);
const windows = process.platform === 'win32';
const root = process.cwd();
const data = await mkdtemp(join(tmpdir(), 'Financiën test-'));
process.env.FINANCIEN_DATA_DIR = data;

const launcher = join(root, windows ? 'Financien.exe' : 'Financiën.app/Contents/MacOS/launch');
const launch = async () => (await execute(launcher, ['--print-url'], { timeout: 120_000 })).stdout.trim();

async function listeningPid(port) {
  if (!windows) {
    const { stdout } = await execute('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN']);
    return Number(stdout.trim());
  }
  const { stdout } = await execute('netstat.exe', ['-ano', '-p', 'tcp']);
  const lines = stdout.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/));
  const row = lines.find(([, local, remote]) => local === '127.0.0.1:' + port && remote === '0.0.0.0:0');
  return Number(row?.at(-1));
}

async function examplePdf(lines) {
  const { default: PDFDocument } = await import('pdfkit');
  const doc = new PDFDocument({ margin: 24 });
  const chunks = [];
  const rendered = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  doc.font('Courier').fontSize(8);
  for (const [index, line] of lines.entries()) doc.text(line, 24, 24 + 16 * index, { lineBreak: false });
  doc.end();
  return rendered;
}

const account = 'NL00FAKE0000000001 EUR';
const bankColumns = (date, name, debit, credit = '') =>
  date.padEnd(11) + ''.padEnd(26) + name.padEnd(29) + debit.padEnd(23) + credit;

const otherService = createServer((_request, response) => response.end('Another local service'));
await new Promise((resolve, reject) => {
  otherService.once('error', error => error.code === 'EADDRINUSE' ? resolve() : reject(error));
  otherService.listen(4317, '127.0.0.1', resolve);
});

let pid;
try {
  const startTime = performance.now();
  const [first, second] = await Promise.all([launch(), launch()]);
  console.log('First launch completed in %ss.', ((performance.now() - startTime) / 1000).toFixed(1));
  assert.match(first, /^http:\/\/127\.0\.0\.1:43\d{2}\/$/);
  const port = Number(new URL(first).port);
  const health = await fetch(new URL('/api/health', first));
  assert.equal(health.status, 204);
  assert.equal(health.headers.get('x-financien-instance'), localInstance());
  pid = await listeningPid(port);
  assert.ok(Number.isInteger(pid) && pid > 0, 'A background server is listening');
  assert.notEqual(port, 4317, 'The launcher skips a port used by another service');
  assert.equal(second, first, 'Concurrent launches return the same URL');
  assert.equal(await launch(), first, 'A subsequent launch reuses the server');
  assert.equal(await listeningPid(port), pid, 'The server process did not restart');

  const html = await (await fetch(first)).text();
  assert.match(html, /Persoonlijk dashboard/);
  const asset = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(asset, 'The launcher built the dashboard');
  assert.equal((await fetch(new URL(asset, first))).status, 200);
  const ledger = await fetch(new URL('/api/ledger', first));
  assert.equal(ledger.status, 200);
  assert.deepEqual((await ledger.json()).transactions, []);

  const python = join(root, windows ? '.venv/Scripts/python.exe' : '.venv/bin/python');
  const { stdout: pdf } = await execute(python, ['-c', [
    'from io import BytesIO',
    'import sys',
    'from pypdf import PdfWriter',
    'pdf = PdfWriter()',
    'pdf.add_blank_page(width=100, height=100)',
    'buffer = BytesIO()',
    'pdf.write(buffer)',
    'sys.stdout.buffer.write(buffer.getvalue())',
  ].join('\n')], { encoding: 'buffer' });
  const upload = await fetch(new URL('/api/import', first), {
    method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: pdf,
  });
  assert.equal(upload.status, 400);
  assert.match((await upload.json()).error, /Kies een Rabobank-rekeningafschrift/);
  const api = (path, options) => fetch(new URL(path, first), options);
  async function read(path, options) {
    const response = await api(path, options);
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    return result;
  }
  const initial = await read('/api/ledger');
  assert.deepEqual(initial.statements, []);
  assert.equal(initial.aiSettings.autoClassify, false);
  assert.deepEqual(await read('/api/reports'), []);
  assert.deepEqual((await read('/api/ai/chat')).memory, []);
  assert.equal((await api('/api/ledger', { headers: { Origin: 'http://example.invalid' } })).status, 403);

  const bank = await examplePdf([
    'Rekeningafschrift', account, 'Datum vanaf', '01-10-2025', 'Datum tot en met', '31-10-2025',
    'Totaal afgeschreven    Totaal bijgeschreven', 'EUR   37,50   2.100,00',
    'Datum Code '.padEnd(11) + 'Tegenrekening'.padEnd(26) + 'Naam/omschrijving'.padEnd(29)
      + 'Bedrag af (debet)'.padEnd(23) + 'Bedrag bij (credit)',
    bankColumns('01-10 sb', 'Fictieve werkgever', '', '2.100,00'),
    bankColumns('07-10 bc', 'Voorbeeld supermarkt', '37,50'),
  ]);
  const card = await examplePdf([
    'Details Creditcard', account, 'Kaartnummer **** **** 1234', 'Periode 01-10-2025 t/m 31-10-2025',
    'Totaal 0,00', 'bijgeschreven', 'Totaal afgeschreven 12,50', '10-10-2025  Voorbeeldwinkel  -12,50',
  ]);
  const importPdf = body => read('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body });
  assert.equal((await importPdf(bank)).added, 2);
  assert.equal((await importPdf(card)).added, 1);
  assert.equal((await importPdf(bank)).duplicates, 2);
  const imported = await read('/api/ledger');
  assert.deepEqual(imported.transactions.map(row => row.amount).sort((a, b) => a - b), [-3750, -1250, 210000]);

  const saved = await read('/api/ai/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Onthoud dat ik eerst de vermogensgrafiek wil zien.', allowChanges: false,
      activePage: { page: 'reports' } }),
  });
  assert.equal(saved.memory.length, 1);
  assert.deepEqual((await read('/api/ai/chat')).memory, saved.memory);
  await read('/api/ai/chat', { method: 'DELETE' });
  assert.deepEqual((await read('/api/ai/chat')).memory, saved.memory);
  assert.deepEqual(await read('/api/ai/memory/' + saved.memory[0].id, { method: 'DELETE' }), []);

  const { openStore } = await import('../server/store.ts');
  const { prepareReport } = await import('../server/reports.ts');
  const store = openStore();
  const { report } = prepareReport(store, { question: 'Hoe ziet zes maanden sparen eruit?', mode: 'saving',
    target: 60_000, projectionMonths: 6, charts: ['projection'] });
  try { store.saveReport(report); }
  finally { store.close(); }
  const restored = await read('/api/reports/' + report.id);
  assert.deepEqual(restored.charts.map(chart => chart.id), ['projection']);
  assert.equal(restored.charts[0].rows.length, 7);
  const response = await api('/api/reports/' + report.id + '/pdf?charts=projection');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  console.log('Native start, empty storage, bank and card import, duplicate handling, chat memory and six-month report PDF verified.');
} finally {
  if (pid) process.kill(pid);
  if (otherService.listening) otherService.close();
  await rm(data, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
}
