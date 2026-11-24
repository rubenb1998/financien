import { Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FilterChip } from '../../components/filter-summary.tsx';
import { MonthAxisTick } from '../../components/month-axis-tick.tsx';
import { Dialog, Panel } from '../../components/ui.tsx';
import { displayMonth, displayMonthYear } from '../../domain/dates.ts';
import { money, roundedMoney } from '../../domain/format.ts';
import type { projectSavings } from '../../domain/savings-projection.ts';

export type Forecast = ReturnType<typeof projectSavings>;

const series = [
  { key: 'cumulative', label: 'Met dit plan', color: '#5945bd' },
  { key: 'targetPace', label: 'Doeltempo', color: '#258772', dash: '5 5' },
  { key: 'currentPace', label: 'Zonder besparingen', color: '#7a8298', dash: '2 4' },
] as const;

export function SavingsChart({ forecast, saved }: { forecast: Forecast; saved: number }) {
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState('');
  const toggleMonth = (next: string) => setMonth(value => value === next ? '' : next);
  return <>
    <Panel title="Spaargroei" subtitle={`Startbedrag ${money(saved)}`} className="savings-chart-panel"
      action={<button className="secondary compact" type="button" aria-haspopup="dialog" onClick={() => setExpanded(true)}>
        <Maximize2 size={16} />Vergroot grafiek
      </button>}>
      <SavingsPlot forecast={forecast} saved={saved} month={month} onMonth={toggleMonth} />
    </Panel>
    {expanded && <Dialog title="Spaargroei per maand" close={() => setExpanded(false)} className="savings-chart-dialog">
      <SavingsPlot forecast={forecast} saved={saved} month={month} onMonth={toggleMonth} />
    </Dialog>}
  </>;
}

function SavingsPlot({ forecast, saved, month, onMonth }: {
  forecast: Forecast; saved: number; month: string; onMonth: (value: string) => void;
}) {
  const data = [{ month: '', cumulative: saved, targetPace: saved, currentPace: saved }, ...forecast.schedule];
  const selected = forecast.schedule.find(item => item.month === month);
  return <>
    <div className="savings-chart" role="group" aria-label="Spaargroei per maand met het plan, doeltempo en huidige uitgaven">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} className="savings-chart-selectable" margin={{ top: 12, right: 18, bottom: 3, left: 0 }}
          onClick={state => {
            const point = state.activeLabel;
            if (typeof point === 'string' && point) onMonth(point);
          }}>
          <CartesianGrid vertical={false} stroke="#e3e6ee" strokeDasharray="3 5" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={8} minTickGap={12}
            tickFormatter={month => month ? displayMonth(month) : 'Start'}
            tick={props => <MonthAxisTick {...props} selectedMonth={month} onMonth={onMonth} />} />
          <YAxis width={64} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#646e86' }} tickFormatter={roundedMoney} />
          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e5ef', borderRadius: 10 }}
            formatter={value => money(Number(value))}
            labelFormatter={(_, items) => items[0]?.payload?.month ? displayMonthYear(items[0].payload.month) : 'Startsaldo'} />
          {selected && <ReferenceLine x={selected.month} stroke="#9b87ed" strokeDasharray="4 4" />}
          {series.map(({ key, label, color, ...style }) => <Line key={key} type="linear" dataKey={key} name={label}
            stroke={color} strokeWidth={key === 'cumulative' ? 3 : 2} strokeDasharray={'dash' in style ? style.dash : undefined}
            dot={key === 'cumulative' ? { r: 2.4, fill: color, strokeWidth: 0 } : false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <ul className="savings-legend">
      {series.map(item => <li key={item.key}><i style={{ background: item.color }} />{item.label}</li>)}
    </ul>
    <div aria-live="polite">
      {selected && <section className="forecast-month" aria-label="Prognose voor gekozen maand">
        <FilterChip label={displayMonthYear(selected.month)} clear={() => onMonth(selected.month)} />
        <dl>
          <div><dt>Inleg</dt><dd>{money(selected.deposit)}</dd></div>
          <div><dt>Totaal gespaard</dt><dd>{money(selected.cumulative)}</dd></div>
          <div><dt>Vrij naast doel</dt><dd>{money(selected.free)}</dd></div>
        </dl>
      </section>}
    </div>
  </>;
}

export function ContributionSchedule({ forecast }: { forecast: Forecast }) {
  return <details className="panel savings-detail">
    <summary>Inleg en saldo per maand</summary>
    <div className="table-scroll in-panel"><table>
      <thead><tr><th>Maand</th><th className="align-right">Inleg</th><th className="align-right">Totaal gespaard</th><th className="align-right">Vrij naast doel</th></tr></thead>
      <tbody>{forecast.schedule.map(row => <tr key={row.month}>
        <td>{displayMonthYear(row.month)}</td><td className="align-right amount">{money(row.deposit)}</td>
        <td className="align-right amount">{money(row.cumulative)}</td><td className="align-right amount">{money(row.free)}</td>
      </tr>)}</tbody>
    </table></div>
  </details>;
}
