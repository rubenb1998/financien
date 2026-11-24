import { categories, dashboardGroups } from '../../src/domain/categories.ts';
import { pageNames } from '../../src/domain/pages.ts';
import type { AiPageContext } from '../../src/domain/ai.ts';
import { InputError } from '../validation.ts';
import { cleanText, object } from './input.ts';

const isUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

function validDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value ? value : undefined;
}

export function readAiPageContext(value: unknown): AiPageContext | undefined {
  if (value === undefined) return;
  const input = object(value);
  if (typeof input.page !== 'string' || !Object.hasOwn(pageNames, input.page)) throw new InputError('De actieve pagina is onbekend.');
  const from = validDate(input.from);
  const to = validDate(input.to);
  const category = typeof input.category === 'string' && Object.hasOwn(categories, input.category) ? input.category : undefined;
  const group = dashboardGroups.find(([id]) => input.group === id)?.[0];
  const merchant = typeof input.merchant === 'string' ? cleanText(input.merchant, 120) : undefined;
  return {
    page: input.page as AiPageContext['page'], from, to, category, group, merchant,
    reportId: input.page === 'reports' && typeof input.reportId === 'string' && isUuid.test(input.reportId) ? input.reportId : undefined,
    statementId: input.page === 'transactions' && typeof input.statementId === 'string' && /^[a-f0-9]{64}$/.test(input.statementId) ? input.statementId : undefined,
  };
}
