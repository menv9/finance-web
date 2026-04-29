export const TOUR_STEPS = [
  {
    route: '/dashboard',
    page: 'Dashboard',
    stops: [
      {
        tourId: 'dashboard-kpis',
        label: 'Key figures',
        desc: 'Your four main numbers at a glance: cash balance, monthly income, monthly expenses, and net savings. These update in real time as you log transactions.',
      },
      {
        tourId: 'dashboard-networth',
        label: 'Net worth',
        desc: 'Tracks your total net worth over time — assets minus liabilities. As you add savings and portfolio holdings, this chart grows automatically.',
      },
      {
        tourId: 'dashboard-cashflow',
        label: 'Income vs. expenses',
        desc: 'A side-by-side comparison of what you earn and what you spend each month. Spot patterns and see whether you\'re consistently saving.',
      },
      {
        tourId: 'dashboard-activity',
        label: 'Recent activity',
        desc: 'A live feed of your latest transactions across all categories. Click any entry to edit or delete it.',
      },
    ],
  },
  {
    route: '/income',
    page: 'Income',
    stops: [
      {
        tourId: 'income-stats',
        label: 'Income summary',
        desc: 'Total income this month, average monthly income, and your biggest income source — all at a glance.',
      },
      {
        tourId: 'income-chart',
        label: 'Income trend',
        desc: 'See how your income has evolved over the past months. Useful for spotting seasonal patterns or growth in earnings.',
      },
      {
        tourId: 'income-fixed',
        label: 'Fixed income',
        desc: 'Recurring income sources like salary or rent — logged once, counted every month automatically. Add your regular earnings here.',
      },
      {
        tourId: 'income-log',
        label: 'Income log',
        desc: 'Every income entry you\'ve made, filterable by month. Click the + button in the header to add a new one.',
      },
    ],
  },
  {
    route: '/expenses',
    page: 'Expenses',
    stops: [
      {
        tourId: 'expenses-stats',
        label: 'Spending summary',
        desc: 'Total spent this month, daily average, and your top spending category. Helps you stay aware of where money is going.',
      },
      {
        tourId: 'expenses-breakdown',
        label: 'Category breakdown',
        desc: 'A visual split of your spending by category. Quickly identify which areas are consuming the most budget.',
      },
      {
        tourId: 'expenses-recurring',
        label: 'Recurring bills',
        desc: 'Fixed monthly expenses like subscriptions or rent — logged once and tracked automatically. Keep your recurring costs visible here.',
      },
      {
        tourId: 'expenses-log',
        label: 'Expense log',
        desc: 'The full list of your expenses. Use the month selector to browse history, and the + button to add new entries.',
      },
    ],
  },
  {
    route: '/budgets',
    page: 'Budgets',
    stops: [
      {
        tourId: 'budgets-stats',
        label: 'Budget overview',
        desc: 'See at a glance how much of your total budget you\'ve used and how much is left for the month.',
      },
      {
        tourId: 'budgets-cards',
        label: 'Category budgets',
        desc: 'Set a spending limit for each category. The progress bars fill as you spend — go green when on track, red when over.',
      },
    ],
  },
  {
    route: '/savings',
    page: 'Savings',
    stops: [
      {
        tourId: 'savings-stats',
        label: 'Savings summary',
        desc: 'Total saved, your savings rate, and how you\'re trending versus last month — all in one row.',
      },
      {
        tourId: 'savings-projection',
        label: 'Savings projection',
        desc: 'Based on your current savings rate, this chart shows where you\'ll be in 12 months. Adjust your habits and watch the projection update.',
      },
      {
        tourId: 'savings-buckets',
        label: 'Savings goals',
        desc: 'Create named buckets for specific goals — emergency fund, vacation, new laptop. Track progress and add deposits to each.',
      },
    ],
  },
  {
    route: '/portfolio',
    page: 'Portfolio',
    stops: [
      {
        tourId: 'portfolio-stats',
        label: 'Portfolio summary',
        desc: 'Total portfolio value, overall gain/loss, and today\'s change. Prices are updated automatically from market data.',
      },
      {
        tourId: 'portfolio-holdings',
        label: 'Holdings',
        desc: 'Your individual positions — stocks, ETFs, crypto — with current price, quantity, and performance. Add holdings with the + button.',
      },
      {
        tourId: 'portfolio-allocation',
        label: 'Allocation',
        desc: 'A breakdown of your portfolio by asset type or sector. Useful for checking diversification at a glance.',
      },
    ],
  },
  {
    route: '/settings',
    page: 'Settings',
    stops: [
      {
        tourId: 'settings-appearance',
        label: 'Appearance',
        desc: 'Switch between light and dark theme, change your display currency, and pick your preferred date and number formats.',
      },
      {
        tourId: 'settings-modules',
        label: 'Modules',
        desc: 'Turn features on or off to keep the app focused. Hide Portfolio if you don\'t invest, or Budgets if you prefer a looser approach.',
      },
      {
        tourId: 'settings-history',
        label: 'Data history',
        desc: 'Browse and manage all your stored transactions. Export to CSV for use in spreadsheets.',
      },
      {
        tourId: 'settings-backup',
        label: 'Backup & sync',
        desc: 'Connect a Supabase account to sync your data across devices, or export a local backup at any time.',
      },
    ],
  },
];
