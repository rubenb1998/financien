import { aiProviderNames } from '../../src/domain/ai.ts';
import type { AiConnectionCheck, AiSelection } from '../../src/domain/ai.ts';
import type { Store } from '../store.ts';
import { InputError } from '../validation.ts';
import { requireProvider, runAi } from './cli.ts';
import type { RunAi } from './cli.ts';
import { boolean, fields, object } from './input.ts';

const healthCheck = 'Dit is de verbindingstest van Financiën. Geef uitsluitend {"ok":true} terug.';

export async function verifyAiConnection(store: Store, selection: AiSelection,
  signal?: AbortSignal, infer: RunAi = runAi,
  authenticate: (provider: AiSelection['provider'], signal?: AbortSignal) => Promise<void> = requireProvider) {
  let result: AiConnectionCheck;
  try {
    await authenticate(selection.provider, signal);
    signal?.throwIfAborted();
    const reply = object(await infer(selection, healthCheck, fields({ ok: boolean }), signal));
    signal?.throwIfAborted();
    if (reply.ok !== true) throw new InputError(aiProviderNames[selection.provider] + ' gaf geen geldig testantwoord.');
    result = { ...selection, outcome: 'verified', checkedAt: new Date().toISOString() };
  } catch (error) {
    signal?.throwIfAborted();
    result = {
      ...selection, outcome: 'failed', checkedAt: new Date().toISOString(),
      error: error instanceof InputError ? error.message : 'De verbindingstest is mislukt. Controleer de CLI en probeer opnieuw.',
    };
  }
  store.saveAiConnection(result);
  return result;
}
