import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, SetStateAction } from 'react';
import { shiftMonth } from '../domain/dates.ts';
import { emptyFilters } from '../domain/ledger.ts';
import type { Filters } from '../domain/types.ts';
import { filtersFollowLink, readRoute } from '../routes.ts';

function historyFilters(): Filters | undefined {
  const saved: (Filters & { year?: string; month?: string }) | undefined = history.state?.dashboardFilters;
  if (!saved) return undefined;
  const { year, month, ...filters } = saved;
  if (month) return { ...filters, period: { unit: 'month', month } };
  if (year) return { ...filters, period: { unit: 'year', month: `${year}-12` } };
  if (year !== undefined && filters.to && filters.from === `${shiftMonth(filters.to.slice(0, 7), -2)}-01`) {
    return { ...filters, from: '', to: '', period: { unit: 'quarter', month: filters.to.slice(0, 7) } };
  }
  return filters;
}

function periodAndAccount({ period, allPeriods, from, to, account }: Filters): Filters {
  return { ...emptyFilters, period, allPeriods, from, to, account };
}

export function useDashboardNavigation(onNavigate: () => void) {
  const [route, setRoute] = useState(() => readRoute(location.hash));
  const [filters, setFilterState] = useState(historyFilters);
  const current = useRef(filters);
  const currentRoute = useRef(route);

  const remember = useCallback((next: Filters) => {
    current.current = next;
    history.replaceState({ ...history.state, dashboardFilters: next }, '');
    setFilterState(next);
  }, []);

  const setFilters = useCallback((update: SetStateAction<Filters>) => {
    remember(typeof update === 'function' ? update(current.current ?? emptyFilters) : update);
  }, [remember]);

  const showLocation = useCallback(() => {
    const nextRoute = readRoute(location.hash);
    const saved = historyFilters() ?? (current.current && (filtersFollowLink(currentRoute.current, nextRoute)
      ? current.current : periodAndAccount(current.current)));
    if (saved) remember(saved);
    currentRoute.current = nextRoute;
    setRoute(nextRoute);
    onNavigate();
  }, [onNavigate, remember]);

  useEffect(() => {
    window.addEventListener('hashchange', showLocation);
    return () => window.removeEventListener('hashchange', showLocation);
  }, [showLocation]);

  function followMenuLink(event: MouseEvent<HTMLAnchorElement>, keepContext: boolean) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const hash = event.currentTarget.hash;
    event.preventDefault();
    if (hash === location.hash) return;
    const filters = current.current;
    const next = filters && !keepContext ? periodAndAccount(filters) : filters;
    history.pushState(next ? { dashboardFilters: next } : null, '', hash);
    showLocation();
  }

  const refreshRoute = useCallback(() => {
    const nextRoute = readRoute(location.hash);
    currentRoute.current = nextRoute;
    setRoute(nextRoute);
  }, []);

  return { route, refreshRoute, filters: filters ?? emptyFilters, setFilters, followMenuLink };
}
