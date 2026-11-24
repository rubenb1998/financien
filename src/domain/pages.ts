export const pageNames = {
  overview: 'Overzicht',
  wealth: 'Vermogen',
  transactions: 'Transacties',
  categories: 'Categorieën',
  'category-dashboard': 'Categorie-dashboard',
  subscriptions: 'Abonnementen',
  reports: 'Rapportages',
  work: 'Declaraties',
  chat: 'AI-chat',
  review: 'Te controleren',
  sources: 'Bronnen & import',
} as const;

export type Page = keyof typeof pageNames;
