import type { XAxisTickContentProps } from 'recharts';
import { displayMonth, displayMonthYear } from '../domain/dates.ts';

export function MonthAxisTick({ x, y, payload, selectedMonth, onMonth, format = displayMonth }: XAxisTickContentProps & {
  selectedMonth?: string;
  format?: (month: string) => string;
  onMonth?: (month: string) => void;
}) {
  const month = String(payload.value);
  const open = month && onMonth ? () => onMonth(month) : undefined;
  return <g transform={`translate(${x},${y})`} className={open ? 'month-tick' : undefined}
    role={open ? 'button' : undefined} tabIndex={open ? 0 : undefined}
    aria-label={open ? `Bekijk ${displayMonthYear(month)}` : undefined}
    aria-pressed={open && selectedMonth !== undefined ? month === selectedMonth : undefined}
    onClick={open && (event => { event.stopPropagation(); open(); })}
    onKeyDown={open && (event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      open();
    })}>
    {open && <rect x={-16} y={-6} width={32} height={23} rx={5} />}
    <text y={11} textAnchor="middle" fontSize={12} fill="var(--muted)">{month ? format(month) : 'Start'}</text>
  </g>;
}
