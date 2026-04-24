import { differenceInCalendarDays, format, isWithinInterval, parseISO } from 'date-fns';
import { lastTwelveMonths, monthKey, upcomingWithinDays } from './dates';

function sumAmount(items) {
  return items.reduce((total, item) => total + (item.amountCents || 0), 0);
}

export function computeExpenseSeries(expenses) {
  return lastTwelveMonths().map((month) => ({
    month: month.label,
    amountCents: sumAmount(expenses.filter((expense) => monthKey(expense.date) === month.key)),
  }));
}

export function computeIncomeSeries(incomes) {
  return lastTwelveMonths().map((month) => ({
    month: month.label,
    amountCents: sumAmount(incomes.filter((income) => monthKey(income.date) === month.key)),
  }));
}

export function categoryBreakdown(expenses) {
  const byCategory = expenses.reduce((accumulator, expense) => {
    accumulator[expense.category] = (accumulator[expense.category] || 0) + expense.amountCents;
    return accumulator;
  }, {});

  return Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

export function computePortfolioMetrics(holdings, dividends, cashflows, targets = []) {
  const currentValueCents = holdings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.currentPriceCents || 0)),
    0,
  );
  const investedCents = holdings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.averageBuyPriceCents || 0)),
    0,
  );
  const pnlCents = currentValueCents - investedCents;
  const pnlPercent = investedCents ? (pnlCents / investedCents) * 100 : 0;
  const dividendIncomeCents = sumAmount(dividends);
  const dividendYield = currentValueCents ? (dividendIncomeCents / currentValueCents) * 100 : 0;

  const allocationActual = holdings.map((holding) => {
    const valueCents = Math.round(holding.quantity * (holding.currentPriceCents || 0));
    const target = targets.find((item) => item.ticker === holding.ticker || item.ticker === holding.ticker.split('.')[0]);
    return {
      ticker: holding.ticker,
      name: holding.name,
      valueCents,
      actualWeight: currentValueCents ? (valueCents / currentValueCents) * 100 : 0,
      targetWeight: target?.targetWeight || 0,
    };
  });

  return {
    currentValueCents,
    investedCents,
    pnlCents,
    pnlPercent,
    dividendIncomeCents,
    dividendYield,
    twrr: computeTWRR(holdings, cashflows),
    xirr: computeXIRR(cashflows, currentValueCents),
    allocationActual,
  };
}

export function computeTWRR(holdings, cashflows) {
  const investedCents = holdings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.averageBuyPriceCents || 0)),
    0,
  );
  const currentValueCents = holdings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.currentPriceCents || 0)),
    0,
  );
  const externalFlows = cashflows.reduce((total, flow) => total + flow.amountCents, 0);
  if (!investedCents) return 0;
  return ((currentValueCents + externalFlows) / investedCents - 1) * 100;
}

export function computeXIRR(cashflows, endingValueCents) {
  if (!cashflows.length || !endingValueCents) return 0;

  // Convention: deposits (money in) are negative; ending value (money back) is positive.
  // Flip stored deposit signs so Newton's method has opposite signs to converge on.
  const datedFlows = [
    ...cashflows.map((flow) => ({
      date: flow.date,
      amountCents: -Math.abs(flow.amountCents),
    })),
    { date: new Date().toISOString().slice(0, 10), amountCents: Math.abs(endingValueCents) },
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // XIRR is undefined if all flows share a sign.
  const hasPositive = datedFlows.some((f) => f.amountCents > 0);
  const hasNegative = datedFlows.some((f) => f.amountCents < 0);
  if (!hasPositive || !hasNegative) return 0;

  const startDate = parseISO(datedFlows[0].date);
  const RATE_MIN = -0.9999;
  const RATE_MAX = 10;
  let rate = 0.1;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    let functionValue = 0;
    let derivativeValue = 0;

    for (const flow of datedFlows) {
      const years = differenceInCalendarDays(parseISO(flow.date), startDate) / 365;
      const base = 1 + rate;
      const denom = base ** years;
      if (!Number.isFinite(denom) || denom === 0) return 0;
      functionValue += flow.amountCents / denom;
      derivativeValue += (-years * flow.amountCents) / (base ** (years + 1));
    }

    if (!Number.isFinite(functionValue) || !Number.isFinite(derivativeValue)) return 0;
    if (Math.abs(derivativeValue) < 1e-10) return 0;

    let nextRate = rate - functionValue / derivativeValue;
    if (!Number.isFinite(nextRate)) return 0;
    if (nextRate < RATE_MIN) nextRate = RATE_MIN;
    if (nextRate > RATE_MAX) nextRate = RATE_MAX;

    if (Math.abs(nextRate - rate) < 1e-7) {
      // If we converged only because we hit the clamp, the true rate is outside a sane range.
      if (nextRate <= RATE_MIN + 1e-6 || nextRate >= RATE_MAX - 1e-6) return null;
      return nextRate * 100;
    }
    rate = nextRate;
  }

  return null;
}

