import { ArrowUpRight, Bot, CheckCircle2, ChevronDown, Circle, CircleAlert, FileUp, LoaderCircle, MessageCircle, Minus, Plug, Send, Square, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.ts';
import { AiIdentity } from '../components/ai-identity.tsx';
import { AiModelSelectors } from '../components/ai-model.tsx';
import type { AiModelChoice } from '../components/ai-model.tsx';
import { pageNames } from '../domain/pages.ts';
import { Notice, Panel } from '../components/ui.tsx';
import { aiEffortLabels, aiProviderNames } from '../domain/ai.ts';
import type { AiProvider, AiSettings } from '../domain/ai.ts';
import type { AiConversation } from '../hooks/ai-conversation.ts';
import { PdfImport } from './sources.tsx';

const providers = Object.keys(aiProviderNames) as AiProvider[];
const cliSetup = { codex: 'https://learn.chatgpt.com/docs/cli', claude: 'https://code.claude.com/docs/en/setup#install-claude-code' };
const cliLabels = {
  ready: 'CLI aangemeld',
  missing: 'CLI ontbreekt',
  signedOut: 'Aanmelden nodig',
  otherAuth: 'Abonnementsaanmelding nodig',
  unavailable: 'CLI-status onbekend',
};

function ActiveProvider({ settings, chat }: { settings: AiSettings; chat: AiConversation }) {
  if (!settings.provider) return <p className="ai-no-provider">Kies een provider voor dit gesprek.</p>;
  const status = chat.statuses.find(item => item.provider === settings.provider);
  const check = status?.check?.model === settings.model && status.check.effort === settings.effort ? status.check : undefined;
  const testing = chat.checking?.provider === settings.provider && chat.checking.model === settings.model && chat.checking.effort === settings.effort;
  const waiting = testing || !status || status.signingIn;
  const verified = !waiting && status.state === 'ready' && check?.outcome === 'verified';
  const failed = !waiting && (status.state !== 'ready' || check?.outcome === 'failed');
  const label = status?.signingIn ? 'Voltooi de aanmelding in je browser'
    : testing ? status?.state === 'ready' ? 'Modelverbinding testen…' : 'Lokale CLI zoeken…'
    : !status ? 'CLI controleren…'
    : status.state !== 'ready' ? 'Niet verbonden · ' + cliLabels[status.state]
    : verified ? 'Verbonden · model getest'
    : failed ? 'Niet verbonden · modeltest mislukt'
    : 'CLI aangemeld · model nog niet getest';
  const Icon = waiting ? LoaderCircle : verified ? CheckCircle2 : failed ? CircleAlert : Circle;

  return <div className="ai-active-provider" aria-live="polite">
    <div className="ai-active-line">
      <AiIdentity provider={settings.provider} model={(settings.model || 'Standaardmodel') + (settings.effort ? ' · ' + aiEffortLabels[settings.effort] : '')} />
      <span className={'ai-link-state' + (verified ? ' ai-link-ok' : failed ? ' ai-link-failed' : '')}>
        <Icon size={15} aria-hidden="true" />{label}
      </span>
    </div>
    {failed && check?.error && <p>{check.error}</p>}
  </div>;
}

function ProviderSettings({ settings, chat, save, reload }: {
  settings: AiSettings; chat: AiConversation; save: (settings: AiSettings) => Promise<void>; reload: () => Promise<void>;
}) {
  const { statuses, refresh, connect, checking, busy } = chat;
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const activeStatus = statuses.find(item => item.provider === settings.provider);
  const blocked = Boolean(saving || busy || checking || activeStatus?.signingIn);
  const { provider, model, effort } = settings;
  const check = activeStatus?.check?.model === model && activeStatus.check.effort === effort ? activeStatus.check : undefined;

  async function activate(nextProvider: AiProvider) {
    if (blocked || provider === nextProvider) return;
    setError('');
    setSaving(true);
    try {
      await save({ ...settings, provider: nextProvider, model: '', effort: undefined });
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Provider kiezen is mislukt.');
    } finally { setSaving(false); }
  }

  async function saveOptions(options: Partial<AiSettings>) {
    if (blocked) return;
    setError('');
    setSaving(true);
    try {
      await save({ ...settings, ...options });
      if (Object.hasOwn(options, 'model')) await refresh().catch(() => undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'AI-voorkeur opslaan is mislukt.');
    } finally { setSaving(false); }
  }

  async function connectCli() {
    if (!provider || blocked) return;
    setError('');
    await connect({ provider, model, effort }).catch(failure => setError(failure instanceof Error ? failure.message : 'CLI verbinden is mislukt.'));
  }

  return <Panel title="AI-provider" className="ai-settings" action={<button type="button" className="plain-button" disabled={blocked}
    onClick={() => void Promise.all([refresh(), reload()]).catch(() => setError('CLI-status ophalen is mislukt.'))}>Vernieuwen</button>}>
    <div className="ai-providers" role="group" aria-label="Provider voor dit gesprek">
      {providers.map(item => {
        const status = statuses.find(candidate => candidate.provider === item);
        const label = status?.signingIn ? 'Aanmelden bezig…'
          : checking?.provider === item ? 'Verbinden…'
          : status ? cliLabels[status.state] : 'Controleren…';
        return <button className={'ai-provider-row' + (provider === item ? ' ai-provider-selected' : '')}
          type="button" key={item} aria-label={aiProviderNames[item]} aria-pressed={provider === item}
          aria-describedby={'ai-cli-status-' + item} disabled={blocked} onClick={() => void activate(item)}>
          <AiIdentity provider={item} />
          <span className="ai-provider-status" id={'ai-cli-status-' + item}>
            {provider === item && <strong>Actief</strong>}{label}
          </span>
        </button>;
      })}
    </div>
    {provider && <AiModelSelectors key={provider} provider={provider} model={model} effort={effort}
      ready={activeStatus?.state === 'ready'} disabled={blocked} onChange={value => void saveOptions(value)} />}
    <label className="switch-line ai-import-default">
      <input type="checkbox" checked={settings.autoClassify} disabled={blocked}
        onChange={event => void saveOptions({ autoClassify: event.target.checked })} />
      Gebruik de chatprovider standaard bij import
    </label>
    {provider && <div className="ai-connection-actions">
      <button className="primary compact" type="button" disabled={blocked} onClick={() => void connectCli()}>
        <Plug size={15} aria-hidden="true" />
        {checking ? 'Verbinden…' : activeStatus?.state === 'ready' && check?.outcome === 'verified' ? 'Opnieuw testen' : 'CLI verbinden'}
      </button>
      {activeStatus?.loginUrl && <a className="secondary compact" href={activeStatus.loginUrl}
        target="_blank" rel="noreferrer">Open inlogscherm <ArrowUpRight size={14} aria-hidden="true" /></a>}
      {activeStatus?.state === 'missing' && <a className="secondary compact" href={cliSetup[provider]}
        target="_blank" rel="noreferrer">Installeer {aiProviderNames[provider]} <ArrowUpRight size={14} aria-hidden="true" /></a>}
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <details className="ai-help"><summary>CLI instellen</summary>
      <p>De app zoekt naar de CLI op dit apparaat. Rond de officiële aanmelding in je browser af als die nodig is.</p>
      <p>Codex <code>npm run ai -- verbind codex</code></p>
      <p>Claude Code <code>npm run ai -- verbind claude</code></p>
    </details>
  </Panel>;
}

function Conversation({ chat, compact = false }: { chat: AiConversation; compact?: boolean }) {
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const { messages, pendingText, draft, loaded, busy } = chat;
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages, pendingText]);
  useEffect(() => {
    if (compact) input.current?.focus();
  }, [compact]);

  return <>
    {chat.pageContext.page !== 'chat' && <p className="muted ai-page-context">
      Huidige pagina <strong>{pageNames[chat.pageContext.page]}</strong>
    </p>}
    <div className="ai-thread" ref={thread} aria-live="polite" role="log" aria-label="Chatberichten">
      {loaded && !messages.length && !pendingText && <div className="ai-welcome">
        {!compact && <span className="metric-icon violet"><Bot size={21} /></span>}
        <p>Vraag iets over je boekingen, uitgaven of spaarscenario’s. <a href="#reports">Naar Rapportages</a></p>
        {!compact && <button type="button" className="secondary compact"
          onClick={() => chat.setDraft('Welke uitgaven had ik vorige maand?')}>Uitgaven vorige maand</button>}
      </div>}
      {!loaded && <p className="loading" role="status">Gesprek laden…</p>}
      {[...messages, ...(pendingText ? [{ role: 'user' as const, text: pendingText }] : [])].map((entry, index) =>
        <div key={index} className={'ai-message ai-message-' + entry.role}>
          {entry.role === 'assistant' && 'provider' in entry && entry.provider
            ? <AiIdentity provider={entry.provider} model={entry.model} />
            : <b>{entry.role === 'user' ? 'Jij' : 'Financiën'}</b>}
          <p>{entry.text}</p>
        </div>)}
      {pendingText && <p className="muted ai-thinking">Boekhouding raadplegen…</p>}
    </div>
    {chat.error && <Notice>{chat.error}</Notice>}
    <form className="ai-composer" onSubmit={event => { event.preventDefault(); void chat.send(); }}>
      <label><span className={compact ? 'visually-hidden' : undefined}>Bericht</span>
        <textarea ref={input} value={draft} placeholder={compact ? 'Stel een vraag…' : 'Bijvoorbeeld: zet de bijschrijving van € 63 op werkvergoeding'}
          maxLength={6_000} rows={compact ? 2 : 3} onChange={event => chat.setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || (compact && !event.shiftKey && !event.nativeEvent.isComposing))) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} />
      </label>
      <div className="ai-composer-actions">
        <label className="switch-line"><input type="checkbox" checked={chat.allowChanges} disabled={busy}
          onChange={event => chat.setAllowChanges(event.target.checked)} />{compact ? 'Bewerken toestaan' : 'Wijzigingen toestaan'}</label>
        <div>
          {chat.canUndo && <button className={compact ? 'icon-btn' : 'secondary compact'} type="button" disabled={busy}
            title="Laatste correctie terugdraaien" aria-label="Laatste correctie terugdraaien" onClick={() => void chat.undo()}>
            <Undo2 size={15} />{!compact && 'Laatste correctie terugdraaien'}
          </button>}
          {pendingText ? <button className={compact ? 'icon-btn' : 'secondary'} type="button" onClick={chat.stop} aria-label="Stoppen" title="Stoppen">
            <Square size={15} />{!compact && 'Stoppen'}
          </button> : <button className={compact ? 'primary ai-icon-primary' : 'primary'} type="submit"
            disabled={!loaded || (!chat.connected && !chat.canRemember) || busy || Boolean(chat.checking) || !draft.trim()} aria-label="Verstuur" title="Verstuur">
            <Send size={15} />{!compact && 'Verstuur'}
          </button>}
        </div>
      </div>
    </form>
  </>;
}

