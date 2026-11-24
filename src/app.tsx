import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { CalendarDays, ListFilter, Upload } from 'lucide-react';
import { api } from './api.ts';
import { Breadcrumbs } from './components/breadcrumbs.tsx';
import { FilterSummary } from './components/filter-summary.tsx';
import { FilterRail } from './components/filters.tsx';
import { Navigation } from './components/navigation.tsx';
import { Empty, Notice } from './components/ui.tsx';
import { categoryCollections, presentCategories } from './domain/categories.ts';
import { coverage, displayDate, limitToMonth, monthSpan } from './domain/dates.ts';
import { count } from './domain/format.ts';
import { emptyFilters, filterLedger } from './domain/ledger.ts';
import { merchantKey, merchantName, presentProviderAliases } from './domain/merchant-breakdown.ts';
import { pageNames } from './domain/pages.ts';
import type { Page } from './domain/pages.ts';
import { recurringItems } from './domain/subscriptions.ts';
import { subscriptionCostType, subscriptionViewLabels } from './domain/subscription-view.ts';
import { tagOptions } from './domain/tags.ts';
import { isWork } from './domain/work.ts';
import type { DashboardLedger, Filters, Transaction } from './domain/types.ts';
import { scopeGroup, scopeLabel, transactionsHref } from './routes.ts';
import { SourcesPage } from './features/sources.tsx';
import { TransactionDialog, TransactionTable } from './features/transactions.tsx';
import { useDashboardNavigation } from './hooks/dashboard-navigation.ts';

const Overview = lazy(() => import('./features/overview.tsx').then(module => ({ default: module.Overview })));
const CategoryPage = lazy(() => import('./features/categories.tsx').then(module => ({ default: module.CategoryPage })));
const CategoryDashboard = lazy(() => import('./features/category-dashboard.tsx').then(module => ({ default: module.CategoryDashboard })));
const GoalPage = lazy(() => import('./features/goals.tsx').then(module => ({ default: module.GoalPage })));
const WorkClaims = lazy(() => import('./features/work-claims.tsx').then(module => ({ default: module.WorkClaims })));
const SubscriptionPage = lazy(() => import('./features/subscriptions.tsx').then(module => ({ default: module.SubscriptionPage })));

const noTransactions: Transaction[] = [];
const titles: Record<Page, string> = { ...pageNames, overview: 'Financieel overzicht' };

