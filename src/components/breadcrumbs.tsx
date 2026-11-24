import { ChevronRight } from 'lucide-react';
import { pageNames } from '../domain/pages.ts';
import { allCategories, categoryHref, scopeGroup, scopeLabel } from '../routes.ts';
import type { CategoryScope, Route } from '../routes.ts';

type Crumb = { label: string; href?: string };

export function Breadcrumbs({ route, title, transactionLabel }: { route: Route; title: string; transactionLabel?: string }) {
  const { page, categoryRoute, transactionScope } = route;
  const crumbs: Crumb[] = [{ label: 'Overzicht', href: page === 'overview' ? undefined : '#overview' }];
  if (categoryRoute) {
    const { scope, merchant, withinCategory, bookings } = categoryRoute;
    const root = scope.type === 'all' && !merchant && !bookings;
    crumbs.push({ label: pageNames[page], href: root ? undefined : categoryHref(allCategories) });
    if (scope.type === 'category' || scope.type === 'collection') {
      const group: CategoryScope = { type: 'group', key: scopeGroup(scope) };
      crumbs.push({ label: scopeLabel(group), href: categoryHref(group) });
    }
    if (scope.type !== 'all') {
      crumbs.push({ label: scopeLabel(scope), href: merchant || bookings ? categoryHref(scope) : undefined });
    }
    if (merchant) {
      crumbs.push({ label: title, href: bookings ? categoryHref(scope, { merchant, withinCategory }) : undefined });
    }
    if (bookings) crumbs.push({ label: 'Boekingen' });
  } else if (transactionScope) {
    const parent = transactionScope.type === 'subscription' ? 'subscriptions'
      : transactionScope.type === 'statement' ? 'sources' : 'transactions';
    crumbs.push({ label: pageNames[parent], href: `#${parent}` }, { label: transactionLabel ?? title });
  } else if (page !== 'overview') {
    crumbs.push({ label: pageNames[page] });
  }
  return <nav aria-label="Broodkruimelpad" className="breadcrumbs">
    <ol>{crumbs.map(({ label, href }, index) => <li key={index}>
      {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
      {href ? <a href={href}>{label}</a> : <span aria-current="page">{label}</span>}
    </li>)}</ol>
  </nav>;
}
