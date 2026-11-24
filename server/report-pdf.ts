import PDFDocument from 'pdfkit';
import { displayDate } from '../src/domain/dates.ts';
import { chartRows, isTimeline, timelineLabel, timelineSeries, timelineTicks } from '../src/domain/report-charts.ts';
import { money, roundedMoney } from '../src/domain/format.ts';
import type { FinancialReport, ReportChart } from '../src/domain/reports.ts';

const color = { ink: '#21253A', muted: '#53617A', purple: '#5542B4', green: '#187A64', red: '#A63C58',
  rule: '#E0E4EF', paper: '#F5F4FB', mist: '#EBE7FB', white: '#FFFFFF' };
const margin = 42;
const clean = (value: string) => value.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u200B-\u200F\u202F]/g, ' ')
  .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/[^\u0009\u000A\u0020-\u007E\u00A0-\u00FF€‘’“”•…ŒœŠšŸŽž™]/gu, '?');

export function reportPdf(report: FinancialReport): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: margin, left: margin, right: margin, bottom: 25 },
    bufferPages: true, info: { Title: clean(report.title), Author: 'Financiën' } });
  const chunks: Buffer[] = [];
  const buffer = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const width = doc.page.width - margin * 2;
  const right = margin + width;
  const limit = doc.page.height - 68;
  let y = 42;

  function style(size: number, fill = color.ink, bold = false) {
    return doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(fill);
  }
  function sizeOf(text: string, size: number, w = width, bold = false) {
    return style(size, color.ink, bold).heightOfString(clean(text), { width: w, lineGap: 3 });
  }
  function draw(text: string, x: number, top: number, size: number, w = width, fill = color.ink, bold = false,
    align: 'left' | 'right' = 'left') {
    style(size, fill, bold).text(clean(text), x, top, { width: w, lineGap: 3, align });
  }
  function rule(top: number) {
    doc.moveTo(margin, top).lineTo(right, top).lineWidth(0.65).stroke(color.rule);
  }
  function nextPage() {
    doc.addPage();
    draw('Financiën  /  Rapportages', margin, 34, 10, width, color.purple, true);
    rule(53);
    y = 72;
  }
  function fit(height: number) {
    if (y + height > limit) nextPage();
  }
  function title(text: string) {
    draw(text, margin, y, 17, width, color.ink, true);
    y += 28;
  }
  function section(heading: string, body: string) {
    const head = sizeOf(heading, 12, width, true);
    const height = sizeOf(body, 10.5);
    fit(head + height + 18);
    draw(heading, margin, y, 12, width, color.ink, true);
    draw(body, margin, y + head + 4, 10.5, width, color.muted);
    y += head + height + 17;
  }

  draw('FINANCIËN  /  RAPPORTAGES', margin, y, 10, width, color.purple, true);
  draw(displayDate(report.date), margin, y, 10, width, color.muted, false, 'right');
  y += 22;
  rule(y);
  y += 14;
  draw(report.title, margin, y, 27, width, color.ink, true);
  y += sizeOf(report.title, 27, width, true) + 6;
  draw(report.period, margin, y, 10.5, width, color.muted);
  y += sizeOf(report.period, 10.5) + 12;
  const brief = sizeOf(report.conclusion, 11, width - 26, true) + 23;
  fit(brief);
  doc.roundedRect(margin, y, width, brief, 8).fill(color.paper);
  draw(report.conclusion, margin + 13, y + 10, 11, width - 26, color.ink, true);
  y += brief + 11;

  if (report.metrics.length) {
    const cell = (width - (report.metrics.length - 1) * 8) / report.metrics.length;
    const headingHeight = Math.max(...report.metrics.map(item => sizeOf(item.label, 9, cell - 20)));
    const height = headingHeight + 33;
    fit(height + 10);
    for (const [index, item] of report.metrics.entries()) {
      const x = margin + index * (cell + 8);
      doc.roundedRect(x, y, cell, height, 6).lineWidth(.65).fillAndStroke(color.white, color.rule);
      draw(item.label, x + 10, y + 9, 9, cell - 20, color.muted);
      draw(money(item.value), x + 10, y + headingHeight + 12, cell < 125 ? 12 : 15, cell - 20,
        item.value < 0 ? color.red : color.purple, true);
    }
    y += height + 13;
  }

  for (const group of chartRows(report.charts)) {
    const cell = (width - (group.length - 1) * 10) / group.length;
    const height = Math.max(...group.map(chart => chartHeight(chart, cell)));
    fit(height);
    group.forEach((chart, index) => drawChart(chart, margin + index * (cell + 10), y, cell));
    y += height + 10;
  }

  if (report.actions.length) {
    fit(26 + actionHeight(report.actions[0]));
    title('Voorstellen voor je maandbudget');
    for (const item of report.actions) {
      const height = actionHeight(item);
      if (y + height > limit) {
        nextPage();
        title('Voorstellen voor je maandbudget (vervolg)');
      }
      const categoryHeight = sizeOf(item.category, 11, width - 135, true);
      draw(item.category, margin, y, 11, width - 135, color.ink, true);
      draw(money(item.saving) + ' p/m', right - 125, y, 10.5, 125, color.green, true, 'right');
      draw(actionBody(item), margin, y + categoryHeight + 3, 9.5, width, color.muted);
      y += height - 8;
      rule(y);
      y += 8;
    }
    y += 6;
  }
  const chartSummary = report.charts.find(chart => chart.id === 'projection')?.summary;
  for (const insight of report.insights) {
    if (insight.text !== chartSummary) section(insight.title, insight.text);
  }

  if (report.subscriptionOptions?.length) {
    const subscriptionHeading = 'Abonnementen om te bekijken';
    const subscriptionNote = 'Deze bedragen blijven in je begroting. Bij opzegging valt het maandbedrag weg zodra het abonnement stopt. Gebruik bij een goedkoper pakket het bevestigde prijsverschil.';
    const entriesHeight = report.subscriptionOptions.reduce((height, item) =>
      height + Math.max(13, sizeOf(item.name, 9.5, width - 120)) + 4, 0);
    fit(sizeOf(subscriptionHeading, 12, width, true) + sizeOf(subscriptionNote, 10.5) + 21 + entriesHeight);
    section(subscriptionHeading, subscriptionNote);
    for (const option of report.subscriptionOptions) {
      const height = Math.max(13, sizeOf(option.name, 9.5, width - 120));
      draw(option.name, margin, y, 9.5, width - 120);
      draw(money(option.monthly) + ' p/m', right - 120, y, 9.5, 120, color.ink, true, 'right');
      y += height + 4;
    }
    y += 9;
  }

  if (report.protectedCosts.length) {
    fit(50);
    title('Beschermde maandlasten');
    for (const item of report.protectedCosts) {
      const height = Math.max(13, sizeOf(item.label, 9.5, width - 125));
      fit(height + 6);
      draw(item.label, margin, y, 9.5, width - 125);
      draw(money(item.value), right - 115, y, 9.5, 115, color.ink, true, 'right');
      y += height + 4;
    }
    y += 14;
  }

  if (report.notes.length) {
    fit(58 + sizeOf(report.question, 10.5));
    title('Gegevens en aannames');
    section('Jouw vraag', report.question);
    for (const note of report.notes) {
      const height = sizeOf(note, 9.5);
      fit(height + 9);
      draw(note, margin, y, 9.5, width, color.muted);
      y += height + 8;
    }
  } else section('Jouw vraag', report.question);

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(pages.start + index);
    const foot = doc.page.height - 48;
    rule(foot);
    draw('Financiën  /  Persoonlijke rapportage', margin, foot + 10, 8.5, width, color.muted);
    draw(`${index + 1} / ${pages.count}`, margin, foot + 10, 8.5, width, color.muted, false, 'right');
  }
  doc.end();
  return buffer;

  function actionBody(item: FinancialReport['actions'][number]) {
    return `Maandbudget ${money(item.before)} naar ${money(item.after)}. ${item.text}`;
  }

  function actionHeight(item: FinancialReport['actions'][number]) {
    return sizeOf(item.category, 11, width - 135, true) + sizeOf(actionBody(item), 9.5) + 17;
  }

  function chartHeadingHeight(chart: ReportChart, cell: number) {
    return sizeOf(chart.title, 12, cell - 22, true) + sizeOf(chart.caption, 8.5, cell - 22) + 19;
  }

  function rankingRowHeight(label: string, cell: number) {
    return Math.max(sizeOf(label, 9, cell - 107, true), 12) + 12;
  }

  function chartHeight(chart: ReportChart, cell: number) {
    const head = chartHeadingHeight(chart, cell);
    if (isTimeline(chart)) return head + 144 + (chart.summary ? sizeOf(chart.summary, 9, cell - 22) + 5 : 0);
    return head + chart.rows.reduce((total, row) => total + rankingRowHeight(row.label, cell), 0) + 5;
  }

  function drawChart(chart: ReportChart, x: number, top: number, cell: number) {
    doc.roundedRect(x, top, cell, chartHeight(chart, cell), 7).lineWidth(.65).fillAndStroke(color.white, color.rule);
    draw(chart.title, x + 11, top + 9, 12, cell - 22, color.ink, true);
    draw(chart.caption, x + 11, top + 12 + sizeOf(chart.title, 12, cell - 22, true), 8.5, cell - 22, color.muted);
    const contentTop = top + chartHeadingHeight(chart, cell);
    if (isTimeline(chart)) {
      drawTimeline(chart, x + 11, contentTop, cell - 22);
      if (chart.summary) draw(chart.summary, x + 11, contentTop + 145, 9, cell - 22, color.muted);
    } else drawRanking(chart, x + 11, contentTop, cell - 22, cell);
  }

  function drawRanking(chart: ReportChart, x: number, top: number, plotWidth: number, cell: number) {
    const values = chart.rows.flatMap(row => row.series.map(series => series.value));
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const scale = max - min || 1;
    const zero = x - min / scale * plotWidth;
    let rowTop = top;
    for (const row of chart.rows) {
      const value = row.series[0]?.value ?? 0;
      const rightWidth = 82;
      const labelWidth = plotWidth - rightWidth - 3;
      draw(row.label, x, rowTop, 9, labelWidth, color.ink, true);
      draw(money(value), x + plotWidth - rightWidth, rowTop, 9, rightWidth, value < 0 ? color.red : color.ink, true, 'right');
      const barTop = rowTop + Math.max(12, sizeOf(row.label, 9, labelWidth, true)) + 2;
      doc.roundedRect(x, barTop, plotWidth, 4, 2).fill(color.paper);
      const length = Math.abs(value) / scale * plotWidth;
      if (length > 0) doc.rect(value < 0 ? zero - length : zero, barTop, length, 4).fill(value < 0 ? color.red : color.purple);
      if (min < 0 && max > 0) doc.moveTo(zero, barTop - 1).lineTo(zero, barTop + 5).lineWidth(.5).stroke(color.muted);
      rowTop += rankingRowHeight(row.label, cell);
    }
  }

  function drawTimeline(chart: ReportChart, left: number, top: number, available: number) {
    const projection = chart.id === 'projection';
    const series = timelineSeries(chart);
    const ticks = timelineTicks(chart);
    const min = ticks[0];
    const max = ticks.at(-1)!;
    const plotLeft = left + 63;
    const plotWidth = available - 76;
    const plotHeight = 98;
    const bottom = top + plotHeight;
    const yValue = (value: number) => bottom - ((value - min) / (max - min)) * plotHeight;
    const xValue = (index: number) => plotLeft + (projection ? index / Math.max(1, chart.rows.length - 1)
      : (index + .5) / chart.rows.length) * plotWidth;

    for (const tick of ticks) {
      const row = yValue(tick);
      draw(roundedMoney(tick), left, row - 5, 8, 56, color.muted, false, 'right');
      doc.moveTo(plotLeft, row).lineTo(plotLeft + plotWidth, row).lineWidth(tick ? .5 : .8)
        .stroke(tick ? color.rule : color.muted);
    }
    const years = new Set(chart.rows.map(row => row.label.split(' ')[1]).filter(Boolean));
    const pace = Math.ceil(chart.rows.length / 8);
    for (const [index, row] of chart.rows.entries()) {
      const last = chart.rows.length - 1;
      if (index !== last && (index % pace || (index > 0 && last - index < pace / 2))) continue;
      const label = timelineLabel(row.label, years.size > 1);
      const labelWidth = style(8, color.muted).widthOfString(clean(label)) + 2;
      draw(label, xValue(index) - labelWidth / 2, bottom + 7, 8, labelWidth, color.muted);
    }
    if (projection) {
      for (const [index, item] of series.entries()) {
        doc.moveTo(xValue(0), yValue(item.values[0]));
        item.values.slice(1).forEach((value, point) => doc.lineTo(xValue(point + 1), yValue(value)));
        if (index === 2) doc.dash(4, { space: 3 });
        doc.lineWidth(1.9).stroke(item.color).undash();
        item.values.forEach((value, point) => doc.circle(xValue(point), yValue(value), 1.9).fill(item.color));
      }
    } else {
      const barWidth = Math.min(22, plotWidth / chart.rows.length / (series.length + 1));
      series.forEach((item, index) => item.values.forEach((value, point) => {
        if (!value) return;
        const x = xValue(point) + (index - series.length / 2) * barWidth;
        doc.rect(x + .7, Math.min(yValue(0), yValue(value)), barWidth - 1.4,
          Math.abs(yValue(0) - yValue(value))).fill(item.color);
      }));
    }
    let keyX = left;
    for (const [index, item] of series.entries()) {
      const legendY = bottom + 29;
      if (projection && index === 2) doc.dash(3, { space: 2 });
      doc.moveTo(keyX, legendY + 4).lineTo(keyX + 13, legendY + 4).lineWidth(2).stroke(item.color).undash();
      const labelWidth = style(8.5, color.muted).widthOfString(clean(item.label)) + 3;
      draw(item.label, keyX + 17, legendY, 8.5, labelWidth, color.muted);
      keyX += labelWidth + 32;
    }
  }
}
