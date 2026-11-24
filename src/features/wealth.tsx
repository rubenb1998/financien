import { Banknote, Landmark, Percent, PiggyBank, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api.ts';
import { Dropdown } from '../components/dropdown.tsx';
import { Empty, Metric, Panel, RankLink } from '../components/ui.tsx';
import { displayDate, displayMonthYear } from '../domain/dates.ts';
import { money, signedMoney } from '../domain/format.ts';
import type { Statement, Transaction } from '../domain/types.ts';
import { balanceTrend, savingsInsights } from '../domain/wealth.ts';
import type { AccountHistory, BalanceSnapshot } from '../domain/wealth.ts';
import { categoryHref } from '../routes.ts';
import { BalanceChart, SavingsRoomChart } from './wealth-charts.tsx';

type BalanceProps = { accounts: AccountHistory[]; edit: (selection: string) => void };

function balanceCaption(missing: number) {
  return missing === 1 ? '1 rekening mist een saldo.' : `${missing} rekeningen missen een saldo.`;
}

function BalanceHeadline({ points, missing }: { points: BalanceSnapshot[]; missing: number }) {
  const latest = points.at(-1)!;
  const first = points[0];
  const change = latest.amount - first.amount;
  return <div className="balance-headline">
    <strong>{money(latest.amount)}</strong>
    <p>Saldo op {displayDate(latest.date)}</p>
    {points.length > 1 && <p className="balance-change"><b className={change < 0 ? 'balance-down' : change > 0 ? 'balance-up' : ''}>
      {signedMoney(change)}</b> sinds {displayDate(first.date)}</p>}
    {missing > 0 && <p className="balance-missing">{balanceCaption(missing)}</p>}
  </div>;
}

export function DashboardBalance({ accounts, edit }: BalanceProps) {
  const points = balanceTrend(accounts, 90);
  const missing = accounts.filter(account => !account.anchor).length;
  if (!accounts.some(account => account.anchor)) {
    return <section className="panel balance-intro">
      <span className="balance-icon"><Wallet size={23} /></span>
      <div><h2>Wat staat er op je rekeningen?</h2>
        <p>Vul per bankrekening een saldo en datum in. Met je afschriften rekent Financiën je saldoverloop uit.</p></div>
      <button type="button" className="primary" onClick={() => edit('setup')}>Saldo instellen</button>
    </section>;
  }
  return <Panel className="dashboard-balance" title={missing ? 'Bekend banksaldo' : 'Banksaldo'}
    action={<div className="balance-panel-actions">
      {missing > 0 && <button type="button" className="plain-button" onClick={() => edit('setup')}>Saldo aanvullen</button>}
      <a className="secondary compact" href="#wealth">Bekijk vermogen</a>
    </div>}>
    {points.length ? <div className="dashboard-balance-content">
      <BalanceHeadline points={points} missing={missing} />
      {points.length > 1 ? <BalanceChart data={points} compact /> : <p className="balance-help dashboard-balance-message">
        Eén saldodatum beschikbaar. Importeer aansluitende afschriften om het verloop te zien.
      </p>}
    </div> : <p className="balance-help">Er is geen datum met saldo voor alle ingestelde rekeningen. Bekijk de afzonderlijke saldi bij Vermogen.</p>}
  </Panel>;
}

const balancePeriods = [
  { days: 90, label: '90 dagen' },
  { days: 180, label: '180 dagen' },
  { days: 365, label: '365 dagen' },
];

export function WealthPage({ accounts, rows, statements, today, rate, reload, edit }: BalanceProps & {
  rows: Transaction[];
  statements: Statement[];
  today: string;
  rate: number | null;
  reload: () => Promise<void>;
}) {
  const [selected, setSelected] = useState('');
  const [days, setDays] = useState(180);
  const configured = accounts.filter(account => account.anchor);
  const selection = configured.find(account => account.id === selected);
  const displayed = selection ? [selection] : accounts;
  const missing = displayed.filter(account => !account.anchor).length;
  const points = balanceTrend(displayed, days);
  const totalDate = points.at(-1)?.date;
  const newerBalances = !selection && totalDate && configured.some(account => account.to > totalDate);
  const insights = useMemo(() => savingsInsights(rows, statements, today, rate), [rows, statements, today, rate]);
  return <>
    <Panel title={selection ? selection.label : missing && configured.length ? 'Bekend banksaldo' : 'Totaal banksaldo'}
      className="wealth-balance" action={configured.length > 1 && <div className="wealth-account-picker">
        <Dropdown label="Rekening in de grafiek" value={selection?.id ?? ''} onChange={setSelected}
          options={[{ value: '', label: 'Alle rekeningen' }, ...configured.map(account => ({ value: account.id, label: account.label }))]} />
      </div>}>
      {points.length ? <>
        <div className="wealth-balance-summary">
          <BalanceHeadline points={points} missing={missing} />
          {points.length > 1 && <div className="segmented wealth-periods" role="group" aria-label="Periode saldoverloop">
            {balancePeriods.map(period => <button type="button" key={period.days} aria-pressed={days === period.days}
              onClick={() => setDays(period.days)}>{period.label}</button>)}
          </div>}
        </div>
        {points.length > 1 ? <BalanceChart data={points} />
          : <p className="balance-help single-balance">Eén saldodatum beschikbaar. Voor een trend zijn aansluitende afschriften nodig.</p>}
        {newerBalances && <p className="balance-help">Het totaal gebruikt de laatste datum waarop alle ingestelde saldi bekend zijn.</p>}
      </> : configured.length ? <Empty message="Er is geen datum met saldo voor alle ingestelde rekeningen. Kies een rekening om het eigen verloop te zien." />
        : <Empty message="Vul een saldo en datum in om te zien hoeveel er op je bankrekeningen staat.">
          <button type="button" className="primary" onClick={() => edit('setup')}>Saldo instellen</button>
        </Empty>}
    </Panel>

    <Panel title="Bankrekeningen" action={<button type="button" className="secondary compact" onClick={() => edit('new')}>Rekening toevoegen</button>}>
      {accounts.length > 0 && <ul className="balance-accounts">{accounts.map(account => <li key={account.id}>
        <span className="metric-icon violet"><Landmark size={19} /></span>
        <div className="balance-account-name"><b>{account.label}</b>
          <small>{account.latestStatement ? `Afschriften t/m ${displayDate(account.latestStatement)}` : 'Handmatig bijgehouden'}</small>
          {account.latestStatement && account.to && account.to < account.latestStatement && account.latestStatement <= today
            && <small>Voor het nieuwste saldo ontbreken aansluitende afschriften.</small>}</div>
        <div className="balance-account-value">
          <strong>{account.to ? money(account.daily.get(account.to)!) : 'Saldo ontbreekt'}</strong>
          {account.to && <small>{displayDate(account.to)}</small>}
        </div>
        <button type="button" className="secondary compact" aria-label={`${account.anchor ? 'Wijzig saldo van' : 'Stel saldo in voor'} ${account.label}`}
          onClick={() => edit(account.id)}>{account.anchor ? 'Wijzigen' : 'Instellen'}</button>
      </li>)}</ul>}
      <p className="balance-help account-explanation">Banksaldo is het geld op je bankrekeningen. Creditcardafrekeningen en gestorte declaratievergoedingen tellen mee zodra ze op een bankafschrift staan.</p>
    </Panel>

    <section className="wealth-savings" aria-labelledby="wealth-savings-title">
      <header className="wealth-section-head">
        <div><h2 id="wealth-savings-title">Sparen & vaste lasten</h2>
          {insights && <p>{insights.covered.length === 1
            ? displayMonthYear(insights.covered[0])
            : `${insights.covered.length} volledige maanden tot en met ${displayMonthYear(insights.covered.at(-1)!)}`}</p>}
        </div>
        <a href="#reports" className="text-link">Vraag spaaradvies aan</a>
      </header>
      {insights && <div className="metrics three wealth-metrics">
        <Metric title="Netto maandinkomen" value={insights.income > 0 ? money(insights.income) : '—'}
          caption="Gemiddeld salaris en toeslagen" icon={<Banknote size={19} />} />
        <Metric title="Vaste lasten per maand" value={money(insights.fixed)}
          caption="Gemiddeld, inclusief abonnementen" icon={<Landmark size={19} />} tone="blue" />
        <Metric title="Over na uitgaven" value={insights.income > 0 ? signedMoney(insights.room) : '—'}
          caption="Gemiddeld per maand" icon={<PiggyBank size={19} />} tone="violet" />
      </div>}
      <Panel title="Spaardoel per maand" className="wealth-rate-panel">
        <SavingsRateForm rate={rate} reload={reload} />
        {insights && insights.target !== null && <>
          <dl className="wealth-target-summary">
            <div><dt>Doel per maand</dt><dd>{money(insights.target)}</dd></div>
            <div><dt>Over van netto-inkomen</dt><dd>{Math.round(insights.room / insights.income * 100)}%</dd></div>
          </dl>
          {insights.room >= insights.target
            ? <p className="wealth-target-status balance-up">Gemiddeld haal je dit doel met je huidige uitgaven.</p>
            : <p className="wealth-target-status">Gemiddeld kom je {money(insights.target - insights.room)} per maand tekort voor dit doel.</p>}
        </>}
        {insights && insights.income <= 0 && <p className="balance-help">Voor een bedrag bij je spaardoel is een maand met geregistreerd salaris of toeslagen nodig.</p>}
      </Panel>
      <div className="wealth-insight-grid">
        <Panel title="Verdeling vaste lasten" subtitle="Gemiddeld per maand">
          {insights?.categories.length ? <div className="rank-list">{insights.categories.map(item =>
            <RankLink key={item.id} label={item.name} value={money(item.total)} share={item.total / insights.categories[0].total}
              href={categoryHref({ type: 'category', key: item.id })} />)}</div>
            : <Empty message="Er zijn nog geen vaste lasten uit volledige afschriftmaanden." />}
        </Panel>
        <Panel title="Spaarruimte per maand" subtitle="Salaris en toeslagen min persoonlijke netto-uitgaven" className="wealth-room-panel">
          {insights && insights.income > 0 ? <>
            <SavingsRoomChart insights={insights} />
            <p className="balance-help">Persoonlijke uitgaven zijn inclusief creditcardaankopen. Werkdeclaraties en kruisposten vallen buiten deze berekening.</p>
          </> : <Empty message={insights ? 'In deze maanden is geen salaris of toeslag herkend.'
            : 'Importeer minimaal één volledige maand voor alle gebruikte bankrekeningen en creditcards.'} />}
        </Panel>
      </div>
    </section>
  </>;
}

function SavingsRateForm({ rate, reload }: { rate: number | null; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const current = rate === null ? '' : String(rate);
  const input = draft ?? current;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.saveSavingsRate(input === '' ? null : Number(input));
      await reload();
      setDraft(undefined);
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="wealth-rate-form" onSubmit={save}>
    <label><span>Percentage van je netto inkomen</span><span className="wealth-percent">
      <input type="number" inputMode="numeric" min={0} max={100} step={1} value={input} placeholder="20"
        onChange={event => { setDraft(event.target.value); setSaved(false); }} /><Percent size={15} aria-hidden="true" />
    </span></label>
    <button type="submit" className="primary" disabled={busy || input === current}>
      {busy ? 'Opslaan…' : 'Opslaan'}
    </button>
    {saved && <p className="balance-up balance-help" role="status">Spaardoel bijgewerkt.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}
