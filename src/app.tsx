import type { AiModelChoice } from './components/ai-model.tsx';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { CalendarDays, ListFilter, Upload } from 'lucide-react';
import { api } from './api.ts';
import { Breadcrumbs } from './components/breadcrumbs.tsx';
import { FilterSummary } from './components/filter-summary.tsx';
import { FilterRail } from './components/filters.tsx';
import { Navigation } from './components/navigation.tsx';
import { PeriodPicker } from './components/period-picker.tsx';
import { Empty, Notice } from './components/ui.tsx';
import { defaultAiSettings } from './domain/ai.ts';
import { categoryCollections, presentCategories } from './domain/categories.ts';
import { coverage, displayDate, todayInAmsterdam } from './domain/dates.ts';
import { count } from './domain/format.ts';
import { emptyFilters, filterLedger } from './domain/ledger.ts';
import { merchantKey, merchantName, presentProviderAliases } from './domain/merchant-breakdown.ts';
import { pageNames } from './domain/pages.ts';
import type { Page } from './domain/pages.ts';
import { availableMonths, intersectDates, periodBounds, periodLabel, trendCalendar } from './domain/periods.ts';
import { recurringItems } from './domain/subscriptions.ts';
import { subscriptionCostType, subscriptionViewLabels } from './domain/subscription-view.ts';
import { tagOptions } from './domain/tags.ts';
import { bankAccounts } from './domain/wealth.ts';
import { isWork } from './domain/work.ts';
import type { DashboardLedger, Filters, Period, Transaction } from './domain/types.ts';
import { scopeGroup, scopeLabel, transactionsHref } from './routes.ts';
import { SourcesPage } from './features/sources.tsx';
import { TransactionDialog, TransactionTable } from './features/transactions.tsx';
import { useAiConversation } from './hooks/ai-conversation.ts';
import { useDashboardNavigation } from './hooks/dashboard-navigation.ts';

const ChatPage = lazy(() => import('./features/chat.tsx').then(module => ({ default: module.ChatPage })));
const FloatingChat = lazy(() => import('./features/chat.tsx').then(module => ({ default: module.FloatingChat })));
const Overview = lazy(() => import('./features/overview.tsx').then(module => ({ default: module.Overview })));
const CategoryPage = lazy(() => import('./features/categories.tsx').then(module => ({ default: module.CategoryPage })));
const CategoryDashboard = lazy(() => import('./features/category-dashboard.tsx').then(module => ({ default: module.CategoryDashboard })));
const ReportsPage = lazy(() => import('./features/reports.tsx').then(module => ({ default: module.ReportsPage })));
const WorkClaims = lazy(() => import('./features/work-claims.tsx').then(module => ({ default: module.WorkClaims })));
const SubscriptionPage = lazy(() => import('./features/subscriptions.tsx').then(module => ({ default: module.SubscriptionPage })));
const DashboardBalance = lazy(() => import('./features/wealth.tsx').then(module => ({ default: module.DashboardBalance })));
const WealthPage = lazy(() => import('./features/wealth.tsx').then(module => ({ default: module.WealthPage })));
const BalanceEditor = lazy(() => import('./features/balance-editor.tsx').then(module => ({ default: module.BalanceEditor })));

const noTransactions: Transaction[] = [];
const titles: Record<Page, string> = { ...pageNames, overview: 'Financieel overzicht' };

