import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presentProviderAliases } from '../src/domain/merchant-breakdown.ts';
import { pageNames } from '../src/domain/pages.ts';
import { categoryHref, filtersFollowLink, mainNavigation, providerHref, readRoute, transactionsHref } from '../src/routes.ts';
import type { CategoryScope, TransactionScope } from '../src/routes.ts';

test('every sidebar page resolves directly', () => {
  for (const page of Object.keys(pageNames)) assert.equal(readRoute(`#${page}`).page, page);
});

test('the category dashboard opens the category selection from the overview or catalog', () => {
  const sport = { group: 'sport', category: '' };
  assert.deepEqual(mainNavigation('overview', 'category-dashboard', sport),
    { href: '#category-dashboard/group/sport', keepContext: true });
  assert.deepEqual(mainNavigation('categories', 'category-dashboard', { ...sport, category: 'bike' }),
    { href: '#category-dashboard/bike', keepContext: true });
  assert.deepEqual(mainNavigation('overview', 'categories', sport), { href: '#categories', keepContext: true });
  assert.deepEqual(mainNavigation('category-dashboard', 'subscriptions', sport), { href: '#subscriptions', keepContext: false });
  assert.deepEqual(mainNavigation('category-dashboard', 'category-dashboard', sport), { href: '#category-dashboard', keepContext: false });
});

test('provider links preserve their parent category and bookings view', t => {
  const scope: CategoryScope = { type: 'category', key: 'rent' };
  const merchant = 'voorbeeldwonen';
  presentProviderAliases({ 'Voorbeeldwonen · Warmte': 'Voorbeeldwonen' });
  t.after(() => presentProviderAliases({}));
  assert.deepEqual(readRoute(providerHref(merchant, 'rent')).categoryRoute,
    { scope, merchant, withinCategory: false, bookings: false });
  assert.deepEqual(readRoute(categoryHref(scope, { merchant, withinCategory: true, bookings: true })).categoryRoute,
    { scope, merchant, withinCategory: true, bookings: true });
  assert.equal(readRoute(categoryHref(scope, { merchant: 'voorbeeldwonen · warmte' })).categoryRoute?.merchant, merchant);
});

test('statement, subscription and transfer views are restorable from their links', () => {
  const scopes: TransactionScope[] = [
    { type: 'statement', key: 'account/statement 1' },
    { type: 'subscription', key: 'personal:sport & media' },
    { type: 'transfers' },
  ];
  for (const scope of scopes) {
    assert.deepEqual(readRoute(transactionsHref(scope)), { page: 'transactions', transactionScope: scope });
  }
  assert.deepEqual(readRoute('#transactions/statement/%invalid'), { page: 'transactions' });
});

test('analysis and detail links carry filters within an analysis and reset them on independent screens', () => {
  assert.ok(filtersFollowLink({ page: 'overview' }, readRoute('#category-dashboard/group/fixed')));
  assert.ok(filtersFollowLink(readRoute('#category-dashboard/rent'), readRoute('#category-dashboard/rent/bookings')));
  assert.ok(!filtersFollowLink({ page: 'overview' }, { page: 'subscriptions' }));
  assert.ok(!filtersFollowLink({ page: 'wealth' }, readRoute('#category-dashboard/rent')));
});
