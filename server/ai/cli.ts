import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess, ExecException } from 'node:child_process';
import { aiProviderNames } from '../../src/domain/ai.ts';
import type { AiProvider, AiSelection, AiStatus } from '../../src/domain/ai.ts';
import { InputError } from '../validation.ts';
import { resolveCli } from './executable.ts';

export class AiProviderError extends InputError {}

export type Schema = Record<string, unknown>;

const signIns = new Map<AiProvider, { child: ChildProcess; url?: string }>();

function loginArguments(provider: AiProvider) {
  return provider === 'codex' ? ['login'] : ['auth', 'login'];
}

function missingCli(provider: AiProvider) {
  return new InputError('Installeer ' + aiProviderNames[provider] + ' op dit apparaat en klik opnieuw op CLI verbinden.');
}

export function loginEnvironment() {
  const env = { ...process.env };
  for (const variable of [
    'OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL', 'ANTHROPIC_PROFILE', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_GATEWAY',
  ]) delete env[variable];
  return env;
}

function run(provider: AiProvider, args: string[], options: { cwd?: string; prompt?: string; timeout: number; signal?: AbortSignal }) {
  const command = resolveCli(provider);
  if (!command) {
    const error: ExecException = Object.assign(missingCli(provider), { code: 'ENOENT', cmd: provider });
    return Promise.resolve({ stdout: '', stderr: '', error });
  }
  const [file, ...prefix] = command;
  return new Promise<{ stdout: string; stderr: string; error: ExecException | null }>(resolve => {
    const child = execFile(file, [...prefix, ...args], {
      cwd: options.cwd, env: loginEnvironment(), timeout: options.timeout, signal: options.signal,
      maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    }, (error, stdout, stderr) => resolve({ stdout, stderr, error }));
    child.stdin?.on('error', () => {});
    child.stdin?.end(options.prompt);
  });
}

export async function providerStatus(provider: AiProvider): Promise<AiStatus> {
  const signIn = signIns.get(provider);
  if (signIn) return { provider, state: 'signedOut', signingIn: true, loginUrl: signIn.url };
  const output = await run(provider, provider === 'codex' ? ['login', 'status'] : ['auth', 'status'], { timeout: 10_000 });
  const report = output.stdout + output.stderr;
  let state: AiStatus['state'] = 'unavailable';
  if (output.error?.code === 'ENOENT') state = 'missing';
  else if (provider === 'codex') {
    if (/logged in using chatgpt/i.test(report)) state = 'ready';
    else if (/logged in using/i.test(report)) state = 'otherAuth';
    else if (/not logged in|not authenticated/i.test(report)) state = 'signedOut';
  } else {
    try {
      const value = JSON.parse(output.stdout);
      if (value.loggedIn === false) state = 'signedOut';
      else if (value.loggedIn === true) {
        state = ['claude.ai', 'claude', 'claudeAi'].includes(value.authMethod) ? 'ready' : 'otherAuth';
      }
    } catch {
      // An older CLI or a login error can report text rather than JSON.
      if (/not logged in|not authenticated/i.test(report)) state = 'signedOut';
    }
  }
  const started = signIns.get(provider);
  return { provider, state, signingIn: Boolean(started), loginUrl: started?.url };
}

export function officialLoginUrl(provider: AiProvider, output: string) {
  const origins = provider === 'codex'
    ? ['https://auth.openai.com']
    : ['https://claude.ai', 'https://claude.com', 'https://platform.claude.com'];
  for (const [candidate] of output.matchAll(/https:\/\/[^\s<>"'\x1b]+/g)) {
    const url = URL.parse(candidate);
    if (url && !url.username && !url.password && origins.includes(url.origin)
      && /^(?:\/oauth2?\/authorize|\/authorize)$/.test(url.pathname)
      && url.searchParams.has('state') && url.searchParams.has('client_id')) return url.href;
  }
}

async function login(provider: AiProvider, terminal: boolean, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (signIns.has(provider)) throw new InputError('Er loopt al een aanmelding bij ' + aiProviderNames[provider] + '.');
  const command = resolveCli(provider);
  if (!command) throw missingCli(provider);
  const [file, ...prefix] = command;
  const name = aiProviderNames[provider];
  const child = spawn(file, [...prefix, ...loginArguments(provider)], {
    env: loginEnvironment(), stdio: terminal ? 'inherit' : ['ignore', 'pipe', 'pipe'], windowsHide: !terminal, signal,
  });
  const attempt: { child: ChildProcess; url?: string } = { child };
  signIns.set(provider, attempt);
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
    stdout = (stdout + chunk).slice(-16_384);
    attempt.url ??= officialLoginUrl(provider, stdout.slice(0, stdout.lastIndexOf('\n') + 1));
  });
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-16_384);
    attempt.url ??= officialLoginUrl(provider, stderr.slice(0, stderr.lastIndexOf('\n') + 1));
  });
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, 300_000);
  timer.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      child.once('error', () => reject(new InputError('Aanmelden bij ' + name + ' kon niet starten. Controleer de CLI.')));
      child.once('close', code => {
        if (code === 0) resolve();
        else if (timedOut) reject(new InputError('De aanmelding bij ' + name + ' verliep. Klik opnieuw op CLI verbinden.'));
        else reject(new InputError('Aanmelden bij ' + name + ' is afgebroken of mislukt. Probeer opnieuw of gebruik `'
          + [provider, ...loginArguments(provider)].join(' ') + '` in je terminal.'));
      });
    });
  } finally {
    clearTimeout(timer);
    signIns.delete(provider);
  }
}

