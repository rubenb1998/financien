import { ArrowDownUp, ChevronLeft, ChevronRight, Link2, Pencil, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Dropdown } from '../components/dropdown.tsx';
import { Dialog, Empty } from '../components/ui.tsx';
import { categoriesFor, categoryLabel, groupLabel, kinds } from '../domain/categories.ts';
import { displayDate, displayMonthYear } from '../domain/dates.ts';
import { signedMoney } from '../domain/format.ts';
import { isProviderBooking, merchantKey, merchantName } from '../domain/merchant-breakdown.ts';
import { compensationTag, reimbursedTag, returnedMoneyTag, returnedPurchaseTag, returnTag, transactionTags } from '../domain/tags.ts';
import { claimStatuses, isWork, workTag } from '../domain/work.ts';
import type { ClaimStatus } from '../domain/work.ts';
import type { Correction, Filters, Kind, Transaction } from '../domain/types.ts';
import { providerHref } from '../routes.ts';

const positiveTags = new Set([returnTag, returnedPurchaseTag, returnedMoneyTag, reimbursedTag, compensationTag]);

interface TagFilter {
  tags: string[];
  toggle: (tag: string) => void;
}

export interface TransactionFilters {
  filters: Pick<Filters, 'tags' | 'category' | 'account'>;
  selectedMonth: string;
  toggleMonth: (month: string) => void;
  toggleTag: (tag: string) => void;
  toggleCategory: (category: string) => void;
  toggleAccount: (account: string) => void;
}

function TransactionTags({ row, filter }: { row: Transaction; filter?: TagFilter }) {
  const tags = transactionTags(row);
  if (!tags.length) return null;
  return <div className="transaction-tags">
    {tags.map(tag => {
      const className = `tag ${positiveTags.has(tag) ? 'green-tag' : 'muted-tag'}`;
      return filter ? <button key={tag} type="button" className={`table-filter ${className}`} aria-pressed={filter.tags.includes(tag)}
        onClick={() => filter.toggle(tag)}>{tag}</button> : <span key={tag} className={className}>{tag}</span>;
    })}
  </div>;
}

