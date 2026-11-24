import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Dropdown } from '../components/dropdown.tsx';
import { Empty, Panel } from '../components/ui.tsx';
import { normalize } from '../domain/classify.ts';
import { displayDate } from '../domain/dates.ts';
import { count, money } from '../domain/format.ts';
import type { ActivityKind, byMerchant } from '../domain/merchant-breakdown.ts';
import { categoryHref } from '../routes.ts';
import type { CategoryScope } from '../routes.ts';

const percent = new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 1 });
export const paymentShare = (paid: number, total: number) => percent.format(total ? paid / total : 0);

export function MerchantList({ scope, items, kind, payments }: {
  scope: CategoryScope;
  items: ReturnType<typeof byMerchant>;
  kind: ActivityKind;
  payments: number;
}) {
  const [sort, setSort] = useState<'net' | 'payments' | 'name'>('net');
  const [search, setSearch] = useState('');
  const query = normalize(search);
  const visible = items.filter(merchant => normalize(merchant.name).includes(query));
  if (sort === 'payments') visible.sort((a, b) => b.payments - a.payments || b.net - a.net);
  if (sort === 'name') visible.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const receiving = kind === 'income';
  const party = receiving ? 'Betaler' : 'Aanbieder';

  return <Panel title={receiving ? 'Per betaler' : 'Per aanbieder'}>
    <div className="merchant-toolbar">
      <input type="search" aria-label={`Zoek ${party.toLowerCase()}`} placeholder={`Zoek ${party.toLowerCase()}`}
        value={search} onChange={event => setSearch(event.target.value)} />
      <Dropdown<typeof sort> compact label={receiving ? 'Sorteer betalers' : 'Sorteer aanbieders'} value={sort} onChange={setSort}
        options={[
          { value: 'net', label: receiving ? 'Hoogste inkomsten' : 'Hoogste uitgaven' },
          { value: 'payments', label: receiving ? 'Meeste bijschrijvingen' : 'Meeste betalingen' },
          { value: 'name', label: 'Naam A–Z' },
        ]} />
    </div>
    {visible.length ? <div className="table-scroll in-panel merchant-table">
      <table>
        <thead><tr><th>{party}</th><th className="align-right">{receiving ? 'Bijschrijvingen' : 'Betalingen'}</th>
          <th className="align-right" title={receiving ? undefined : 'Vóór teruggaven'}>Gem. bedrag</th>
          <th className="align-right">{receiving ? 'Ontvangen' : 'Netto-uitgaven'}</th></tr></thead>
        <tbody>{visible.map(merchant => <tr key={merchant.key}>
          <td>
            <a className="row-open merchant-link" href={categoryHref(scope, { merchant: merchant.key })}>
              <span>{merchant.name}</span><ChevronRight size={15} aria-hidden="true" />
            </a>
            {merchant.lastPayment && <small>Laatst {displayDate(merchant.lastPayment)}</small>}
          </td>
          <td className="align-right amount">{count(merchant.payments)}{payments > 0 && <small>{paymentShare(merchant.payments, payments)} van totaal</small>}</td>
          <td className="align-right amount">{merchant.average === null ? '—' : money(merchant.average)}</td>
          <td className="align-right amount">{money(merchant.net)}</td>
        </tr>)}</tbody>
      </table>
    </div> : <Empty message={items.length ? 'Geen resultaten voor deze zoekopdracht.' : 'Geen boekingen in deze selectie.'} />}
  </Panel>;
}
