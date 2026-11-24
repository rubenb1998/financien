import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dataDirectory } from './store.ts';

export const healthPath = '/api/health';
export const instanceHeader = 'x-financien-instance';
// A running server from an earlier API version may not have the routes the current build uses.
const apiVersion = '11';

export function localInstance(projectRoot = process.cwd()) {
  const root = realpathSync(projectRoot);
  return createHash('sha256').update(root).update('\0').update(dataDirectory(root)).update('\0').update(apiVersion).digest('hex');
}