export function TransactionTable({ rows, accountLabels, onOpen, prioritizeAmount = false, showClaims = false, showOriginalMerchant = false, transactionFilters }: {
  rows: Transaction[]; prioritizeAmount?: boolean; showClaims?: boolean; accountLabels: Map<string, string>; onOpen: (row: Transaction) => void;
  showOriginalMerchant?: boolean;
  transactionFilters?: TransactionFilters;
}) {
  const [sort, setSort] = useState<'date' | 'amount'>(prioritizeAmount ? 'amount' : 'date');
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const sorted = sort === 'amount' ? [...rows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) : rows;
  const displayed = sorted.slice(current * pageSize, (current + 1) * pageSize);
  const filter = (callback: (value: string) => void, value: string) => { setPage(0); callback(value); };

  if (!rows.length) return <Empty message="Geen transacties voor deze selectie." />;
  return <section className="panel table-panel">
    <div className="table-toolbar"><span>{rows.length.toLocaleString('nl-NL')} boekingen</span>
      <button type="button" className="secondary compact" onClick={() => { setSort(sort === 'date' ? 'amount' : 'date'); setPage(0); }}>
        <ArrowDownUp size={15} />{sort === 'date' ? 'Nieuwste eerst' : 'Grootste bedrag eerst'}
      </button>
    </div>
    <div className="table-scroll">
      <table>
        <thead><tr><th>Datum</th><th>Omschrijving</th><th>Categorie</th><th>{showClaims ? 'Declaratiestatus' : 'Rekening'}</th><th className="align-right">Bedrag</th></tr></thead>
        <tbody>{displayed.map(row => {
          const month = row.date.slice(0, 7);
          const category = categoryLabel(row.category);
          const account = accountLabels.get(row.accountId) ?? row.source;
          const categoryClass = `tag ${row.kind === 'transfer' || row.kind === 'pending' ? 'muted-tag' : ''}`;
          return <tr key={row.id}>
          <td className="date-cell">{transactionFilters
            ? <button type="button" className="table-filter" aria-pressed={transactionFilters.selectedMonth === month}
              aria-label={`${displayDate(row.date)}, filter op ${displayMonthYear(month)}`}
              onClick={() => filter(transactionFilters.toggleMonth, month)}>{displayDate(row.date)}</button>
            : displayDate(row.date)}</td>
          <td><button type="button" className="row-open" onClick={() => onOpen(row)}>
            <span>{showOriginalMerchant ? row.originalMerchant || row.merchant : row.merchant}</span>
            {row.review && <TriangleAlert className="review-icon" size={14} aria-label="Te controleren" />}
            {row.linkedId && <Link2 size={15} aria-label="Gekoppelde boeking" />}
          </button>{row.kind !== 'refund' && <small>{kinds[row.kind]}</small>}<TransactionTags row={row} filter={transactionFilters && {
            tags: transactionFilters.filters.tags, toggle: tag => filter(transactionFilters.toggleTag, tag),
          }} /></td>
          <td>{transactionFilters
            ? <button type="button" className={`table-filter ${categoryClass}`} aria-pressed={transactionFilters.filters.category === row.category}
              onClick={() => filter(transactionFilters.toggleCategory, row.category)}>{category}</button>
            : <span className={categoryClass}>{category}</span>}</td>
          <td className="account-cell">{showClaims ? row.kind === 'expense'
            ? row.claimStatus ? claimStatuses[row.claimStatus] : 'Onbekend'
            : '—' : transactionFilters
              ? <button type="button" className="table-filter" aria-pressed={transactionFilters.filters.account === row.accountId}
                onClick={() => filter(transactionFilters.toggleAccount, row.accountId)}>{account}</button> : account}</td>
          <td className={`align-right amount ${row.kind === 'refund' || row.kind === 'income' ? 'positive' : ''}`}>{signedMoney(row.amount)}</td>
        </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="pagination">
      <span>{current * pageSize + 1}–{Math.min((current + 1) * pageSize, rows.length)} van {rows.length.toLocaleString('nl-NL')}</span>
      <button type="button" className="icon-btn" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Vorige pagina"><ChevronLeft size={17} /></button>
      <button type="button" className="icon-btn" onClick={() => setPage(current + 1)} disabled={current === pageCount - 1} aria-label="Volgende pagina"><ChevronRight size={17} /></button>
    </div>
  </section>;
}

export function TransactionDialog({ row, account, corrected, linked, openLinked, close, save }: {
  row: Transaction; account: string; corrected?: Correction; linked?: Transaction;
  openLinked: (row: Transaction) => void; close: () => void; save: (value: Correction | null) => Promise<void>;
}) {
  const [kind, setKind] = useState(row.kind);
  const [category, setCategory] = useState(row.category);
  const [merchant, setMerchant] = useState(row.merchant);
  const [subscription, setSubscription] = useState(row.subscription ?? '');
  const [note, setNote] = useState(corrected?.note ?? '');
  const [tagInput, setTagInput] = useState(row.tags?.join(', ') ?? '');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | ''>(row.claimStatus ?? '');
  const tags = [...new Set(tagInput.split(',').map(tag => tag.trim()).filter(Boolean))];
  const taggedWork = isWork({ tags });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = row.amount > 0 ? ['income', 'refund', 'transfer', 'pending'] as const
    : ['expense', 'transfer', 'pending'] as const;
  const categoryOptions = categoriesFor(kind);
  const groupCategories = categoryOptions.length >= 9;

  async function persist(value: Correction | null) {
    setBusy(true);
    setError('');
    try { await save(value); close(); } catch (error) {
      setError(error instanceof Error ? error.message : 'Opslaan is mislukt.');
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void persist({ kind, category, merchant, subscription, note, tags, claimStatus: taggedWork ? claimStatus || undefined : undefined });
  }

  return <Dialog title="Transactie" close={close}>
    <div className="transaction-heading"><div><h3>{row.merchant}</h3><p>{displayDate(row.date)} · {account} · PDF-pagina {row.page}</p></div>
      <strong>{signedMoney(row.amount)}</strong></div>
    <TransactionTags row={row} />
    <div className="transaction-evidence">
      <strong>{kinds[row.kind]}</strong><p>{row.reason}</p>
      {row.suggestedCategory && <button type="button" className="secondary compact" onClick={() => {
        setKind(row.kind);
        setCategory(row.suggestedCategory!);
        if (row.suggestedCategory === 'reimbursement' && !isWork({ tags })) setTagInput([...tags, workTag].join(', '));
      }}>Gebruik voorstel · {categoryLabel(row.suggestedCategory)}</button>}
      {linked && <button className="secondary compact" type="button" onClick={() => openLinked(linked)}>
        <Link2 size={15} /> {linked.merchant} · {displayDate(linked.date)} · {signedMoney(linked.amount)}
      </button>}
      {isProviderBooking(row) && <a className="text-link" href={providerHref(merchantKey(row), row.category)}
        onClick={event => { if (event.currentTarget.hash === location.hash) close(); }}>
        Bekijk {merchantName(row)}<ChevronRight size={14} aria-hidden="true" />
      </a>}
      {row.evidence && <a href={row.evidence} target="_blank" rel="noreferrer">Bron voor herkenning</a>}
      <details><summary>Originele boeking</summary>
        <pre>{[row.originalMerchant, row.counterparty, row.details].filter(Boolean).join('\n')}</pre>
      </details>
    </div>
    <form onSubmit={handleSubmit} className="editor-form">
      <div className="form-row">
        <Dropdown<Kind> field label="Type" value={kind} options={options.map(value => ({ value, label: kinds[value] }))}
          onChange={next => { setKind(next); setCategory(categoriesFor(next)[0][0]); }} />
        <Dropdown field label="Categorie" value={category} onChange={setCategory} searchLabel="Zoek een categorie"
          options={categoryOptions.map(([value, item]) => ({
            value, label: item.label, group: groupCategories ? groupLabel(item.group) : undefined,
          }))} />
      </div>
      <div className="form-row">
        <label>Naam<input required value={merchant} maxLength={160} onChange={event => setMerchant(event.target.value)} /></label>
        {(kind === 'expense' || kind === 'refund') && <label>Abonnement<input value={subscription} maxLength={100} placeholder="Optioneel" onChange={event => setSubscription(event.target.value)} /></label>}
      </div>
      <div className="form-row">
        <label>Tags<input value={tagInput} placeholder="Scheid tags met komma’s" onChange={event => setTagInput(event.target.value)} /></label>
        {taggedWork && kind === 'expense' && <Dropdown<ClaimStatus | ''> field label="Declaratiestatus" value={claimStatus}
          onChange={setClaimStatus} options={[{ value: '', label: 'Onbekend' }, ...(Object.keys(claimStatuses) as ClaimStatus[])
            .map(value => ({ value, label: claimStatuses[value] }))]} />}
      </div>
      {kind === 'expense' && <label className="switch-line"><input type="checkbox" checked={taggedWork} onChange={event => {
        const next = event.target.checked ? [...tags, workTag] : tags.filter(tag => !isWork({ tags: [tag] }));
        setTagInput(next.join(', '));
      }} />Declareren werk</label>}
      <label>Notitie<input value={note} maxLength={500} placeholder="Optioneel" onChange={event => setNote(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={busy}><Pencil size={16} />{row.review ? 'Bevestig indeling' : 'Opslaan'}</button>
        {corrected && <button type="button" className="secondary" disabled={busy} onClick={() => void persist(null)}>Automatische indeling herstellen</button>}
      </div>
    </form>
  </Dialog>;
}
