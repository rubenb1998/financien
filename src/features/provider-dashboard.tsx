import { ArrowDownLeft, ChartNoAxesCombined, List, Wallet } from 'lucide-react';
import { TrendChart, TrendLegend } from '../components/charts.tsx';
import type { MonthSelection } from '../components/charts.tsx';
import { Empty, Metric, Panel } from '../components/ui.tsx';
import { monthlySeries } from '../domain/analytics.ts';
import { count, money } from '../domain/format.ts';
import { summarize } from '../domain/ledger.ts';
import { isActivity, isProviderBooking, merchantKey } from '../domain/merchant-breakdown.ts';
import type { Transaction } from '../domain/types.ts';
import { categoryHref, scopeLabel } from '../routes.ts';
import type { CategoryRoute } from '../routes.ts';
import { CategoryBreakdown } from './category-breakdown.tsx';
import { TransactionTable } from './transactions.tsx';

export function ProviderDashboard({ route, rows, trendRows, from, to, monthSelection, accountLabels, onOpen }: {
  route: CategoryRoute & { merchant: string };
  rows: Transaction[]; trendRows: Transaction[]; from: string; to: string; monthSelection: MonthSelection;
  accountLabels: Map<string, string>; onOpen: (row: Transaction) => void;
}) {
  const { scope, merchant, bookings, withinCategory } = route;
  const matches = (row: Transaction) => isProviderBooking(row) && merchantKey(row) === merchant;
  const selected = rows.filter(matches);
  const trend = trendRows === rows ? selected : trendRows.filter(matches);
  const totals = summarize(selected);
  const canShowIncome = trend.some(row => row.kind === 'income');
  const canShowSpending = trend.some(row => isActivity(row, 'spending'));
  const incomeOnly = canShowIncome && !canShowSpending;
  const overviewHref = categoryHref(scope, { merchant, withinCategory });
  const bookingsHref = categoryHref(scope, { merchant, withinCategory, bookings: true });
  const table = <TransactionTable rows={selected} accountLabels={accountLabels} onOpen={onOpen} showOriginalMerchant />;
  return <>
    <div className="panel provider-toolbar">
      <nav className="detail-tabs" aria-label="Aanbiedersweergave">
        <a href={overviewHref} aria-current={!bookings ? 'page' : undefined}><ChartNoAxesCombined size={15} />Overzicht</a>
        <a href={bookingsHref} aria-current={bookings ? 'page' : undefined}><List size={15} />Boekingen</a>
      </nav>
      {scope.type !== 'all' && <nav className="detail-tabs" aria-label="Categorieën van aanbieder">
        <a href={categoryHref(scope, { merchant, bookings })} aria-current={!withinCategory ? 'page' : undefined}>Alle categorieën</a>
        <a href={categoryHref(scope, { merchant, bookings, withinCategory: true })} aria-current={withinCategory ? 'page' : undefined}>{scopeLabel(scope)}</a>
      </nav>}
    </div>
    <div className="metrics three">
      <Metric title={incomeOnly ? 'Ontvangen' : 'Netto-uitgaven'} value={money(incomeOnly ? totals.income : totals.spent)}
        icon={<Wallet size={19} />} tone="violet" href={bookings ? undefined : bookingsHref} />
      <Metric title="Boekingen" value={count(selected.length)} icon={<List size={19} />} href={bookings ? undefined : bookingsHref} />
      <Metric title={incomeOnly ? 'Gemiddelde bijschrijving' : 'Teruggaven'}
        value={incomeOnly ? selected.length ? money(Math.round(totals.income / selected.length)) : '—' : money(totals.refunds)}
        caption={canShowIncome && canShowSpending ? `${money(totals.income)} aan inkomsten` : undefined}
        icon={<ArrowDownLeft size={19} />} tone="blue" />
    </div>
    {bookings ? table : !trend.length && !monthSelection.selectedMonth ? <Empty message="Geen boekingen in deze selectie." /> : <>
      <div className="category-insight-grid">
        <Panel title="Per maand" className="category-trend"
          action={canShowIncome && canShowSpending && <TrendLegend income="Inkomsten" expenses="Netto-uitgaven" />}>
          <TrendChart series={incomeOnly
            ? monthlySeries(trend, from, to).map(point => ({ ...point, spent: point.income }))
            : monthlySeries(trend, from, to)} monthSelection={monthSelection}
            amountLabel={incomeOnly ? 'Inkomsten' : 'Netto-uitgaven'} income={canShowIncome && canShowSpending} />
        </Panel>
        <div className="provider-categories">
          {canShowSpending && <CategoryBreakdown rows={selected.filter(row => isActivity(row, 'spending'))} kind="spending" merchant={merchant} />}
          {canShowIncome && <CategoryBreakdown rows={selected.filter(row => isActivity(row, 'income'))} kind="income" merchant={merchant} />}
          {!trend.length && <Empty message="Geen categorieën in deze selectie." />}
        </div>
      </div>
      <div className="provider-bookings"><h2>Boekingen</h2>{table}</div>
    </>}
  </>;
}
