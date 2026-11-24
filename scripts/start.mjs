import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, statSync, writeSync } from 'node:fs';
import { get } from 'node:http';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const privateDirectory = join(root, '.private');
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const ports = Array.from({ length: 10 }, (_, index) => 4317 + index);
const windows = process.platform === 'win32';
const address = port => `http://127.0.0.1:${port}`;

function probe(port, { healthPath, instanceHeader, instance }) {
  return new Promise(resolve => {
    const request = get(address(port) + healthPath, { agent: false }, response => {
      const matches = response.statusCode === 204 && response.headers[instanceHeader] === instance;
      response.destroy();
      resolve(matches ? 'ready' : 'occupied');
    });
    request.on('error', error => resolve(error.code === 'ECONNREFUSED' ? 'free' : 'occupied'));
    const timeout = setTimeout(() => request.destroy(), 750);
    request.on('close', () => clearTimeout(timeout));
  });
}

function modified(path) {
  return statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0;
}

function newestSource(directory) {
  return Math.max(modified(directory), ...readdirSync(directory, { withFileTypes: true }).map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? newestSource(path) : modified(path);
  }));
}

async function dependenciesReady() {
  const installed = modified(join(root, 'node_modules', '.package-lock.json'));
  if (installed < modified(join(root, 'package-lock.json')) || !existsSync(vite)) return false;
  try {
    await import('vite');
    return true;
  } catch {
    // Native dependencies must be reinstalled when the project moves between operating systems.
    return false;
  }
}

function runNpm(args, log) {
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const [program, ...parameters] = !windows ? ['npm', ...args]
    : existsSync(npmCli) ? [process.execPath, npmCli, ...args]
      : [process.env.ComSpec ?? 'cmd.exe', '/d', '/c', 'npm.cmd', ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(program, parameters, {
      cwd: root, windowsHide: true, stdio: ['ignore', log, log],
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(' ')} is mislukt.`));
    });
  });
}

async function prepare(log) {
  const install = !(await dependenciesReady());
  if (install) await runNpm(['ci', '--include=dev'], log);
  const built = modified(join(root, 'dist', 'index.html'));
  const inputs = ['index.html', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json'];
  const latestChange = Math.max(
    ...inputs.map(file => modified(join(root, file))),
    newestSource(join(root, 'src')),
    newestSource(join(root, 'server')),
  );
  if (install || !built || latestChange > built) await runNpm(['run', 'build'], log);
}

async function startPreview(port, health, log) {
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort'], {
    cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log],
  });
  let exited = false;
  let spawnError;
  server.once('error', error => { spawnError = error; });
  server.once('exit', () => { exited = true; });
  server.unref();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await probe(port, health) === 'ready') return true;
    if (spawnError) throw spawnError;
    if (exited) return false;
    await delay(150);
  }
  server.kill();
  throw new Error('De lokale server reageert niet.');
}

async function dashboardUrl() {
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('Installeer Node.js 24 of nieuwer om Financiën te starten.');
  }
  const { DatabaseSync } = await import('node:sqlite');
  const { healthPath, instanceHeader, localInstance } = await import('../server/local-instance.ts');
  const health = { healthPath, instanceHeader, instance: localInstance(root) };
  mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });

  // SQLite releases this lock when the launcher exits, including after an interrupted start.
  const lock = new DatabaseSync(join(privateDirectory, 'launcher.lock'));
  try {
    lock.exec('PRAGMA busy_timeout = 300000');
    lock.exec('BEGIN IMMEDIATE');
    const states = await Promise.all(ports.map(port => probe(port, health)));
    const running = ports[states.indexOf('ready')];
    if (running !== undefined) return address(running) + '/';

    const available = ports.filter((_, index) => states[index] === 'free');
    if (!available.length) throw new Error('Alle lokale poorten voor Financiën (4317–4326) zijn bezet.');
    const log = openSync(join(privateDirectory, 'launcher.log'), 'w', 0o600);
    try {
      await prepare(log);
      for (const port of available) {
        if (await startPreview(port, health, log)) return address(port) + '/';
        // A different process may have claimed this port while we were building.
        if (await probe(port, health) === 'free') break;
      }
      throw new Error('De lokale server kon niet worden gestart.');
    } catch (error) {
      writeSync(log, `\n${error.stack ?? error}\n`);
      throw new Error(`${error.message}\nZie .private/launcher.log in de projectmap.`);
    } finally {
      closeSync(log);
    }
  } finally {
    lock.close();
  }
}

try {
  console.log(await dashboardUrl());
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
