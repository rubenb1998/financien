import { resolve } from 'node:path';
import { parsePdf } from './pdf.ts';
import { openStore } from './store.ts';

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error('Gebruik npm run import -- afschrift.pdf [afschrift2.pdf]');
  process.exitCode = 1;
} else {
  const store = openStore();
  for (const path of paths) {
    try {
      const { statement, transactions } = await parsePdf(resolve(path));
      const result = store.import(statement, transactions);
      console.log(`${statement.label} · ${statement.count} regels gecontroleerd · ${result.added} nieuw · ${result.duplicates} dubbel`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Importeren mislukt.');
      process.exitCode = 1;
    }
  }
  store.close();
}
