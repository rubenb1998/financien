import { Check, ChevronDown, Search } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { positionDropdown } from './dropdown-position.ts';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  group?: string;
}

type DropdownProps<T extends string> = {
  label: string;
  options: readonly DropdownOption<T>[];
  field?: boolean;
  compact?: boolean;
  placeholder?: string;
  searchLabel?: string;
} & (
  { multiple?: false; value: T; onChange: (value: T) => void }
  | { multiple: true; selected: readonly T[]; onChange: (values: T[]) => void; clearLabel?: string }
);

function searchText(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('nl-NL').trim();
}

export function Dropdown<T extends string>(props: DropdownProps<T>) {
  const { label, options, field, compact, placeholder, searchLabel = 'Zoek een optie' } = props;
  const id = useId();
  const listId = `${id}-options`;
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const typeAhead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const searchable = options.length >= 9;
  const multiple = props.multiple === true;
  const selected = multiple ? props.selected : [props.value];
  const summary = multiple ? (selected.length ? label : placeholder ?? label)
    : options.find(option => option.value === props.value)?.label ?? placeholder ?? 'Kies een optie';
  const query = searchText(search);
  const groups = Map.groupBy(options.filter(option => !query || searchText(`${option.label} ${option.group ?? ''}`).includes(query)),
    option => option.group ?? '');
  const visible = [...groups.values()].flat();
  const optionId = (value: T) => `${listId}-${encodeURIComponent(value)}`;
  const active = visible[activeIndex];
  const activeId = active && open ? optionId(active.value) : undefined;

  function close() {
    if (popup.current?.matches(':popover-open')) popup.current.hidePopover();
  }

  function choose(value: T) {
    if (multiple) {
      props.onChange(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
      return;
    }
    close();
    trigger.current?.focus({ preventScroll: true });
    if (props.value !== value) props.onChange(value);
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    const editing = event.target === searchInput.current;
    if (!editing && event.target !== list.current) return;
    if (event.key === 'Enter' || (!editing && event.key === ' ')) {
      event.preventDefault();
      if (active) choose(active.value);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(Math.max(0, Math.min(activeIndex + offset, visible.length - 1)));
      return;
    }
    if (editing) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : Math.max(0, visible.length - 1));
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.metaKey || event.ctrlKey) return;
    const now = Date.now();
    const last = typeAhead.current;
    const letter = searchText(event.key);
    const prefix = now - last.time < 650 && last.text !== letter ? last.text + letter : letter;
    typeAhead.current = { text: prefix, time: now };
    const next = [...visible.slice(activeIndex + 1), ...visible.slice(0, activeIndex + 1)]
      .find(option => searchText(option.label).startsWith(prefix));
    if (next) setActiveIndex(visible.indexOf(next));
  }

  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return;
    const panel = popup.current;
    const button = trigger.current;
    const position = () => positionDropdown(panel, button, compact ? 'end' : 'start');
    const closeOnScroll = (event: Event) => {
      if (event.target instanceof Node && panel.contains(event.target)) return;
      close();
    };
    position();
    (searchInput.current ?? list.current)?.focus({ preventScroll: true });
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      delete panel.dataset.positioned;
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open, compact]);

  useLayoutEffect(() => {
    const container = list.current;
    const option = activeId && document.getElementById(activeId);
    if (!container || !option) return;
    const frame = container.getBoundingClientRect();
    const row = option.getBoundingClientRect();
    if (row.top < frame.top) container.scrollTop += row.top - frame.top - 4;
    if (row.bottom > frame.bottom) container.scrollTop += row.bottom - frame.bottom + 4;
  }, [activeId]);

  function renderOption(option: DropdownOption<T>) {
    const checked = selected.includes(option.value);
    return <div key={option.value} id={optionId(option.value)} className="dropdown-option" role="option"
      aria-selected={checked} data-active={active?.value === option.value}
      onMouseDown={event => event.preventDefault()} onClick={() => choose(option.value)}>
      {multiple && <span className="dropdown-checkbox" aria-hidden="true">{checked && <Check size={12} strokeWidth={2.7} />}</span>}
      <span className="dropdown-option-label">{option.label}</span>
      {!multiple && checked && <Check className="dropdown-check" size={16} strokeWidth={2.4} aria-hidden="true" />}
    </div>;
  }

  return <div className={`dropdown${compact ? ' dropdown-compact' : ''}`} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
  }}>
    <span id={`${id}-label`} className={field ? 'dropdown-label' : 'visually-hidden'}>{label}</span>
    <button type="button" ref={trigger} className="dropdown-trigger" popoverTarget={id}
      aria-haspopup="listbox" aria-controls={listId} aria-expanded={open}
      aria-labelledby={summary === label ? `${id}-value` : `${id}-label ${id}-value`}
      aria-describedby={multiple && selected.length > 0 ? `${id}-count` : undefined}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        if (popup.current?.matches(':popover-open')) (searchInput.current ?? list.current)?.focus();
        else event.currentTarget.click();
      }}>
      <span id={`${id}-value`}>{summary}</span>
      {multiple && selected.length > 0 && <span className="dropdown-count" id={`${id}-count`}>
        {selected.length}<span className="visually-hidden"> geselecteerd</span>
      </span>}
      <ChevronDown size={15} className="dropdown-chevron" aria-hidden="true" />
    </button>
    <div id={id} ref={popup} popover="auto" className="dropdown-popup" onKeyDown={handleKeys}
      onToggle={event => {
        const shown = event.newState === 'open';
        setOpen(shown);
        setSearch('');
        typeAhead.current = { text: '', time: 0 };
        setActiveIndex(shown && !searchable ? Math.max(0, visible.findIndex(option => selected.includes(option.value))) : 0);
      }}>
      {searchable && <div className="dropdown-search">
        <Search size={15} aria-hidden="true" />
        <input ref={searchInput} type="search" aria-label={searchLabel} placeholder={searchLabel}
          role={multiple ? undefined : 'combobox'} aria-expanded={multiple ? undefined : open}
          aria-autocomplete={multiple ? undefined : 'list'} aria-controls={listId}
          aria-activedescendant={activeId} autoComplete="off" value={search} onChange={event => {
            setSearch(event.target.value);
            setActiveIndex(0);
            if (list.current) list.current.scrollTop = 0;
          }} />
      </div>}
      <div id={listId} ref={list} className="dropdown-options" role="listbox" aria-label={label}
        tabIndex={searchable ? -1 : 0} aria-activedescendant={searchable ? undefined : activeId}
        aria-multiselectable={multiple || undefined}>
        {[...groups].map(([group, items]) => group ? <div key={group} role="group" aria-label={group}>
          <div className="dropdown-group-label" aria-hidden="true">{group}</div>
          {items.map(renderOption)}
        </div> : items.map(renderOption))}
      </div>
      {!visible.length && <p className="dropdown-empty" role="status">{query ? 'Geen opties gevonden.' : 'Geen opties beschikbaar.'}</p>}
      {multiple && props.clearLabel && selected.length > 0 && <div className="dropdown-footer">
        <button type="button" className="plain-button" onClick={() => {
          (searchInput.current ?? list.current)?.focus({ preventScroll: true });
          props.onChange([]);
        }}>{props.clearLabel}</button>
      </div>}
    </div>
  </div>;
}
