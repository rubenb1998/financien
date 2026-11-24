export const groups = [
  ['fixed', 'Vaste lasten', '#9478ee'],
  ['variable', 'Variabele lasten', '#53dab1'],
  ['sport', 'Sport', '#efad6b'],
  ['subscriptions', 'Abonnementen', '#65aaf4'],
  ['other', 'Overige uitgaven', '#e584a6'],
  ['income', 'Inkomsten', '#53dab1'],
  ['ignored', 'Buiten berekening', '#8b91a7'],
] as const;

export type Group = typeof groups[number][0];

const baseCategories: Record<string, { label: string; group: Group }> = {
  rent: { label: 'Huur & wonen', group: 'fixed' },
  utilities: { label: 'Energie & water', group: 'fixed' },
  insurance: { label: 'Verzekeringen', group: 'fixed' },
  healthinsurance: { label: 'Zorgverzekering', group: 'fixed' },
  telecom: { label: 'Telefoon & internet', group: 'fixed' },
  taxes: { label: 'Gemeente & waterschap', group: 'fixed' },
  bankfees: { label: 'Bank- & kaartkosten', group: 'fixed' },
  groceries: { label: 'Boodschappen', group: 'variable' },
  dining: { label: 'Uit eten & bestellen', group: 'variable' },
  transport: { label: 'Vervoer & parkeren', group: 'variable' },
  travel: { label: 'Vakantie & verblijf', group: 'variable' },
  shopping: { label: 'Winkelen & kleding', group: 'variable' },
  home: { label: 'Huis & huishouden', group: 'variable' },
  health: { label: 'Zorg & verzorging', group: 'variable' },
  entertainment: { label: 'Uitjes & entertainment', group: 'variable' },
  bike: { label: 'Fietsen', group: 'sport' },
  run: { label: 'Hardlopen', group: 'sport' },
  swim: { label: 'Zwemmen', group: 'sport' },
  race: { label: 'Wedstrijden & bond', group: 'sport' },
  coaching: { label: 'Coaching & training', group: 'sport' },
  nutrition: { label: 'Sportvoeding', group: 'sport' },
  gear: { label: 'Uitrusting', group: 'sport' },
  fitness: { label: 'Fitness & overige sport', group: 'sport' },
  streaming: { label: 'Streaming & media', group: 'subscriptions' },
  software: { label: 'Softwareabonnementen', group: 'subscriptions' },
  digital: { label: 'Software- & cloudgebruik', group: 'variable' },
  tech: { label: 'Technologie & elektronica', group: 'variable' },
  education: { label: 'Studie & werk', group: 'other' },
  shared: { label: 'Gedeelde uitgaven', group: 'other' },
  sharedrefund: { label: 'Geld teruggekregen', group: 'other' },
  cash: { label: 'Contante opname', group: 'other' },
  leisure: { label: 'Overige bestedingen', group: 'other' },
  unknown: { label: 'Onbekende uitgave', group: 'other' },
  salary: { label: 'Salaris', group: 'income' },
  benefits: { label: 'Toeslagen', group: 'income' },
  taxback: { label: 'Belastingteruggave', group: 'income' },
  study: { label: 'Studiefinanciering', group: 'income' },
  reimbursement: { label: 'Declaraties & vergoedingen', group: 'income' },
  otherincome: { label: 'Overige ontvangsten', group: 'income' },
  gift: { label: 'Giften', group: 'income' },
  transfer: { label: 'Kruispost', group: 'ignored' },
  pending: { label: 'Mogelijke kruispost', group: 'ignored' },
};

export const categories = { ...baseCategories };

export const categoryLabel = (category: string) => categories[category]?.label ?? category;
export const groupOf = (category: string) => categories[category]?.group ?? 'other';
export const isProtectedBudget = (category: string) => groupOf(category) === 'fixed' || category === 'health';
export const dashboardGroups = groups.filter(([id]) => id !== 'ignored');
export const groupLabel = (key: string) => groups.find(([id]) => id === key)?.[1] ?? key;

export interface CategoryCollection {
  label: string;
  group: Group;
  categories: string[];
}

export interface CategoryPresentation {
  labels: Record<string, string>;
  collections: Record<string, CategoryCollection>;
  featuredCollection?: string;
}

export const categoryCollections: Record<string, CategoryCollection> = Object.create(null);

export function presentCategories({ labels, collections }: CategoryPresentation) {
  for (const [id, category] of Object.entries(baseCategories)) {
    categories[id] = labels[id] ? { ...category, label: labels[id] } : category;
  }
  for (const id of Object.keys(categoryCollections)) delete categoryCollections[id];
  Object.assign(categoryCollections, collections);
}

export const kinds = {
  expense: 'Uitgave', income: 'Inkomst', refund: 'Teruggave',
  transfer: 'Kruispost', pending: 'Mogelijke kruispost',
} as const;

export function categoriesFor(kind: keyof typeof kinds) {
  return Object.entries(categories).filter(([id, category]) => {
    if (kind === 'transfer' || kind === 'pending') return id === kind;
    if (kind === 'income') return category.group === 'income';
    return category.group !== 'income' && category.group !== 'ignored';
  });
}
