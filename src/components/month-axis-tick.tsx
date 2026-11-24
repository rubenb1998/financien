import type { XAxisTickContentProps } from 'recharts';
import { displayMonth, displayMonthYear } from '../domain/dates.ts';

export function MonthAxisTick({ x, y, payload, selectedMonth, onMonth }: XAxisTickContentProps & {
  selectedMonth?: string;
  onMonth: (month: string) => void;
}) {
  const month = String(payload.value);
  const interactive = Boolean(month);
  return <g transform={`translate(${x},${y})`} className={interactive ? 'month-tick' : undefined}
    role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined}
    aria-label={interactive ? displayMonthYear(month) : undefined}
    aria-pressed={interactive ? month === selectedMonth : undefined}
    onClick={interactive ? event => { event.stopPropagation(); onMonth(month); } : undefined}
    onKeyDown={interactive ? event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      onMonth(month);
    } : undefined}>
    {interactive && <rect x={-16} y={-6} width={32} height={23} rx={5} />}
    <text y={11} textAnchor="middle" fontSize={12} fill="var(--muted)">{month ? displayMonth(month) : 'Start'}</text>
  </g>;
}
