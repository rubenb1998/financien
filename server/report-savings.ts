import { shiftMonth } from '../src/domain/dates.ts';
import { money } from '../src/domain/format.ts';
import type { ReportRequest } from '../src/domain/reports.ts';

const amount = '(\\d[\\d.,]*)';
const euroAmount = '(?:€\\s*' + amount + '|' + amount + '\\s*euro\\b)';
const months = 'januari februari maart april mei juni juli augustus september oktober november december'.split(' ');
const numbers = 'een twee drie vier vijf zes zeven acht negen tien elf twaalf'.split(' ');

function cents(value: string | undefined) {
  if (!value) return;
  const parsed = Math.round(Number(value.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) * 100);
  if (parsed > 0 && parsed <= 100_000_000) return parsed;
}

function monthlyAmount(question: string) {
  const monthly = new RegExp('(?:€\\s*)?' + amount + '\\s*(?:euro\\s*)?(?:per maand|/maand)\\b', 'gi');
  for (const match of question.matchAll(monthly)) {
    const before = question.slice(0, match.index);
    if (/(?:inkomen|salaris|verdien|huur|kost\w*)[^\n.!?;€]{0,30}$/i.test(before)
      && !/(?:sparen|besparen|doel|opzij)[^\n.!?;€]{0,20}$/i.test(before)) continue;
    return cents(match[1]);
  }
  return cents(question.match(/\bmaandelijks\s+(?:€\s*)?(\d[\d.,]*)/i)?.[1]);
}

function totalAmount(question: string) {
  const values = [...question.matchAll(new RegExp(euroAmount, 'gi'))].filter(match => {
    const before = question.slice(0, match.index);
    return !/\b(?:inkomen|salaris|verdien|al gespaard|al opzij gezet)\s*(?:van|is|netto)?\s*$/i.test(before);
  }).map(match => cents(match[1] ?? match[2])).filter(value => value !== undefined);
  if (values.length) return new Set(values).size === 1 ? values[0] : undefined;
  const unmarked = question.match(/\b(\d[\d.,]*)\s+(?:in totaal\s+)?(?:sparen|besparen|opzij|apart zetten|bij elkaar)\b/i);
  return cents(unmarked?.[1]);
}

export function projectionMonths(question: string) {
  const relative = question.match(new RegExp('\\b(?:binnen|over|in|na|voor|komende)\\s+(\\d{1,3}|' + numbers.join('|') + ')\\s+maand(?:en)?\\b', 'i'))?.[1];
  if (!relative) return;
  return Number(relative) || numbers.indexOf(relative.toLowerCase()) + 1;
}

function deadlineMonth(question: string, date: string, nextYear: boolean) {
  const currentMonth = date.slice(0, 7);
  const year = Number(date.slice(0, 4));
  const isoMonth = question.match(/\b(20\d{2}-(?:0[1-9]|1[0-2]))(?:-\d{2})?\b/)?.[1];
  if (isoMonth) return isoMonth;
  const relative = question.match(new RegExp('\\b(?:binnen|over|in)\\s+(\\d{1,3}|' + numbers.join('|') + ')\\s+maand(?:en)?\\b', 'i'))?.[1];
  if (relative) {
    const duration = Number(relative) || numbers.indexOf(relative.toLowerCase()) + 1;
    if (duration > 0 && duration <= 120) return shiftMonth(currentMonth, duration);
  }
  const month = question.match(new RegExp('\\b(' + months.join('|') + ')\\b(?:\\s+(20\\d{2}))?', 'i'));
  if (month) {
    const value = String(months.indexOf(month[1].toLowerCase()) + 1).padStart(2, '0');
    const nextOccurrence = value < currentMonth.slice(5) ? year + 1 : year;
    return (month[2] ?? (nextYear ? year + 1 : nextOccurrence)) + '-' + value;
  }
  if (/\b(?:eind|einde van|uiterlijk eind)\s+(?:dit|volgend) jaar\b/i.test(question)) return (year + Number(nextYear)) + '-12';
  return question.match(/\b(?:eind|einde van)\s+(20\d{2})\b/i)?.[1]?.concat('-12');
}

const savingTerms = /\b(?:sparen|bespaar\w*|bespar\w*|spaardoel\w*|spaarplan\w*|spaarscenario\w*|spaaradvies\w*|spaarruimte|opzij|apart zetten|bij elkaar)\b/i;
const totalTerms = /\b(?:totaal|bij elkaar|vakantie|reis|deadline|binnen|uiterlijk|over \w+ maanden|volgend jaar|eind \d{4})\b/i;

export function savingsQuestion(question: string, subject: string, date: string, previous?: ReportRequest,
  clarification?: string) {
  const saving = savingTerms.test(subject) || Boolean(clarification?.startsWith('Hoeveel wil je'));
  if (!saving && previous?.mode !== 'saving') return {};
  const bareAmount = cents(question.match(/^\s*(?:€\s*)?(\d[\d.,]*)\s*(?:euro)?\s*[.!]?\s*$/i)?.[1]);
  const asksMonthly = clarification?.startsWith('Hoeveel wil je per maand');
  const asksTotal = clarification?.startsWith('Wanneer wil je') || /\b(?:in totaal|totaalbedrag)\b/i.test(question);
  const monthly = monthlyAmount(question) ?? (!asksTotal && asksMonthly ? bareAmount : undefined)
    ?? (/^\s*(?:ja,?\s+)?(?:per maand|maandelijks)[.!]?\s*$/i.test(question) ? totalAmount(subject) : undefined);
  if (monthly) return { saving: true, target: monthly };
  const priorGoal = previous?.totalGoal;
  const nextYear = /\bvolgend jaar\b/i.test(subject);
  const deadline = deadlineMonth(question, date, nextYear) ?? deadlineMonth(subject, date, nextYear);
  const total = (totalTerms.test(subject) || deadline || priorGoal || asksTotal)
    ? totalAmount(question) ?? totalAmount(subject) ?? (asksTotal ? bareAmount : undefined) ?? priorGoal?.amount : undefined;
  if (total) {
    const by = deadline ?? priorGoal?.deadline;
    if (!by || by < date.slice(0, 7)) {
      return { saving: true, message: `Wanneer wil je ${money(total)} bij elkaar hebben? Noem een maand of een termijn, bijvoorbeeld juni 2027 of over zes maanden.` };
    }
    const elapsed = (Number(by.slice(0, 4)) - Number(date.slice(0, 4))) * 12 + Number(by.slice(5)) - Number(date.slice(5, 7));
    return { saving: true, target: Math.ceil(total / Math.max(1, elapsed)), totalGoal: { amount: total, deadline: by } };
  }
  if (saving && !previous?.target) {
    if (totalAmount(subject) || bareAmount) return { saving: true, message: 'Is dat bedrag per maand of je totale spaardoel? Noem bij een totaalbedrag ook wanneer je het bij elkaar wilt hebben.' };
    return { saving: true, message: 'Hoeveel wil je per maand sparen? Voor een totaalbedrag kun je ook je gewenste eindmaand noemen.' };
  }
  return { saving, target: previous?.target, totalGoal: priorGoal };
}

export function explicitIncome(question: string) {
  const match = question.match(/\b(?:salaris|inkomen|verdien)\s*(?:is|van|bedraagt|netto)?\s*(?:€\s*)?(\d[\d.,]*)\s*(?:euro|netto|per maand|[.!?]|$)/i);
  return cents(match?.[1]);
}
