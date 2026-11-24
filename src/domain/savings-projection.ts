import { isProtectedBudget } from './categories.ts';
import { displayMonth, monthSpan, shiftMonth } from './dates.ts';
import type { SavingsPlan } from './savings-types.ts';

export function projectSavings(plan: SavingsPlan) {
  const { baseline, reserve, saved, target, provision } = plan;
  const months = monthSpan(plan.startMonth, plan.endMonth);
  const income = baseline.income.reduce((sum, line) => sum + line.monthly, 0);
  const lines = baseline.lines.map(line => {
    const cap = isProtectedBudget(line.id) ? undefined : plan.caps[line.id];
    const budget = Math.min(line.monthly, cap?.monthly ?? line.monthly);
    return { ...line, budget, cut: line.monthly - budget, action: cap?.action ?? '' };
  });
  const baselineCosts = lines.reduce((sum, line) => sum + line.monthly, 0);
  const cuts = lines.reduce((sum, line) => sum + line.cut, 0);
  const expenses = baselineCosts - cuts + (provision?.monthly ?? 0);
  const room = income - expenses;
  const capacity = Math.max(0, room - reserve);
  const currentRoom = income - baselineCosts - (provision?.monthly ?? 0);
  const currentCapacity = Math.max(0, currentRoom - reserve);
  const remaining = Math.max(0, target - saved);
  const needed = months.length ? Math.ceil(remaining / months.length) : 0;
  const monthlyDeposit = Math.min(needed, capacity);
  const extraNeeded = Math.max(0, needed + reserve - room);
  const expenseLimit = income - needed - reserve;

  let cumulative = saved;
  const schedule = months.map((month, index) => {
    const deposit = Math.min(monthlyDeposit, Math.max(0, target - cumulative));
    cumulative += deposit;
    return {
      month, label: displayMonth(month), deposit, cumulative,
      targetPace: saved + Math.min(remaining, needed * (index + 1)),
      currentPace: saved + Math.min(remaining, currentCapacity * (index + 1)),
      free: room - deposit,
    };
  });
  const finish = schedule.find(row => row.cumulative >= target)?.month
    ?? (monthlyDeposit > 0 ? shiftMonth(plan.startMonth, Math.ceil(remaining / monthlyDeposit) - 1) : null);
  return {
    income, lines, baselineCosts, cuts, expenses, room, needed, monthlyDeposit, extraNeeded, expenseLimit, schedule, finish,
    currentRoom, ending: cumulative, shortfall: Math.max(0, target - cumulative), free: room - monthlyDeposit,
  };
}
