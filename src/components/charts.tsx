import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from '../domain/analytics.ts';
import { displayDate, displayMonth, displayMonthYear } from '../domain/dates.ts';
import { count, money, roundedMoney } from '../domain/format.ts';
import type { TrendCalendar } from '../domain/periods.ts';
import { MonthAxisTick } from './month-axis-tick.tsx';
import { Empty } from './ui.tsx';

const axes = { fontSize: 12, fill: '#646e86' };
const tooltip = { background: '#ffffff', border: '1px solid #e2e5ef', borderRadius: 10, color: '#20243a' };

export type TrendContext = { calendar: TrendCalendar; onMonth?: (month: string) => void };

export function TrendLegend({ income, expenses }: { income: string; expenses: string }) {
  return <div className="chart-legend">
    <span><i className="mint-dot" />{income}</span>
    <span><i className="violet-dot" />{expenses}</span>
  </div>;
}

export function TrendChart({ series, income = true, trend, measure = 'amount', amountLabel = 'Netto-uitgaven', countLabel = 'Betalingen', incomeLabel = 'Inkomsten' }: {
  series: TrendPoint[];
  income?: boolean;
  trend: TrendContext;
  measure?: 'amount' | 'count';
  amountLabel?: string;
  countLabel?: string;
  incomeLabel?: string;
}) {
  if (!series.some(point => point.spent !== null)) return <Empty message="Geen afschriften in deze periode." />;
  const counting = measure === 'count';
  const label = counting ? countLabel : amountLabel;
  const daily = trend.calendar.unit === 'day';
  const multipleYears = series[0].date.slice(0, 4) !== series.at(-1)?.date.slice(0, 4);
  const monthTick = (date: string) => multipleYears ? displayMonth(date) + ' ’' + date.slice(2, 4) : displayMonth(date);
  const { onMonth } = trend;
  const covered = new Set(series.filter(point => point.spent !== null).map(point => point.date));
  const unavailable = series.filter(point => point.spent === null);
  const interval = daily ? 'dag' : 'maand';
  return <><div className="trend-chart" role={onMonth ? 'group' : 'img'}
    aria-label={`${income ? `${amountLabel} en ${incomeLabel.toLowerCase()}` : label} per ${interval}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={series} margin={{ top: 12, right: 12, bottom: 3, left: 0 }}
        onClick={onMonth ? state => {
          if (typeof state.activeLabel === 'string' && covered.has(state.activeLabel)) onMonth(state.activeLabel);
        } : undefined}>
        <defs><linearGradient id="income-gradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#53bf9e" stopOpacity=".17" />
          <stop offset="1" stopColor="#53bf9e" stopOpacity="0" /></linearGradient></defs>
        {unavailable.map(({ date }) => <ReferenceArea key={date} x1={date} x2={date} fill="#f1f2f8"
          stroke="none" zIndex={-1} pointerEvents="none" />)}
        <CartesianGrid stroke="#e3e6ee" vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={9} minTickGap={daily ? 12 : 13}
          interval={daily ? 'preserveStartEnd' : 'preserveStart'}
          tickFormatter={daily ? date => String(Number(date.slice(-2))) : monthTick}
          tick={onMonth ? props => <MonthAxisTick {...props} format={monthTick} onMonth={covered.has(props.payload.value) ? onMonth : undefined} /> : axes} />
        <YAxis axisLine={false} tickLine={false} tick={axes} width={counting ? 42 : 69}
          allowDecimals={!counting} tickFormatter={counting ? count : roundedMoney} />
        <Tooltip contentStyle={tooltip} labelStyle={{ color: '#20243a' }} cursor={{ fill: '#745ee310' }}
          formatter={value => counting ? count(Number(value)) : money(Number(value))}
          labelFormatter={date => typeof date === 'string' ? (daily ? displayDate(date) : displayMonthYear(date)) : ''} />
        {income && <Area dataKey="income" name={incomeLabel} type="monotone" fill="url(#income-gradient)"
          stroke="#279877" strokeWidth={2} dot={covered.size === 1} activeDot={{ r: 4 }} isAnimationActive={false} />}
        <Bar dataKey={counting ? 'payments' : 'spent'} name={label} fill={counting ? '#319e82' : '#9a82f5'}
          radius={daily ? [2, 2, 0, 0] : [4, 4, 0, 0]} maxBarSize={daily ? 15 : 32}
          isAnimationActive={false} cursor={onMonth ? 'pointer' : undefined}
          onClick={onMonth ? (bar, _, event) => {
            event.stopPropagation();
            if (covered.has(bar.payload.date)) onMonth(bar.payload.date);
          } : undefined} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
    {unavailable.length > 0 && <p className="chart-coverage">Grijze delen vallen buiten het afschrift of het gekozen datumbereik.</p>}
  </>;
}

export function SpendDonut({ data, total, selectedGroup, onGroup }: {
  data: { id: string; name: string; value: number; fill: string }[];
  total: number; selectedGroup: string; onGroup: (group: string) => void;
}) {
  const segments = data.filter(row => row.value > 0);
  if (!segments.length) return <Empty message="Geen uitgaven in deze selectie." />;
  return <div className="donut" role="group" aria-label={`Netto-uitgaven ${money(total)} verdeeld per hoofdgroep`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <PieChart>
        <Pie data={segments} dataKey="value" nameKey="name" innerRadius="77%" outerRadius="96%"
          paddingAngle={3} cornerRadius={5} stroke="none" isAnimationActive={false} cursor="pointer"
          onClick={(_, index) => onGroup(segments[index].id)}>
          {selectedGroup && segments.map(row => <Cell key={row.id} fillOpacity={row.id === selectedGroup ? 1 : .24} />)}
        </Pie>
        <Tooltip contentStyle={tooltip} formatter={value => money(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
    <div className="donut-center"><strong>{roundedMoney(total)}</strong><span>netto uitgegeven</span></div>
  </div>;
}
