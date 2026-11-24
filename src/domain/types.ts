import type { CategoryPresentation } from './categories.ts';
import type { SubscriptionView } from './subscription-view.ts';
import type { ClaimStatus } from './work.ts';
import type { SavingsPlan } from './savings-types.ts';

export type Source = 'bank' | 'card';
export type Kind = 'expense' | 'income' | 'refund' | 'transfer' | 'pending';

export interface RawTransaction {
  id: string;
  accountId: string;
  statementId?: string;
  source: Source;
  date: string;
  amount: number;
  code: string;
  merchant: string;
  details: string;
  counterparty: string;
  counterpartyAccountId?: string;
  ownCounterparty: boolean;
  order: number;
  page: number;
}

export interface Statement {
  id: string;
  accountId: string;
  label: string;
  source: Source;
  from: string;
  to: string;
  debit: number;
  credit: number;
  count: number;
  pages: number;
  importedAt?: string;
}

export interface Classification {
  kind: Kind;
  category: string;
  merchant: string;
  reason: string;
  review: boolean;
  subscription?: string;
  linkedId?: string;
  evidence?: string;
  tags?: string[];
  claimStatus?: ClaimStatus;
}

export interface Transaction extends RawTransaction, Classification {
  originalMerchant: string;
  returnedPurchase?: boolean;
}

export interface Correction {
  kind: Kind;
  category: string;
  merchant?: string;
  subscription?: string;
  note?: string;
  tags?: string[];
  claimStatus?: ClaimStatus;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  saved: number;
  monthly: number | null;
  due: string;
}

export interface Scenario {
  income: number | null;
  cuts: Record<string, number>;
}

export interface Ledger {
  statements: Statement[];
  transactions: RawTransaction[];
  corrections: Record<string, Correction>;
  goals: Goal[];
  scenario: Scenario;
  plans?: SavingsPlan[];
}

export interface ImportResult {
  statement: Statement;
  added: number;
  duplicates: number;
}

export interface Filters {
  year: string;
  month: string;
  from: string;
  to: string;
  account: string;
  group: string;
  category: string;
  kind: string;
  query: string;
  subscriptions: boolean;
  tags: string[];
  includeWork: boolean;
}

export interface DashboardPresentation {
  categories: CategoryPresentation;
  providerAliases: Record<string, string>;
  period: 'latestYear' | 'allTime';
}

export interface DashboardLedger {
  statements: Statement[];
  transactions: Transaction[];
  corrections: Record<string, Correction>;
  goals: Goal[];
  scenario: Scenario;
  plans?: SavingsPlan[];
  presentation: DashboardPresentation;
  subscriptionView: SubscriptionView | null;
}
