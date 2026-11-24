import { useEffect, useRef } from 'react';
import { CalendarDays, CreditCard, ListFilter, Search, X } from 'lucide-react';
import { categories, groupLabel, groups, kinds } from '../domain/categories.ts';
import { displayDate, displayMonthYear, shiftMonth } from '../domain/dates.ts';
import { emptyFilters } from '../domain/ledger.ts';
import type { Filters, Statement } from '../domain/types.ts';
import { Dropdown } from './dropdown.tsx';

export function FilterRail({ filters, set, statements, open, close, enabled, tags, analytics, months, categoryLocked = false }: {
  filters: Filters; set: (filters: Filters) => void; statements: Statement[];
  open: boolean; close: () => void; enabled: boolean; tags: string[]; analytics: boolean; months: string[]; categoryLocked?: boolean;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    closeButton.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, [open]);
  const years = [...new Set(statements.flatMap(row => Array.from(
    { length: +row.to.slice(0, 4) - +row.from.slice(0, 4) + 1 }, (_, i) => String(+row.from.slice(0, 4) + i),
  )))].sort().reverse();
  const newest = statements.map(row => row.to).sort().at(-1);
  const accounts = [...new Map(statements.map(row => [row.accountId, row])).values()];
  const availableMonths = filters.month && !months.includes(filters.month) ? [...months, filters.month].sort() : months;
  const update = <K extends keyof Filters,>(key: K, value: Filters[K]) => set({ ...filters, [key]: value });
  const lastThree = newest ? `${shiftMonth(newest.slice(0, 7), -2)}-01` : '';
  const custom = Boolean(filters.from || filters.to);
  const preset = filters.from === lastThree && filters.to === newest ? '3m' : !custom ? filters.year || 'all' : '';

  return <>
    {open && <button className="filter-backdrop" type="button" aria-label="Filters sluiten" onClick={close} />}
    <aside id="filters" onKeyDown={event => { if (open && event.key === 'Escape') close(); }} className={`filter-rail ${open ? 'is-open' : ''}`} aria-label={enabled ? 'Dashboardfilters' : 'Brondekking'}>
      <div className="filter-title">
        <div><ListFilter size={19} /><h2>{enabled ? 'Filters' : 'Brondekking'}</h2></div>
        {enabled && <button className="plain-button" onClick={() => set({ ...emptyFilters })}>Wis alles</button>}
        <button ref={closeButton} className="icon-btn rail-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
      </div>
      {enabled ? <div className="filter-fields">
        <div className="filter-section">
          <h3><CalendarDays size={16} /> Periode</h3>
          <div className="filter-presets">
            {years.map(year => <button key={year} type="button" aria-pressed={preset === year}
              onClick={() => set({ ...filters, year, month: '', from: '', to: '' })}>{year}</button>)}
            {newest && <button type="button" aria-pressed={preset === '3m'} onClick={() => set({ ...filters, year: '', month: '', from: lastThree, to: newest })}>3 mnd</button>}
            <button type="button" aria-pressed={preset === 'all'} onClick={() => set({ ...filters, year: '', month: '', from: '', to: '' })}>Alles</button>
          </div>
          <Dropdown field label="Maand" value={filters.month} onChange={value => update('month', value)} searchLabel="Zoek een maand"
            options={[{ value: '', label: 'Alle maanden' }, ...availableMonths.map(value => ({ value, label: displayMonthYear(value) }))]} />
          <div className="date-fields">
            <label>Van<input type="date" value={filters.from} max={filters.to || undefined} onChange={event => set({ ...filters, year: '', month: '', from: event.target.value })} /></label>
            <label>Tot en met<input type="date" value={filters.to} min={filters.from || undefined} onChange={event => set({ ...filters, year: '', month: '', to: event.target.value })} /></label>
          </div>
        </div>
        <div className="filter-section">
          <h3><CreditCard size={16} /> Rekening</h3>
          <Dropdown label="Rekening" value={filters.account} onChange={value => update('account', value)}
            options={[{ value: '', label: 'Alle rekeningen' }, ...accounts.map(account => ({ value: account.accountId, label: account.label }))]} />
        </div>
        <div className="filter-section filter-category">
          <h3><ListFilter size={16} /> Categorie & type</h3>
          {!categoryLocked && <>
            <Dropdown field label="Hoofdcategorie" value={filters.group} onChange={group => set({ ...filters, group, category: '' })}
              options={[{ value: '', label: 'Alle hoofdgroepen' }, ...groups.map(([value, label]) => ({ value, label }))]} />
            <Dropdown field label="Subcategorie" value={filters.category} onChange={value => update('category', value)} searchLabel="Zoek een categorie"
              options={[{ value: '', label: 'Alle subcategorieën' }, ...Object.entries(categories)
                .filter(([, category]) => !filters.group || category.group === filters.group)
                .map(([value, { label, group }]) => ({ value, label, group: filters.group ? undefined : groupLabel(group) }))]} />
          </>}
          <Dropdown field label="Transactietype" value={filters.kind} onChange={value => update('kind', value)}
            options={[{ value: '', label: 'Alle transactietypen' }, ...Object.entries(kinds).map(([value, label]) => ({ value, label }))]} />
          <Dropdown multiple label="Tags" placeholder="Alle tags" searchLabel="Zoek een tag"
            options={tags.map(tag => ({ value: tag, label: tag }))} selected={filters.tags}
            onChange={values => update('tags', values)} clearLabel="Wis tagselectie" />
          <label className="switch-line"><input type="checkbox" checked={filters.subscriptions}
            onChange={event => update('subscriptions', event.target.checked)} />Abonnementskosten meetellen</label>
          {analytics && <label className="switch-line"><input type="checkbox" checked={filters.includeWork}
            onChange={event => update('includeWork', event.target.checked)} />Werkdeclaraties meetellen</label>}
        </div>
        <div className="filter-section">
          <h3><Search size={16} /> Zoeken</h3>
          <input type="search" aria-label="Zoek transacties" placeholder="Naam of omschrijving" value={filters.query}
            onChange={event => update('query', event.target.value)} />
        </div>
      </div> : null}
      {newest && <div className="filter-status"><span className="status-dot" /><div><b>Afschriften t/m</b><p>{displayDate(newest)}</p></div></div>}
    </aside>
  </>;
}
