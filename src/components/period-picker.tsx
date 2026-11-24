import { ChevronLeft, ChevronRight } from 'lucide-react';
import { periodBounds, periodChoices, periodInYear, periodLabel, periodLabels, periodNavigation, periodUnits } from '../domain/periods.ts';
import type { Period } from '../domain/types.ts';
import { Dropdown } from './dropdown.tsx';

export interface PeriodPickerProps {
  period?: Period;
  months: string[];
  onChange: (period: Period) => void;
}

export function PeriodPicker({ period, months, onChange }: PeriodPickerProps) {
  const anchor = period?.month ?? months.at(-1);
  if (!anchor) return null;

  const year = anchor.slice(0, 4);
  const years = [...new Set([year, ...months.map(month => month.slice(0, 4))])].sort().reverse()
    .map(value => ({ value, label: value }));
  const unitLabel = period ? periodLabels[period.unit] : '';
  const navigation = period && periodNavigation(period, months);
  const inYear = months.filter(month => month.startsWith(year));
  const bounds = period && periodBounds(period);
  const anchorWithCoverage = bounds && !months.includes(anchor) && inYear.findLast(month =>
    month >= bounds.from.slice(0, 7) && month <= bounds.to.slice(0, 7));
  const options = period && periodChoices(period.unit, [...new Set([...inYear, period.month])].sort());

  return <div className="period-picker" role="group" aria-label="Periode kiezen">
    <div className="filter-presets" role="group" aria-label="Periodeweergave">
      {periodUnits.map(unit => <button key={unit} type="button" aria-pressed={period?.unit === unit}
        onClick={() => { if (period?.unit !== unit) onChange({ unit, month: anchorWithCoverage || anchor }); }}>{periodLabels[unit]}</button>)}
    </div>
    {period && <>
      {period.unit !== 'year' && <Dropdown label="Jaar" value={year} options={years}
        onChange={value => onChange(periodInYear(period, value, months))} />}
      <div className="period-stepper">
        <button type="button" className="icon-btn" aria-label={`Vorig${period.unit === 'month' ? 'e' : ''} ${unitLabel.toLowerCase()}`}
          disabled={!navigation?.previous} onClick={() => navigation?.previous && onChange(navigation.previous)}>
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        {period.unit === 'year' ? <Dropdown label="Jaar" value={year} options={years}
          onChange={value => onChange(periodInYear(period, value, months))} />
          : <Dropdown label={unitLabel} value={periodLabel(period, false)}
            options={(options ?? []).map(choice => ({ value: periodLabel(choice, false), label: periodLabel(choice, false) }))}
            onChange={value => {
              const choice = options?.find(choice => periodLabel(choice, false) === value);
              if (choice) onChange(choice);
            }} />}
        <button type="button" className="icon-btn" aria-label={`Volgend${period.unit === 'month' ? 'e' : ''} ${unitLabel.toLowerCase()}`}
          disabled={!navigation?.next} onClick={() => navigation?.next && onChange(navigation.next)}>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </>}
  </div>;
}
