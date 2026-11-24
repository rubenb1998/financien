import { BriefcaseBusiness, Receipt, Wallet } from 'lucide-react';
import { TrendChart, TrendLegend } from '../components/charts.tsx';
import type { MonthSelection } from '../components/charts.tsx';
import { Metric, Notice, Panel } from '../components/ui.tsx';
import { monthlySeries } from '../domain/analytics.ts';
import { money } from '../domain/format.ts';
import { netSpend } from '../domain/ledger.ts';
import { isWork } from '../domain/work.ts';
import type { Transaction } from '../domain/types.ts';
import { TransactionTable } from './transactions.tsx';
import type { TransactionFilters } from './transactions.tsx';

export function WorkClaims({ rows, trendRows, from, to, monthSelection, accountLabels, open, transactionFilters }: {
  rows: Transaction[]; accountLabels: Map<string, string>; open: (row: Transaction) => void;
  trendRows: Transaction[]; from: string; to: string; monthSelection: MonthSelection; transactionFilters: TransactionFilters;
}) {
  const work = rows.filter(isWork);
  const spent = work.reduce((sum, row) => sum + netSpend(row), 0);
  const reimbursed = work.filter(row => row.kind === 'income').reduce((sum, row) => sum + row.amount, 0);
  const ready = work.filter(row => row.kind === 'expense' && row.claimStatus === 'toSubmit')
    .reduce((sum, row) => sum + netSpend(row), 0);
  return <>
    <div className="metrics three">
      <Metric title="Netto werkkosten" value={money(spent)} icon={<BriefcaseBusiness size={19} />} tone="violet" />
      <Metric title="Vergoedingen ontvangen" value={money(reimbursed)} icon={<Wallet size={19} />} />
      <Metric title="Te declareren" value={money(ready)} caption="Door jou zo gemarkeerd" icon={<Receipt size={19} />} tone="blue" />
    </div>
    <Panel title="Werkkosten en vergoedingen" action={<TrendLegend income="Vergoedingen" expenses="Werkkosten" />}>
      <TrendChart series={monthlySeries(trendRows === rows ? work : trendRows.filter(isWork), from, to)}
        amountLabel="Netto werkkosten" incomeLabel="Ontvangen vergoedingen" monthSelection={monthSelection} />
    </Panel>
    <Notice>Open een boeking om de declaratiestatus bij te werken. Een vergoeding kan meerdere kosten bevatten.</Notice>
    <TransactionTable rows={work} accountLabels={accountLabels} onOpen={open} showClaims transactionFilters={transactionFilters} />
  </>;
}
