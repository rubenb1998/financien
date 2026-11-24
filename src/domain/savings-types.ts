export type BudgetKind = 'fixed' | 'usual' | 'reserve';

export interface BudgetLine {
  id: string;
  kind: BudgetKind;
  monthly: number;
  months: number;
  activeMonths: number;
}

export interface OneOff {
  label: string;
  ids: string[];
}

export interface SavingsBaseline {
  income: { label: string; monthly: number }[];
  months: string[];
  reserveMonths: string[];
  spentMonthly: number;
  lines: BudgetLine[];
  exclusions: { label: string; amount: number; from: string; to: string }[];
}

export interface PlanRequest {
  id: string;
  title: string;
  target: number;
  saved: number;
  reserve: number;
  startMonth: string;
  endMonth: string;
  caps: Record<string, { monthly: number; action: string }>;
  provision?: { monthly: number; label: string };
}

export interface SavingsPlan extends PlanRequest {
  analysisDate: string;
  baseline: SavingsBaseline;
}
