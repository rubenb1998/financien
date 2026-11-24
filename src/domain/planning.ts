import { byCategory } from './analytics.ts';
import { groupOf, isProtectedBudget } from './categories.ts';
import { completeMonths, shiftMonth } from './dates.ts';
import { netSpend } from './ledger.ts';
import { median } from './subscriptions.ts';
import { isWork } from './work.ts';
import type { Goal, Scenario, Statement, Transaction } from './types.ts';

export function planningBaseline(rows: Transaction[], statements: Statement[]) {
  const months = completeMonths(statements).slice(-3);
  const historical = rows.filter(row => !isWork(row) && months.includes(row.date.slice(0, 7)));
  const perMonth = Map.groupBy(historical, row => row.date.slice(0, 7));
  const recurringIncome = months.map(month => (perMonth.get(month) ?? []).filter(row =>
    row.kind === 'income' && ['salary', 'benefits'].includes(row.category))
    .reduce((sum, row) => sum + row.amount, 0));
  const spending = months.length ? Math.round(historical.reduce((sum, row) => sum + netSpend(row), 0) / months.length) : 0;
  const opportunities = byCategory(historical)
    .filter(item => item.total > 0 && !isProtectedBudget(item.id) && ['variable', 'sport', 'subscriptions', 'other'].includes(groupOf(item.id))
      && !['unknown', 'cash', 'shared'].includes(item.id))
    .map(item => ({ ...item, average: Math.round(item.total / months.length) }));
  return { months, income: median(recurringIncome), spending, opportunities };
}

export function savingsScenario(baseline: ReturnType<typeof planningBaseline>, scenario: Scenario) {
  const income = scenario.income ?? baseline.income;
  const savings = baseline.opportunities.reduce((total, category) =>
    total + Math.min(category.average, scenario.cuts[category.id] ?? 0), 0);
  const spending = Math.max(0, baseline.spending - savings);
  return { income, savings, spending, room: income - spending };
}

export function projectGoals(goals: Goal[], room: number, today: string) {
  const committed = goals.filter(goal => goal.saved < goal.target).reduce((sum, goal) => sum + (goal.monthly ?? 0), 0);
  const automaticCount = goals.filter(goal => goal.monthly === null && goal.saved < goal.target).length;
  const unallocated = Math.max(0, room - committed);
  return goals.map(goal => {
    const remaining = Math.max(0, goal.target - goal.saved);
    const monthly = goal.monthly ?? (automaticCount ? Math.floor(unallocated / automaticCount) : 0);
    const months = remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null;
    const targetMonth = months === null ? null : shiftMonth(today.slice(0, 7), months);
    const monthlyShortfall = Math.max(0, committed - Math.max(0, room));
    return { ...goal, remaining, projection: months, targetMonth, plannedMonthly: monthly, monthlyShortfall };
  });
}

const suggestedCutLimits = [
  ['dining', .3], ['shopping', .3], ['streaming', .3], ['entertainment', .3],
  ['leisure', .3], ['software', .2], ['digital', .2], ['home', .15],
  ['transport', .1], ['groceries', .1],
] as const;

export function suggestCuts(baseline: ReturnType<typeof planningBaseline>, scenario: Scenario, targetRoom: number) {
  let gap = Math.max(0, targetRoom - savingsScenario(baseline, scenario).room);
  const cuts = { ...scenario.cuts };
  for (const [id, limit] of suggestedCutLimits) {
    const item = baseline.opportunities.find(category => category.id === id);
    if (!item || gap === 0) continue;
    const current = cuts[id] ?? 0;
    const increase = Math.min(gap, Math.max(0, Math.floor(item.average * limit) - current));
    if (increase > 0) cuts[id] = current + increase;
    gap -= increase;
  }
  return { ...scenario, cuts };
}
