import { useId } from 'react';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { displayDate, displayMonth, displayMonthYear } from '../domain/dates.ts';
import { money, roundedMoney } from '../domain/format.ts';
import type { BalanceSnapshot, savingsInsights } from '../domain/wealth.ts';

const dayLabel = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayYearLabel = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });
const spansYears = (first: string, last: string) => first.slice(0, 4) !== last.slice(0, 4);
const axisText = { fill: '#606981', fontSize: 12 };
const tooltipStyle = { border: '1px solid #dddff0', borderRadius: 9, boxShadow: '0 4px 15px #27376014', fontSize: 13 };

export function BalanceChart({ data, compact = false }: { data: BalanceSnapshot[]; compact?: boolean }) {
  const gradient = useId();
  if (data.length < 2) return null;
  const steps = Math.min(data.length - 1, compact ? 3 : 5);
  const ticks = Array.from({ length: steps + 1 }, (_, index) => data[Math.round(index * (data.length - 1) / steps)].date);
  const tickDate = !compact && spansYears(data[0].date, data.at(-1)!.date) ? dayYearLabel : dayLabel;
  const amounts = data.map(point => point.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return <div className={compact ? 'balance-chart balance-chart-compact' : 'balance-chart'} role="group" aria-label="Verloop van het banksaldo">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={data} margin={{ top: 8, bottom: 0, left: 0, right: 10 }}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8065dc" stopOpacity=".23" />
          <stop offset="100%" stopColor="#8065dc" stopOpacity=".035" />
        </linearGradient></defs>
        {!compact && <CartesianGrid stroke="#e3e6ee" vertical={false} strokeDasharray="3 5" />}
        <XAxis dataKey="date" ticks={ticks} tickFormatter={date => tickDate.format(new Date(date))}
          axisLine={false} tickLine={false} tick={axisText} interval="preserveStartEnd" tickMargin={7} padding={{ left: compact ? 14 : 4, right: 11 }} />
        <YAxis hide={compact} axisLine={false} tickLine={false} tick={axisText} width={74}
          domain={min === max ? [min - 100, max + 100] : ['auto', 'auto']} tickFormatter={roundedMoney} />
        {!compact && min < 0 && max > 0 && <ReferenceLine y={0} stroke="#b6bcd1" />}
        <Tooltip contentStyle={tooltipStyle} formatter={value => money(Number(value))}
          labelFormatter={date => typeof date === 'string' ? displayDate(date) : ''} />
        <Area dataKey="amount" name="Banksaldo" type="stepAfter" stroke="#654cc5" fill={`url(#${gradient})`}
          strokeWidth={2} isAnimationActive={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function SavingsRoomChart({ insights }: { insights: NonNullable<ReturnType<typeof savingsInsights>> }) {
  const hasTarget = insights.target !== null;
  const multiYear = spansYears(insights.covered[0], insights.covered.at(-1)!);
  return <>
    <div className="savings-room-chart" role="group" aria-label="Spaarruimte en spaardoel per maand">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={insights.data} margin={{ top: 7, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e3e6ee" vertical={false} strokeDasharray="3 5" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisText} tickFormatter={month => multiYear ? displayMonth(month) + ' ' + month.slice(2, 4) : displayMonth(month)} tickMargin={8} />
          <YAxis axisLine={false} tickLine={false} tick={axisText} width={74} tickFormatter={roundedMoney} />
          <Tooltip contentStyle={tooltipStyle} formatter={value => money(Number(value))}
            labelFormatter={month => typeof month === 'string' ? displayMonthYear(month) : ''} />
          <ReferenceLine y={0} stroke="#b6bcd1" />
          <Bar dataKey="room" name="Over na uitgaven" fill="#8b71e7" maxBarSize={38} isAnimationActive={false} />
          {insights.target !== null && <ReferenceLine className="wealth-monthly-target" y={insights.target}
            stroke="#287e65" strokeWidth={2} strokeDasharray="5 4" ifOverflow="extendDomain" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="chart-legend wealth-chart-legend">
      <span><i className="violet-dot" />Over na uitgaven</span>
      {hasTarget && <span><i className="wealth-target-line" />Spaardoel</span>}
    </div>
  </>;
}
