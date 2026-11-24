import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildLedger } from '../src/domain/ledger.ts';
import { matchesKind, normalize } from '../src/domain/profile.ts';
import { transactionTags } from '../src/domain/tags.ts';
import { isWork, workTag } from '../src/domain/work.ts';
import type { Transaction } from '../src/domain/types.ts';
import { loadProfile } from './profile.ts';
import { openStore } from './store.ts';
import { readCorrection } from './validation.ts';

const [action, ...args] = process.argv.slice(2);

function summary(row: Transaction) {
  const { id, date, amount, merchant, category, kind, review, claimStatus, subscription, linkedId } = row;
  return { id, date, amount, merchant, category, kind, review, claimStatus, subscription, linkedId, tags: transactionTags(row) };
}

function findRows(rows: Transaction[]) {
  const { values, positionals } = parseArgs({
    args, allowPositionals: true, options: {
      datum: { type: 'string' }, bedrag: { type: 'string' }, controle: { type: 'boolean' },
    },
  });
  const date = values.datum;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geef --datum op in YYYY-MM-DD.');
  const amount = values.bedrag;
  if (amount !== undefined && !/^-?\d+$/.test(amount)) throw new Error('Geef --bedrag op in hele eurocenten, bijvoorbeeld --bedrag=-2500.');
  const query = normalize(positionals.join(' '));
  return rows.filter(row =>
    (!date || row.date === date)
    && (amount === undefined || row.amount === Number(amount))
    && (!values.controle || row.review)
    && (!query || normalize(`${row.merchant} ${row.originalMerchant} ${row.details}`).includes(query)));
}

function readPatch() {
  const patch = JSON.parse(readFileSync(0, 'utf8'));
  const fields = ['kind', 'category', 'merchant', 'subscription', 'note', 'tags', 'claimStatus'];
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length
    || Object.keys(patch).some(key => !fields.includes(key))) throw new Error('Geef één of meer geldige correctievelden op.');
  return patch as Record<string, unknown>;
}

try {
  if (action !== 'zoek' && (action !== 'corrigeer' || args.length !== 1)) {
    throw new Error('Gebruik npm run boeking -- zoek [tekst] [--datum YYYY-MM-DD] [--bedrag=centen] [--controle], of corrigeer ID met JSON op stdin.');
  }
  const store = openStore();
  try {
    const { rules } = loadProfile();
    if (action === 'zoek') {
      const found = findRows(buildLedger(store.load(), rules));
      console.log(JSON.stringify({ count: found.length, rows: found.slice(0, 30).map(summary) }, null, 2));
    } else {
      const patch = readPatch();
      const [id] = args;
      store.updateCorrection(id, ledger => {
        const row = buildLedger(ledger, rules).find(item => item.id === id);
        if (!row) throw new Error('Boeking niet gevonden.');
        const next = readCorrection({
          kind: row.kind, category: row.category, merchant: row.merchant, subscription: row.subscription,
          tags: row.tags, claimStatus: row.claimStatus, note: ledger.corrections[id]?.note, ...patch,
        });
        if (!matchesKind(row.amount, next.kind)) throw new Error('Dit transactietype past niet bij het bedrag.');
        if (next.kind === 'income' && next.category === 'reimbursement' && patch.tags === undefined && !isWork(next)) {
          next.tags = [...(next.tags ?? []), workTag];
        }
        if (patch.claimStatus !== undefined && (next.kind !== 'expense' || !isWork(next))) {
          throw new Error('Een declaratiestatus hoort bij een uitgave met de tag Declareren werk.');
        }
        if (next.kind !== 'expense' || !isWork(next)) next.claimStatus = undefined;
        return next;
      });
      const changed = buildLedger(store.load(), rules).find(row => row.id === id);
      if (changed) console.log(JSON.stringify(summary(changed), null, 2));
    }
  } finally {
    store.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Boekingen lezen of corrigeren is mislukt.');
  process.exitCode = 1;
}
