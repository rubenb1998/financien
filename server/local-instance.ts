import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dataDirectory } from './store.ts';

export const healthPath = '/api/health';
export const instanceHeader = 'x-financien-instance';

export function localInstance(projectRoot = process.cwd()) {
  const root = realpathSync(projectRoot);
  return createHash('sha256').update(root).update('\0').update(dataDirectory(root)).digest('hex');
}
