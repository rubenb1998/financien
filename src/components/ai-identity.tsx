import { Sparkles, Terminal } from 'lucide-react';
import { aiProviderNames } from '../domain/ai.ts';
import type { AiProvider } from '../domain/ai.ts';

export function AiIdentity({ provider, model }: { provider: AiProvider; model?: string }) {
  const Icon = provider === 'codex' ? Terminal : Sparkles;
  return <span className={'ai-identity ai-identity-' + provider}>
    <span className="ai-identity-icon"><Icon size={16} aria-hidden="true" /></span>
    <span>{aiProviderNames[provider]}{model && <small>{model}</small>}</span>
  </span>;
}
