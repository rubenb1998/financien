import { categories, categoryCollections, categoryLabel, dashboardGroups, groupLabel, groupOf } from './domain/categories.ts';
import { canonicalMerchantKey } from './domain/merchant-breakdown.ts';
import { pageNames } from './domain/pages.ts';
import type { Page } from './domain/pages.ts';

export type CategoryScope = { type: 'all' } | { type: 'group' | 'collection' | 'category'; key: string };
export type CategoryRoute = { scope: CategoryScope; merchant?: string; withinCategory?: boolean; bookings?: boolean };
export type TransactionScope = { type: 'transfers' } | { type: 'statement' | 'subscription'; key: string };
export type Route = { page: Page; categoryRoute?: CategoryRoute; transactionScope?: TransactionScope; planId?: string };

export const allCategories: CategoryScope = { type: 'all' };

export function scopeGroup(scope: CategoryScope) {
  if (scope.type === 'group') return scope.key;
  if (scope.type === 'category') return groupOf(scope.key);
  if (scope.type === 'collection') return categoryCollections[scope.key]?.group ?? '';
  return '';
}

export function scopeLabel(scope: CategoryScope) {
  if (scope.type === 'group') return groupLabel(scope.key);
  if (scope.type === 'category') return categoryLabel(scope.key);
  if (scope.type === 'collection') return categoryCollections[scope.key]?.label ?? 'Alle uitgaven';
  return 'Alle uitgaven';
}

export function categoryHref(scope: CategoryScope, { merchant, withinCategory, bookings }: Omit<CategoryRoute, 'scope'> = {}) {
  const root = scope.type === 'all' ? '#category-dashboard'
    : scope.type === 'category' ? `#category-dashboard/${scope.key}`
    : `#category-dashboard/${scope.type}/${scope.key}`;
  const provider = merchant === undefined ? '' : `/merchant/${encodeURIComponent(merchant)}${withinCategory ? '/category' : ''}`;
  return root + provider + (bookings ? '/bookings' : '');
}

export function categorySelection({ group, category }: { group: string; category: string }): CategoryScope {
  if (Object.hasOwn(categories, category) && categories[category].group !== 'ignored') {
    return { type: 'category', key: category };
  }
  return dashboardGroups.some(([id]) => id === group) ? { type: 'group', key: group } : allCategories;
}

export function mainNavigation(from: Page, to: Page, filters: { group: string; category: string }) {
  const fromOverview = from === 'overview' || from === 'categories';
  const toAnalysis = to === 'overview' || to === 'categories' || to === 'category-dashboard';
  const keepContext = fromOverview && toAnalysis;
  const href = keepContext && to === 'category-dashboard' ? categoryHref(categorySelection(filters)) : `#${to}`;
  return { href, keepContext };
}

export function providerHref(merchant: string, category: string) {
  const scope: CategoryScope = Object.hasOwn(categories, category) && categories[category].group !== 'ignored'
    ? { type: 'category', key: category } : allCategories;
  return categoryHref(scope, { merchant });
}

export function transactionsHref(scope: TransactionScope) {
  return `#transactions/${scope.type}${'key' in scope ? `/${encodeURIComponent(scope.key)}` : ''}`;
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

function categoryRoute(parts: string[]): CategoryRoute {
  const [first, key] = parts;
  let scope = allCategories;
  let rest = parts;

  if (first === 'group' && dashboardGroups.some(([id]) => id === key)) {
    scope = { type: 'group', key };
    rest = parts.slice(2);
  } else if (first === 'collection' && Object.hasOwn(categoryCollections, key)) {
    scope = { type: 'collection', key };
    rest = parts.slice(2);
  } else if (Object.hasOwn(categories, first) && categories[first].group !== 'ignored') {
    scope = { type: 'category', key: first };
    rest = parts.slice(1);
  }

  if (rest[0] === 'bookings') return { scope, bookings: true };
  const merchant = rest[0] === 'merchant' && rest[1] ? decodeSegment(rest[1]) : '';
  if (merchant) {
    const withinCategory = scope.type !== 'all' && rest[2] === 'category';
    return { scope, merchant: canonicalMerchantKey(merchant), withinCategory, bookings: rest[withinCategory ? 3 : 2] === 'bookings' };
  }
  return { scope };
}

export function readRoute(hash: string): Route {
  const [page, ...parts] = hash.slice(1).split('/');
  if (page === 'goals') return { page, planId: parts[0] };
  if (page === 'sport') return { page: 'category-dashboard', categoryRoute: { scope: { type: 'group', key: 'sport' } } };
  if (page === 'category-dashboard' || (page === 'categories' && parts[0])) {
    return { page: 'category-dashboard', categoryRoute: categoryRoute(parts) };
  }
  if (page === 'transactions') {
    const [type, segment] = parts;
    if (type === 'transfers') return { page, transactionScope: { type } };
    const key = segment ? decodeSegment(segment) : '';
    if (key && (type === 'statement' || type === 'subscription')) return { page, transactionScope: { type, key } };
  }
  return { page: Object.hasOwn(pageNames, page) ? page as Page : 'overview' };
}
