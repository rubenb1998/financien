import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { displayMonth, displayMonthYear } from '../domain/dates.ts';
import { count, money, roundedMoney } from '../domain/format.ts';
import { MonthAxisTick } from './month-axis-tick.tsx';
import { Empty } from './ui.tsx';

const axes = { fontSize: 12, fill: '#646e86' };
const tooltip = { background: '#ffffff', border: '1px solid #e2e5ef', borderRadius: 10, color: '#20243a' };

export type MonthSelection = { selectedMonth: string; onMonth: (month: string) => void };

export function TrendLegend({ income, expenses }: { income: string; expenses: string }) {
  return <div className="chart-legend">
    <span><i className="mint-dot" />{income}</span>
    <span><i className="violet-dot" />{expenses}</span>
  </div>;
}

export function TrendChart({ series, income = true, monthSelection, measure = 'amount', amountLabel = 'Netto-uitgaven', countLabel = 'Betalingen', incomeLabel = 'Inkomsten' }: {
  series: { month: string; spent: number; income?: number; payments?: number }[];
  income?: boolean;
  monthSelection?: MonthSelection;
  measure?: 'amount' | 'count';
  amountLabel?: string;
  countLabel?: string;
  incomeLabel?: string;
}) {
  if (!series.length) return <Empty message="Geen gegevens voor deze periode." />;
  const counting = measure === 'count';
  const label = counting ? countLabel : amountLabel;
  const { selectedMonth, onMonth } = monthSelection ?? {};
  return <div className="trend-chart" role={onMonth ? 'group' : 'img'}
    aria-label={income ? `${amountLabel} en ${incomeLabel.toLowerCase()} per maand` : `${label} per maand`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={series} margin={{ top: 12, right: 12, bottom: 3, left: 0 }}
        onClick={onMonth ? state => {
          if (typeof state.activeLabel === 'string') onMonth(state.activeLabel);
        } : undefined}>
        <defs><linearGradient id="income-gradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#53bf9e" stopOpacity=".17" />
          <stop offset="1" stopColor="#53bf9e" stopOpacity="0" /></linearGradient></defs>
        <CartesianGrid stroke="#e3e6ee" vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={9} minTickGap={10}
          tickFormatter={displayMonth}
          tick={onMonth ? props => <MonthAxisTick {...props} selectedMonth={selectedMonth} onMonth={onMonth} /> : axes} />
        <YAxis axisLine={false} tickLine={false} tick={axes} width={counting ? 42 : 69}
          allowDecimals={!counting} tickFormatter={counting ? count : roundedMoney} />
        <Tooltip contentStyle={tooltip} labelStyle={{ color: '#20243a' }} cursor={{ fill: '#745ee310' }}
          formatter={value => counting ? count(Number(value)) : money(Number(value))}
          labelFormatter={(_, payload) => payload[0]?.payload?.month ? displayMonthYear(payload[0].payload.month) : ''} />
        {income && <Area dataKey="income" name={incomeLabel} type="monotone" fill="url(#income-gradient)"
          stroke="#279877" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
        <Bar dataKey={counting ? 'payments' : 'spent'} name={label} fill={counting ? '#319e82' : '#9a82f5'}
          radius={[4, 4, 0, 0]} maxBarSize={25} isAnimationActive={false} cursor={onMonth ? 'pointer' : undefined}
          onClick={onMonth ? (_, index, event) => {
            event.stopPropagation();
            onMonth(series[index].month);
          } : undefined}>
          {selectedMonth && series.map(row => <Cell key={row.month} fillOpacity={row.month === selectedMonth ? 1 : .29} />)}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
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
