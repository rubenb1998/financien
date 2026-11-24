import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, ChartNoAxesColumnIncreasing, Copy,
  FileChartColumn, MessageSquareText, Plus, RefreshCw, Send, Sparkles } from 'lucide-react';
import { api } from '../api.ts';
import { AiModelSelectors } from '../components/ai-model.tsx';
import { aiProviderNames } from '../domain/ai.ts';
import type { AiSettings } from '../domain/ai.ts';
import { Notice } from '../components/ui.tsx';
import { displayDate } from '../domain/dates.ts';
import { money } from '../domain/format.ts';
import type { ChartId, FinancialReport, ReportSummary } from '../domain/reports.ts';
import type { SavingsPlan } from '../domain/savings-types.ts';
import type { Goal } from '../domain/types.ts';
import { GoalPage } from './goals.tsx';
import { ReportCharts } from './report-charts.tsx';
import '../styles/reports.css';

const starters = {
  spending: {
    placeholder: 'Bijv. Waar gaat het meeste van mijn geld naartoe? Vergelijk mijn uitgaven per maand.',
    examples: [
      ['Waar gaat het meeste van mijn geld naartoe?', 'Waar gaat het meeste van mijn geld naartoe? Laat de grootste uitgaven zien.'],
      ['Wat kosten mijn abonnementen?', 'Welke terugkerende abonnementen kosten me het meest per maand?'],
    ],
  },
  saving: {
    placeholder: 'Bijv. Ik wil € 300 per maand sparen. Welke uitgaven kan ik aanpassen als mijn vaste lasten gelijk blijven?',
    examples: [
      ['Hoe kan ik € 300 per maand sparen?', 'Hoe kan ik € 300 per maand sparen? Houd rekening met mijn vaste lasten en geef haalbare aanpassingen.'],
      ['Wat kan ik besparen met mijn sportbudget intact?', 'Ik wil € 300 per maand sparen. Houd naast mijn vaste lasten ook mijn sportbudget gelijk.'],
    ],
  },
} as const;
const reportHref = (id: string) => `#reports/${id}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Er is iets misgegaan. Probeer het opnieuw.';

export function ReportsPage({ reportId, planId, plans, goals, hasStatements, aiSettings, saveAiSettings }: {
  reportId?: string; planId?: string; plans: SavingsPlan[]; goals: Goal[]; hasStatements: boolean;
  aiSettings: AiSettings; saveAiSettings: (value: AiSettings) => Promise<void>;
}) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [report, setReport] = useState<FinancialReport>();
  const [detailError, setDetailError] = useState('');
  const [listError, setListError] = useState('');
  const [aiStatus, setAiStatus] = useState<Awaited<ReturnType<typeof api.reportAi>>>();
  const [local, setLocal] = useState(!aiSettings.provider);
  const [savingModel, setSavingModel] = useState(false);
  const [question, setQuestion] = useState('');
  const [starter, setStarter] = useState<keyof typeof starters>('spending');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [pending, setPending] = useState<{ question: string; clarification: string }>();
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [copied, setCopied] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  const current = report?.id === reportId ? report : undefined;
  const provider = local ? null : aiSettings.provider;
  const cliReady = aiStatus?.providers.some(status => status.provider === provider && status.state === 'ready') ?? false;
  const modelReady = provider ? cliReady : Boolean(aiStatus?.model);
  const legacyPlan = planId ? plans.find(plan => plan.id === planId) : undefined;

  async function changeModel(options: Partial<AiSettings>) {
    if (savingModel || busy) return;
    setSavingModel(true);
    setChatError('');
    try {
      await saveAiSettings({ ...aiSettings, ...options });
      setLocal(false);
    } catch (error) {
      setChatError(errorMessage(error));
    } finally {
      setSavingModel(false);
    }
  }

  async function refresh() {
    await Promise.allSettled([
      api.reports().then(list => { setReports(list); setListError(''); }).catch(error => setListError(errorMessage(error))),
      api.reportAi().then(setAiStatus).catch(() => setAiStatus({ model: null, providers: [] })),
    ]);
  }
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  useEffect(() => {
    let active = true;
    setDetailError('');
    if (reportId) void api.report(reportId).then(value => {
      if (active) setReport(value);
    }).catch(error => {
      if (active) setDetailError(errorMessage(error));
    });
    return () => { active = false; };
  }, [reportId]);

  function fill(value: string) {
    setQuestion(value);
    setCopied(false);
    field.current?.focus();
  }

  function reset() {
    setMessages([]);
    setPending(undefined);
    setQuestion('');
    setCopied(false);
    setChatError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();
    if (!value || submitting.current || savingModel || !modelReady) return;
    const origin = location.hash;
    submitting.current = true;
    setBusy(true);
    setChatError('');
    setQuestion('');
    setMessages(previous => [...previous, { role: 'user', text: value }]);
    try {
      const result = await api.reportChat(value, reportId, pending, provider
        ? { provider, model: aiSettings.model, effort: aiSettings.effort } : null);
      setMessages(previous => [...previous, { role: 'assistant', text: result.message }]);
      if (result.report) {
        setPending(undefined);
        setReport(result.report);
        if (location.hash === origin) location.hash = reportHref(result.report.id);
        void refresh();
      } else {
        const earlier = pending?.question;
        setPending({ question: (earlier ? `${earlier}\n${value}` : value).slice(0, 1_200), clarification: result.message });
      }
    } catch (error) {
      setChatError(errorMessage(error));
      setMessages(previous => previous.slice(0, -1));
      setQuestion(value);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function copyQuestion() {
    try {
      const context = current ? ` Bouw voort op rapport ${current.id} (${current.title}).` : '';
      await navigator.clipboard.writeText(`Maak in deze Financiën-projectmap een rapportage via npm run report.${context}\n\n${question.trim()}`);
      setCopied(true);
    } catch {
      setChatError('Kopiëren is niet gelukt. Selecteer je vraag en kopieer die naar de AI-chat bij deze projectmap.');
      field.current?.select();
    }
  }

  return <div className="reports-page">
    <p className="reports-intro">Stel een vraag over je afschriften en ontvang een persoonlijk rapport dat je als PDF kunt downloaden.</p>
    {!hasStatements && <Notice>Je hebt nog geen afschriften geïmporteerd. <a href="#sources">Afschrift toevoegen</a></Notice>}
    <div className="reports-workspace">
      <div className="reports-sidebar">
        <section className="panel report-chat" aria-labelledby="report-chat-heading">
          <header className="report-side-header">
            <span className="report-icon"><Sparkles size={20} aria-hidden="true" /></span>
            <div><h2 id="report-chat-heading">AI-chat</h2><p>Stel je rapport samen vanuit een vraag</p></div>
          </header>
          <div className="ai-model-fields report-model-picker">
            <label>AI-provider
              <select value={provider ?? 'local'} disabled={busy || savingModel} onChange={event => {
                const next = event.target.value;
                if (next === 'local') setLocal(true);
                else if (next === 'codex' || next === 'claude') void changeModel(next === aiSettings.provider
                  ? { provider: next } : { provider: next, model: '', effort: undefined });
              }}>
                <option value="local">Lokaal{aiStatus?.model ? ' · ' + aiStatus.model : ''}</option>
                <option value="codex">Codex</option>
                <option value="claude">Claude Code</option>
              </select>
            </label>
            {provider && <AiModelSelectors key={provider} provider={provider} model={aiSettings.model} effort={aiSettings.effort}
              ready={cliReady} disabled={busy || savingModel} onChange={value => void changeModel(value)} />}
          </div>
          {provider && cliReady && <p className="report-chat-hint">Je vraag gaat via {aiProviderNames[provider]}. Je boekingen en berekeningen blijven lokaal.</p>}
          {provider && aiStatus && !cliReady && <p className="report-chat-hint">Verbind {aiProviderNames[provider]} in <a href="#chat">AI-chat</a>.</p>}
          {messages.length === 0 && !current && <div className="segmented report-starters" role="group" aria-label="Voorbeelden per onderwerp">
            <button type="button" aria-pressed={starter === 'spending'} onClick={() => setStarter('spending')}>Uitgaven</button>
            <button type="button" aria-pressed={starter === 'saving'} onClick={() => setStarter('saving')}>Spaarscenario</button>
          </div>}
          {messages.length > 0 && <ol className="report-chat-messages" aria-label="Gesprek" aria-live="polite">
            {messages.map((message, index) => <li key={index} className={message.role}>
              <strong>{message.role === 'user' ? 'Jij' : 'AI-chat'}</strong><p>{message.text}</p>
            </li>)}
          </ol>}
          {messages.length === 0 && !current && <div className="report-examples">
            {starters[starter].examples.map(([label, value]) => <button key={label} type="button" onClick={() => fill(value)} disabled={busy}>
              {label}<ArrowRight size={14} aria-hidden="true" />
            </button>)}
          </div>}
          <form className="report-composer" onSubmit={submit}>
            <label htmlFor="report-question">{current || pending ? 'Stel een vervolgvraag' : 'Wat wil je weten of bereiken?'}</label>
            <textarea id="report-question" ref={field} value={question} maxLength={1200} rows={4} disabled={busy}
              placeholder={current ? 'Bijv. Werk dit uit tot stappen voor de eerste maand.'
                : pending ? 'Bijv. juni 2027 of over zes maanden' : starters[starter].placeholder}
              onChange={event => { setQuestion(event.target.value); setCopied(false); }} />
            <div className="report-compose-actions">
              {aiStatus === undefined ? <button type="button" className="primary" disabled>AI-chat verbinden…</button>
                : modelReady ? <button type="submit" className="primary" disabled={busy || savingModel || !question.trim()}>
                <Send size={16} aria-hidden="true" />{busy ? 'Bezig met rapport…' : pending ? 'Antwoord versturen' : 'Genereer rapport'}
              </button> : <button type="button" className="primary" disabled={!question.trim()} onClick={() => void copyQuestion()}>
                <Copy size={16} aria-hidden="true" />{copied ? 'Vraag gekopieerd' : 'Kopieer voor AI-chat'}
              </button>}
            </div>
          </form>
          {busy && <p className="report-chat-hint" role="status">De AI analyseert je vraag en kiest de grafieken.</p>}
          {aiStatus && !provider && !modelReady && <p className="report-chat-hint">Plak je vraag in de AI-chat bij deze projectmap. Het rapport komt daarna onder Eerdere rapporten.</p>}
          {chatError && <p className="report-error" role="alert">{chatError}</p>}
        </section>

        <section className="panel report-history" aria-labelledby="report-history-heading">
          <div className="report-history-head">
            <h2 id="report-history-heading">Eerdere rapporten</h2>
            <button className="icon-btn" type="button" title="Rapporten vernieuwen" aria-label="Rapporten vernieuwen" onClick={() => void refresh()}>
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          {listError && <p className="report-error" role="alert">{listError}</p>}
          {!reports.length && !listError && <p>Je rapporten verschijnen hier zodra ze klaar zijn.</p>}
          <ul>
            {reports.map(item => <li key={item.id}>
              <a href={reportHref(item.id)} aria-current={item.id === reportId ? 'page' : undefined}
                onClick={() => { setPending(undefined); setChatError(''); }}>
                <FileChartColumn size={18} aria-hidden="true" />
                <span><strong>{item.title}</strong><small>{displayDate(item.date)}</small></span>
              </a>
            </li>)}
          </ul>
        </section>
      </div>

      <div className="report-output">
        {detailError ? <Notice>{detailError}</Notice> : current
          ? <ReportPreview key={current.id} report={current} followUp={fill} reset={reset} busy={busy} />
          : reportId ? <p className="loading" role="status">Rapport laden…</p>
            : legacyPlan ? <GoalPage plans={[legacyPlan]} planId={legacyPlan.id} goals={goals} /> : <ReportPlaceholder />}
      </div>
    </div>
  </div>;
}

function ReportPlaceholder() {
  return <section className="panel report-placeholder" aria-labelledby="report-placeholder-heading">
    <div className="report-placeholder-visual" aria-hidden="true">
      <div className="sample-back" />
      <div className="sample-page">
        <FileChartColumn size={21} />
        <i /><i />
        <div className="sample-bars"><span /><span /><span /><span /><span /></div>
        <div className="sample-lines"><span /><span /><span /></div>
      </div>
    </div>
    <h2 id="report-placeholder-heading">Je rapport verschijnt hier</h2>
    <p>Stel een vraag in de AI-chat of open een eerder rapport.</p>
  </section>;
}

function ReportPreview({ report, followUp, reset, busy }: {
  report: FinancialReport; followUp: (question: string) => void; reset: () => void; busy: boolean;
}) {
  const [selected, setSelected] = useState(() => new Set(report.charts.map(chart => chart.id)));
  const chartSummary = report.charts.find(chart => chart.id === 'projection')?.summary;
  const insights = report.insights.filter(item => item.text !== chartSummary);
  const download = `/api/reports/${report.id}/pdf?charts=${[...selected].join(',')}`;
  function toggleChart(id: ChartId, enabled: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  return <article className="report-preview" aria-labelledby="report-preview-title">
    <section className="panel report-cover">
      <div className="report-cover-tools">
        <span>{displayDate(report.date)}</span>
        <div><a href="#reports" className="secondary compact" onClick={reset}><Plus size={15} />Nieuw rapport</a>
          <a className="primary compact" href={download} download><ArrowDownToLine size={16} />Download PDF</a></div>
      </div>
      <h2 id="report-preview-title">{report.title}</h2>
      <p className="report-period">{report.period}</p>
      <p className="report-conclusion">{report.conclusion}</p>
      <dl className="report-metrics">
        {report.metrics.map(item => <div key={item.label}><dt>{item.label}</dt>
          <dd className={item.value < 0 ? 'negative' : undefined}>{money(item.value)}</dd></div>)}
      </dl>
    </section>
    {report.charts.length > 0 && <section className="panel report-section">
      <div className="report-charts-head">
        <h2><ChartNoAxesColumnIncreasing size={20} aria-hidden="true" />Grafieken</h2>
        <p>Kies welke grafieken meegaan in je PDF.</p>
      </div>
      <ReportCharts charts={report.charts} selected={selected} toggle={toggleChart} />
    </section>}
    {report.actions.length > 0 && <section className="panel report-section">
      <h2>Voorstellen voor je maandbudget</h2>
      <ol className="report-actions">
        {report.actions.map((item, index) => <li key={item.category + index}>
          <div><h3>{item.category}</h3><span className="report-saving">{money(item.saving)} besparing p/m</span></div>
          <p className="report-action-budget">Maandbudget {money(item.before)} → {money(item.after)}</p>
          <p>{item.text}</p>
        </li>)}
      </ol>
    </section>}
    {insights.length > 0 && <section className="panel report-section report-insights">
      <h2>Toelichting</h2>
      {insights.map((item, index) => <section key={index}><h3>{item.title}</h3><p>{item.text}</p></section>)}
    </section>}
    {!!report.subscriptionOptions?.length && <details className="panel report-detail report-subscriptions">
      <summary>Abonnementen om te bekijken</summary>
      <p>Deze bedragen blijven in je begroting. Bij opzegging valt het maandbedrag pas weg zodra het abonnement stopt. Gebruik bij een goedkoper pakket het bevestigde prijsverschil.</p>
      <dl>{report.subscriptionOptions.map(item => <div key={item.name}><dt>{item.name}</dt><dd>{money(item.monthly)} p/m</dd></div>)}</dl>
    </details>}
    {report.protectedCosts.length > 0 && <details className="panel report-detail">
      <summary>Beschermde maandlasten</summary>
      <dl>{report.protectedCosts.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{money(item.value)}</dd></div>)}</dl>
    </details>}
    <details className="panel report-detail">
      <summary>Gegevens en aannames</summary>
      <p className="report-original-question"><strong>Jouw vraag</strong><span>{report.question}</span></p>
      <ul>{report.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </details>
    {report.mode === 'saving' && <section className="panel report-followup">
      <span className="report-icon"><MessageSquareText size={21} aria-hidden="true" /></span>
      <div><h2>Wil je dit plan verder uitwerken?</h2><p>Vraag om concrete stappen voor de eerste maand of een variant met andere keuzes.</p>
        <button type="button" className="secondary compact" disabled={busy}
          onClick={() => followUp('Werk dit spaaradvies uit tot een checklist voor de eerste maand, met een praktisch weekbudget waar dat past.')}>
          Maak een eerste-maandchecklist<ArrowRight size={15} aria-hidden="true" />
        </button></div>
    </section>}
  </article>;
}