export function ChatPage({ settings, saveSettings, reload, chat, importModel, setImportModel }: {
  settings: AiSettings; saveSettings: (settings: AiSettings) => Promise<void>; reload: () => Promise<void>;
  chat: AiConversation; importModel: AiModelChoice; setImportModel: (choice: AiModelChoice) => void;
}) {
  return <div className="ai-layout">
    <Panel title="Gesprek" className="ai-chat-panel"
      action={chat.messages.length > 0 && <button type="button" className="plain-button" disabled={chat.busy} onClick={() => void chat.clear()}>Wis gesprek</button>}>
      <ActiveProvider settings={settings} chat={chat} />
      <Conversation chat={chat} />
    </Panel>
    <div className="ai-side">
      <ProviderSettings settings={settings} chat={chat} save={saveSettings} reload={reload} />
      <Panel title="Lokaal geheugen" className="ai-memory">
        <p>Zeg bijvoorbeeld ‘Onthoud dat ik alle bedragen wil afronden’. Je voorkeuren worden op dit apparaat bewaard.</p>
        {chat.memory.length > 0 && <ul>{chat.memory.map(note => <li key={note.id}><span>{note.text}</span>
          <button type="button" className="plain-button" disabled={chat.busy} onClick={() => void chat.forget(note.id)}>Vergeten</button>
        </li>)}</ul>}
      </Panel>
      <details className="ai-attach">
        <summary><FileUp size={17} /> Afschriften importeren <ChevronDown size={16} /></summary>
        <PdfImport model={importModel} setModel={setImportModel} reload={reload} />
      </details>
    </div>
  </div>;
}

