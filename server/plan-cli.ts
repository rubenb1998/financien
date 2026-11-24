import { readFileSync } from 'node:fs';
import { buildLedger } from '../src/domain/ledger.ts';
import { savingsBaseline } from '../src/domain/savings-baseline.ts';
import { projectSavings } from '../src/domain/savings-projection.ts';
import { readSavingsRequest } from './savings-request.ts';
import { loadProfile } from './profile.ts';
import { openStore } from './store.ts';

const store = openStore();
try {
  const { plans, oneOffs, analysisDate, income } = readSavingsRequest(JSON.parse(readFileSync(0, 'utf8')));
  const ledger = store.load();
  const baseline = savingsBaseline(buildLedger(ledger, loadProfile().rules), ledger.statements, oneOffs, analysisDate, income);
  const saved = plans.map(plan => ({ ...plan, analysisDate, baseline }));
  if (process.argv.includes('--save')) store.savePlans(saved);
  console.log(JSON.stringify(saved.map(plan => {
    const { income, baselineCosts, expenses, monthlyDeposit, ending, shortfall, extraNeeded, free, finish } = projectSavings(plan);
    return { id: plan.id, income, baselineCosts, expenses, monthlyDeposit, ending, shortfall, extraNeeded, free, finish };
  }), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Het spaarscenario kon niet worden berekend.');
  process.exitCode = 1;
} finally {
  store.close();
}
