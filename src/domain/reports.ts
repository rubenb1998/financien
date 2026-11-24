import { byCategory, byGroup, incomeByCategory } from './analytics.ts';
import { categoryLabel, groupLabel, groupOf, isProtectedBudget } from './categories.ts';
import { addDays, completeMonths, coverage, displayDate, displayMonthYear, shiftMonth } from './dates.ts';
import { money } from './format.ts';
import { summarize } from './ledger.ts';
import { byMerchant, merchantKey } from './merchant-breakdown.ts';
import { normalize } from './classify.ts';
import { savingsBaseline } from './savings-baseline.ts';
import { recurringItems } from './subscriptions.ts';
import { savingsProjection } from './report-projection.ts';
import { flexibleAmount, reportSpendingPattern } from './report-spending-pattern.ts';
import type { ReportBankBalance } from './report-projection.ts';
import { isWork } from './work.ts';
import type { Statement, Transaction } from './types.ts';

export const reportCharts = {
  groups: 'Uitgaven per groep',
  categories: 'Uitgaven per categorie',
  merchants: 'Uitgaven per aanbieder',
  history: 'Inkomsten en uitgaven per maand',
  subscriptions: 'Terugkerende abonnementskosten',
  income: 'Inkomsten per categorie',
  budget: 'Opbouw van je maandbudget',
  target: 'Spaarruimte en doelbedrag',
  cuts: 'Besparing per voorstel',
  projection: 'Verwacht banksaldo',
} as const;

export type ChartId = keyof typeof reportCharts;
export type ReportMode = 'spending' | 'saving';
export type ReportSection = { title: string; text: string };
export type ReportRequest = {
  question: string;
  mode: ReportMode;
  title?: string;
  from?: string;
  to?: string;
  focus?: string;
  merchant?: string;
  target?: number;
  projectionMonths?: number;
  totalGoal?: { amount: number; deadline: string };
  income?: number;
  exclude?: string[];
  charts?: ChartId[];
  sections?: ReportSection[];
};
type ReportSeries = { label: string; value: number };
export type ReportChart = {
  id: ChartId; title: string; caption: string; summary?: string;
  rows: { label: string; series: ReportSeries[] }[];
};
export type ReportSubscription = { name: string; monthly: number };
export type ReportAction = { category: string; before: number; after: number; saving: number; text: string };

export type ReportSummary = { id: string; date: string; title: string; question: string; mode: ReportMode; target?: number };
export type FinancialReport = ReportSummary & {
  request: ReportRequest;
  period: string;
  metrics: { label: string; value: number }[];
  conclusion: string;
  insights: ReportSection[];
  charts: ReportChart[];
  actions: ReportAction[];
  subscriptionOptions?: ReportSubscription[];
  protectedCosts: { label: string; value: number }[];
  notes: string[];
};

const cutRules: [string, number, string][] = [
  ['dining', .25, 'Plan één afhaal- of restaurantmoment minder en spreek vooraf een budget af.'],
  ['shopping', .20, 'Stel aankopen uit tot het volgende budgetmoment en koop alleen van je lijst.'],
  ['entertainment', .20, 'Kies vooraf welke uitjes je wilt houden en zoek een goedkoper alternatief voor de rest.'],
  ['leisure', .15, 'Loop de losse aankopen na en kies welke je de komende maand kunt overslaan.'],
  ['groceries', .10, 'Maak een weekmenu, check je voorraad en gebruik een boodschappenlijst met een weekbudget.'],
  ['gear', .20, 'Plan vervanging van materiaal vooruit en kijk eerst naar reparatie, tweedehands of lenen.'],
  ['fitness', .15, 'Beperk losse sportaankopen en betaalde extra’s boven op je lidmaatschap.'],
  ['race', .15, 'Kies je belangrijkste wedstrijden vooraf en reserveer inschrijfkosten per maand.'],
  ['coaching', .15, 'Plan extra losse sessies vooruit en stel er een budget voor vast.'],
  ['nutrition', .10, 'Vergelijk de kosten per training en kijk welke sportvoeding je nodig hebt.'],
  ['bike', .15, 'Stel accessoires uit en plan noodzakelijk onderhoud als aparte pot.'],
  ['run', .15, 'Plan vervanging van schoenen en kleding en stel extra aankopen uit.'],
  ['swim', .10, 'Spreek een budget af voor losse bezoeken en vergelijk toegangsprijzen.'],
  ['travel', .15, 'Stel per reis een bedrag vast en reserveer dat over meerdere maanden.'],
  ['tech', .15, 'Plan vervanging en stel upgrades uit terwijl je huidige apparatuur nog werkt.'],
  ['digital', .15, 'Bundel losse aankopen en beperk extra gebruikskosten boven op je abonnementen.'],
  ['home', .10, 'Bundel geplande aankopen en spreek een maximum af voor extra uitgaven.'],
];

