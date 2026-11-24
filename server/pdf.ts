import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { RawTransaction, Statement } from '../src/domain/types.ts';

const execute = promisify(execFile);
const parser = fileURLToPath(new URL('./importers/rabobank.py', import.meta.url));
const virtualPython = fileURLToPath(new URL(
  process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python', import.meta.url,
));

export async function parsePdf(path: string): Promise<{ statement: Statement; transactions: RawTransaction[] }> {
  const executable = process.env.FINANCIEN_PYTHON ?? (existsSync(virtualPython) ? virtualPython : process.platform === 'win32' ? 'python' : 'python3');
  try {
    const { stdout } = await execute(executable, [parser, path], { maxBuffer: 32 * 1024 * 1024, timeout: 90_000 });
    return JSON.parse(stdout);
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    if (stderr?.includes("No module named 'pypdf'")) throw new Error('Installeer eerst pypdf met het requirements.txt-bestand.');
    if (stderr && !stderr.includes('\n') && !stderr.includes('Traceback')) throw new Error(stderr);
    throw new Error('De PDF kon niet worden gelezen of is geen ondersteund Rabobank-afschrift.');
  }
}
