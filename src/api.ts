import type { AiChatResult, AiClassifyResult, AiProvider, AiConnectionCheck, AiImportResult, AiMemoryNote, AiModel, AiPageContext, AiProgress, AiSelection, AiSettings, AiStatus } from './domain/ai.ts';
import type { FinancialReport, ReportSummary } from './domain/reports.ts';
import type { SubscriptionView } from './domain/subscription-view.ts';
import type { AccountBalance, Correction, DashboardLedger } from './domain/types.ts';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Verbinding met het lokale dashboard mislukt.');
  return data;
}

const json = (method: 'PUT' | 'POST', value: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
});

export const api = {
  load: () => request<DashboardLedger>('/api/ledger'),
  reports: () => request<ReportSummary[]>('/api/reports'),
  report: (id: string) => request<FinancialReport>(`/api/reports/${id}`),
  reportAi: () => request<{ model: string | null; providers: AiStatus[] }>('/api/reports/ai'),
  reportChat: (question: string, previousId?: string, pending?: { question: string; clarification: string }, selection?: AiSelection | null) =>
    request<{ message: string; report?: FinancialReport }>('/api/reports/chat', json('POST', { question, previousId, pending, selection })),
  saveSubscriptionView: (view: SubscriptionView) => request('/api/preferences/subscriptions', json('PUT', view)),
  upload: (file: File, model: AiSelection | null) => request<AiImportResult>('/api/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      ...(model && { 'X-Financien-Classify': 'yes', 'X-Financien-AI-Provider': model.provider, 'X-Financien-AI-Model': model.model, ...(model.effort && { 'X-Financien-AI-Effort': model.effort }) }),
    },
    body: file,
  }),
  aiProgress: () => request<AiProgress | null>('/api/ai/progress'),
  aiModels: (provider: AiProvider) => request<AiModel[]>('/api/ai/models/' + provider),
  aiStatus: () => request<AiStatus[]>('/api/ai/status'),
  saveAiSettings: (settings: AiSettings) => request<AiSettings>('/api/ai/settings', json('PUT', settings)),
  aiConnect: (model: AiSelection) => request<AiConnectionCheck>('/api/ai/connect', json('POST', model)),
  classify: (statementId: string, model: AiSelection) => request<AiClassifyResult>('/api/ai/classify', json('POST', { statementId, model })),
  chat: () => request<AiChatResult>('/api/ai/chat'),
  sendChat: (text: string, allowChanges: boolean, activePage: AiPageContext, signal: AbortSignal) =>
    request<AiChatResult>('/api/ai/chat', { ...json('POST', { text, allowChanges, activePage }), signal }),
  forget: (id: number) => request<AiMemoryNote[]>('/api/ai/memory/' + id, { method: 'DELETE' }),
  clearChat: () => request<AiChatResult>('/api/ai/chat', { method: 'DELETE' }),
  undoAi: () => request<{ restored: number; skipped: number }>('/api/ai/undo', { method: 'POST' }),
  saveBalance: (value: AccountBalance, previousId?: string) => request('/api/balances', json('PUT', { ...value, previousId })),
  removeBalance: (id: string) => request(`/api/balances/${id}`, { method: 'DELETE' }),
  saveSavingsRate: (rate: number | null) => request('/api/savings-rate', json('PUT', { rate })),
  correct: (id: string, value: Correction | null) => request(`/api/corrections/${id}`, value ? json('PUT', value) : { method: 'DELETE' }),
};
