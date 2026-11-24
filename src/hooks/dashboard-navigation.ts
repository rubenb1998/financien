import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, SetStateAction } from 'react';
import { emptyFilters } from '../domain/ledger.ts';
import type { Filters } from '../domain/types.ts';
import { readRoute } from '../routes.ts';

function historyFilters(): Filters | undefined {
  return history.state?.dashboardFilters;
}

function periodAndAccount({ year, month, from, to, account }: Filters): Filters {
  return { ...emptyFilters, year, month, from, to, account };
}

export function useDashboardNavigation(onNavigate: () => void) {
  const [route, setRoute] = useState(() => readRoute(location.hash));
  const [filters, setFilterState] = useState(historyFilters);
  const current = useRef(filters);

  const remember = useCallback((next: Filters) => {
    current.current = next;
    history.replaceState({ ...history.state, dashboardFilters: next }, '');
    setFilterState(next);
  }, []);

  const setFilters = useCallback((update: SetStateAction<Filters>) => {
    remember(typeof update === 'function' ? update(current.current ?? emptyFilters) : update);
  }, [remember]);

  const initializeYear = useCallback((year: string) => {
    if (!current.current && year) remember({ ...emptyFilters, year });
  }, [remember]);

  const showLocation = useCallback(() => {
    const saved = historyFilters() ?? current.current;
    if (saved) remember(saved);
    setRoute(readRoute(location.hash));
    onNavigate();
  }, [onNavigate, remember]);

  useEffect(() => {
    window.addEventListener('hashchange', showLocation);
    return () => window.removeEventListener('hashchange', showLocation);
  }, [showLocation]);

  const refreshRoute = useCallback(() => setRoute(readRoute(location.hash)), []);

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

  return { route, filters: filters ?? emptyFilters, setFilters, initializeYear, refreshRoute, followMenuLink };
}