export function FloatingChat({ settings, chat, open, setOpen }: {
  settings: AiSettings; chat: AiConversation; open: boolean; setOpen: (open: boolean) => void;
}) {
  const launcher = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!open && returnFocus.current) {
      launcher.current?.focus();
      returnFocus.current = false;
    }
  }, [open]);

  function minimize() {
    returnFocus.current = true;
    setOpen(false);
  }

  return <div className="ai-float">
    {open && <section id="floating-chat" className="panel ai-float-panel" aria-labelledby="floating-chat-heading"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); minimize(); } }}>
      <header className="ai-float-header">
        <h2 id="floating-chat-heading">AI-chat</h2>
        <div>
          <a href="#chat" className="icon-btn" onClick={() => setOpen(false)} aria-label="Grote chat openen" title="Grote chat openen"><ArrowUpRight size={17} /></a>
          <button type="button" className="icon-btn" aria-label="Chat minimaliseren" title="Chat minimaliseren" onClick={minimize}><Minus size={17} /></button>
        </div>
      </header>
      <ActiveProvider settings={settings} chat={chat} />
      {(!settings.provider || (chat.statuses.length > 0 && !chat.connected)) &&
        <p className="ai-float-connect"><a href="#chat">Verbind een AI-provider in de grote chat</a></p>}
      <Conversation chat={chat} compact />
    </section>}
    {!open && <button type="button" ref={launcher} className="primary ai-launcher" aria-expanded={false}
      aria-label="Snelle AI-chat openen" onClick={() => setOpen(true)}>
      {settings.provider ? <AiIdentity provider={settings.provider} /> : <><MessageCircle size={18} /><span>AI-chat</span></>}
    </button>}
  </div>;
}
