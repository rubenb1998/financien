import { useEffect, useRef } from 'react';
import { CalendarDays, CreditCard, ListFilter, Search, X } from 'lucide-react';
import { categories, groupLabel, groups, kinds } from '../domain/categories.ts';
import { displayDate } from '../domain/dates.ts';
import { periodBounds } from '../domain/periods.ts';
import type { Filters, Statement } from '../domain/types.ts';
import { Dropdown } from './dropdown.tsx';
import { PeriodPicker } from './period-picker.tsx';
import type { PeriodPickerProps } from './period-picker.tsx';

export function FilterRail({ filters, set, reset, statements, open, close, enabled, tags, analytics, periodPicker, categoryLocked = false, bankAccounts }: {
  filters: Filters; set: (filters: Filters) => void; reset: () => void; statements: Statement[];
  open: boolean; close: () => void; enabled: boolean; tags: string[]; analytics: boolean;
  periodPicker: PeriodPickerProps; categoryLocked?: boolean; bankAccounts?: { value: string; label: string }[];
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    closeButton.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, [open]);
  const newest = statements.map(row => row.to).sort().at(-1);
  const accounts = bankAccounts ?? [...new Map(statements.map(row => [row.accountId, row.label]))]
    .map(([value, label]) => ({ value, label }));
  const update = <K extends keyof Filters,>(key: K, value: Filters[K]) => set({ ...filters, [key]: value });
  const bounds = periodPicker.period && periodBounds(periodPicker.period);

  return <>
    {open && <button className="filter-backdrop" type="button" aria-label="Filters sluiten" onClick={close} />}
    <aside id="filters" onKeyDown={event => { if (open && event.key === 'Escape') close(); }} className={`filter-rail ${open ? 'is-open' : ''}`} aria-label={enabled ? 'Dashboardfilters' : 'Brondekking'}>
      <div className="filter-title">
        <div><ListFilter size={19} /><h2>{enabled ? 'Filters' : 'Brondekking'}</h2></div>
        {enabled && <button className="plain-button" type="button" onClick={reset}>Wis filters</button>}
        <button ref={closeButton} className="icon-btn rail-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
      </div>
      {enabled ? <div className="filter-fields">
        <div className="filter-section">
          <h3><CalendarDays size={16} /> Periode</h3>
          <div className="rail-period-picker"><PeriodPicker {...periodPicker} /></div>
          <details className="date-refinement" open={Boolean(filters.from || filters.to) || undefined}>
            <summary>Datumbereik verfijnen</summary>
            <div className="date-fields">
              <button type="button" className="plain-button" aria-pressed={Boolean(filters.allPeriods)}
                onClick={() => set({ ...filters, period: undefined, allPeriods: true, from: '', to: '' })}>{bankAccounts ? 'Volledige periode' : 'Hele afschriftperiode'}</button>
              <label>Van<input type="date" value={filters.from} min={bounds?.from} max={filters.to || bounds?.to}
                onChange={event => set({ ...filters, period: periodPicker.period, from: event.target.value })} /></label>
              <label>Tot en met<input type="date" value={filters.to} min={filters.from || bounds?.from} max={bounds?.to}
                onChange={event => set({ ...filters, period: periodPicker.period, to: event.target.value })} /></label>
            </div>
          </details>
        </div>
        <div className="filter-section">
          <h3><CreditCard size={16} /> Rekening</h3>
          <Dropdown label="Rekening" value={filters.account} onChange={value => update('account', value)}
            options={[{ value: '', label: 'Alle rekeningen' }, ...accounts]} />
          {bankAccounts && <p className="balance-help">Geldt voor het saldoverloop.</p>}
        </div>
        {!bankAccounts && <>
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
        </>}
      </div> : null}
      {newest && <div className="filter-status"><span className="status-dot" /><div><b>Afschriften t/m</b><p>{displayDate(newest)}</p></div></div>}
    </aside>
  </>;
}
