import { Building2, ChartNoAxesCombined, List, Receipt, Wallet } from 'lucide-react';
import { useState } from 'react';
import { TrendChart } from '../components/charts.tsx';
import type { TrendContext } from '../components/charts.tsx';
import { Dropdown } from '../components/dropdown.tsx';
import { Empty, Metric, Panel } from '../components/ui.tsx';
import { categories, categoryCollections, dashboardGroups, groupLabel } from '../domain/categories.ts';
import { count, money } from '../domain/format.ts';
import { activitySeries, byMerchant, isActivity, spendingActivity } from '../domain/merchant-breakdown.ts';
import type { ActivityKind } from '../domain/merchant-breakdown.ts';
import type { Transaction } from '../domain/types.ts';
import { allCategories, categoryHref, scopeGroup } from '../routes.ts';
import type { CategoryRoute, CategoryScope } from '../routes.ts';
import { CategoryBreakdown } from './category-breakdown.tsx';
import { MerchantList, paymentShare } from './merchant-list.tsx';
import { ProviderDashboard } from './provider-dashboard.tsx';
import { TransactionTable } from './transactions.tsx';

function CategorySelectors({ route, kind }: { route: CategoryRoute; kind: ActivityKind }) {
  const { scope, bookings } = route;
  const group = scopeGroup(scope);
  const subcategory = scope.type === 'category' || scope.type === 'collection' ? `${scope.type}:${scope.key}` : '';
  const show = (scope: CategoryScope) => { location.hash = categoryHref(scope); };
  const collections = Object.entries(categoryCollections).filter(([, item]) => !group || item.group === group)
    .map(([id, item]) => ({ value: `collection:${id}`, label: `${item.label} (alle onderdelen)`, group: group ? undefined : groupLabel(item.group) }));
  const subcategories = Object.entries(categories).filter(([, item]) => item.group !== 'ignored' && (!group || item.group === group))
    .map(([id, item]) => ({ value: `category:${id}`, label: item.label, group: group ? undefined : groupLabel(item.group) }));

  return <section className="panel category-selectors" aria-label="Categorie kiezen">
    <Dropdown field label="Hoofdcategorie" value={group} onChange={key => show(key ? { type: 'group', key } : allCategories)}
      options={[{ value: '', label: kind === 'income' ? 'Alle categorieën' : 'Alle uitgaven' },
        ...dashboardGroups.map(([value, label]) => ({ value, label }))]} />
    <Dropdown field label="Subcategorie" value={subcategory} searchLabel="Zoek een categorie"
      options={[{ value: '', label: 'Alle subcategorieën' }, ...collections, ...subcategories]}
      onChange={value => {
        const [type, key] = value.split(':');
        show(key ? { type: type === 'collection' ? type : 'category', key } : group ? { type: 'group', key: group } : allCategories);
      }} />
    <a className="secondary" href={categoryHref(scope, { bookings: !bookings })}>
      {bookings ? <ChartNoAxesCombined size={16} /> : <List size={16} />}{bookings ? 'Naar statistieken' : 'Bekijk boekingen'}
    </a>
  </section>;
}

function CategoryTrend({ rows, kind, trend }: {
  rows: Transaction[]; kind: ActivityKind; trend: TrendContext;
}) {
  const [measure, setMeasure] = useState<'amount' | 'count'>('amount');
  const amount = kind === 'income' ? 'Ontvangen' : 'Netto-uitgaven';
  const payments = kind === 'income' ? 'Bijschrijvingen' : 'Betalingen';
  return <Panel title={trend.calendar.unit === 'day' ? 'Per dag' : 'Per maand'} className="category-trend"
    action={<div className="segmented" role="group" aria-label="Grafiekweergave">
      <button type="button" aria-pressed={measure === 'amount'} onClick={() => setMeasure('amount')}>{amount}</button>
      <button type="button" aria-pressed={measure === 'count'} onClick={() => setMeasure('count')}>{payments}</button>
    </div>}>
    {rows.length ? <TrendChart series={activitySeries(rows, kind, trend.calendar)} income={false} measure={measure}
      amountLabel={amount} countLabel={payments} trend={trend} /> : <Empty message="Geen boekingen in deze selectie." />}
  </Panel>;
}

export function CategoryDashboard({ route, rows, trend, accountLabels, onOpen, incomeOnly }: {
  route: CategoryRoute;
  rows: Transaction[];
  trend: TrendContext;
  accountLabels: Map<string, string>;
  onOpen: (row: Transaction) => void;
  incomeOnly: boolean;
}) {
  const { scope, merchant, bookings } = route;
  if (merchant) return <ProviderDashboard route={{ ...route, merchant }} rows={rows}
    trend={trend} accountLabels={accountLabels} onOpen={onOpen} />;

  const kind = scopeGroup(scope) === 'income' || (scope.type === 'all' && incomeOnly) ? 'income' : 'spending';
  const selected = rows.filter(row => isActivity(row, kind));
  const activity = spendingActivity(selected, kind);
  const suppliers = !bookings ? byMerchant(selected, kind) : [];
  const mostFrequent = suppliers.reduce<typeof suppliers[number] | undefined>((best, item) =>
    item.payments > (best?.payments ?? 0) ? item : best, undefined);
  const showBreakdown = scope.type !== 'category';
  const paymentCount = kind === 'income' ? 'Bijschrijvingen' : 'Betalingen';
  const bookingsHref = bookings ? undefined : categoryHref(scope, { bookings: true });

  return <>
    <CategorySelectors route={route} kind={kind} />
    <div className="metrics three">
      <Metric title={kind === 'income' ? 'Ontvangen' : 'Netto-uitgaven'} value={money(activity.net)}
        caption={kind === 'income' ? undefined : 'Na teruggaven'} icon={<Wallet size={19} />} tone="violet" href={bookingsHref} />
      <Metric title={paymentCount} value={count(activity.payments)} icon={<Receipt size={19} />} href={bookingsHref} />
      {mostFrequent
          ? <Metric title={`Meeste ${paymentCount.toLowerCase()}`} value={mostFrequent.name} icon={<Building2 size={19} />} tone="blue"
            caption={`${count(mostFrequent.payments)} · ${paymentShare(mostFrequent.payments, activity.payments)} van het totaal`}
            href={categoryHref(scope, { merchant: mostFrequent.key })} />
          : <Metric title="Gemiddeld bedrag" value={activity.average === null ? '—' : money(activity.average)}
            icon={<Building2 size={19} />} tone="blue" />}
    </div>
    {bookings ? <TransactionTable rows={selected} accountLabels={accountLabels} onOpen={onOpen} showOriginalMerchant />
      : <>
          <div className={showBreakdown ? 'category-insight-grid' : undefined}>
            <CategoryTrend rows={selected} kind={kind} trend={trend} />
            {showBreakdown && <CategoryBreakdown rows={selected} kind={kind} byGroup={scope.type === 'all'} />}
          </div>
          <MerchantList scope={scope} items={suppliers} kind={kind} payments={activity.payments} />
        </>}
  </>;
}
