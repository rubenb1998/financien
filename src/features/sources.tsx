import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, CreditCard, FileUp, Landmark, Upload } from 'lucide-react';
import { api } from '../api.ts';
import { AiModelFields } from '../components/ai-model.tsx';
import type { AiModelChoice } from '../components/ai-model.tsx';
import { Empty, Notice, Panel } from '../components/ui.tsx';
import { displayDate } from '../domain/dates.ts';
import { count, money } from '../domain/format.ts';
import type { AiImportResult, AiProgress, AiSelection } from '../domain/ai.ts';
import type { Statement } from '../domain/types.ts';
import { transactionsHref } from '../routes.ts';

interface ImportOptions {
  model: AiModelChoice;
  setModel: (value: AiModelChoice) => void;
  reload: () => Promise<void>;
}

function importSelection(model: AiModelChoice): AiSelection | null {
  return model.provider ? { provider: model.provider, model: model.model.trim(), effort: model.effort } : null;
}

export function PdfImport({ model, setModel, reload }: ImportOptions) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ name: string; result?: AiImportResult; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const selection = importSelection(model);

  const [progress, setProgress] = useState<AiProgress | null>(null);
  useEffect(() => {
    if (!busy) {
      setProgress(null);
      return;
    }
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function updateProgress() {
      try {
        const value = await api.aiProgress();
        if (mounted) setProgress(value);
      } catch {
        // The import response still reports its own status.
      } finally {
        if (mounted) timer = setTimeout(() => void updateProgress(), 1_500);
      }
    }
    void updateProgress();
    return () => { mounted = false; clearTimeout(timer); };
  }, [busy]);

  async function upload(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setMessages([]);
    try {
      for (const file of files) {
        try {
          const result = await api.upload(file, selection);
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

  async function retry(result: AiImportResult) {
    if (!selection) return;
    setBusy(true);
    try {
      const ai = await api.classify(result.statement.id, selection);
      setMessages(previous => previous.map(message => message.result === result
        ? { ...message, result: { ...result, ai, aiError: undefined } } : message));
    } catch (error) {
      setMessages(previous => previous.map(message => message.result === result ? { ...message, result: {
        ...result, aiError: error instanceof Error ? error.message : 'Classificeren mislukt.',
      } } : message));
    } finally {
      await reload().catch(() => setMessages(current => [...current, { name: 'Dashboard', error: 'Herladen is mislukt.' }]));
      setBusy(false);
    }
  }

  return <Panel title="Afschrift toevoegen" subtitle="Rabobank-betaalrekening of creditcard · PDF">
      <div className="import-ai-selection">
        <AiModelFields value={model} onChange={setModel} disabled={busy} providerLabel="Classificatie bij import"
          modelLabel="Model voor import" emptyLabel="Zonder AI" />
        {selection && <p className="muted">Het gekozen model controleert de indeling na het inlezen van je afschriften.</p>}
      </div>
      <div className={'dropzone' + (dragging ? ' dragging' : '')}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
        <span className="metric-icon violet"><FileUp size={22} /></span>
        <p>Sleep een PDF hierheen</p>
        <button className="primary" type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={16} />
          {busy ? selection ? 'Importeren en classificeren…' : 'Afschrift verwerken…' : 'Kies afschriften'}</button>
        <input hidden ref={input} type="file" accept=".pdf,application/pdf" multiple onChange={event => void upload(Array.from(event.target.files ?? []))} />
      </div>
      {progress && progress.total > 0 && <div className="ai-import-progress">
        <label>AI-classificatie · {count(progress.reviewed)} van {count(progress.total)}
          <progress max={progress.total} value={progress.reviewed} /></label>
      </div>}
      <div aria-live="polite">{messages.map(({ name, result, error }, index) => <div className="import-message" key={index}>
        <p className={error ? 'form-error' : 'upload-result'}>
          {name} · {error ?? (count(result!.added) + ' toegevoegd, ' + count(result!.duplicates) + ' al aanwezig')}
        </p>
        {result?.ai && <p className="muted">{count(result.ai.classified)} beoordeeld door AI · {count(result.ai.review)} te controleren</p>}
        {result?.aiError && <div className="import-message-error">
          <p className="form-error">Afschrift opgeslagen. {result.aiError}</p>
          <button className="plain-button" type="button" disabled={busy || !selection} onClick={() => void retry(result)}>Classificatie hervatten</button>
        </div>}
      </div>)}</div>
    </Panel>;
}

export function SourcesPage({ statements, reload, transactionCount, model, setModel }: ImportOptions & {
  statements: Statement[]; transactionCount: number;
}) {
  const selection = importSelection(model);
  const sorted = [...statements].sort((a, b) => b.to.localeCompare(a.to) || a.source.localeCompare(b.source));
  const [classifying, setClassifying] = useState('');
  const [classification, setClassification] = useState('');
  async function classify(statement: Statement) {
    if (!selection) return;
    setClassifying(statement.id);
    setClassification('');
    try {
      const result = await api.classify(statement.id, selection);
      setClassification(statement.label + ' · ' + count(result.classified) + ' beoordeeld door AI · ' + count(result.review) + ' te controleren');
    } catch (error) {
      setClassification(error instanceof Error ? error.message : 'Classificeren mislukt.');
    } finally {
      await reload().catch(() => setClassification('Dashboard herladen is mislukt.'));
      setClassifying('');
    }
  }

  return <>
    <PdfImport model={model} setModel={setModel} reload={reload} />
    {classification && <Notice>{classification}</Notice>}
    <Panel title="Geïmporteerde afschriften" subtitle={`${count(transactionCount)} unieke boekingsregels in de database`}
      action={sorted.some(row => row.source === 'bank') && <a className="secondary compact" href="#wealth">Saldi beheren</a>}>
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
        {selection && <button className="plain-button source-ai-button" type="button" disabled={Boolean(classifying)}
          onClick={() => void classify(row)}>{classifying === row.id ? 'Classificeren…' : 'Beoordeel met AI'}</button>}
      </article>)}</div> : <Empty message="Voeg een afschrift toe om te beginnen." />}
    </Panel>
    <Notice>Import is handmatig. De brondata en correcties staan in de lokale database. Afschriftcontroles gebruiken debet en credit, inclusief kruisposten.</Notice>
  </>;
}