const rangeLabel = (from: string, to: string) => from === to ? displayMonthYear(from)
  : `${displayMonthYear(from)} t/m ${displayMonthYear(to)}`;
const monthOf = (row: Transaction) => row.date.slice(0, 7);
const sum = <T,>(items: T[], value: (item: T) => number) => items.reduce((total, item) => total + value(item), 0);
const positive = <T extends { total: number }>(items: T[]) => items.filter(item => item.total > 0);
const isIncomeFocus = (focus?: string) => Boolean(focus && (focus === 'income' || groupOf(focus) === 'income'));

function singleChart(id: ChartId, caption: string, items: { label: string; value: number }[], legend = 'Bedrag'): ReportChart {
  return { id, title: reportCharts[id], caption,
    rows: items.map(({ label, value }) => ({ label, series: [{ label: legend, value }] })) };
}

export function reportEvidence(rows: Transaction[], statements: Statement[], request: ReportRequest, date: string, balance?: ReportBankBalance) {
  const personal = rows.filter(row => !isWork(row));
  const complete = completeMonths(statements).filter(month => month < date.slice(0, 7));
  const span = coverage(statements);
  const requested = Boolean(request.from || request.to);
  const matching = (month: string) => (!request.from || month >= request.from) && (!request.to || month <= request.to);
  const months = requested ? complete.filter(matching) : complete.slice(-6);
  const selected = personal.filter(row => months.length ? months.includes(monthOf(row)) : matching(monthOf(row)));
  const coveredStart = request.from ? request.from + '-01' : span.from;
  const coveredEnd = request.to ? addDays(`${shiftMonth(request.to, 1)}-01`, -1) : span.to;
  const covered = statements.flatMap(statement => {
    const from = coveredStart > statement.from ? coveredStart : statement.from;
    const to = coveredEnd < statement.to ? coveredEnd : statement.to;
    return from <= to ? [{ from, to }] : [];
  });
  const observed = coverageRanges(covered);
  const period = months.length ? rangeLabel(months[0], months.at(-1)!)
    : observed.from && observed.to ? `${displayDate(observed.from)} t/m ${displayDate(observed.to)}` : 'Geen afschriftdekking';
  const focus = request.focus;
  const merchant = request.merchant ? normalize(request.merchant) : '';
  const scoped = selected.filter(row => (!focus || row.category === focus || groupOf(row.category) === focus)
    && (!merchant || merchantKey(row).includes(merchant)));
  const totals = summarize(scoped);
  const categories = positive(byCategory(scoped));
  const groups = positive(byGroup(scoped));
  const providers = byMerchant(scoped).filter(item => item.net > 0);
  const income = incomeByCategory(scoped);
  const subscriptions = recurringItems(personal, statements);
  const tracked = subscriptions.filter(item => item.type === 'personal' && item.active && item.monthlyCost && item.evidence);
  const selectedMonths = months.length ? months : [...new Set(scoped.map(monthOf))].sort();
  const perMonth = Map.groupBy(scoped, monthOf);
  const periodCaption = [period, focus && categoryLabel(groupLabel(focus)), request.merchant].filter(Boolean).join(' · ');
  const charts = [
    singleChart('groups', periodCaption, groups.map(item => ({ label: groupLabel(item.id), value: item.total }))),
    singleChart('categories', periodCaption, categories.slice(0, 8).map(item => ({ label: item.name, value: item.total }))),
    singleChart('merchants', periodCaption, providers.slice(0, 8).map(item => ({ label: item.name, value: item.net }))),
    { id: 'history' as const, title: isIncomeFocus(focus) ? 'Inkomsten per maand' : focus || merchant ? 'Uitgaven per maand' : reportCharts.history,
      caption: periodCaption, rows: (scopeHasData(scoped) ? selectedMonths.slice(-12) : []).map(month => {
        const { spent, income } = summarize(perMonth.get(month) ?? []);
        return { label: displayMonthYear(month), series: [
          ...((!focus && !merchant) || isIncomeFocus(focus) ? [{ label: 'Inkomsten', value: income }] : []),
          ...(!isIncomeFocus(focus) ? [{ label: 'Uitgaven', value: spent }] : []),
        ] };
      }) },
    singleChart('subscriptions', span.to ? `Maandindicaties op basis van boekingen t/m ${displayDate(span.to)}` : '',
      tracked.filter(item => (!focus || focus === item.category || focus === groupOf(item.category))
        && (!merchant || normalize(item.name).includes(merchant))).slice(0, 8)
        .map(item => ({ label: item.name, value: item.monthlyCost! })), 'Per maand'),
    singleChart('income', periodCaption, income.map(item => ({ label: item.name, value: item.total }))),
  ].filter(chart => chart.rows.length);
  const insights: ReportSection[] = [];
  if (!scopeHasData(scoped)) insights.push({ title: 'Beschikbare informatie', text: 'Er zijn geen persoonlijke inkomsten of uitgaven in deze selectie.' });
  if (categories.length) {
    const first = categories[0];
    const share = totals.spent > 0 && first.total <= totals.spent
      ? ` Dat is ${new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 1 }).format(first.total / totals.spent)} van de netto-uitgaven in deze selectie.` : '';
    insights.push({ title: 'Grootste uitgavenpost', text: `${first.name} komt uit op ${money(first.total)}.${share}` });
  }
  if (providers.length) insights.push({ title: 'Grootste aanbieder', text: `Bij ${providers[0].name} kwam je netto uit op ${money(providers[0].net)}.` });
  if (income.length) insights.push({ title: 'Grootste inkomstenbron', text: `${income[0].name} kwam uit op ${money(income[0].total)} in deze periode.` });

  const notes = [
    months.length ? `Uitgavenanalyse over ${months.length} volledige afschriftmaanden met dekking van alle geïmporteerde rekeningen. Maanden met ontbrekende dekking tellen niet mee.`
      : 'Voor deze selectie is er geen volledige afschriftmaand met dekking van alle geïmporteerde rekeningen. De cijfers omvatten alleen de beschikbare boekingen.',
    'Uitgaven zijn netto na retouren. Kruisposten, kaartafrekeningen en werkdeclaraties zijn buiten de persoonlijke berekening gehouden.',
  ];
  if (selectedMonths.length > 12) notes.push('De maandgrafiek toont maximaal de twaalf meest recente maanden uit de selectie.');
  if (tracked.length && request.mode === 'spending') notes.push('Abonnementsbedragen zijn indicaties uit herhaalde betalingen. Controleer de actuele prijs, opzegtermijn en eventuele kosten.');

  const savings = request.mode === 'saving'
    ? savingsAdvice(personal, statements, tracked, request, date, complete, balance) : undefined;
  if (savings) {
    charts.push(...savings.charts.filter(chart => chart.rows.length));
    notes.push(...savings.notes);
  }
  return { period, months, totals, charts, insights, notes, savings, counts: { statements: statements.length } };
}