export function App() {
  const [ledger, setLedger] = useState<DashboardLedger | null>(null);
  const [wealthFilters, setWealthFilters] = useState(emptyFilters);
  const [statementFilters, setStatementFilters] = useState(() => new Map<string, Filters>());
  const [filterOpen, setFilterOpen] = useState(false);
  const [miniChat, setMiniChat] = useState(false);
  const [importChoice, setImportChoice] = useState<AiModelChoice>();
  const [selected, setSelected] = useState<string>();
  const [balanceSelection, setBalanceSelection] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const [error, setError] = useState('');
  const onNavigate = useCallback(() => {
    focusHeading.current = true;
    setFilterOpen(false);
    setSelected(undefined);
    setBalanceSelection(undefined);
    window.scrollTo(0, 0);
  }, []);
  const { route, filters: generalFilters, setFilters: setGeneralFilters, refreshRoute, followMenuLink } = useDashboardNavigation(onNavigate);
  const { page, categoryRoute, transactionScope, planId, reportId } = route;
  const statementId = transactionScope?.type === 'statement' ? transactionScope.key : undefined;
  const wealthPage = page === 'wealth';
  const filters = wealthPage ? wealthFilters : statementId ? statementFilters.get(statementId) ?? emptyFilters : generalFilters;

  const reload = useCallback(async () => {
    const data = await api.load();
    presentCategories(data.presentation.categories);
    presentProviderAliases(data.presentation.providerAliases);
    refreshRoute();
    setLedger(data);
  }, [refreshRoute]);

  const aiSettings = ledger?.aiSettings ?? defaultAiSettings;
  const importModel = importChoice ?? { provider: aiSettings.autoClassify ? aiSettings.provider : null, model: aiSettings.model, effort: aiSettings.effort };
  const saveAiSettings = async (value: typeof aiSettings) => {
    const aiSettings = await api.saveAiSettings(value);
    setLedger(current => current && { ...current, aiSettings });
  };

  useEffect(() => {
    reload().catch(failure => setError(failure instanceof Error ? failure.message : 'Laden mislukt.'));
  }, [reload]);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [route]);

  function setFilters(update: SetStateAction<Filters>) {
    if (wealthPage) {
      setWealthFilters(update);
      return;
    }
    if (!statementId) {
      setGeneralFilters(update);
      return;
    }
    setStatementFilters(previous => new Map(previous).set(statementId,
      typeof update === 'function' ? update(previous.get(statementId) ?? emptyFilters) : update));
  }

  const rows = ledger?.transactions ?? noTransactions;
  const today = todayInAmsterdam();
  const accounts = useMemo(() => ledger ? bankAccounts(ledger, today) : [], [ledger, today]);
  const accountLabels = useMemo(() => new Map(ledger?.statements.map(row => [row.accountId, row.label])), [ledger]);
  const wealthAccount = wealthPage ? accounts.find(account => account.id === filters.account) : undefined;
  useEffect(() => {
    if (ledger && wealthFilters.account && !accounts.some(account => account.id === wealthFilters.account)) {
      setWealthFilters(current => ({ ...current, account: '' }));
    }
  }, [ledger, accounts, wealthFilters.account]);
  const statement = ledger?.statements.find(row => row.id === statementId);
  const allCoverage = coverage(ledger?.statements ?? []);
  const coveredStatements = statementId ? statement ? [statement] : [] : ledger?.statements ?? [];
  const sources = coveredStatements.filter(row => !filters.account || row.accountId === filters.account);
  const latestMonth = allCoverage.to.slice(0, 7);
  const period = filters.period ?? (!wealthPage && !statementId && !filters.allPeriods && ledger?.presentation.period !== 'allTime' && !filters.from && !filters.to && latestMonth
    ? { unit: 'year', month: latestMonth } as const : undefined);
  const periodSources = wealthPage ? [...coveredStatements, ...accounts] : sources;
  const periodPicker = { period, months: availableMonths(periodSources), onChange: choosePeriod };
  const bounds = period ? periodBounds(period) : { from: '', to: '' };
  const wealthFrom = filters.from > bounds.from ? filters.from : bounds.from;
  const wealthTo = filters.to && (!bounds.to || filters.to < bounds.to) ? filters.to : bounds.to;
  const hasWealthRange = wealthPage && Boolean(period || filters.allPeriods || filters.from || filters.to);
  const wealthRange = useMemo(() => hasWealthRange ? { from: wealthFrom, to: wealthTo } : undefined,
    [hasWealthRange, wealthFrom, wealthTo]);
  const covered = sources.flatMap(source => {
    const selection = intersectDates(source, bounds);
    const range = selection && intersectDates(selection, filters);
    return range ? [range] : [];
  });
  const from = covered.map(row => row.from).sort()[0] ?? '';
  const to = covered.map(row => row.to).sort().at(-1) ?? '';
  const chartCalendar = trendCalendar(period, { from, to }, covered);
  const trend = { calendar: chartCalendar, onMonth: chartCalendar.unit === 'month' ? selectMonth : undefined };
  const periodCaption = from ? `${displayDate(from)} – ${displayDate(to)}` : 'Geen afschriften in deze periode';
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
  const baseFilters = { ...filters, period };
  const scopedFilters = categoryRoute
    ? { ...baseFilters, group: scope ? scopeGroup(scope) : '', category: scope?.type === 'category' ? scope.key : '' } : baseFilters;
  const scopedRows = filterLedger(transactionRows, scopedFilters);
  const filtered = scope?.type === 'collection'
    ? scopedRows.filter(row => categoryCollections[scope.key]?.categories.includes(row.category)) : scopedRows;
  const analytics = ['overview', 'categories', 'category-dashboard'].includes(page);
  const personalRows = (items: Transaction[]) => filters.includeWork || filters.tags.length ? items : items.filter(row => !isWork(row));
  const analyticalRows = personalRows(filtered);
  const distributionRows = page === 'overview' && (filters.group || filters.category)
    ? personalRows(filterLedger(rows, { ...baseFilters, group: '', category: '' })) : analyticalRows;
  const tags = useMemo(() => tagOptions(rows), [rows]);
  const fullWidth = page === 'reports' || page === 'chat';
  const activeFilters = page !== 'sources' && !fullWidth;
  const activeRow = rows.find(row => row.id === selected);
  const linked = rows.find(row => row.id === activeRow?.linkedId || row.linkedId === selected && selected !== undefined);
  const reviewCount = rows.filter(row => row.review).length;
  const openRow = (row: Transaction) => setSelected(row.id);
  const merchant = categoryRoute?.merchant;
  const provider = merchant === undefined ? undefined : rows.find(row => merchantKey(row) === merchant);
  const providerLabel = provider ? merchantName(provider) : merchant;
  const subject = providerLabel ?? (routeScope && routeScope.type !== 'all' ? scopeLabel(routeScope) : titles[page]);
  const pageTitle = transactionLabel ?? (categoryRoute?.bookings ? `Boekingen · ${subject}` : subject);
  const chat = useAiConversation(aiSettings, Boolean(ledger) && (page === 'chat' || miniChat), reload, {
    page, reportId, statementId,
    ...(wealthPage ? {
      from: wealthRange?.from || (filters.allPeriods && periodPicker.months[0] ? periodPicker.months[0] + '-01' : undefined),
      to: wealthRange?.to, account: wealthAccount?.label,
    }
      : activeFilters && { from, to, group: scopedFilters.group, category: scopedFilters.category }),
    merchant: providerLabel,
  });

  function choosePeriod(period: Period) {
    setFilters(current => ({ ...current, period, allPeriods: false, from: '', to: '' }));
  }

  function selectMonth(month: string) {
    choosePeriod({ unit: 'month', month });
  }

  const selectedMonth = period?.unit === 'month' ? period.month : '';

  function toggleMonth(month: string) {
    if (selectedMonth !== month) selectMonth(month);
    else if (statementId) setFilters(current => ({ ...current, period: undefined, from: '', to: '' }));
    else choosePeriod({ unit: 'year', month });
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

  const transactionFilters = { filters, selectedMonth, toggleMonth, toggleTag, toggleCategory, toggleAccount };

  const shown = page === 'review' ? filtered.filter(row => row.review) : filtered;

  return <div className={fullWidth ? 'app-shell app-shell-planning' : 'app-shell'}>
    <Navigation page={page} reviews={reviewCount} categoryFilter={filters} follow={followMenuLink} />
    <main className="main-content" id="main">
      <div className="topline">
        <Breadcrumbs route={route} title={subject} transactionLabel={transactionLabel} />
        {page !== 'sources' && <a className="secondary compact top-import" href="#sources"><Upload size={15} />Importeren</a>}
      </div>
      <header className="page-head">
        <div><h1 ref={heading} tabIndex={-1}>{pageTitle}</h1>
          {activeFilters && ledger && <>
            {wealthPage ? (period || filters.allPeriods) && <p className="period" aria-live="polite">
              <CalendarDays size={16} aria-hidden="true" /><strong>{period ? periodLabel(period) : 'Volledige periode'}</strong>
            </p> : <p className="period" aria-live="polite"><CalendarDays size={16} aria-hidden="true" />
              <span>{period && <><strong>{periodLabel(period)}</strong><span aria-hidden="true"> · </span></>}{periodCaption}</span></p>}
            <FilterSummary filters={filters} set={setFilters} analytics={analytics} categoryLocked={Boolean(categoryRoute)}
              accountLabel={wealthAccount?.label ?? accountLabels.get(filters.account)}
              selection={transactionLabel ? { label: transactionLabel, href: '#transactions' } : undefined} /></>}
        </div>
        {activeFilters && <button type="button" className="secondary mobile-filter" aria-expanded={filterOpen} aria-controls="filters" onClick={() => setFilterOpen(true)}><ListFilter size={17} />Filters</button>}
      </header>
      {activeFilters && ledger && (period || periodPicker.months.length > 0) && <div className="mobile-period-picker">
        <PeriodPicker {...periodPicker} />
      </div>}
      {error && <Notice>{error} <button type="button" className="plain-button" onClick={() =>
        void reload().then(() => setError('')).catch(failure => setError(String(failure)))}>Opnieuw laden</button></Notice>}
      {!ledger && !error && <p className="loading" role="status">Financiën laden…</p>}
      {!!ledger && <div className="page-body">
        {page === 'overview' && <Suspense fallback={null}>
          <DashboardBalance accounts={accounts} edit={setBalanceSelection} />
        </Suspense>}
        {!rows.length && page !== 'sources' && page !== 'subscriptions' && !wealthPage && !fullWidth ? <Empty message="Importeer je eerste afschrift."><a className="primary" href="#sources">Afschrift toevoegen</a></Empty> : <>
          <Suspense fallback={<p className="loading" role="status">Analyse laden…</p>}>
            {page === 'chat' && <ChatPage settings={aiSettings} reload={reload} chat={chat} importModel={importModel} setImportModel={setImportChoice}
              saveSettings={saveAiSettings} />}
            {page === 'overview' && <Overview rows={analyticalRows} distributionRows={distributionRows}
              trend={trend} group={filters.group} onGroup={toggleGroup} featuredCollection={ledger.presentation.categories.featuredCollection} />}
            {page === 'categories' && <CategoryPage rows={analyticalRows} />}
            {categoryRoute && <CategoryDashboard key={location.hash} route={categoryRoute} rows={analyticalRows}
              trend={trend} accountLabels={accountLabels} onOpen={openRow} incomeOnly={filters.kind === 'income'} />}
            {page === 'reports' && <ReportsPage aiSettings={aiSettings} saveAiSettings={saveAiSettings} plans={ledger.plans ?? []} planId={planId} reportId={reportId} goals={ledger.goals} hasStatements={ledger.statements.length > 0} />}
            {page === 'wealth' && <WealthPage accounts={accounts} rows={rows} statements={ledger.statements}
              today={today} rate={ledger.savingsRate ?? null} range={wealthRange} selection={wealthAccount}
              reload={reload} edit={setBalanceSelection} />}
            {page === 'work' && <WorkClaims rows={filtered} trend={trend}
              accountLabels={accountLabels} open={openRow} transactionFilters={transactionFilters} />}
            {page === 'subscriptions' && <SubscriptionPage rows={rows} selection={new Set(filtered.map(row => row.id))}
              trend={trend} statements={ledger.statements}
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
          {page === 'sources' && <SourcesPage statements={ledger.statements} transactionCount={rows.length} reload={reload} model={importModel} setModel={setImportChoice} />}
        </>}
        {page === 'overview' && allCoverage.to && <footer className="main-foot">
          <a href="#sources">{ledger.statements.length} afschriften</a><span>·</span>
          <a href={transactionsHref({ type: 'transfers' })}>Bekijk kruisposten</a>
        </footer>}
      </div>}
    </main>
    {!fullWidth && <FilterRail filters={filters} set={setFilters} statements={coveredStatements} open={filterOpen}
      close={() => setFilterOpen(false)} enabled={activeFilters} tags={tags} analytics={analytics}
      periodPicker={periodPicker} reset={() => setFilters(wealthPage ? emptyFilters
        : { ...emptyFilters, period: statementId ? undefined : period, allPeriods: filters.allPeriods })}
      bankAccounts={wealthPage ? accounts.map(({ id, label }) => ({ value: id, label })) : undefined}
      categoryLocked={Boolean(categoryRoute)} />}
    {ledger && page !== 'chat' && <Suspense fallback={null}>
      <FloatingChat settings={aiSettings} chat={chat} open={miniChat} setOpen={setMiniChat} />
    </Suspense>}
    {activeRow && <TransactionDialog key={activeRow.id} row={activeRow} account={accountLabels.get(activeRow.accountId) ?? ''}
      corrected={ledger?.corrections[activeRow.id]} linked={linked} openLinked={openRow} close={() => setSelected(undefined)}
      save={async value => { await api.correct(activeRow.id, value); await reload(); }} />}
    {balanceSelection && <Suspense fallback={null}>
      <BalanceEditor key={balanceSelection} selection={balanceSelection} accounts={accounts} today={today}
        close={() => setBalanceSelection(undefined)} reload={reload} />
    </Suspense>}
  </div>;
}

function rowsForSubscription(rows: Transaction[], ids: string[]) {
  const selected = new Set(ids);
  return rows.filter(row => selected.has(row.id));
}
