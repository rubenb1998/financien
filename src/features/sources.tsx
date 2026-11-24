import { useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, CreditCard, FileUp, Landmark, Upload } from 'lucide-react';
import { api } from '../api.ts';
import { Empty, Notice, Panel } from '../components/ui.tsx';
import { displayDate } from '../domain/dates.ts';
import { count, money } from '../domain/format.ts';
import type { ImportResult, Statement } from '../domain/types.ts';
import { transactionsHref } from '../routes.ts';

export function SourcesPage({ statements, reload, transactionCount }: {
  statements: Statement[]; reload: () => Promise<void>; transactionCount: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ name: string; result?: ImportResult; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const sorted = [...statements].sort((a, b) => b.to.localeCompare(a.to) || a.source.localeCompare(b.source));

  async function upload(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setMessages([]);
    try {
      for (const file of files) {
        try {
          const result = await api.upload(file);
          setMessages(previous => [...previous, { name: result.statement.label, result }]);
        } catch (error) {
          setMessages(previous => [...previous, { name: file.name, error: error instanceof Error ? error.message : 'Importeren mislukt.' }]);
        }
      }
      await reload();
    } catch (error) {
      setMessages(previous => [...previous, { name: 'Dashboard herladen', error: error instanceof Error ? error.message : 'Herladen mislukt.' }]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return <>
    <Panel title="Afschrift toevoegen" subtitle="Rabobank-betaalrekening of creditcard · PDF">
      <div className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
        <span className="metric-icon violet"><FileUp size={22} /></span>
        <p>Sleep een PDF hierheen</p>
        <button className="primary" type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={16} />
          {busy ? 'Afschrift verwerken…' : 'Kies afschriften'}</button>
        <input hidden ref={input} type="file" accept=".pdf,application/pdf" multiple onChange={event => void upload(Array.from(event.target.files ?? []))} />
      </div>
      <div aria-live="polite">{messages.map((message, index) => <p className={message.error ? 'form-error' : 'upload-result'} key={index}>
        {message.name} · {message.error ?? `${count(message.result!.added)} toegevoegd, ${count(message.result!.duplicates)} al aanwezig`}
      </p>)}</div>
    </Panel>
    <Panel title="Geïmporteerde afschriften" subtitle={`${count(transactionCount)} unieke boekingsregels in de database`}>
      {sorted.length ? <div className="source-grid">{sorted.map(row => <article className="source-card" key={row.id}>
        <div className="source-heading"><span className="metric-icon blue">{row.source === 'bank' ? <Landmark size={19} /> : <CreditCard size={19} />}</span>
          <div><h3>{row.label}</h3><p>{displayDate(row.from)} – {displayDate(row.to)}</p></div></div>
        <dl><div><dt>Afschriftregels</dt><dd>{count(row.count)}</dd></div><div><dt>Debet</dt><dd>{money(row.debit)}</dd></div>
          <div><dt>Credit</dt><dd>{money(row.credit)}</dd></div></dl>
        <span className="source-check"><CheckCircle2 size={15} />Aangesloten op afschrifttotalen</span>
        <a className="text-link source-bookings" href={transactionsHref({ type: 'statement', key: row.id })}
          aria-label={`Bekijk boekingen van ${row.label}`}>
          Bekijk boekingen<ChevronRight size={15} aria-hidden="true" />
        </a>
      </article>)}</div> : <Empty message="Voeg een afschrift toe om te beginnen." />}
    </Panel>
    <Notice>Import is handmatig. De brondata en correcties staan in de lokale database. Afschriftcontroles gebruiken debet en credit, inclusief kruisposten.</Notice>
  </>;
}
