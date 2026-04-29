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
    amountCents: sumAmount(incomes.filter((income) => (income.accountingMonth || monthKey(income.date)) === month.key)),
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
  const activeHoldings = holdings.filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0);
  const currentValueCents = activeHoldings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.currentPriceCents || 0)),
    0,
  );
  const investedCents = activeHoldings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.averageBuyPriceCents || 0)) + (holding.feeCents || 0),
    0,
  );
  const pnlCents = currentValueCents - investedCents;
  const pnlPercent = investedCents ? (pnlCents / investedCents) * 100 : 0;
  const dividendIncomeCents = sumAmount(dividends);
  const dividendYield = currentValueCents ? (dividendIncomeCents / currentValueCents) * 100 : 0;

  const allocationByTicker = activeHoldings.reduce((groups, holding) => {
    const valueCents = Math.round(holding.quantity * (holding.currentPriceCents || 0));
    const current = groups.get(holding.ticker) || {
      ticker: holding.ticker,
      name: holding.name,
      valueCents: 0,
    };
    groups.set(holding.ticker, {
      ...current,
      valueCents: current.valueCents + valueCents,
    });
    return groups;
  }, new Map());

  const allocationActual = [...allocationByTicker.values()].map((holding) => {
    const target = targets.find((item) => item.ticker === holding.ticker || item.ticker === holding.ticker.split('.')[0]);
    return {
      ...holding,
      actualWeight: currentValueCents ? (holding.valueCents / currentValueCents) * 100 : 0,
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

// "TWRR" here is an approximation: true time-weighted return needs periodic
// portfolio snapshots which we don't store. We use simple price-return on cost
// basis — (current value − cost basis) / cost basis — which removes the impact
// of additional contributions because cost basis already grew with each buy.
export function computeTWRR(holdings, cashflows) {
  void cashflows;
  const activeHoldings = holdings.filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0);
  const investedCents = activeHoldings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.averageBuyPriceCents || 0)) + (holding.feeCents || 0),
    0,
  );
  const currentValueCents = activeHoldings.reduce(
    (total, holding) => total + Math.round(holding.quantity * (holding.currentPriceCents || 0)),
    0,
  );
  if (!investedCents) return 0;
  return ((currentValueCents - investedCents) / investedCents) * 100;
}

