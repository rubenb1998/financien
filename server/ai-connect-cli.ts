import { parseArgs } from 'node:util';
import { aiProviderNames } from '../src/domain/ai.ts';
import { loginInTerminal, providerStatus } from './ai/cli.ts';
import { verifyAiConnection } from './ai/connection.ts';
import { aiProvider, readAiSelection } from './ai/input.ts';
import { openStore } from './store.ts';
import { InputError } from './validation.ts';

try {
  const options = parseArgs({ allowPositionals: true, options: {
    model: { type: 'string' }, effort: { type: 'string' }, 'zonder-aanmelding': { type: 'boolean' },
  } });
  const [action = 'status', name, ...rest] = options.positionals;
  if (rest.length || !['status', 'verbind', 'controleer'].includes(action)) {
    throw new InputError('Gebruik npm run ai -- status, verbind codex|claude, of controleer codex|claude.');
  }
  const provider = name ? aiProvider(name) : undefined;
  const store = openStore();
  try {
    const settings = store.aiSettings();
    if (action === 'status') {
      const providers = provider ? [provider] : ['codex', 'claude'] as const;
      const statuses = await Promise.all(providers.map(async item => ({
        ...await providerStatus(item), check: store.aiConnection(item, item === settings.provider ? settings.model : undefined, settings.effort),
      })));
      console.log(JSON.stringify({ selected: settings, statuses }, null, 2));
    } else {
      const chosen = provider ?? (action === 'controleer' ? settings.provider : null);
      if (!chosen) throw new InputError('Geef aan of je codex of claude wilt verbinden.');
      const sameProvider = settings.provider === chosen;
      const selection = readAiSelection({ provider: chosen,
        model: options.values.model ?? (sameProvider ? settings.model : ''),
        effort: options.values.effort ?? (sameProvider && options.values.model === undefined ? settings.effort : undefined),
      });
      if (action === 'verbind') {
        store.saveAiSettings({ ...settings, ...selection });
        const { state } = await providerStatus(chosen);
        if ((state === 'signedOut' || state === 'otherAuth') && !options.values['zonder-aanmelding']) {
          console.log('Rond de officiële aanmelding af bij ' + aiProviderNames[chosen] + '.');
          await loginInTerminal(chosen);
        }
      }
      const check = await verifyAiConnection(store, selection);
      const label = aiProviderNames[chosen] + (selection.model ? ' · ' + selection.model : '');
      if (check.outcome === 'verified') console.log(label + ' is verbonden. Het model heeft de test beantwoord.');
      else {
        console.error(label + ' is niet verbonden. ' + check.error);
        process.exitCode = 1;
      }
    }
  } finally {
    store.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'De CLI-koppeling is mislukt.');
  process.exitCode = 1;
}
