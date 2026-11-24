import { displayDate, displayMonthYear, shiftMonth } from './dates.ts';
import { money, signedMoney } from './format.ts';
import type { ReportChart, ReportRequest, ReportSection } from './reports.ts';

export type ReportBankBalance = { date: string; amount: number; accounts: number; totalAccounts: number };

export function savingsProjection(request: ReportRequest, date: string, room: number, after: number, balance?: ReportBankBalance) {
  const current = date.slice(0, 7);
  const deadline = request.totalGoal?.deadline;
  const untilDeadline = deadline ? (Number(deadline.slice(0, 4)) - Number(current.slice(0, 4))) * 12
    + Number(deadline.slice(5)) - Number(current.slice(5)) : undefined;
  const count = request.projectionMonths ?? (untilDeadline === undefined ? 6 : Math.min(24, Math.max(1, untilDeadline)));
  const start = balance?.amount ?? 0;
  const target = request.target!;
  const finalMonth = displayMonthYear(shiftMonth(current, count));
  const known = balance
    ? `Beginsaldo op ${displayDate(balance.date)}${balance.accounts < balance.totalAccounts ? ` van ${balance.accounts} van ${balance.totalAccounts} rekeningen` : ''}.`
    : 'Verandering vanaf nul, omdat er geen gezamenlijk banksaldo beschikbaar is.';
  const rows = Array.from({ length: count + 1 }, (_, index) => ({
    label: index ? displayMonthYear(shiftMonth(current, index)) : 'Start',
    series: [
      { label: 'Gebruikelijk patroon', value: start + index * room },
      { label: 'Met aanpassingen', value: start + index * after },
      { label: 'Als je het doel haalt', value: start + index * target },
    ],
  }));
  const hasDeficit = start + count * Math.min(room, after) < 0;
  const chart: ReportChart = {
    id: 'projection', title: balance ? 'Verwacht banksaldo' : 'Verandering in banksaldo',
    caption: `${known} ${count} maand${count === 1 ? '' : 'en'} vanaf ${displayMonthYear(shiftMonth(current, 1))}.${hasDeficit ? ' Onder nul tekent de grafiek een tekort.' : ''}`, rows,
  };
  const insight: ReportSection = {
    title: `In ${finalMonth}`,
    text: balance
      ? `Bij je gebruikelijke patroon komt je banksaldo uit op ${money(start + count * room)}. Met de aanpassingen wordt dat ${money(start + count * after)}. Als je elke maand ${money(target)} overhoudt, komt het uit op ${money(start + count * target)}.`
      : `Bij je gebruikelijke patroon verandert je banksaldo met ${signedMoney(count * room)}. Met de aanpassingen wordt dat ${signedMoney(count * after)}. Als je elke maand ${money(target)} overhoudt, neemt je banksaldo toe met ${money(count * target)}.`,
  };
  return { chart: { ...chart, summary: insight.text }, insight };
}
