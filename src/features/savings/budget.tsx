import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Panel } from '../../components/ui.tsx';
import { categories, categoryLabel, isProtectedBudget } from '../../domain/categories.ts';
import { displayDate, displayMonthYear } from '../../domain/dates.ts';
import { money } from '../../domain/format.ts';
import type { BudgetKind, SavingsPlan } from '../../domain/savings-types.ts';
import { categoryHref } from '../../routes.ts';
import type { Forecast } from './projection.tsx';

const labels: Record<BudgetKind, string> = {
  fixed: 'Vaste last', usual: 'Regelmatige uitgave', reserve: 'Maandreservering',
};

function BudgetCategory({ id }: { id: string }) {
  const label = categoryLabel(id);
  return categories[id] && categories[id].group !== 'ignored'
    ? <a className="text-link budget-category-link" href={categoryHref({ type: 'category', key: id })}>
      {label}<ChevronRight size={13} aria-hidden="true" />
    </a> : label;
}

export function MonthlyBudget({ forecast, plan }: { forecast: Forecast; plan: SavingsPlan }) {
  const protectedCosts = forecast.lines.filter(line => isProtectedBudget(line.id)).reduce((sum, line) => sum + line.budget, 0);
  const provision = plan.provision?.monthly ?? 0;
  return <Panel title="Verdeling per maand" subtitle={`Kostenplafond voor doel ${money(forecast.expenseLimit)}`} className="savings-budget">
    <dl>
      <div><dt>Netto maandinkomen</dt><dd>{money(forecast.income)}</dd></div>
      <div><dt>Beschermde kosten</dt><dd>{money(protectedCosts)}</dd></div>
      <div><dt>Overige uitgaven en potjes</dt><dd>{money(forecast.expenses - protectedCosts - provision)}</dd></div>
      {provision > 0 && <div><dt>{plan.provision?.label}</dt><dd>{money(provision)}</dd></div>}
      <div className="savings-budget-total"><dt>Maandbudget uitgaven</dt><dd>{money(forecast.expenses)}</dd></div>
      <div><dt>Inleg spaardoel</dt><dd>{money(forecast.monthlyDeposit)}</dd></div>
      <div className="savings-budget-free"><dt>Vrij naast doel{plan.reserve > 0 && <small>Gewenst minimum {money(plan.reserve)}</small>}</dt>
        <dd>{money(forecast.free)}</dd></div>
    </dl>
  </Panel>;
}

export function BudgetCuts({ forecast }: { forecast: Forecast }) {
  const [all, setAll] = useState(false);
  const cuts = forecast.lines.filter(line => line.cut > 0).sort((a, b) => b.cut - a.cut);
  if (!cuts.length) return null;
  return <Panel title="Besparen per categorie" subtitle={`${money(forecast.cuts)} minder gepland per maand`}
    action={cuts.length > 6 && <button className="secondary compact" type="button" onClick={() => setAll(!all)}>
      {all ? 'Toon grootste posten' : `Toon alle ${cuts.length} posten`}
    </button>}>
    <div className="table-scroll in-panel savings-cuts"><table>
      <thead><tr><th>Post en actie</th><th className="align-right">Basis p/m</th><th className="align-right">Budget p/m</th><th className="align-right">Besparing p/m</th></tr></thead>
      <tbody>{(all ? cuts : cuts.slice(0, 6)).map(line => <tr key={line.id}>
        <td><BudgetCategory id={line.id} /><small>{line.action}</small></td>
        <td className="align-right amount">{money(line.monthly)}</td>
        <td className="align-right amount">{money(line.budget)}</td>
        <td className="align-right amount positive">{money(line.cut)}</td>
      </tr>)}</tbody>
    </table></div>
  </Panel>;
}

function range(months: string[]) {
  return months.length > 1 ? `${displayMonthYear(months[0])} t/m ${displayMonthYear(months[months.length - 1])}` : displayMonthYear(months[0]);
}

export function BudgetBasis({ plan, forecast }: { plan: SavingsPlan; forecast: Forecast }) {
  const { baseline, provision, analysisDate } = plan;
  return <details className="panel savings-detail">
    <summary>Kostenbasis en aannames</summary>
    <div className="savings-basis-facts">
      <div><b>{money(baseline.spentMonthly)}</b><span>Werkelijke netto-uitgaven p/m</span></div>
      <div><b>{money(forecast.baselineCosts)}</b><span>Geschatte gebruikelijke kosten p/m</span></div>
      <div><b>{money(forecast.currentRoom)}</b><span>Over p/m bij huidig patroon, met voorziening</span></div>
    </div>
    <p className="muted">Regelmatige uitgaven gebruiken {range(baseline.months)}. Periodieke rekeningen en potjes zijn omgerekend naar een maandbedrag op basis van {range(baseline.reserveMonths)}. Vaste maandlasten gebruiken het middelste bedrag uit de laatste drie volledige maanden.</p>
    <p className="muted">De prognose gebruikt persoonlijke kosten. Werkdeclaraties, kruisposten en losse terugbetalingen via betaalverzoeken vallen buiten de raming. Analyse op {displayDate(analysisDate)}.</p>
    <div className="savings-income-sources">
      {baseline.income.map(line => <span key={line.label}><strong>{money(line.monthly)}</strong> {line.label.toLowerCase()}</span>)}
    </div>
    {provision && <p className="muted">{provision.label} is een voorlopige reservering van {money(provision.monthly)} per maand.</p>}
    {baseline.exclusions.length > 0 && <div className="savings-exclusions">
      <h3>Eenmalige uitgaven buiten de prognose</h3>
      <ul>{baseline.exclusions.map(item => <li key={item.label}><span>{item.label}
        <small>{displayDate(item.from)}{item.to !== item.from && ` t/m ${displayDate(item.to)}`}</small></span><strong>{money(item.amount)}</strong></li>)}</ul>
    </div>}
    <div className="table-scroll in-panel"><table>
      <thead><tr><th>Kostenpost</th><th>Type</th><th>Betaald in</th><th className="align-right">Basis p/m</th><th className="align-right">Plan p/m</th></tr></thead>
      <tbody>{forecast.lines.map(line => <tr key={line.id}>
        <td><BudgetCategory id={line.id} /></td><td>{isProtectedBudget(line.id) ? 'Beschermd' : labels[line.kind]}</td>
        <td>{line.activeMonths} van {line.months} maanden</td>
        <td className="align-right amount">{money(line.monthly)}</td><td className="align-right amount">{money(line.budget)}</td>
      </tr>)}</tbody>
    </table></div>
  </details>;
}
