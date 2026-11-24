import { ChevronRight } from 'lucide-react';
import { Empty, Panel, RankLink } from '../components/ui.tsx';
import { byCategory, incomeByCategory } from '../domain/analytics.ts';
import { categories, groups } from '../domain/categories.ts';
import { money } from '../domain/format.ts';
import type { Transaction } from '../domain/types.ts';
import { categoryHref } from '../routes.ts';

export function CategoryPage({ rows }: { rows: Transaction[] }) {
  const items = [...byCategory(rows), ...incomeByCategory(rows)];
  if (!items.length) return <Empty message="Geen categorieën in deze selectie." />;
  return <div className="category-grid">
    {groups.map(([id, label, color]) => {
      const selected = items.filter(item => categories[item.id]?.group === id);
      if (!selected.length) return null;
      const total = selected.reduce((sum, item) => sum + item.total, 0);
      const largest = Math.max(1, ...selected.map(item => Math.abs(item.total)));
      return <Panel key={id} title={<a className="panel-title-link" href={categoryHref({ type: 'group', key: id })}>
        {label}<ChevronRight size={15} aria-hidden="true" />
      </a>} subtitle={`${selected.length} subcategorieën`} action={<strong className="category-total">{money(total)}</strong>}>
        <div className="rank-list">{selected.map(item =>
          <RankLink key={item.id} label={item.name} value={money(item.total)} share={Math.abs(item.total) / largest} color={color}
            href={categoryHref({ type: 'category', key: item.id })} />)}</div>
      </Panel>;
    })}
  </div>;
}