export function App() {
  const [ledger, setLedger] = useState<DashboardLedger | null>(null);
  const [statementFilters, setStatementFilters] = useState(() => new Map<string, Filters>());
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const [error, setError] = useState('');
  const onNavigate = useCallback(() => {
    focusHeading.current = true;
    setFilterOpen(false);
    setSelected(undefined);
    window.scrollTo(0, 0);
  }, []);
  const { route, filters: generalFilters, setFilters: setGeneralFilters, initializeYear, refreshRoute, followMenuLink } = useDashboardNavigation(onNavigate);
  const { page, categoryRoute, transactionScope, planId } = route;
  const statementId = transactionScope?.type === 'statement' ? transactionScope.key : undefined;
  const filters = statementId ? statementFilters.get(statementId) ?? emptyFilters : generalFilters;

  const reload = useCallback(async () => {
    const data = await api.load();
    presentCategories(data.presentation.categories);
    presentProviderAliases(data.presentation.providerAliases);
    refreshRoute();
    setLedger(data);
    if (data.presentation.period === 'latestYear') initializeYear(coverage(data.statements).to.slice(0, 4));
  }, [initializeYear, refreshRoute]);

  useEffect(() => {
    void reload().catch(failure => setError(failure instanceof Error ? failure.message : 'Laden mislukt.'));
  }, [reload]);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [route]);

  function setFilters(update: SetStateAction<Filters>) {
    if (!statementId) {
      setGeneralFilters(update);
      return;
    }
    setStatementFilters(previous => new Map(previous).set(statementId,
      typeof update === 'function' ? update(previous.get(statementId) ?? emptyFilters) : update));
  }

  const rows = ledger?.transactions ?? noTransactions;
  const accountLabels = useMemo(() => new Map(ledger?.statements.map(row => [row.accountId, row.label])), [ledger]);
  const statement = ledger?.statements.find(row => row.id === statementId);
  const subscriptionId = transactionScope?.type === 'subscription' ? transactionScope.key : undefined;
  const subscription = useMemo(() => subscriptionId && ledger
    ? recurringItems(rows, ledger.statements).find(item => item.id === subscriptionId) : undefined, [rows, ledger, subscriptionId]);
  const transactionLabel = statementId ? statement?.label ?? 'Afschriftboekingen' : subscriptionId
    ? subscription ? subscription.type === 'personal' ? subscription.name : `${subscription.name} · ${subscriptionViewLabels[subscriptionCostType(subscription)]}` : 'Abonnementsboekingen'
    : transactionScope?.type === 'transfers' ? 'Kruisposten' : undefined;
  const transactionRows = statementId ? rows.filter(row => row.statementId === statementId)
    : subscriptionId ? rowsForSubscription(rows, subscription?.ids ?? [])
    : transactionScope?.type === 'transfers' ? rows.filter(row => row.kind === 'transfer') : rows;
  const routeScope = categoryRoute?.scope;
  const scope = categoryRoute?.merchant && !categoryRoute.withinCategory ? undefined : routeScope;
  const baseFilters = { ...filters, month: '' };
  const scopedFilters = categoryRoute
    ? { ...baseFilters, group: scope ? scopeGroup(scope) : '', category: scope?.type === 'category' ? scope.key : '' } : baseFilters;
  const scopedRows = filterLedger(transactionRows, scopedFilters);
  const periodRows = scope?.type === 'collection'
    ? scopedRows.filter(row => categoryCollections[scope.key]?.categories.includes(row.category)) : scopedRows;
  const filtered = filters.month ? filterLedger(periodRows, { ...emptyFilters, month: filters.month }) : periodRows;
  const analytics = ['overview', 'categories', 'category-dashboard'].includes(page);
  const personalRows = (items: Transaction[]) => filters.includeWork || filters.tags.length ? items : items.filter(row => !isWork(row));
  const analyticalRows = personalRows(filtered);
  const trendRows = filters.month ? personalRows(periodRows) : analyticalRows;
  const distributionRows = page === 'overview' && (filters.group || filters.category)
    ? personalRows(filterLedger(rows, { ...filters, group: '', category: '' })) : analyticalRows;
  const tags = useMemo(() => tagOptions(rows), [rows]);
  const allCoverage = coverage(ledger?.statements ?? []);
  const coveredStatements = statementId ? statement ? [statement] : [] : ledger?.statements ?? [];
  const sourceCoverage = coverage(coveredStatements.filter(row => !filters.account || row.accountId === filters.account));
  const from = [sourceCoverage.from, filters.from, filters.year && `${filters.year}-01-01`].filter(Boolean).sort().at(-1) ?? '';
  const to = [sourceCoverage.to, filters.to, filters.year && `${filters.year}-12-31`].filter(Boolean).sort()[0] ?? '';
  const shownDates = limitToMonth(from, to, filters.month);
  const period = sourceCoverage.from && shownDates.from <= shownDates.to
    ? `${displayDate(shownDates.from)} – ${displayDate(shownDates.to)}` : 'Geen afschriften in deze periode';
  const activeFilters = !['sources', 'goals'].includes(page);
  const activeRow = rows.find(row => row.id === selected);
  const linked = rows.find(row => row.id === activeRow?.linkedId || row.linkedId === selected && selected !== undefined);
  const reviewCount = rows.filter(row => row.review).length;
  const openRow = (row: Transaction) => setSelected(row.id);
  const merchant = categoryRoute?.merchant;
  const provider = merchant === undefined ? undefined : rows.find(row => merchantKey(row) === merchant);
  const providerLabel = provider ? merchantName(provider) : merchant;
  const subject = providerLabel ?? (routeScope && routeScope.type !== 'all' ? scopeLabel(routeScope) : titles[page]);
  const pageTitle = transactionLabel ?? (categoryRoute?.bookings ? `Boekingen · ${subject}` : subject);

  function toggleMonth(month: string) {
    setFilters(current => ({ ...current, month: current.month === month ? '' : month }));
  }

  function toggleGroup(group: string) {
    setFilters(current => ({ ...current, group: current.group === group && !current.category ? '' : group, category: '' }));
  }

  function toggleCategory(category: string) {
    setFilters(current => ({ ...current, category: current.category === category ? '' : category }));
  }

  function toggleTag(tag: string) {
    setFilters(current => ({
      ...current, tags: current.tags.includes(tag) ? current.tags.filter(value => value !== tag) : [...current.tags, tag],
    }));
  }

  function toggleAccount(account: string) {
    setFilters(current => ({ ...current, account: current.account === account ? '' : account }));
  }

  const monthSelection = { selectedMonth: filters.month, onMonth: toggleMonth };
  const transactionFilters = { filters, toggleMonth, toggleTag, toggleCategory, toggleAccount };

  const shown = page === 'review' ? filtered.filter(row => row.review) : filtered;

  return <div className={page === 'goals' ? 'app-shell app-shell-planning' : 'app-shell'}>
    <Navigation page={page} reviews={reviewCount} categoryFilter={filters} follow={followMenuLink} />
    <main className="main-content" id="main">
      <div className="topline">
        <Breadcrumbs route={route} title={subject} transactionLabel={transactionLabel} />
        {page !== 'sources' && <a className="secondary compact top-import" href="#sources"><Upload size={15} />Importeren</a>}
      </div>
      <header className="page-head">
        <div><h1 ref={heading} tabIndex={-1}>{pageTitle}</h1>
          {activeFilters && ledger && <><p className="period" aria-live="polite"><CalendarDays size={16} aria-hidden="true" />{period}</p>
            <FilterSummary filters={filters} set={setFilters} analytics={analytics} categoryLocked={Boolean(categoryRoute)}
              accountLabel={accountLabels.get(filters.account)}
              selection={transactionLabel ? { label: transactionLabel, href: '#transactions' } : undefined} /></>}
        </div>
        {activeFilters && <button type="button" className="secondary mobile-filter" aria-expanded={filterOpen} aria-controls="filters" onClick={() => setFilterOpen(true)}><ListFilter size={17} />Filters</button>}
      </header>
      {error && <Notice>{error} <button type="button" className="plain-button" onClick={() =>
        void reload().then(() => setError('')).catch(failure => setError(String(failure)))}>Opnieuw laden</button></Notice>}
      {!ledger && !error && <p className="loading" role="status">Financiën laden…</p>}
      {!!ledger && <div className="page-body">
        {!rows.length && page !== 'sources' && page !== 'goals' && page !== 'subscriptions' ? <Empty message="Importeer je eerste afschrift."><a className="primary" href="#sources">Afschrift toevoegen</a></Empty> : <>
          <Suspense fallback={<p className="loading" role="status">Analyse laden…</p>}>
            {page === 'overview' && <Overview rows={analyticalRows} trendRows={trendRows} distributionRows={distributionRows}
              from={from} to={to} monthSelection={monthSelection} group={filters.group} onGroup={toggleGroup}
              featuredCollection={ledger.presentation.categories.featuredCollection} />}
            {page === 'categories' && <CategoryPage rows={analyticalRows} />}
            {categoryRoute && <CategoryDashboard key={location.hash} route={categoryRoute} rows={analyticalRows} trendRows={trendRows}
              from={from} to={to} monthSelection={monthSelection} accountLabels={accountLabels} onOpen={openRow} incomeOnly={filters.kind === 'income'} />}
            {page === 'goals' && <GoalPage plans={ledger.plans ?? []} planId={planId} goals={ledger.goals} />}
            {page === 'work' && <WorkClaims rows={filtered} trendRows={periodRows} from={from} to={to} monthSelection={monthSelection}
              accountLabels={accountLabels} open={openRow} transactionFilters={transactionFilters} />}
            {page === 'subscriptions' && <SubscriptionPage rows={rows} selection={new Set(periodRows.map(row => row.id))}
              from={from} to={to} monthSelection={monthSelection} statements={ledger.statements}
              savedView={ledger.subscriptionView} saveView={async view => {
                await api.saveSubscriptionView(view);
                setLedger(current => current && { ...current, subscriptionView: view });
              }} />}
          </Suspense>
          {(page === 'transactions' || page === 'review') && <>
            {page === 'review' && <Notice>{count(shown.length)} in deze selectie · {count(reviewCount)} in totaal. Open een boeking om de voorgestelde indeling te controleren.</Notice>}
            <TransactionTable key={location.hash} rows={shown} prioritizeAmount={page === 'review'}
              accountLabels={accountLabels} onOpen={openRow} transactionFilters={transactionFilters} />
          </>}
          {page === 'sources' && <SourcesPage statements={ledger.statements} transactionCount={rows.length} reload={reload} />}
        </>}
        {page === 'overview' && allCoverage.to && <footer className="main-foot">
          <a href="#sources">{ledger.statements.length} afschriften</a><span>·</span>
          <a href={transactionsHref({ type: 'transfers' })}>Bekijk kruisposten</a>
        </footer>}
      </div>}
    </main>
    {page !== 'goals' && <FilterRail filters={filters} set={setFilters} statements={coveredStatements} open={filterOpen}
      close={() => setFilterOpen(false)} enabled={activeFilters} tags={tags} analytics={analytics}
      months={monthSpan(from, to)} categoryLocked={Boolean(categoryRoute)} />}
    {activeRow && <TransactionDialog key={activeRow.id} row={activeRow} account={accountLabels.get(activeRow.accountId) ?? ''}
      corrected={ledger?.corrections[activeRow.id]} linked={linked} openLinked={openRow} close={() => setSelected(undefined)}
      save={async value => { await api.correct(activeRow.id, value); await reload(); }} />}
  </div>;
}

function rowsForSubscription(rows: Transaction[], ids: string[]) {
  const selected = new Set(ids);
  return rows.filter(row => selected.has(row.id));
}