export function loginInTerminal(provider: AiProvider) {
  return login(provider, true);
}

export async function connectProvider(provider: AiProvider, signal?: AbortSignal) {
  const status = await providerStatus(provider);
  signal?.throwIfAborted();
  if (!status.signingIn && (status.state === 'signedOut' || status.state === 'otherAuth')) {
    await login(provider, false, signal);
    await requireProvider(provider);
  } else {
    requireReady(status);
  }
}

function providerFailure(provider: AiProvider, report: string, timedOut: boolean) {
  const name = aiProviderNames[provider];
  if (timedOut) return new AiProviderError(name + ' antwoordde niet op tijd. Probeer opnieuw of kies een sneller model.');
  if (/unknown (option|argument)|unexpected argument|unrecognized option/i.test(report)) {
    return new AiProviderError('Deze versie van ' + name + ' ondersteunt de modeltest niet. Werk de CLI bij en probeer opnieuw.');
  }
  if (/rate limit|usage limit|out of extra usage|quota|429|hit your limit/i.test(report)) {
    return new AiProviderError('De gebruikslimiet voor ' + name + ' is bereikt. Je kunt later verdergaan.');
  }
  if (/not logged in|not authenticated|authentication|sign in|login|unauthorized|401/i.test(report)) {
    return new AiProviderError('Meld je opnieuw aan bij ' + name + ' via de eigen CLI.');
  }
  if (/attempt to write a readonly database|permission denied|access is denied|operation not permitted/i.test(report)) {
    return new AiProviderError(name + ' kan zijn eigen CLI-map niet bijwerken. Start Financiën vanuit je eigen gebruikerssessie en klik opnieuw op CLI verbinden.');
  }
  if (/model.{0,80}(not found|not supported|unavailable|access)|invalid model/i.test(report)) {
    return new AiProviderError('Dit model is niet beschikbaar via ' + name + '. Kies het standaardmodel of een ander model.');
  }
  return new AiProviderError(name + ' kon deze opdracht niet afronden. Controleer de CLI-versie en probeer opnieuw.');
}

function requireReady({ provider, state, signingIn }: AiStatus) {
  if (signingIn) throw new InputError('Rond eerst de aanmelding af bij ' + aiProviderNames[provider] + '.');
  if (state === 'ready') return;
  const name = aiProviderNames[provider];
  const instruction = provider === 'codex' ? 'codex login' : 'claude auth login';
  if (state === 'missing') throw missingCli(provider);
  throw new InputError(state === 'unavailable' ? 'De status van ' + name + ' is niet leesbaar. Werk de CLI bij en probeer opnieuw.'
      : 'Meld je met je eigen abonnement aan bij ' + name + ' (' + instruction + ').');
}

export async function requireProvider(provider: AiProvider) {
  requireReady(await providerStatus(provider));
}

export const claudeSafeArguments = ['--print', '--safe-mode', '--no-session-persistence', '--tools', '',
  '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--disallowedTools', 'mcp__*'];

export type RunAi = (selection: AiSelection, prompt: string, schema: Schema, signal?: AbortSignal) => Promise<unknown>;

export const runAi: RunAi = async ({ provider, model, effort }, prompt, schema, signal) => {
  const work = await mkdtemp(join(tmpdir(), 'financien-ai-'));
  const schemaPath = join(work, 'schema.json');
  const answerPath = join(work, 'antwoord.json');
  try {
    const modelArgs = model ? ['--model', model] : [];
    let args: string[];
    if (provider === 'codex') {
      await writeFile(schemaPath, JSON.stringify(schema), { mode: 0o600 });
      args = ['exec', '--ignore-user-config', '-c', 'cli_auth_credentials_store="auto"',
        '--skip-git-repo-check', '--sandbox', 'read-only',
        '--ephemeral', '--json', '--output-schema', schemaPath, '--output-last-message', answerPath, ...modelArgs,
        ...(effort ? ['-c', 'model_reasoning_effort=' + JSON.stringify(effort)] : []), '-'];
    } else {
      args = [...claudeSafeArguments, '--output-format', 'json', '--json-schema', JSON.stringify(schema), ...modelArgs,
        ...(effort ? ['--effort', effort] : [])];
    }
    const output = await run(provider, args, { cwd: work, prompt, signal, timeout: 120_000 });
    signal?.throwIfAborted();
    if (output.error) throw providerFailure(provider, output.stdout + output.stderr, output.error.killed === true);
    try {
      if (provider === 'codex') return JSON.parse(await readFile(answerPath, 'utf8')) as unknown;
      const result = JSON.parse(output.stdout);
      if (result.is_error) throw providerFailure(provider, String(result.result), false);
      if (result.structured_output === undefined) throw new Error('No structured response');
      return result.structured_output as unknown;
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw new AiProviderError(aiProviderNames[provider] + ' gaf geen bruikbaar antwoord. Probeer opnieuw.');
    }
  } finally {
    await rm(work, { force: true, recursive: true });
  }
};
