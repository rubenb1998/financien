import { readFileSync } from 'node:fs';
import { categories, categoryLabel, groupOf, presentCategories } from '../src/domain/categories.ts';
import { defaultSubscriptionView } from '../src/domain/subscription-view.ts';
import { loadProfile } from './profile.ts';
import { openStore } from './store.ts';
import { readSubscriptionView } from './validation.ts';

const [section, action, ...extra] = process.argv.slice(2);

try {
  if (extra.length) throw new Error('Te veel argumenten.');
  if (!section || section === 'categorieen') {
    if (action) throw new Error('Onbekende optie voor profiel of categorieën.');
    const { presentation } = loadProfile();
    presentCategories(presentation.categories);
    if (section === 'categorieen') {
      console.log(JSON.stringify(Object.keys(categories).map(id => ({ id, label: categoryLabel(id), group: groupOf(id) })), null, 2));
    } else {
      console.log('Het lokale profiel is geldig.');
    }
  } else if (section === 'geheugen' && !action) {
    const store = openStore();
    try { console.log(JSON.stringify(store.memory(), null, 2)); } finally { store.close(); }
  } else if (section === 'abonnementen' && (!action || action === '--save')) {
    const store = openStore();
    try {
      if (action) store.saveSubscriptionView(readSubscriptionView(JSON.parse(readFileSync(0, 'utf8'))));
      console.log(JSON.stringify(store.subscriptionView() ?? defaultSubscriptionView, null, 2));
    } finally {
      store.close();
    }
  } else {
    throw new Error('Gebruik npm run instellingen, of voeg -- categorieen, -- geheugen of -- abonnementen [--save] toe.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Instellingen lezen of opslaan is mislukt.');
  process.exitCode = 1;
}
