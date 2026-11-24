import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReport, reportEvidence } from '../src/domain/reports.ts';
import type { ReportRequest } from '../src/domain/reports.ts';
import type { Statement, Transaction } from '../src/domain/types.ts';
import { readRoute } from '../src/routes.ts';
import { reportSpendingPattern } from '../src/domain/report-spending-pattern.ts';
import { readReportRequest } from '../server/reports.ts';
import { explicitIncome, projectionMonths, savingsQuestion } from '../server/report-savings.ts';

const date = '2026-11-24';
const statement: Statement = { id: 'sample', accountId: 'sample', label: 'Voorbeeld', source: 'bank',
  from: '2026-07-01', to: '2026-11-11', debit: 0, credit: 0, count: 0, pages: 1 };
const rows: Transaction[] = ['07', '08', '09', '10'].flatMap(month => {
  const booking = (category: string, kind: Transaction['kind'], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
    id: `${month}-${category}`, accountId: 'sample', source: 'bank', date: `2026-${month}-05`, category, kind, amount,
    merchant: category, originalMerchant: category, reason: '', review: false, code: 'bc', details: '', counterparty: '',
    ownCounterparty: false, order: 0, page: 1, ...extra,
  });
  return [
    booking('salary', 'income', 200_000), booking('rent', 'expense', -115_000),
    booking('health', 'expense', -12_000), booking('groceries', 'expense', -37_000, { merchant: 'Voorbeeldmarkt' }),
    booking('dining', 'expense', -18_000), booking('streaming', 'expense', -2_000, { subscription: 'Voorbeeldflix' }),
    booking('fitness', 'expense', -6_000), booking('shared', 'expense', -8_000),
    booking('education', 'expense', -40_000, { tags: ['Declareren werk'] }),
    booking('transfer', 'transfer', -50_000),
  ];
});

test('report spend uses the chosen dates, groups and charts and excludes work and transfers', () => {
  const request = readReportRequest({ question: 'Mijn boodschappen in oktober', mode: 'spending',
    from: '2026-10', to: '2026-10', merchant: 'Voorbeeldmarkt', charts: ['history'] });
  const evidence = reportEvidence(rows, [statement], request, date);
  const report = buildReport('sample', date, request, evidence);
  assert.equal(report.period, 'oktober 2026');
  assert.equal(report.metrics[0].value, 37_000);
  assert.deepEqual(report.charts.map(chart => chart.id), ['history']);
  assert.equal(report.charts[0].rows[0].series[0].value, 37_000);
  const all = reportEvidence(rows, [statement], { mode: 'spending', question: 'Wat geef ik uit?' }, date);
  assert.equal(all.totals.spent, 4 * 198_000);
  assert.equal(all.totals.income, 4 * 200_000);
});

test('savings reports preserve fixed bills and healthcare, respect exclusions and expose the remaining gap', () => {
  const request: ReportRequest = { question: 'Hoe spaar ik € 300?', mode: 'saving', target: 30_000, exclude: ['groceries'] };
  const evidence = reportEvidence(rows, [statement], request, date);
  const report = buildReport('sample', date, request, evidence);
  assert.deepEqual(report.protectedCosts.map(item => item.value), [115_000, 12_000]);
  assert.deepEqual(report.actions.map(item => [item.saving, item.before - item.after]), [[4_500, 4_500], [900, 900]]);
  assert.deepEqual(report.metrics.map(item => item.value), [30_000, 2_000, 7_400, 22_600]);
  assert.match(report.conclusion, /226,00/);
  assert.deepEqual(report.subscriptionOptions, [{ name: 'Voorbeeldflix', monthly: 2_000 }]);
});

test('an incomplete period can show expenses without inventing a monthly budget', () => {
  const request = readReportRequest({ question: 'Sparen', mode: 'saving', target: 30_000 });
  const evidence = reportEvidence([], [{ ...statement, from: '2026-11-01' }], request, date);
  const report = buildReport('sample', date, request, evidence);
  assert.deepEqual(report.metrics.map(item => item.value), [30_000]);
  assert.equal(report.charts.length, 0);
  assert.match(report.conclusion, /volledige maand/);
  assert.deepEqual(readRoute('#goals/bestaand-plan'), { page: 'reports', planId: 'bestaand-plan' });
});

test('a vacation savings request keeps the total while asking only for the deadline', () => {
  const request = 'Ik wil volgend jaar op vakantie en ik moet 500 euro besparen. Hoe zou ik dit doen?';
  const first = savingsQuestion(request, request, date);
  assert.match(first.message ?? '', /^Wanneer wil je .*500.* bij elkaar hebben/);
  const followUp = 'Hoe ik dat moet doen.';
  assert.equal(savingsQuestion(followUp, request + '\n' + followUp, date, undefined, first.message).message, first.message);
  const answer = 'juni 2027';
  const goal = savingsQuestion(answer, request + '\n' + answer, date, undefined, first.message);
  assert.deepEqual(goal.totalGoal, { amount: 50_000, deadline: '2027-06' });
  assert.equal(goal.target, 7143);
  const input = readReportRequest({ question: request, mode: 'saving', target: goal.target, totalGoal: goal.totalGoal });
  const report = buildReport('sample', date, input, reportEvidence(rows, [statement], input, date));
  assert.match(report.title, /500.*juni 2027/);
  assert.deepEqual(report.metrics.slice(0, 2).map(item => item.value), [7143, 50_000]);
});

