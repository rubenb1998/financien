import { useEffect, useId, useState } from 'react';
import { api } from '../api.ts';
import { aiEffortLabels, aiEfforts, aiProviderNames } from '../domain/ai.ts';
import type { AiEffort, AiModel, AiProvider, AiSelection } from '../domain/ai.ts';

export interface AiModelChoice {
  provider: AiProvider | null;
  model: string;
  effort?: AiEffort;
}

export function AiModelFields({ value, onChange, providerLabel, modelLabel, emptyLabel, disabled }: {
  value: AiModelChoice; onChange: (value: AiModelChoice) => void; providerLabel: string;
  modelLabel: string; emptyLabel: string; disabled?: boolean;
}) {
  const suggestions = useId();
  return <div className="ai-model-fields">
    <label>{providerLabel}
      <select value={value.provider ?? ''} disabled={disabled} onChange={event => {
        const choice = event.target.value;
        const provider = choice === 'codex' || choice === 'claude' ? choice : null;
        onChange({ provider, model: provider === value.provider ? value.model : '' });
      }}>
        <option value="">{emptyLabel}</option>
        <option value="codex">{aiProviderNames.codex}</option>
        <option value="claude">{aiProviderNames.claude}</option>
      </select>
    </label>
    {value.provider && <label>{modelLabel}
      <input value={value.model} disabled={disabled} placeholder="Standaardmodel van de CLI" maxLength={101}
        list={value.provider === 'claude' ? suggestions : undefined}
        onChange={event => onChange({ ...value, model: event.target.value, effort: undefined })} />
      <datalist id={suggestions}><option value="sonnet" /><option value="opus" /><option value="haiku" /></datalist>
    </label>}
  </div>;
}

export function AiModelSelectors({ provider, model, effort, onChange, ready, disabled }: {
  provider: AiProvider; model: string; effort?: AiEffort; ready: boolean; disabled?: boolean;
  onChange: (value: Pick<AiSelection, 'model' | 'effort'>) => void;
}) {
  const [catalog, setCatalog] = useState<{ provider: AiProvider; models: AiModel[] }>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    setError('');
    void api.aiModels(provider).then(models => {
      if (current) setCatalog({ provider, models });
    }).catch(() => {
      if (current) setError('Modellen ophalen is mislukt.');
    });
    return () => { current = false; };
  }, [provider, ready, retry]);

  if (!ready) return null;
  const models = catalog?.provider === provider ? catalog.models : [];
  const defaultModel = models.find(option => option.recommended) ?? models.find(option => !option.id);
  const chosen = model ? models.find(option => option.id === model) : defaultModel;
  const efforts = chosen?.efforts ?? [];
  return <div className="ai-model-fields ai-catalog-fields">
    <label>Model
      <select value={model} disabled={disabled} onChange={event => {
        const next = event.target.value;
        const option = models.find(item => item.id === next) ?? (!next ? defaultModel : undefined);
        onChange({ model: next, effort: effort && option?.efforts.includes(effort) ? effort : undefined });
      }}>
        <option value="">{defaultModel?.id ? 'Standaard · ' + defaultModel.name : 'Standaardmodel van de CLI'}</option>
        {model && !models.some(option => option.id === model) && <option value={model}>{model}</option>}
        {models.filter(option => option.id).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
    {(efforts.length > 0 || effort) && <label>Redeneerniveau
      <select value={effort ?? ''} disabled={disabled} onChange={event => onChange({
        model, effort: aiEfforts.find(item => item === event.target.value),
      })}>
        <option value="">{chosen?.defaultEffort ? 'Standaard · ' + aiEffortLabels[chosen.defaultEffort] : 'Standaard'}</option>
        {effort && !efforts.includes(effort) && <option value={effort}>{aiEffortLabels[effort]}</option>}
        {efforts.map(option => <option key={option} value={option}>{aiEffortLabels[option]}</option>)}
      </select>
    </label>}
    {error && <p className="form-error" role="status">{error}{' '}
      <button className="plain-button" type="button" disabled={disabled} onClick={() => setRetry(count => count + 1)}>Opnieuw ophalen</button>
    </p>}
    {!error && catalog?.provider !== provider && <p className="report-chat-hint" role="status">Modellen ophalen…</p>}
  </div>;
}
