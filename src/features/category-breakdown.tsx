import { Empty, Panel, RankLink } from '../components/ui.tsx';
import { categoryLabel, groupLabel, groupOf } from '../domain/categories.ts';
import { money } from '../domain/format.ts';
import { spendingActivity } from '../domain/merchant-breakdown.ts';
import type { ActivityKind } from '../domain/merchant-breakdown.ts';
import type { Transaction } from '../domain/types.ts';
import { categoryHref } from '../routes.ts';

export function CategoryBreakdown({ rows, kind, byGroup = false, merchant }: {
  rows: Transaction[]; kind: ActivityKind; byGroup?: boolean; merchant?: string;
}) {
  const entries = Map.groupBy(rows, row => byGroup ? groupOf(row.category) : row.category);
  const ranked = [...entries].map(([key, transactions]) => ({ key, ...spendingActivity(transactions, kind) }))
    .sort((a, b) => b.net - a.net);
  const largest = Math.max(1, ...ranked.map(item => Math.abs(item.net)));
  const label = byGroup ? groupLabel : categoryLabel;
  return <Panel title={merchant ? kind === 'income' ? 'Inkomsten per categorie' : 'Uitgaven per categorie'
    : byGroup ? 'Per hoofdcategorie' : 'Per subcategorie'}>
    {ranked.length ? <div className="rank-list">
      {ranked.map(({ key, net }) => <RankLink key={key} label={label(key)} value={money(net)} share={Math.abs(net) / largest}
        href={categoryHref({ type: byGroup ? 'group' : 'category', key }, { merchant, withinCategory: Boolean(merchant) })} />)}
    </div> : <Empty message="Geen boekingen in deze selectie." />}
  </Panel>;
}
