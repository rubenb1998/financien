import { CircleDollarSign, Flag, Wallet } from 'lucide-react';
import { Empty, Metric, Panel } from '../components/ui.tsx';
import { displayMonthYear } from '../domain/dates.ts';
import { money } from '../domain/format.ts';
import { projectSavings } from '../domain/savings-projection.ts';
import type { SavingsPlan } from '../domain/savings-types.ts';
import type { Goal } from '../domain/types.ts';
import { BudgetBasis, BudgetCuts, MonthlyBudget } from './savings/budget.tsx';
import { ContributionSchedule, SavingsChart } from './savings/projection.tsx';

export function GoalPage({ plans, planId, goals }: { plans: SavingsPlan[]; planId?: string; goals: Goal[] }) {
  const active = plans.find(plan => plan.id === planId) ?? plans[0];
  return <>
    {active ? <>
      <nav className="savings-scenarios" aria-label="Spaarscenario's">
        {plans.map(plan => <a key={plan.id} href={`#goals/${plan.id}`} className="panel savings-scenario"
          aria-current={plan.id === active.id ? 'page' : undefined}>
          <span>{displayMonthYear(plan.startMonth)} t/m {displayMonthYear(plan.endMonth)}</span>
          <strong>{plan.title}</strong>
          <small>{plan.reserve > 0 ? `${money(plan.reserve)} per maand over naast het doel` : 'Vrije ruimte naar het doel'}</small>
        </a>)}
      </nav>
      <GoalPlan key={active.id} plan={active} />
    </> : <Empty message="Vraag hier in de chat een spaarplan met een doelbedrag en deadline. Het plan verschijnt op deze pagina." />}
    {goals.length > 0 && <Panel title="Eerder opgeslagen doelen">
      <ul className="savings-previous">
        {goals.map(goal => <li key={goal.id}><strong>{goal.title}</strong> {money(goal.saved)} van {money(goal.target)}</li>)}
      </ul>
    </Panel>}
  </>;
}

function GoalPlan({ plan }: { plan: SavingsPlan }) {
  const forecast = projectSavings(plan);
  const isShort = forecast.shortfall > 0;
  return <>
    <div className="metrics three">
      <Metric title="Inleg per maand" value={money(forecast.monthlyDeposit)} icon={<Wallet size={19} />}
        caption={isShort ? `${money(forecast.needed)} nodig voor de deadline` : `${forecast.schedule.length} maanden volgens plan`} />
      <Metric title={`Verwacht in ${displayMonthYear(plan.endMonth)}`} value={money(forecast.ending)} tone="violet" icon={<Flag size={19} />}
        caption={isShort ? `${money(forecast.shortfall)} onder doel` : 'Doel gehaald in de prognose'} />
      <Metric title="Vrij naast het doel" value={money(forecast.free)} tone="blue" icon={<CircleDollarSign size={19} />}
        caption={plan.reserve > 0 ? `${money(plan.reserve)} gewenst per maand` : 'Per maand na inleg'} />
    </div>
    <div className="savings-insights">
      <SavingsChart forecast={forecast} saved={plan.saved} />
      <MonthlyBudget forecast={forecast} plan={plan} />
    </div>
    {isShort && <section className="panel savings-gap" aria-label="Resterend voor de deadline">
      <h2>Voor {displayMonthYear(plan.endMonth)} ontbreekt {money(forecast.extraNeeded)} per maand</h2>
      <p>Met {money(forecast.extraNeeded)} extra netto inkomen of lagere beïnvloedbare uitgaven per maand haal je het doel op tijd.
        {forecast.finish && ` Bij hetzelfde uitgavenplan bereik je het doel naar verwachting in ${displayMonthYear(forecast.finish)}.`}</p>
    </section>}
    <BudgetCuts forecast={forecast} />
    <ContributionSchedule forecast={forecast} />
    <BudgetBasis plan={plan} forecast={forecast} />
  </>;
}
