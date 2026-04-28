export const DEFAULT_CATEGORIES = [
  'Vivienda',
  'Transporte',
  'Alimentacion',
  'Suscripciones',
  'Ocio',
  'Salud',
  'Otros',
];

export const DEFAULT_SETTINGS = {
  baseCurrency: 'EUR',
  locale: 'en-GB',
  theme: 'light',
  categories: DEFAULT_CATEGORIES,
  holdingPlatforms: ['Trade Republic', 'IBKR', 'DEGIRO'],
  alphaVantageApiKey: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  allocationTargets: [],
  csvMapping: {
    date: 'date',
    amount: 'amount',
    category: 'category',
    description: 'description',
    currency: 'currency',
  },
};

export const DEFAULT_DATA = {
  expenses: [],
  fixedExpenses: [],
  incomes: [],
  holdings: [],
  dividends: [],
  portfolioCashflows: [],
  portfolioSales: [],
  savingsEntries: [],
  budgets: [],
  rollovers: [],
  transfers: [],
  attachments: [],
};