export function computeDashboardData({ expenses, incomes, fixedExpenses, holdings, dividends, portfolioCashflows, savingsConfig, savingsEntries, transfers = [] }) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthExpenses = expenses.filter((item) => monthKey(item.date) === currentMonth);
  const currentMonthIncomes  = incomes.filter((item)  => monthKey(item.date) === currentMonth);

  // Fix: only count actually-logged expenses. Adding fixedMonthlyCents on top
  // double-counts recurring bills that were already saved as expense entries.
  const totalExpensesCents = sumAmount(currentMonthExpenses);
  const totalIncomeCents   = sumAmount(currentMonthIncomes);
  const cashflowCents      = totalIncomeCents - totalExpensesCents;
  const savingsRate        = totalIncomeCents ? (cashflowCents / totalIncomeCents) * 100 : 0;
  const portfolio          = computePortfolioMetrics(holdings, dividends, portfolioCashflows, []);

  // Fix: real net worth = savings balance (starting balance + logged entries) + portfolio.
  // The old formula (12-month cumulative cashflow + portfolio) ignored pre-existing
  // savings and only looked back 12 months.
  const savingsBalance =
    (savingsConfig?.currentBalanceCents || 0) +
    (savingsEntries || []).reduce((sum, e) => sum + (e.amountCents || 0), 0);
  const netWorthCents = savingsBalance + portfolio.currentValueCents;

  const monthlyExpenses = computeExpenseSeries(expenses);
  const monthlyIncome   = computeIncomeSeries(incomes);

  // Fix: build the net worth series by working BACKWARDS from the real current
  // net worth, subtracting each subsequent month's logged cashflow. This gives
  // a coherent historical view rather than adding a static portfolio value to
  // a rolling 12-month cashflow sum.
  const netWorthSeries = lastTwelveMonths().map((month, index) => {
    const subsequentCashflow =
      monthlyIncome.slice(index + 1).reduce((sum, item) => sum + item.amountCents, 0) -
      monthlyExpenses.slice(index + 1).reduce((sum, item) => sum + item.amountCents, 0);
    return {
      month: month.label,
      netWorthCents: netWorthCents - subsequentCashflow,
    };
  });

  const cashflowSeries = monthlyIncome.map((incomePoint, index) => ({
    month: incomePoint.month,
    incomeCents: incomePoint.amountCents,
    expenseCents: monthlyExpenses[index]?.amountCents || 0,
  }));

  const upcomingEvents = [
    ...fixedExpenses
      .filter((expense) => expense.active)
      .map((expense) => ({
        id: expense.id,
        type: 'fixed-expense',
        label: expense.name,
        amountCents: expense.amountCents,
        dueDate: upcomingWithinDays(expense.chargeDay),
      }))
      .filter((event) => event.dueDate),
    ...dividends
      .map((dividend) => ({
        id: dividend.id,
        type: 'dividend',
        label: `${dividend.ticker} dividend`,
        amountCents: dividend.amountCents,
        dueDate: parseISO(dividend.date),
      }))
      .filter((event) => isWithinInterval(event.dueDate, { start: new Date(), end: new Date(Date.now() + 7 * 86400000) })),
  ];

  // Income distribution this month (transfers from income → savings/portfolio)
  const thisMonthTransfers = (transfers || []).filter((t) => t.date?.startsWith(currentMonth));
  const distributedToSavingsCents = thisMonthTransfers
    .filter((t) => t.fromModule === 'income' && t.toModule === 'savings')
    .reduce((s, t) => s + t.amountCents, 0);
  const distributedToPortfolioCents = thisMonthTransfers
    .filter((t) => t.fromModule === 'income' && t.toModule === 'portfolio')
    .reduce((s, t) => s + t.amountCents, 0);

  return {
    netWorthCents,
    cashflowCents,
    savingsRate,
    portfolioPnlMonthCents: portfolio.pnlCents,
    expenseSeries: monthlyExpenses,
    incomeSeries: monthlyIncome,
    netWorthSeries,
    cashflowSeries,
    upcomingEvents,
    totalIncomeCents,
    distributedToSavingsCents,
    distributedToPortfolioCents,
  };
}

export function yearlySideIncome(incomes) {
  const currentYear = format(new Date(), 'yyyy');
  return incomes
    .filter((income) => income.incomeKind === 'variable' && income.date.startsWith(currentYear))
    .reduce((total, income) => total + income.amountCents, 0);
}
