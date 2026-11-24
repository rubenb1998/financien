export const pageNames = {
  overview: 'Overzicht',
  transactions: 'Transacties',
  categories: 'Categorieën',
  'category-dashboard': 'Categorie-dashboard',
  subscriptions: 'Abonnementen',
  goals: 'Spaardoelen',
  work: 'Declaraties',
  review: 'Te controleren',
  sources: 'Bronnen & import',
} as const;

export type Page = keyof typeof pageNames;