export function computeXIRR(cashflows, endingValueCents) {
  if (!cashflows.length || !endingValueCents) return 0;

  // Convention: deposits (money in) are negative; ending value (money back) is positive.
  // Stored portfolioCashflows already follow this convention (executeTransfer
  // writes deposits as negative). Preserve the original sign so that any future
  // withdrawal entries (positive stored amount) don't get flipped back to a
  // deposit by a blanket -Math.abs(...).
  const datedFlows = [
    ...cashflows.map((flow) => ({
      date: flow.date,
      amountCents: flow.amountCents,
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

function portfolioSaleCashflowCents(sale) {
  return Math.max(sale.proceedsCents || 0, 0);
}

export function computeDashboardData({ expenses, incomes, fixedExpenses, holdings, dividends, portfolioCashflows, portfolioSales = [], savingsConfig, savingsEntries, transfers = [] }) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const today = format(new Date(), 'yyyy-MM-dd');
  const allPastIncomes = incomes.filter((item) => item.date <= today);
  const allPastCashflowIncomes = allPastIncomes.filter((item) => item.incomeKind !== 'portfolio_sale');
  const savingsPaidExpenseIds = new Set(
    (transfers || [])
      .filter((t) => t.fromModule === 'savings' && t.toModule === 'expenses')
      .map((t) => t.linkedExpenseId)
      .filter(Boolean),
  );
  const allPastCashflowExpenses = expenses.filter((item) => item.date <= today && !savingsPaidExpenseIds.has(item.id));
  const allPastSaleCashflowCents = (portfolioSales || [])
    .filter((sale) => sale.date <= today)
    .reduce((sum, sale) => sum + portfolioSaleCashflowCents(sale), 0);
  const allPastCashflowDistributionsCents = (transfers || [])
    .filter((t) => t.date <= today && (t.fromModule === 'income' || t.fromModule === 'cashflow'))
    .filter((t) => t.toModule === 'savings' || t.toModule === 'portfolio')
    .reduce((sum, t) => sum + (t.amountCents || 0), 0);
  const allPastDirectSavingsCents = (savingsEntries || [])
    .filter((e) => e.date <= today && !e.transferId)
    .reduce((sum, e) => sum + (e.amountCents || 0), 0);
  const availableBalanceCents =
    sumAmount(allPastCashflowIncomes) +
    allPastSaleCashflowCents -
    sumAmount(allPastCashflowExpenses) -
    allPastCashflowDistributionsCents -
    allPastDirectSavingsCents;

  const currentMonthExpenses = expenses.filter((item) => monthKey(item.date) === currentMonth && item.date <= today);
  const currentMonthIncomes  = incomes.filter((item)  => (item.accountingMonth || monthKey(item.date)) === currentMonth && item.date <= today);
  const currentMonthCashflowIncomes = currentMonthIncomes.filter((item) => item.incomeKind !== 'portfolio_sale');
  const currentMonthSaleCashflowCents = (portfolioSales || [])
    .filter((sale) => monthKey(sale.date) === currentMonth && sale.date <= today)
    .reduce((sum, sale) => sum + portfolioSaleCashflowCents(sale), 0);

  // Fix: only count actually-logged expenses. Adding fixedMonthlyCents on top
  // double-counts recurring bills that were already saved as expense entries.
  const totalExpensesCents = sumAmount(currentMonthExpenses);
  const totalIncomeCents   = sumAmount(currentMonthIncomes);
  const cashflowIncomeCents = sumAmount(currentMonthCashflowIncomes);

  // Distributions this month (income → savings / portfolio) are money you've
  // deliberately set aside — they're no longer "usable" discretionary cash.
  const thisMonthTransfers = (transfers || []).filter((t) => t.date?.startsWith(currentMonth));
  const isCashflowSource = (t) => t.fromModule === 'income' || t.fromModule === 'cashflow';
  const distributedToSavingsCents = thisMonthTransfers
    .filter((t) => isCashflowSource(t) && t.toModule === 'savings')
    .reduce((s, t) => s + t.amountCents, 0);
  const distributedToPortfolioCents = thisMonthTransfers
    .filter((t) => isCashflowSource(t) && t.toModule === 'portfolio')
    .reduce((s, t) => s + t.amountCents, 0);

  // Directly-logged savings entries this month are money set aside from cashflow,
  // just like transfers to savings — deduct them so cashflow reflects what's
  // actually left to spend. Exclude transfer-linked entries (transferId is set)
  // since those are already captured by distributedToSavingsCents above.
  const savedThisMonthCents = (savingsEntries || [])
    .filter((e) => e.date?.startsWith(currentMonth) && e.date <= today && !e.transferId)
    .reduce((s, e) => s + (e.amountCents || 0), 0);

  // Cashflow = money actually left to spend (income − expenses − saved − invested).
  const distributedTotalCents = distributedToSavingsCents + distributedToPortfolioCents;
  const cashflowCents      = cashflowIncomeCents + currentMonthSaleCashflowCents - totalExpensesCents - distributedTotalCents - savedThisMonthCents;
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
  const monthlyCashflowIncome = computeIncomeSeries(incomes.filter((item) => item.incomeKind !== 'portfolio_sale'));

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
      netWorthCents: Math.max(0, netWorthCents - subsequentCashflow),
    };
  });

  const cashflowSeries = monthlyCashflowIncome.map((incomePoint, index) => {
    const month = lastTwelveMonths()[index];
    const saleCashflowCents = (portfolioSales || [])
      .filter((sale) => monthKey(sale.date) === month.key)
      .reduce((sum, sale) => sum + portfolioSaleCashflowCents(sale), 0);
    return {
      month: incomePoint.month,
      incomeCents: incomePoint.amountCents + saleCashflowCents,
      expenseCents: monthlyExpenses[index]?.amountCents || 0,
    };
  });

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

  return {
    netWorthCents,
    cashflowCents,
    availableBalanceCents,
    savingsBalanceCents: savingsBalance,
    savingsRate,
    portfolioPnlMonthCents: portfolio.pnlCents,
    expenseSeries: monthlyExpenses,
    incomeSeries: monthlyIncome,
    netWorthSeries,
    cashflowSeries,
    upcomingEvents,
    totalIncomeCents,
    portfolioSaleCashflowCents: currentMonthSaleCashflowCents,
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
