import { accessSync, constants, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import type { AiProvider } from '../../src/domain/ai.ts';

type Command = [file: string, ...args: string[]];

function executable(path: string) {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function resolveCli(provider: AiProvider, platform = process.platform, env = process.env, home = homedir(),
  isExecutable = executable): Command | undefined {
  const windows = platform === 'win32';
  const path = windows ? win32 : posix;
  const fileName = provider + (windows ? '.exe' : '');
  const override = provider === 'codex' ? env.FINANCIEN_CODEX : env.FINANCIEN_CLAUDE;
  const pathValue = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1];
  const pathEntries = (pathValue ?? '').split(path.delimiter).map(entry => entry.replace(/^"|"$/g, ''));
  const directories = [path.join(home, '.local', 'bin'), ...pathEntries];
  if (windows) {
    if (env.LOCALAPPDATA) directories.push(
      path.join(env.LOCALAPPDATA, 'Programs', 'OpenAI', 'Codex', 'bin'),
      path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links'),
      path.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps'),
    );
    if (env.APPDATA) directories.push(path.join(env.APPDATA, 'npm'));
  } else {
    directories.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin');
  }

  function npmOnWindows(directory: string): Command | undefined {
    const modules = path.join(directory, 'node_modules');
    if (provider === 'claude') {
      const native = path.join(modules, '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
      if (isExecutable(native)) return [native];
    }
    const entry = provider === 'codex'
      ? path.join(modules, '@openai', 'codex', 'bin', 'codex.js')
      : path.join(modules, '@anthropic-ai', 'claude-code', 'cli.js');
    if (isExecutable(entry)) return [process.execPath, entry];
  }

  if (override) {
    const file = path.resolve(override);
    if (windows && /\.(cmd|bat|ps1)$/i.test(file)) return npmOnWindows(path.dirname(file));
    if (isExecutable(file)) return [file];
    return;
  }
  for (const directory of new Set(directories.filter(directory => path.isAbsolute(directory)))) {
    const file = path.join(directory, fileName);
    if (isExecutable(file)) return [file];
    if (windows) {
      const npm = npmOnWindows(directory);
      if (npm) return npm;
    }
  }
  if (platform === 'darwin' && provider === 'codex') {
    const bundle = 'ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
    for (const directory of [path.join(home, 'Applications'), '/Applications']) {
      const file = path.join(directory, bundle);
      if (isExecutable(file)) return [file];
    }
  }
}
