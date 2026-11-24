import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { RawTransaction, Statement } from '../src/domain/types.ts';

const execute = promisify(execFile);
const parser = fileURLToPath(new URL('./importers/rabobank.py', import.meta.url));
const windows = process.platform === 'win32';
const virtualPython = fileURLToPath(new URL(windows ? '../.venv/Scripts/python.exe' : '../.venv/bin/python', import.meta.url));

export async function parsePdf(path: string): Promise<{ statement: Statement; transactions: RawTransaction[] }> {
  const executable = process.env.FINANCIEN_PYTHON ?? (existsSync(virtualPython) ? virtualPython : windows ? 'python' : 'python3');
  try {
    const { stdout } = await execute(executable, ['-X', 'utf8', parser, path], {
      maxBuffer: 32 * 1024 * 1024, timeout: 90_000, windowsHide: true,
    });
    return JSON.parse(stdout);
  } catch (error) {
    const { code, stderr: output } = error as { code?: string; stderr?: string };
    if (code === 'ENOENT') throw new Error('Python 3 ontbreekt. Volg de stappen voor PDF-import in de README.');
    const stderr = output?.trim();
    if (stderr?.includes("No module named 'pypdf'")) throw new Error('Installeer pypdf met requirements.txt volgens de stappen voor PDF-import in de README.');
    if (stderr && !stderr.includes('\n') && !stderr.includes('Traceback')) throw new Error(stderr);
    throw new Error('De PDF kon niet worden gelezen of is geen ondersteund Rabobank-afschrift.');
  }
}
