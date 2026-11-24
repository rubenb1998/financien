import type { ReportChart } from './reports.ts';

export const reportColors = {
  violet: '#624DC0', green: '#217D68', slate: '#626E8A', red: '#9C3654',
} as const;

export function isTimeline(chart: ReportChart) {
  return chart.id === 'projection' || chart.id === 'history';
}

export function timelineSeries(chart: ReportChart) {
  const labels = [...new Set(chart.rows.flatMap(row => row.series.map(series => series.label)))];
  return labels.map((label, index) => ({
    label,
    color: chart.id === 'projection' ? [reportColors.slate, reportColors.violet, reportColors.green][index] ?? reportColors.violet
      : label === 'Inkomsten' ? reportColors.green : reportColors.violet,
    values: chart.rows.map(row => row.series.find(series => series.label === label)?.value ?? 0),
  }));
}

export function timelineLabel(label: string, includeYear: boolean) {
  const [month, year] = label.split(' ');
  if (!year) return label;
  return month.slice(0, 3) + (includeYear ? ' ’' + year.slice(-2) : '');
}

export function timelineTicks(chart: ReportChart) {
  const values = chart.rows.flatMap(row => row.series.map(series => series.value));
  const min = Math.min(...values, ...(chart.id === 'history' ? [0] : []));
  const max = Math.max(...values, ...(chart.id === 'history' ? [0] : []));
  const span = max - min || Math.max(Math.abs(max) / 4, 100);
  const power = 10 ** Math.floor(Math.log10(span / 3));
  const step = ([1, 2, 2.5, 5, 10].find(n => power * n >= span / 3) ?? 10) * power;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  return low === high ? [low - step, low, high + step] :
    Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => low + index * step);
}

export function pairReportCharts(first: ReportChart, second?: ReportChart) {
  return Boolean(second && !isTimeline(first) && !isTimeline(second)
    && first.rows.length <= 5 && second.rows.length <= 5
    && [...first.rows, ...second.rows].every(row => row.series.length === 1));
}

export function chartRows(charts: ReportChart[]) {
  const rows: ReportChart[][] = [];
  for (let index = 0; index < charts.length; index++) {
    const first = charts[index];
    if (pairReportCharts(first, charts[index + 1])) rows.push([first, charts[++index]]);
    else rows.push([first]);
  }
  return rows;
}
