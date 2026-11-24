import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const bundledModel = 'qwen3:1.7b';
const managedFolder = resolve(process.env.FINANCIEN_DATA_DIR ?? '.private', 'report-models');
const manifest = join(managedFolder, 'manifests', 'registry.ollama.ai', 'library', 'qwen3', '1.7b');
const installedApp = '/Applications/Ollama.app/Contents/Resources/ollama';
const regularOrigin = 'http://127.0.0.1:11434';
export type LocalModel = { origin: string; name: string; cpu?: boolean };

let managed: Promise<LocalModel | null> | undefined;
let worker: ChildProcess | undefined;

async function findModel(origin: string, preferred?: string): Promise<LocalModel | null> {
  try {
    const response = await fetch(`${origin}/api/tags`, { signal: AbortSignal.timeout(1_500), redirect: 'error' });
    if (!response.ok) return null;
    const { models } = await response.json() as { models: { name: string; size?: number; remote_model?: string; remote_host?: string }[] };
    const installed = models.filter(model => model.size && !model.remote_model && !model.remote_host && !/cloud/i.test(model.name));
    const selected = preferred ? installed.find(model => model.name === preferred) : installed[0];
    return selected ? { origin, name: selected.name } : null;
  } catch {
    return null;
  }
}

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close(error => error || typeof address !== 'object' || !address
        ? reject(error ?? new Error('Geen lokale poort beschikbaar.')) : resolve(address.port));
    });
  });
}

async function startManaged(): Promise<LocalModel | null> {
  const port = await availablePort();
  const address = `127.0.0.1:${port}`;
  const executable = process.env.FINANCIEN_OLLAMA ?? (process.platform === 'darwin' && existsSync(installedApp) ? installedApp : 'ollama');
  const child = spawn(executable, ['serve'], { stdio: 'ignore', windowsHide: true,
    env: { ...process.env, OLLAMA_HOST: address, OLLAMA_MODELS: managedFolder, OLLAMA_NO_CLOUD: '1',
      OLLAMA_NUM_PARALLEL: '1', LLAMA_ARG_DEVICE: 'none' } });
  worker = child;
  child.unref();
  let stopped = false;
  const onStop = () => {
    stopped = true;
    if (worker === child) { worker = undefined; managed = undefined; }
  };
  child.once('error', onStop);
  child.once('exit', onStop);
  for (let attempt = 0; attempt < 20 && !stopped; attempt++) {
    const model = await findModel(`http://${address}`, bundledModel);
    if (model && !stopped) return { ...model, cpu: true };
    await delay(125);
  }
  if (!stopped) child.kill();
  return null;
}

export async function localReportModel() {
  const preferred = process.env.FINANCIEN_REPORT_MODEL;
  if ((!preferred || preferred === bundledModel) && existsSync(manifest)) {
    managed ??= startManaged().catch(() => null);
    const model = await managed;
    if (model) return model;
    managed = undefined;
  }
  return findModel(regularOrigin, preferred);
}

export function closeReportModel() {
  worker?.kill();
}

process.on('exit', closeReportModel);
