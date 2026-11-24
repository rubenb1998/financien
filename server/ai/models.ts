import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { aiEfforts, aiProviderNames, isAiModelId } from '../../src/domain/ai.ts';
import type { AiModel, AiProvider } from '../../src/domain/ai.ts';
import { InputError } from '../validation.ts';
import { claudeSafeArguments, loginEnvironment, requireProvider } from './cli.ts';
import { resolveCli } from './executable.ts';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function modelEntry(provider: AiProvider, item: unknown): AiModel | undefined {
  const row = record(item);
  const id = provider === 'codex' ? row.model : row.value === 'default' ? '' : row.value;
  if (!isAiModelId(id) || typeof row.displayName !== 'string' || row.hidden === true) return;
  if (provider === 'codex' && Array.isArray(row.inputModalities) && !row.inputModalities.includes('text')) return;
  const rawEfforts = provider === 'codex' && Array.isArray(row.supportedReasoningEfforts)
    ? row.supportedReasoningEfforts.map(item => record(item).reasoningEffort)
    : Array.isArray(row.supportedEffortLevels) ? row.supportedEffortLevels : [];
  const efforts = aiEfforts.filter(effort => rawEfforts.includes(effort));
  const defaultEffort = efforts.find(effort => effort === row.defaultReasoningEffort);
  return { id, name: row.displayName, efforts, defaultEffort, recommended: row.isDefault === true };
}

export async function listAiModels(provider: AiProvider): Promise<AiModel[]> {
  await requireProvider(provider);
  const command = resolveCli(provider);
  if (!command) throw new InputError('De CLI is niet meer beschikbaar.');
  const [file, ...prefix] = command;
  const args = provider === 'codex'
    ? ['app-server', '--listen', 'stdio://']
    : [...claudeSafeArguments, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'];
  const child = spawn(file, [...prefix, ...args], {
    cwd: tmpdir(), env: loginEnvironment(), stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  const entries = new Map<string, AiModel>();
  let requestId = 1;
  const send = (message: object) => child.stdin.write(JSON.stringify(message) + '\n');
  const add = (rows: unknown[]) => {
    for (const row of rows) {
      const model = modelEntry(provider, row);
      if (model) entries.set(model.id, model);
    }
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const failure = new InputError('De modellenlijst van ' + aiProviderNames[provider] + ' is niet beschikbaar. Controleer de CLI-versie.');
      const timer = setTimeout(() => reject(failure), 15_000);
      const finish = () => { clearTimeout(timer); resolve(); };
      const fail = () => { clearTimeout(timer); reject(failure); };
      child.once('error', fail);
      child.once('exit', fail);
      child.stdin.on('error', fail);
      lines.on('line', line => {
        let message: Record<string, unknown>;
        try { message = record(JSON.parse(line)); } catch { return; }
        if (provider === 'claude') {
          const response = record(message.response);
          if (message.type !== 'control_response' || response.request_id !== 'models') return;
          const models = record(response.response).models;
          if (response.subtype !== 'success' || !Array.isArray(models)) return fail();
          add(models);
          return finish();
        }

        if (message.id !== requestId) return;
        if (message.error) return fail();
        const result = record(message.result);
        if (requestId === 1) send({ method: 'initialized' });
        else {
          if (!Array.isArray(result.data)) return fail();
          add(result.data);
          if (!result.nextCursor) return finish();
          if (requestId > 10 || typeof result.nextCursor !== 'string') return fail();
        }
        send({ method: 'model/list', id: ++requestId,
          params: { limit: 100, includeHidden: false, cursor: result.nextCursor ?? null } });
      });
      if (provider === 'codex') send({ id: requestId, method: 'initialize', params: { clientInfo: { name: 'financien', version: '1.0' } } });
      else send({ type: 'control_request', request_id: 'models', request: { subtype: 'initialize' } });
    });
  } finally {
    child.stdin.end();
    lines.close();
    child.kill();
  }
  return [...entries.values()];
}
