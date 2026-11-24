import { useId } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartRows, isTimeline, timelineLabel, timelineSeries, timelineTicks } from '../domain/report-charts.ts';
import { money, roundedMoney } from '../domain/format.ts';
import type { ChartId, ReportChart } from '../domain/reports.ts';

export function ReportCharts({ charts, selected, toggle }: {
  charts: ReportChart[]; selected: ReadonlySet<ChartId>; toggle: (id: ChartId, enabled: boolean) => void;
}) {
  return <div className="report-charts">{chartRows(charts).map(group =>
    <div key={group[0].id} className={group.length === 2 ? 'report-chart-pair' : undefined}>
      {group.map(chart => <ReportFigure key={chart.id} chart={chart}
        selected={selected.has(chart.id)} toggle={enabled => toggle(chart.id, enabled)} />)}
    </div>)}</div>;
}

function ReportFigure({ chart, selected, toggle }: { chart: ReportChart; selected: boolean; toggle: (enabled: boolean) => void }) {
  const id = useId();
  return <figure className="report-chart" aria-labelledby={id}>
    <figcaption>
      <div><h3 id={id}>{chart.title}</h3><p>{chart.caption}</p></div>
      <label><input type="checkbox" checked={selected} onChange={event => toggle(event.target.checked)}
        aria-label={`${chart.title} opnemen in de PDF`} />In PDF</label>
    </figcaption>
    {isTimeline(chart) ? <Timeline chart={chart} /> : <Ranking chart={chart} />}
  </figure>;
}

function Timeline({ chart }: { chart: ReportChart }) {
  const series = timelineSeries(chart);
  const ticks = timelineTicks(chart);
  const projection = chart.id === 'projection';
  const entries = chart.rows.map((row, index) => ({
    month: row.label, ...Object.fromEntries(series.map(item => [item.label, item.values[index]])),
  }));
  const years = new Set(chart.rows.map(row => row.label.split(' ')[1]).filter(Boolean));
  return <>
    <div className="report-timeline">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={entries} margin={{ top: 6, right: 10, bottom: 2, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e5ef" strokeDasharray="3 4" />
          <XAxis dataKey="month" tickFormatter={label => timelineLabel(label, years.size > 1)}
            tick={{ fill: '#53617a', fontSize: 11 }} tickLine={false} axisLine={false} tickMargin={8} minTickGap={13} />
          <YAxis width={73} domain={[ticks[0], ticks.at(-1)!]} ticks={ticks} tickFormatter={roundedMoney}
            tick={{ fill: '#53617a', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={value => money(Number(value))} labelStyle={{ color: '#21253a' }}
            contentStyle={{ borderRadius: 9, border: '1px solid #dfe3ef' }} cursor={{ fill: '#efedf8' }} />
          {series.map((item, index) => projection
            ? <Line key={item.label} dataKey={item.label} stroke={item.color} strokeWidth={2.4}
              strokeDasharray={index === 2 ? '5 4' : undefined} dot={{ r: 2.7, fill: item.color, strokeWidth: 0 }}
              activeDot={{ r: 4 }} isAnimationActive={false} />
            : <Bar key={item.label} dataKey={item.label} fill={item.color} maxBarSize={28}
              radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <ul className="report-legend">
      {series.map((item, index) => <li key={item.label}><i aria-hidden="true" style={{ color: item.color }}
        className={projection && index === 2 ? 'dashed' : undefined} />{item.label}</li>)}
    </ul>
    {chart.summary && <p className="report-chart-summary">{chart.summary}</p>}
    <details className="report-chart-data">
      <summary>Grafiekwaarden</summary>
      <div><table><thead><tr><th scope="col">Maand</th>
        {series.map(item => <th key={item.label} scope="col">{item.label}</th>)}</tr></thead>
        <tbody>{chart.rows.map((row, index) => <tr key={row.label}><th scope="row">{row.label}</th>
          {series.map(item => <td key={item.label}>{money(item.values[index])}</td>)}</tr>)}</tbody>
      </table></div>
    </details>
  </>;
}

function Ranking({ chart }: { chart: ReportChart }) {
  const values = chart.rows.flatMap(row => row.series.map(item => item.value));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  return <dl>
    {chart.rows.map((row, index) => <div key={index} className="report-chart-row">
      <dt>{row.label}</dt>
      {row.series.map(item => <dd key={item.label}>
        {row.series.length > 1 && <small>{item.label}</small>}<strong>{money(item.value)}</strong>
        <span className="report-bar" aria-hidden="true"><i className={item.value < 0 ? 'negative' : undefined}
          style={{ insetInlineStart: `${(Math.min(0, item.value) - min) / span * 100}%`, width: `${Math.abs(item.value) / span * 100}%` }} />
          {min < 0 && max > 0 && <b style={{ insetInlineStart: `${-min / span * 100}%` }} />}</span>
      </dd>)}
    </div>)}
  </dl>;
}