function scopeHasData(rows: Transaction[]) {
  return rows.some(row => row.kind === 'expense' || row.kind === 'refund' || row.kind === 'income');
}

function coverageRanges(ranges: { from: string; to: string }[]) {
  return { from: ranges.map(item => item.from).sort()[0], to: ranges.map(item => item.to).sort().at(-1) };
}

function savingsAdvice(rows: Transaction[], statements: Statement[], subscriptions: ReturnType<typeof recurringItems>,
  request: ReportRequest, date: string, complete: string[], balance?: ReportBankBalance) {
  const target = request.target!;
  const metrics: FinancialReport['metrics'] = [{ label: 'Spaardoel per maand', value: target }];
  if (request.totalGoal) metrics.push({ label: 'Totaaldoel', value: request.totalGoal.amount });
  const charts: ReportChart[] = [];
  const actions: ReportAction[] = [];
  const insights: ReportSection[] = [];
  const subscriptionOptions: ReportSubscription[] = [];
  const notes: string[] = [];
  const protectedCosts: FinancialReport['protectedCosts'] = [];
  const result = { metrics, charts, actions, subscriptionOptions, insights, notes, protectedCosts, conclusion: '' };
  if (!complete.length) {
    result.conclusion = 'Met de huidige afschriftdekking is je maandelijkse spaarruimte nog niet te berekenen. Importeer ten minste één volledige maand voor alle rekeningen en vraag de rapportage opnieuw aan.';
    return result;
  }

  const baseline = savingsBaseline(rows, statements, [], date, request.income);
  const pattern = reportSpendingPattern(rows, baseline.lines, baseline.months, date);
  const costs = sum(pattern.lines, line => line.monthly);
  const income = sum(baseline.income, line => line.monthly);
  const protectedLines = pattern.lines.filter(line => isProtectedBudget(line.id));
  const protectedTotal = sum(protectedLines, line => line.monthly);
  protectedCosts.push(...protectedLines.map(line => ({ label: categoryLabel(line.id), value: line.monthly })));
  const adjustableLines = pattern.lines.filter(line => !isProtectedBudget(line.id));
  const subscriptionsTotal = sum(adjustableLines, line => line.subscriptionMonthly ?? 0);
  const basis = rangeLabel(baseline.months[0], baseline.months.at(-1)!);
  notes.push(`Begroting op basis van ${basis}. Gewone uitgaven zijn gemiddeld over maximaal zes volledige maanden, periodieke posten over maximaal twaalf en vaste lasten zijn waar mogelijk gebaseerd op recente gebruikelijke betalingen.`);
  notes.push(request.income !== undefined ? 'De berekening gebruikt het opgegeven netto maandinkomen.'
    : 'Terugkerend netto inkomen is geschat met salaris en toeslagen over maximaal drie volledige maanden. Overige inkomsten zijn niet als vast inkomen geraamd.');
  notes.push('Vaste lasten, zorg en abonnementen blijven in de begroting. Periodieke uitgaven krijgen een maandreservering. De besparingen op losse uitgaven zijn richtbedragen.');
  if (pattern.recentMonths.length) {
    const recentBasis = rangeLabel(pattern.recentMonths[0], pattern.recentMonths.at(-1)!);
    notes.push(`Bespaarvoorstellen zijn gebaseerd op losse uitgaven in ${recentBasis}. Bij een duidelijke daling in de laatste drie volledige maanden gebruikt de raming voor gewone uitgaven het nieuwe niveau. Een bestaande daling zit al in het uitgangsscenario.`);
    const change = pattern.changes[0];
    if (change) insights.push({
      title: 'Recente uitgaven',
      text: `${categoryLabel(change.id)} komt in ${recentBasis} gemiddeld uit op ${money(change.recent)} netto per maand, tegenover ${money(change.before)} in de eerdere begrotingsbasis. De prognose rekent met het recente niveau.`,
    });
  } else notes.push('Er zijn geen volledige afschriftmaanden in het laatste kwartaal. Bespaarvoorstellen volgen zodra recente uitgaven betrouwbaar zijn vast te stellen.');

  charts.push(singleChart('budget', basis, [
    { label: 'Beschermde lasten en zorg', value: protectedTotal },
    { label: 'Abonnementen', value: subscriptionsTotal },
    { label: 'Overige gewone uitgaven', value: sum(adjustableLines.filter(line => line.kind !== 'reserve'), flexibleAmount) },
    { label: 'Periodieke reserveringen', value: sum(adjustableLines.filter(line => line.kind === 'reserve'), flexibleAmount) },
  ].filter(item => item.value > 0), 'Per maand'));

  if (!baseline.income.length) {
    metrics.push({ label: 'Geraamde maandlasten', value: costs });
    result.conclusion = 'Er is geen terugkerend inkomen herkend. Geef je netto maandinkomen door om te berekenen wat je spaardoel vraagt.';
    return result;
  }

  const room = income - costs;
  let gap = Math.max(0, target - room);
  const allowed = (id: string) => !isProtectedBudget(id) && !request.exclude?.includes(id) && !request.exclude?.includes(groupOf(id));
  if (gap) {
    // The regular scenario keeps subscription prices. Only a confirmed contract change could free this amount.
    const optional = subscriptions.filter(item => allowed(item.category)
      && (groupOf(item.category) === 'subscriptions' || item.category === 'digital'));
    subscriptionOptions.push(...optional.slice(0, 3).map(item => ({ name: item.name, monthly: item.monthlyCost! })));
  }

  const monthlyBudgets = new Map(adjustableLines.map(line => [line.id, flexibleAmount(line)]));
  const proposals = cutRules.flatMap(([id, proportion, text]) => {
    const flexible = pattern.proposalBudgets.get(id) ?? 0;
    if (!flexible || !allowed(id)) return [];
    const potential = Math.floor(flexible * proportion / 100) * 100;
    return potential ? [{ id, text, before: monthlyBudgets.get(id)!, potential }] : [];
  }).sort((a, b) => b.potential - a.potential);

  for (const { id, text, before, potential } of proposals.slice(0, 4)) {
    if (!gap) break;
    const saving = Math.min(gap, potential);
    const after = before - saving;
    const weekly = ['groceries', 'dining'].includes(id) ? ` Richtbedrag per week: ${money(Math.round(after * 12 / 52))}.` : '';
    actions.push({ category: categoryLabel(id), before, after, saving, text: text + weekly });
    gap -= saving;
  }

  const saving = sum(actions, item => item.saving);
  const after = room + saving;
  metrics.push({ label: 'Huidige spaarruimte', value: room }, { label: 'Ruimte met aanpassingen', value: after },
    { label: 'Resterend per maand', value: gap });
  const projection = savingsProjection(request, date, room, after, balance);
  charts.push(projection.chart);
  insights.unshift(projection.insight);
  notes.push('De prognose telt alleen netto geld dat je overhoudt. Een overboeking tussen eigen rekeningen verandert je totaal niet. Rente en toekomstige prijswijzigingen zijn buiten de projectie gehouden.');
  charts.push(singleChart('target', `Terugkerend netto inkomen ${money(income)} · geraamde lasten ${money(costs)} per maand`, [
    { label: 'Huidige ruimte', value: room }, { label: 'Na voorgestelde aanpassingen', value: after }, { label: 'Spaardoel', value: target },
  ], 'Per maand'));
  if (actions.length) charts.push(singleChart('cuts', 'Geschat verschil tussen het huidige en voorgestelde budget per categorie',
    [...actions].sort((a, b) => b.saving - a.saving).slice(0, 8).map(item => ({ label: item.category, value: item.saving })), 'Per maand'));

  const current = room < 0 ? `Je maandbegroting komt naar schatting ${money(-room)} tekort.`
    : `Je houdt naar schatting ${money(room)} per maand over.`;
  result.conclusion = room >= target
    ? `Met ${money(room)} geschatte ruimte per maand past je doel van ${money(target)} in deze begroting.`
    : `${current} ${saving > 0 ? `De voorgestelde aanpassingen maken naar schatting ${money(saving)} per maand vrij. ` : ''}${gap > 0
      ? `Voor je spaardoel ontbreekt daarna nog ${money(gap)} per maand.` : `Daarmee komt je doel van ${money(target)} per maand binnen bereik.`}`;
  return result;
}

