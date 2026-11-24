import type { Page } from './pages.ts';
import type { ImportResult } from './types.ts';

export const aiProviderNames = { codex: 'Codex', claude: 'Claude Code' };
export type AiProvider = keyof typeof aiProviderNames;

export const aiEfforts = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;
export type AiEffort = typeof aiEfforts[number];
export const aiEffortLabels: Record<AiEffort, string> = {
  none: 'Geen', minimal: 'Minimaal', low: 'Laag', medium: 'Gemiddeld', high: 'Hoog',
  xhigh: 'Extra hoog', max: 'Maximaal', ultra: 'Ultra',
};

export function isAiModelId(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,100}(?:\[1m\])?)?$/.test(value);
}

export interface AiModel {
  id: string;
  name: string;
  efforts: AiEffort[];
  defaultEffort?: AiEffort;
  recommended?: boolean;
}

export interface AiSelection {
  provider: AiProvider;
  model: string;
  effort?: AiEffort;
}

export interface AiSettings extends Omit<AiSelection, 'provider'> {
  provider: AiProvider | null;
  autoClassify: boolean;
}

export const defaultAiSettings: AiSettings = { provider: null, model: '', autoClassify: false };

export interface AiConnectionCheck extends AiSelection {
  outcome: 'verified' | 'failed';
  checkedAt: string;
  error?: string;
}

export interface AiStatus {
  provider: AiProvider;
  state: 'ready' | 'missing' | 'signedOut' | 'otherAuth' | 'unavailable';
  signingIn: boolean;
  loginUrl?: string;
  check?: AiConnectionCheck;
}

export interface AiClassification {
  category: string | null;
  subscription: string | null;
  confidence: 'keep' | 'confident' | 'review';
  reason: string;
}

export interface AiProgress { total: number; reviewed: number }

export interface AiClassifyResult {
  classified: number;
  review: number;
  remaining: number;
}

export interface AiImportResult extends ImportResult {
  ai?: AiClassifyResult;
  aiError?: string;
}

export interface AiPageContext {
  page: Page;
  from?: string;
  to?: string;
  account?: string;
  group?: string;
  category?: string;
  merchant?: string;
  reportId?: string;
  statementId?: string;
}

export interface AiMemoryNote {
  id: number;
  text: string;
}

export function rememberedPreference(question: string) {
  const note = question.trim().match(/^(?:onthoud(?: alsjeblieft)?(?: dat)?[ :]+|voortaan[ :]+)([\s\S]+)$/i)?.[1]?.trim();
  return note && !/^dat$/i.test(note) ? note : undefined;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  text: string;
  provider?: AiProvider;
  model?: string;
}

export interface AiChatResult {
  messages: AiChatMessage[];
  changed: boolean;
  canUndo: boolean;
  memory?: AiMemoryNote[];
}
