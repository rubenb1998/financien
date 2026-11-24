import type { SubscriptionView } from './domain/subscription-view.ts';
import type { Correction, DashboardLedger, ImportResult } from './domain/types.ts';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Verbinding met het lokale dashboard mislukt.');
  return data;
}

const put = (value: unknown): RequestInit => ({
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
});

export const api = {
  load: () => request<DashboardLedger>('/api/ledger'),
  saveSubscriptionView: (view: SubscriptionView) => request('/api/preferences/subscriptions', put(view)),
  upload: (file: File) => request<ImportResult>('/api/import', {
    method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file,
  }),
  correct: (id: string, value: Correction | null) => request(`/api/corrections/${id}`, value ? put(value) : { method: 'DELETE' }),
};
