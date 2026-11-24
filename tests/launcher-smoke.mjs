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
  console.log('First launch, detached server, port fallback, dashboard, SQLite and PDF parser verified.');
} finally {
  if (pid) process.kill(pid);
  if (otherService.listening) otherService.close();
  await rm(data, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
}
