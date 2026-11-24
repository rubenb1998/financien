import { Activity, ArrowDownLeft, ArrowUpRight, ChevronRight, CircleDollarSign, CreditCard, ShoppingBasket, TriangleAlert } from 'lucide-react';
import { byCategory, byGroup, monthlySeries } from '../domain/analytics.ts';
import { categoryCollections, categoryLabel, groups } from '../domain/categories.ts';
import { addDays, displayMonthYear, shiftMonth } from '../domain/dates.ts';
import { count, money, roundedMoney } from '../domain/format.ts';
import { netSpend, summarize } from '../domain/ledger.ts';
import type { Transaction } from '../domain/types.ts';
import { SpendDonut, TrendChart, TrendLegend } from '../components/charts.tsx';
import type { MonthSelection } from '../components/charts.tsx';
import { Empty, Metric, Panel, RankLink } from '../components/ui.tsx';
import { categoryHref } from '../routes.ts';

export function Overview({ rows, trendRows, distributionRows, from, to, monthSelection, group, onGroup, featuredCollection }: {
  rows: Transaction[]; trendRows: Transaction[]; distributionRows: Transaction[];
  from: string; to: string; monthSelection: MonthSelection; group: string; onGroup: (group: string) => void; featuredCollection?: string;
}) {
  const summary = summarize(rows);
  const series = monthlySeries(trendRows, from, to);
  const groupMap = new Map(byGroup(distributionRows).map(({ id, total }) => [id, total]));
  const distribution = groups.filter(([id]) => groupMap.has(id)).map(([id, name, fill]) =>
    ({ id, name, fill, value: groupMap.get(id) ?? 0 }));
  const groceries = rows.filter(row => row.category === 'groceries').reduce((sum, row) => sum + netSpend(row), 0);
  const collection = featuredCollection ? categoryCollections[featuredCollection] : undefined;
  const collectionSpend = collection
    ? rows.filter(row => collection.categories.includes(row.category)).reduce((sum, row) => sum + netSpend(row), 0)
    : 0;
  const recentMonth = monthSelection.selectedMonth ? series.find(item => item.month === monthSelection.selectedMonth) : series.at(-1);
  const partialLastMonth = recentMonth && to < addDays(`${shiftMonth(recentMonth.month, 1)}-01`, -1);
  const subscriptions = rows.filter(row => row.subscription).reduce((sum, row) => sum + netSpend(row), 0);
  const review = rows.filter(row => row.review).length;
  const top = byCategory(rows).filter(item => item.total > 0).slice(0, 5);

  return <>
    <div className="metrics">
      <Metric title="Netto-uitgaven" value={money(summary.spent)} caption={summary.refunds ? `${money(summary.refunds)} aan teruggaven verrekend` : 'Werkelijke bestedingen'} icon={<ArrowUpRight size={20} />} tone="violet" />
      <Metric title="Inkomsten" value={money(summary.income)} caption="Externe bijschrijvingen" icon={<ArrowDownLeft size={20} />}
        href={categoryHref({ type: 'group', key: 'income' })} />
      <Metric title="Verschil" value={money(summary.income - summary.spent)} caption="Inkomsten min netto-uitgaven" icon={<CircleDollarSign size={19} />} tone="blue" />
      <Metric title={categoryLabel('groceries')} value={money(groceries)} caption={summary.spent > 0 ? `${Math.max(0, Math.round(groceries / summary.spent * 100))}% van netto-uitgaven` : 'Binnen je selectie'} icon={<ShoppingBasket size={19} />} tone="amber"
        href={categoryHref({ type: 'category', key: 'groceries' })} />
    </div>

    <div className="overview-grid">
      <Panel title="Inkomsten & uitgaven" subtitle="Ontwikkeling per maand" className="trend-panel"
        action={<TrendLegend income="Inkomsten" expenses="Uitgaven" />}>
        <TrendChart series={series} monthSelection={monthSelection} />
        {recentMonth && <div className="chart-note"><button type="button" className="plain-button"
          aria-pressed={recentMonth.month === monthSelection.selectedMonth} onClick={() => monthSelection.onMonth(recentMonth.month)}>
          {displayMonthYear(recentMonth.month)}{partialLastMonth ? ' · deelmaand' : ''}</button>
          <strong>{money(recentMonth.spent)} uitgegeven</strong></div>}
      </Panel>

      <Panel title="Waar gaat je geld heen?" subtitle="Verdeling per hoofdgroep" className="distribution-panel">
        <SpendDonut data={distribution} total={distribution.reduce((sum, item) => sum + item.value, 0)} selectedGroup={group} onGroup={onGroup} />
        <ul className="split-list">
          {distribution.map(item => <li key={item.id}><button type="button" aria-pressed={group === item.id} onClick={() => onGroup(item.id)}>
            <span><i style={{ background: item.fill }} />{item.name}</span><strong>{roundedMoney(item.value)}</strong>
          </button></li>)}
        </ul>
      </Panel>
    </div>

    <div className="overview-grid bottom-grid">
      <Panel title="Grootste uitgavenposten" action={<a className="text-link" href="#categories">Alle categorieën <ChevronRight size={15} /></a>}>
        {top.length ? <div className="rank-list">{top.map(item =>
          <RankLink key={item.id} label={item.name} value={money(item.total)} share={item.total / top[0].total}
            href={categoryHref({ type: 'category', key: item.id })} />)}</div> : <Empty message="Geen uitgavenposten in deze selectie." />}
      </Panel>
      <Panel title="Uitgelicht">
        <div className="shortcut-list">
          {featuredCollection && collection && <a href={categoryHref({ type: 'collection', key: featuredCollection })}>
            <span className="metric-icon amber"><Activity size={19} /></span>
            <span><b>{collection.label}</b><small>{money(collectionSpend)} netto</small></span><ChevronRight size={16} />
          </a>}
          <a href="#subscriptions"><span className="metric-icon blue"><CreditCard size={19} /></span><span><b>Abonnementen</b><small>{money(subscriptions)} netto</small></span><ChevronRight size={16} /></a>
          <a href="#review"><span className="metric-icon violet"><TriangleAlert size={19} /></span><span><b>Te controleren</b><small>{count(review)} boekingen in selectie</small></span><ChevronRight size={16} /></a>
        </div>
      </Panel>
    </div>
  </>;
}