export function buildReport(id: string, date: string, request: ReportRequest, evidence: ReturnType<typeof reportEvidence>): FinancialReport {
  const { totals, savings } = evidence;
  const defaults: ChartId[] = request.mode === 'saving' ? ['projection', 'target', 'budget', 'cuts']
    : isIncomeFocus(request.focus) ? ['income', 'history']
      : request.focus === 'subscriptions' ? ['subscriptions', 'categories', 'history']
        : request.focus || request.merchant ? ['categories', 'history'] : ['groups', 'categories', 'history'];
  const charts = (request.charts ?? defaults).flatMap(id => {
    const chart = evidence.charts.find(item => item.id === id);
    return chart ? [chart] : [];
  });
  const metrics = savings?.metrics ?? (isIncomeFocus(request.focus) ? [{ label: 'Inkomsten', value: totals.income }]
    : request.focus || request.merchant ? [{ label: 'Netto-uitgaven', value: totals.spent }]
      : [{ label: 'Netto-uitgaven', value: totals.spent }, { label: 'Inkomsten', value: totals.income },
        { label: 'Verschil', value: totals.income - totals.spent }]);
  const relevant = savings ? evidence.insights.filter(item => item.title === 'Beschikbare informatie') : evidence.insights;
  const alreadyFits = savings?.metrics.some(item => item.label === 'Huidige spaarruimte' && item.value >= request.target!);
  const goal = request.totalGoal;
  const deadlineInsight = goal ? [{
    title: 'Sparen tot ' + displayMonthYear(goal.deadline),
    text: `Leg elke maand ${money(request.target!)} opzij om uiterlijk in ${displayMonthYear(goal.deadline)} ${money(goal.amount)} te bereiken, uitgaande van een startbedrag van ${money(0)}.`,
  }] : [];
  const next = alreadyFits ? [{ title: 'Gebruik een proefmaand',
    text: 'Neem het doel op in je begroting voor de komende maand. Controleer aan het einde van die maand wat je na vaste lasten en periodieke kosten werkelijk overhield.' }] : [];
  return {
    id, date, title: request.title ?? (savings ? goal ? `${money(goal.amount)} sparen voor eind ${displayMonthYear(goal.deadline)}` : `${money(request.target!)} per maand sparen`
      : request.merchant ? `Uitgaven bij ${request.merchant}`
        : request.focus ? `${categoryLabel(groupLabel(request.focus))} in beeld` : 'Waar gaat mijn geld heen?'),
    question: request.question, mode: request.mode, target: request.target, request, period: evidence.period,
    conclusion: savings?.conclusion ?? relevant[0]?.text ?? 'Bekijk de beschikbare informatie voor deze selectie.',
    metrics, charts, insights: [...(savings?.insights ?? []), ...deadlineInsight, ...next, ...(request.sections ?? []), ...(savings ? relevant : relevant.slice(1))],
    actions: savings?.actions ?? [], subscriptionOptions: savings?.subscriptionOptions, protectedCosts: savings?.protectedCosts ?? [], notes: evidence.notes,
  };
}
