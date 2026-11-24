import { ListFilter, X } from 'lucide-react';
import { categoryLabel, groupLabel, kinds } from '../domain/categories.ts';
import { displayDate } from '../domain/dates.ts';
import type { Filters, Kind } from '../domain/types.ts';

type ChipProps = { label: string } & ({ clear: () => void } | { href: string });

export function FilterChip({ label, ...action }: ChipProps) {
  const content = <>{label}<X size={12} aria-hidden="true" /></>;
  const name = `Verwijder filter ${label}`;
  return 'href' in action ? <a className="filter-chip" href={action.href} aria-label={name}>{content}</a>
    : <button type="button" className="filter-chip" onClick={action.clear} aria-label={name}>{content}</button>;
}

export function FilterSummary({ filters, set, analytics, categoryLocked, accountLabel, selection }: {
  filters: Filters; set: (filters: Filters) => void; analytics: boolean; categoryLocked: boolean; accountLabel?: string;
  selection?: { label: string; href: string };
}) {
  const patch = (values: Partial<Filters>) => () => set({ ...filters, ...values });
  const range = filters.from && filters.to ? `${displayDate(filters.from)} – ${displayDate(filters.to)}`
    : filters.from ? `Vanaf ${displayDate(filters.from)}` : filters.to ? `T/m ${displayDate(filters.to)}` : '';
  const chips: ChipProps[] = [];
  if (selection) chips.push(selection);
  if (range) chips.push({ label: range, clear: patch({ from: '', to: '' }) });
  if (filters.account) chips.push({ label: accountLabel ?? filters.account, clear: patch({ account: '' }) });
  if (!categoryLocked && filters.group) chips.push({ label: groupLabel(filters.group), clear: patch({ group: '' }) });
  if (!categoryLocked && filters.category) chips.push({ label: categoryLabel(filters.category), clear: patch({ category: '' }) });
  if (filters.kind) chips.push({ label: kinds[filters.kind as Kind] ?? filters.kind, clear: patch({ kind: '' }) });
  if (filters.query.trim()) chips.push({ label: `Zoek op ‘${filters.query.trim()}’`, clear: patch({ query: '' }) });
  for (const tag of filters.tags) {
    chips.push({ label: tag, clear: patch({ tags: filters.tags.filter(value => value !== tag) }) });
  }
  if (analytics && !filters.includeWork && !filters.tags.length) {
    chips.push({ label: 'Zonder werkdeclaraties', clear: patch({ includeWork: true }) });
  }
  if (!filters.subscriptions) chips.push({ label: 'Zonder abonnementskosten', clear: patch({ subscriptions: true }) });
  if (!chips.length) return null;

  return <div className="filter-chips" role="group" aria-label="Actieve filters">
    <span className="filter-chips-label"><ListFilter size={13} aria-hidden="true" />Filters</span>
    {chips.map((chip, index) => <FilterChip key={`${index}-${chip.label}`} {...chip} />)}
  </div>;
}
