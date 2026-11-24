import { readFileSync } from 'node:fs';
import { availableMonths } from '../src/domain/periods.ts';
import { isReportId, prepareReport, readReportRequest } from './reports.ts';
import { openStore } from './store.ts';

const store = openStore();
try {
  if (process.argv.includes('months')) {
    console.log(JSON.stringify(availableMonths(store.load().statements)));
  } else if (process.argv[2] === 'show') {
    const report = store.report(process.argv[3] ?? '');
    if (!report) throw new Error('Deze rapportage bestaat niet.');
    console.log(JSON.stringify(report, null, 2));
  } else {
    const saveIndex = process.argv.indexOf('save', 2);
    const replaceId = saveIndex < 0 ? undefined : process.argv[saveIndex + 1];
    if (replaceId !== undefined && !isReportId(replaceId)) throw new Error('Gebruik een geldige rapport-ID na save.');
    const request = readReportRequest(JSON.parse(readFileSync(0, 'utf8')));
    const { evidence, report } = prepareReport(store, request, replaceId);
    if (saveIndex >= 0) {
      store.saveReport(report, replaceId !== undefined);
      console.log(JSON.stringify({ id: report.id, title: report.title, conclusion: report.conclusion, route: `#reports/${report.id}` }));
    } else {
      console.log(JSON.stringify({ ...report, availableCharts: evidence.charts }, null, 2));
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'De rapportage kon niet worden gegenereerd.');
  process.exitCode = 1;
} finally {
  store.close();
}
