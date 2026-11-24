import { BriefcaseBusiness, ChartNoAxesCombined, ChartPie, CreditCard, FileChartColumn, Landmark, LayoutDashboard, List, ShieldCheck, Wallet, TriangleAlert, Database, MessageCircle } from 'lucide-react';
import type { MouseEvent } from 'react';
import { pageNames } from '../domain/pages.ts';
import type { Page } from '../domain/pages.ts';
import { mainNavigation } from '../routes.ts';

const sections = [
  { title: 'Inzicht', items: [
    ['overview', LayoutDashboard],
    ['wealth', Landmark],
    ['transactions', List],
    ['categories', ChartPie],
    ['category-dashboard', ChartNoAxesCombined],
    ['subscriptions', CreditCard],
  ] },
  { title: 'Planning', items: [
    ['reports', FileChartColumn],
    ['work', BriefcaseBusiness],
    ['chat', MessageCircle],
  ] },
  { title: 'Gegevens', items: [
    ['review', TriangleAlert],
    ['sources', Database],
  ] },
] as const;

export function Navigation({ page, reviews, categoryFilter, follow }: {
  page: Page; reviews: number; categoryFilter: { group: string; category: string };
  follow: (event: MouseEvent<HTMLAnchorElement>, keepContext: boolean) => void;
}) {
  const overview = mainNavigation(page, 'overview', categoryFilter);
  return <aside className="nav-sidebar">
    <a className="brand" href={overview.href} onClick={event => follow(event, overview.keepContext)} aria-label="Financiën overzicht">
      <span className="brand-mark"><Wallet size={22} strokeWidth={2.2} /></span>
      <span className="brand-copy"><b>Financiën</b></span>
    </a>
    <nav aria-label="Hoofdnavigatie">
      {sections.map(section => <div className="nav-section" key={section.title}>
        <h2>{section.title}</h2>
        {section.items.map(([id, Icon]) => {
          const target = mainNavigation(page, id, categoryFilter);
          return <a key={id} href={target.href} onClick={event => follow(event, target.keepContext)}
            title={pageNames[id]} aria-current={page === id ? 'page' : undefined} className={page === id ? 'selected' : ''}>
            <Icon size={18} strokeWidth={1.75} /><span>{pageNames[id]}</span>{id === 'review' && reviews > 0 && <small>{reviews}</small>}
          </a>;
        })}
      </div>)}
    </nav>
    <div className="nav-footer">
      <div className="local-status"><ShieldCheck size={17} /><strong>Lokaal opgeslagen</strong></div>
    </div>
  </aside>;
}
