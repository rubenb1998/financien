import { subscriptionTypes } from './subscriptions.ts';
import type { SubscriptionType } from './subscriptions.ts';

export interface SubscriptionView {
  types: SubscriptionType[];
  period: 'recent' | 'all';
  includeUtilities: boolean;
}

export const defaultSubscriptionView: SubscriptionView = {
  types: ['personal'], period: 'all', includeUtilities: false,
};

export const subscriptionViewLabels = { ...subscriptionTypes, utilities: 'Gas, water & licht' };

export function subscriptionCostType(item: { type: SubscriptionType; category: string }) {
  return item.type === 'fixed' && item.category === 'utilities' ? 'utilities' : item.type;
}

export function subscriptionInView(
  item: { type: SubscriptionType; category: string },
  view: SubscriptionView,
) {
  const type = subscriptionCostType(item);
  return type === 'utilities' ? view.includeUtilities : view.types.includes(type);
}

export function isSubscriptionType(value: unknown): value is SubscriptionType {
  return typeof value === 'string' && Object.hasOwn(subscriptionTypes, value);
}
