import { CalendarClock, ChevronRight, CreditCard, Repeat2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { TrendChart } from '../components/charts.tsx';
import type { TrendContext } from '../components/charts.tsx';
import { Dropdown } from '../components/dropdown.tsx';
import { Empty, Metric, Notice, Panel } from '../components/ui.tsx';
import { trendSeries } from '../domain/analytics.ts';
import { categoryLabel } from '../domain/categories.ts';
import { displayDate } from '../domain/dates.ts';
import { money } from '../domain/format.ts';
import { netSpend } from '../domain/ledger.ts';
import { recurringItems, subscriptionTypes } from '../domain/subscriptions.ts';
import type { SubscriptionType } from '../domain/subscriptions.ts';
import type { Statement, Transaction } from '../domain/types.ts';
import { defaultSubscriptionView, isSubscriptionType, subscriptionCostType, subscriptionInView, subscriptionViewLabels } from '../domain/subscription-view.ts';
import type { SubscriptionView } from '../domain/subscription-view.ts';
import { transactionsHref } from '../routes.ts';

const legacyPreferenceKey = 'financien.subscription-view.v1';
const types = Object.keys(subscriptionTypes) as SubscriptionType[];
const typeOptions = [
  ...types.map(value => ({ value, label: subscriptionViewLabels[value] })),
  { value: 'utilities' as const, label: subscriptionViewLabels.utilities },
];

function readLegacyView(): SubscriptionView {
  try {
    const view = JSON.parse(localStorage.getItem(legacyPreferenceKey) ?? 'null');
    if (!view || !Array.isArray(view.types)) return defaultSubscriptionView;
    return {
      types: types.filter(type => view.types.includes(type)),
      period: view.period === 'recent' ? 'recent' : 'all',
      includeUtilities: view.types.includes('fixed'),
    };
  } catch {
    return defaultSubscriptionView;
  }
}

export function SubscriptionPage({ rows, selection, trend, statements, savedView, saveView }: {
  rows: Transaction[];
  selection?: ReadonlySet<string>;
  trend: TrendContext; statements: Statement[];
  savedView: SubscriptionView | null;
  saveView: (view: SubscriptionView) => Promise<void>;
}) {
  const [legacyView] = useState(readLegacyView);
  const [error, setError] = useState('');
  const [pendingView, setPendingView] = useState<SubscriptionView>();
  const saves = useRef(Promise.resolve());
  const view = pendingView ?? savedView ?? legacyView;
  const selectedTypes = view.includeUtilities ? [...view.types, 'utilities' as const] : view.types;

  function updateView(next: SubscriptionView) {
    setPendingView(next);
    saves.current = saves.current.then(async () => {
      try {
        await saveView(next);
        setError('');
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Instellingen opslaan is mislukt.');
      } finally {
        setPendingView(current => current === next ? undefined : current);
      }
    });
  }

  const items = recurringItems(rows, statements, selection).filter(item => subscriptionInView(item, view));
  const recent = items.filter(item => item.active);
  const eligible = view.period === 'recent' ? recent : items;
  const subscriptionIds = new Set(eligible.flatMap(item => item.ids));
  const selected = rows.filter(row => subscriptionIds.has(row.id));
  const chargeDates = new Map(selected.filter(row => row.kind === 'expense').map(row => [row.id, row.date]));
  const monthly = recent.reduce((sum, item) => sum + Math.max(0, item.monthlyCost ?? 0), 0);
  const total = selected.reduce((sum, row) => sum + netSpend(row), 0);

  return <>
    {error && <Notice>{error}</Notice>}
    <div className="metrics three">
      <Metric title="Geschat per maand" value={money(monthly)} caption="Recent betaalde diensten met een maandritme" icon={<CalendarClock size={20} />} />
      <Metric title="Geschat per jaar" value={money(monthly * 12)} caption="Bij gelijkblijvende maandlasten" icon={<Repeat2 size={20} />} tone="blue" />
      <Metric title="Totaal in selectie" value={money(total)} caption="Werkelijke boekingen, na retouren" icon={<CreditCard size={20} />} tone="violet" />
    </div>
    <Panel title={`Abonnementskosten per ${trend.calendar.unit === 'day' ? 'dag' : 'maand'}`}>
      <TrendChart series={trendSeries(selected, trend.calendar)} income={false} trend={trend} />
    </Panel>
    <Panel title="Terugkerende betalingen"
      subtitle={typeOptions.filter(option => selectedTypes.includes(option.value)).map(option => option.label).join(' · ') || 'Geen kostensoorten geselecteerd'}
      action={<div className="subscription-actions">
        <div className="segmented" aria-label="Laatste betaling">
          <button type="button" aria-pressed={view.period === 'recent'} onClick={() => updateView({ ...view, period: 'recent' })}>Recent</button>
          <button type="button" aria-pressed={view.period === 'all'} onClick={() => updateView({ ...view, period: 'all' })}>Alles</button>
        </div>
        <Dropdown multiple compact label="Soorten kosten" options={typeOptions} selected={selectedTypes}
          onChange={selected => updateView({
            ...view, types: selected.filter(isSubscriptionType), includeUtilities: selected.includes('utilities'),
          })} />
      </div>}>
      {eligible.length ? <div className="table-scroll in-panel"><table>
        <thead><tr><th>Aanbieder</th><th>Laatste betaling</th><th className="align-right">Per maand</th><th className="align-right">Per jaar</th><th className="align-right">Totaal</th></tr></thead>
        <tbody>{eligible.map(item => {
          const date = item.ids.map(id => chargeDates.get(id) ?? '').sort().at(-1);
          const estimate = item.monthlyCost === null ? null : Math.max(0, item.monthlyCost);
          return <tr key={item.id}>
            <td><a className="row-open merchant-link" href={transactionsHref({ type: 'subscription', key: item.id })}>
              {item.name}<ChevronRight size={14} aria-hidden="true" />
            </a>
              <small>{categoryLabel(item.category)} · {item.count} {item.count === 1 ? 'boeking' : 'boekingen'}</small>
              {item.type !== 'personal' && <small className="subscription-type">{subscriptionViewLabels[subscriptionCostType(item)]}</small>}</td>
            <td className="date-cell">{date ? displayDate(date) : '—'}{view.period === 'all' && !item.active && <small>Eerder betaald</small>}</td>
            <td className="align-right amount">{estimate === null ? <span title="Onvoldoende regelmatig voor een raming">—</span> : money(estimate)}</td>
            <td className="align-right amount">{estimate === null ? '—' : money(estimate * 12)}</td>
            <td className="align-right amount">{money(item.total)}</td>
          </tr>;
        })}</tbody>
      </table></div> : <Empty message="Geen terugkerende betalingen bij deze filters." />}
    </Panel>
  </>;
}