test('monthly savings, deadline changes and stated income use the intended amounts', () => {
  const monthly = 'Ik wil € 300 per maand sparen voor mijn vakantie.';
  assert.deepEqual(savingsQuestion(monthly, monthly, date), { saving: true, target: 30_000 });
  const total = 'Ik wil € 500 over zes maanden bij elkaar hebben.';
  const goal = savingsQuestion(total, total, date);
  assert.deepEqual(goal.totalGoal, { amount: 50_000, deadline: '2027-05' });
  assert.equal(goal.target, 8334);
  const salary = 'Mijn inkomen is € 2.500 per maand. Ik wil € 300 per maand sparen.';
  assert.equal(savingsQuestion(salary, salary, date).target, 30_000);
  assert.equal(explicitIncome(salary), 250_000);
  const previous: ReportRequest = { mode: 'saving', question: total, target: goal.target, totalGoal: goal.totalGoal };
  assert.equal(savingsQuestion('Maak het juni 2027', 'Maak het juni 2027', date, previous).target, 7143);
});

test('the six month projection separates current spending, flexible cuts and the target from the same opening bank balance', () => {
  const question = 'Hoe ziet mijn banksaldo eruit over zes maanden als ik € 600 per maand spaar?';
  const request = readReportRequest({ question, mode: 'saving', target: 60_000, projectionMonths: projectionMonths(question) });
  assert.equal(request.projectionMonths, 6);
  const coaching = rows.filter(row => row.category === 'fitness').map(row => ({
    ...row, id: row.id + '-coach', category: 'coaching', amount: -7_500, subscription: 'Voorbeeldcoach',
  }));
  const all = [...rows, ...coaching];
  const evidence = reportEvidence(all, [statement], request, date,
    { amount: 100_000, date: '2026-11-23', accounts: 1, totalAccounts: 2 });
  const chart = evidence.charts.find(chart => chart.id === 'projection')!;
  assert.equal(chart.rows.length, 7);
  assert.equal(chart.rows.at(-1)?.label, 'mei 2027');
  assert.match(chart.caption, /1 van 2 rekeningen/);
  assert.deepEqual(chart.rows[0].series.map(item => item.value), [100_000, 100_000, 100_000]);
  assert.equal(chart.rows.at(-1)?.series[0].value, 100_000 + 6 * (2_000 - 7_500));
  assert.equal(chart.rows.at(-1)?.series[1].value, 100_000 + 6 * (2_000 - 7_500 + 4_500 + 3_700 + 900));
  assert.equal(chart.rows.at(-1)?.series[2].value, 460_000);
  assert.ok(evidence.savings?.actions.every(action => action.category !== 'Coaching & training'));
  assert.deepEqual(evidence.savings?.subscriptionOptions, [{ name: 'Voorbeeldflix', monthly: 2_000 }]);
  const budget = evidence.charts.find(chart => chart.id === 'budget')!;
  assert.equal(budget.rows.find(row => row.label === 'Abonnementen')?.series[0].value, 9_500);
  const relative = reportEvidence(all, [statement], request, date).charts.find(chart => chart.id === 'projection');
  assert.equal(relative?.title, 'Verandering in banksaldo');
  assert.equal(relative?.rows.at(-1)?.series[2].value, 360_000);
});

test('a prior purchase peak falls into the baseline adjustment and cannot be counted again as savings', () => {
  const history = rows[0];
  const bikeRows = [110_000, 90_000, 130_000, 12_000, 0, 15_000].flatMap((expense, index) => expense
    ? [{ ...history, id: 'bike-' + index, kind: 'expense' as const, category: 'bike',
      date: `2026-${String(index + 5).padStart(2, '0')}-05`, amount: -expense }] : []);
  const covered = [{ ...statement, from: '2026-05-01', to: '2026-10-31' }];
  const request = readReportRequest({ question: 'Sparen', mode: 'saving', target: 60_000 });
  const evidence = reportEvidence([...rows, ...bikeRows], covered, request, date);
  const insight = evidence.savings?.insights.find(item => item.title === 'Recente uitgaven');
  assert.match(insight?.text ?? '', /90,00/);
  assert.ok(evidence.savings?.actions.every(action => !/Fietsen/.test(action.category)));
  const baseOnly = reportEvidence(rows, covered, request, date);
  const room = (value: typeof evidence) => value.savings?.metrics.find(item => item.label === 'Huidige spaarruimte')?.value;
  assert.equal(room(evidence), room(baseOnly)! - 9_000);
});

test('sparse historical expenses stay reserved without becoming monthly savings proposals', () => {
  const sample = rows[0];
  const entries: Transaction[] = [
    { ...sample, id: 'purchase', date: '2026-05-05', kind: 'expense', amount: -36_000, category: 'gear' },
    { ...sample, id: 'coaching', date: '2026-10-05', kind: 'expense', amount: -7_500, category: 'coaching', subscription: 'Voorbeeld' },
  ];
  const lines = [
    { id: 'gear', kind: 'reserve' as const, monthly: 6_000, months: 6, activeMonths: 1 },
    { id: 'coaching', kind: 'usual' as const, monthly: 7_500, subscriptionMonthly: 7_500, months: 6, activeMonths: 6 },
  ];
  const months = ['05', '06', '07', '08', '09', '10'].map(value => `2026-${value}`);
  const pattern = reportSpendingPattern(entries, lines, months, date);
  assert.deepEqual(pattern.lines, lines);
  assert.equal(pattern.proposalBudgets.size, 0);
  const oldCoverage = reportSpendingPattern(entries, lines, months.slice(0, 3), date);
  assert.deepEqual(oldCoverage.lines, lines);
  assert.equal(oldCoverage.proposalBudgets.size, 0);
});
