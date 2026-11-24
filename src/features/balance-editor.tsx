import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api.ts';
import { Dropdown } from '../components/dropdown.tsx';
import { Dialog } from '../components/ui.tsx';
import { inputCents } from '../domain/format.ts';
import type { AccountHistory } from '../domain/wealth.ts';

export function BalanceEditor({ accounts, selection, today, close, reload }: {
  accounts: AccountHistory[];
  selection: string;
  today: string;
  close: () => void;
  reload: () => Promise<void>;
}) {
  const existing = accounts.find(account => account.id === selection);
  const unconfigured = accounts.filter(account => account.latestStatement && !account.anchor);
  const firstChoice = existing ?? (selection === 'setup' ? unconfigured[0] : undefined);
  const [id, setId] = useState(firstChoice?.id ?? 'new');
  const [newId] = useState(() => `manual-${crypto.randomUUID()}`);
  const [label, setLabel] = useState(existing?.anchor?.label ?? '');
  const suggestedDate = firstChoice?.anchor?.date ?? firstChoice?.latestStatement ?? today;
  const [date, setDate] = useState(suggestedDate > today ? today : suggestedDate);
  const [amount, setAmount] = useState(firstChoice?.anchor ? String(firstChoice.anchor.amount / 100).replace('.', ',') : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const originalManual = existing?.anchor && !existing.latestStatement ? existing : undefined;
  const manual = id === 'new' || id === originalManual?.id;

  async function persist(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const entered = amount.trim().replace(/^€\s*/, '');
    const value = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(entered) ? entered.replaceAll('.', '') : entered;
    if (!/^[+-]?\d+(?:[,.]\d{1,2})?$/.test(value)) {
      setError('Vul een bedrag in met maximaal twee decimalen, bijvoorbeeld 1.250,50.');
      return;
    }
    const previousId = originalManual && !manual ? originalManual.id : undefined;
    void persist(() => api.saveBalance({
      accountId: id === 'new' ? newId : id, date, amount: inputCents(value), label: manual ? label : undefined,
    }, previousId));
  }

  return <Dialog title={existing?.anchor ? 'Saldo wijzigen' : 'Saldo instellen'} close={() => { if (!busy) close(); }}>
    <form className="editor-form" onSubmit={submit}>
      {selection === 'setup' && unconfigured.length > 0 && <Dropdown label="Rekening" field value={id}
        options={[...unconfigured.map(account => ({ value: account.id, label: account.label })), { value: 'new', label: 'Handmatige rekening' }]}
        onChange={value => {
          setId(value);
          const suggested = unconfigured.find(account => account.id === value)?.latestStatement ?? today;
          setDate(suggested > today ? today : suggested);
        }} />}
      {existing?.latestStatement && <p className="balance-editor-account">{existing.label}</p>}
      {originalManual && unconfigured.length > 0 && <Dropdown label="Afschriften koppelen" field value={id} onChange={setId}
        options={[{ value: originalManual.id, label: 'Handmatig bijhouden' },
          ...unconfigured.map(account => ({ value: account.id, label: account.label }))]} />}
      {manual && <label>Naam rekening<input required maxLength={80} value={label} onChange={event => setLabel(event.target.value)}
        placeholder="Bijvoorbeeld spaarrekening" /></label>}
      <p className="balance-help">Vul het saldo aan het einde van de gekozen dag in. Gebruik bijvoorbeeld het eindsaldo op je afschrift.</p>
      <div className="form-row">
        <label>Saldo in euro<input required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)}
          placeholder="0,00" /></label>
        <label>Saldodatum<input required type="date" min="1900-01-01" max={today} value={date}
          onChange={event => setDate(event.target.value)} /></label>
      </div>
      {manual && <p className="balance-help">Voor een handmatige rekening zie je het saldo op de ingevulde datum. Na import kun je de afschriften koppelen.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {removing ? <div className="balance-remove">
        <p className="balance-help">Wil je het ingestelde saldo wissen?</p>
        <div className="form-actions"><button type="button" className="danger-button" disabled={busy}
          onClick={() => { if (existing) void persist(() => api.removeBalance(existing.id)); }}>Saldo wissen</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => setRemoving(false)}>Annuleren</button></div>
      </div> : <div className="form-actions">
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Opslaan…' : 'Saldo opslaan'}</button>
        <button type="button" className="secondary" disabled={busy} onClick={close}>Annuleren</button>
        {existing?.anchor && <button type="button" className="plain-button balance-remove-button" disabled={busy}
          onClick={() => setRemoving(true)}>Saldo wissen</button>}
      </div>}
    </form>
  </Dialog>;
}
