import { useEffect, useMemo, useState } from 'react';
import LWGroupedHistogram from '../components/charts/LWGroupedHistogram';
import { useFinanceStore } from '../store/useFinanceStore';
import { buildDividendIncomeRows } from '../utils/finance';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { chartMonthLabel, normalizeDateInput } from '../utils/dates';
import { Card, Stat, EmptyState } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { MonthSelector } from '../components/MonthSelector';
import { rise } from '../utils/motion';
import { useTranslation } from '../i18n/useTranslation';

function currentMonthKey() {
  return normalizeDateInput(new Date()).slice(0, 7);
}

const PAGE_SIZE = 10;

function Pagination({ page, totalPages, onPrev, onNext, t }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={page === 1}
        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {t('thisMonth.pagination.previous')}
      </button>
      <span className="tabular text-ink-muted">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page === totalPages}
        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {t('thisMonth.pagination.next')}
      </button>
    </div>
  );
}

// Progress-bar cell that contextualises the cashflow number with income as denominator
function CashflowIncomeCell({ incomeCents, cashflowCents, currency, locale, className, t }) {
  const incomeTotalCents = Math.max(incomeCents, 0);
  // spentCents = everything that left income (expenses + saved + invested)
  const spentCents = Math.max(incomeCents - cashflowCents, 0);
  const isOver = cashflowCents < 0;
  const differenceCents = Math.abs(cashflowCents);
  const fillPercent = incomeTotalCents > 0 ? Math.min((spentCents / incomeTotalCents) * 100, 100) : 100;

  return (
    <div className={`min-w-0 bg-surface p-6 ${className || ''}`}>
      <p className="eyebrow mb-3">{t('thisMonth.kpiNetCashflow')}</p>
      {incomeTotalCents > 0 ? (
        <>
          <p className="text-sm text-ink mb-3">
            {t('thisMonth.cashflowSpentOf', {
              spent: <span key="spent" className="font-semibold numeric">{formatCurrency(spentCents, currency, locale)}</span>,
              income: <span key="income" className="font-semibold numeric">{formatCurrency(incomeTotalCents, currency, locale)}</span>,
            })}
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-danger' : 'bg-accent'}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p className={`mt-2.5 text-sm font-semibold numeric ${isOver ? 'text-danger' : 'text-positive'}`}>
            {isOver
              ? t('thisMonth.cashflowOver', { amount: `+${formatCurrency(differenceCents, currency, locale).replace(/^[−-]/, '')}` })
              : t('thisMonth.cashflowLeft', { amount: formatCurrency(differenceCents, currency, locale) })}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t('thisMonth.noIncome')}</p>
      )}
    </div>
  );
}

function monthDisplayLabel(month, locale) {
  if (!month) return '';
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, m - 1, 1),
  );
}

export default function ThisMonthPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [activityPage, setActivityPage] = useState(1);
  useEffect(() => { setActivityPage(1); }, [selectedMonth]);

  const { t, locale } = useTranslation();

  const dashboard = useFinanceStore((s) => s.derived.dashboard);
  const incomes = useFinanceStore((s) => s.incomes);
  const expenses = useFinanceStore((s) => s.expenses);
  const transfers = useFinanceStore((s) => s.transfers);
  const savingsEntries = useFinanceStore((s) => s.savingsEntries);
  const portfolioCashflows = useFinanceStore((s) => s.portfolioCashflows);
  const dividends = useFinanceStore((s) => s.dividends);
  const settings = useFinanceStore((s) => s.settings);

  const currency = settings.baseCurrency;

  // Compute monthly KPIs from raw data for the selected month
  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    // Expenses paid from savings shouldn't count toward the monthly expense
    // total — the money already left "savings" balance, not the bank. Hybrid:
    // legacy transfer-linked expense IDs + new-style savings entries with
    // kind === 'expense'.
    const savingsPaidExpenseIds = new Set([
      ...transfers
        .filter((t) => t.fromModule === 'savings' && t.toModule === 'expenses')
        .map((t) => t.linkedExpenseId)
        .filter(Boolean),
      ...(savingsEntries || [])
        .filter((e) => e.kind === 'expense' && e.expenseId)
        .map((e) => e.expenseId),
    ]);

    // Exclude transfer incomes (legacy savings withdrawals) — they affect balance
    // but should not inflate monthly cashflow/income metrics. New-style
    // withdrawals create no income row, so this only matters for legacy data.
    const dividendIncomeRows = buildDividendIncomeRows(dividends);
    const monthIncomes = [...incomes, ...dividendIncomeRows].filter(
      (e) =>
        (e.accountingMonth || e.date?.slice(0, 7)) === selectedMonth &&
        e.incomeKind !== 'transfer',
    );
    const monthCashflowIncomes = monthIncomes.filter((e) => e.incomeKind !== 'portfolio_sale');
    const monthExpenses = expenses.filter(
      (e) => e.date?.slice(0, 7) === selectedMonth && !savingsPaidExpenseIds.has(e.id),
    );
    const monthTransfers = transfers.filter((t) => t.date?.startsWith(selectedMonth) && t.date <= today);

    const incomeCents = monthIncomes.reduce((s, e) => s + (e.amountCents || 0), 0);
    const cashflowIncomeCents = monthCashflowIncomes.reduce((s, e) => s + (e.amountCents || 0), 0);
    const expenseCents = monthExpenses.reduce((s, e) => s + (e.amountCents || 0), 0);

    // Cashflow → portfolio. Hybrid: legacy transfer rows + new-style cashflows.
    const isCashflowSource = (t) => t.fromModule === 'income' || t.fromModule === 'cashflow';
    const legacyDistToPortfolio = monthTransfers
      .filter((t) => isCashflowSource(t) && t.toModule === 'portfolio')
      .reduce((s, t) => s + (t.amountCents || 0), 0);
    const newDistToPortfolio = (portfolioCashflows || [])
      .filter((cf) =>
        cf.date?.startsWith(selectedMonth)
        && cf.kind === 'buy' && cf.source === 'cashflow',
      )
      .reduce((s, cf) => s - (cf.amountCents || 0), 0);
    const distributedToPortfolioCents = legacyDistToPortfolio + newDistToPortfolio;

    // Net savings flow: only true deposits/withdrawals from cashflow side.
    // Exclude allocation releases and new-style typed entries (those represent
    // money moving between modules, not "saved this month").
    const netSavedThisMonthCents = (savingsEntries || [])
      .filter((e) =>
        (e.accountingMonth || e.date?.slice(0, 7)) === selectedMonth
        && e.source !== 'allocation'
        && !e.kind,
      )
      .reduce((s, e) => s + (e.amountCents || 0), 0);

    // Cashflow = money left to spend after expenses, savings, and investments.
    // Expenses are stored as positive amounts, so they reduce cashflow.
    const cashflowCents =
      cashflowIncomeCents -
      expenseCents -
      netSavedThisMonthCents -
      distributedToPortfolioCents;

    return {
      incomeCents,
      expenseCents,
      cashflowCents,
      savedCents: netSavedThisMonthCents,
      investedCents: distributedToPortfolioCents,
    };
  }, [incomes, dividends, expenses, transfers, savingsEntries, portfolioCashflows, selectedMonth]);

  // Combined activity log for the selected month
  const activityLog = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = [];

    [...incomes, ...buildDividendIncomeRows(dividends)]
      .filter(
        (e) =>
          (e.accountingMonth || e.date?.slice(0, 7)) === selectedMonth && e.date <= today,
      )
      .forEach((e) =>
        rows.push({
          id: e.id,
          type: 'income',
          date: e.date,
          label: e.source || 'Income',
          amountCents: e.amountCents,
          direction: 'in',
        }),
      );

    expenses
      .filter((e) => e.date?.slice(0, 7) === selectedMonth && e.date <= today)
      .forEach((e) =>
        rows.push({
          id: e.id,
          type: 'expense',
          date: e.date,
          label: e.description || e.category || 'Expense',
          amountCents: e.amountCents,
          direction: 'out',
        }),
      );

    // Legacy transfers (kept for historical data continuity)
    transfers
      .filter((t) => t.date?.startsWith(selectedMonth) && t.date <= today)
      .forEach((t) =>
        rows.push({
          id: t.id,
          type: 'transfer',
          date: t.date,
          label: t.description || `${t.fromModule} → ${t.toModule}`,
          amountCents: t.amountCents,
          direction: 'out',
        }),
      );

    // New-style typed savings entries surface the underlying movement
    (savingsEntries || [])
      .filter((e) =>
        (e.accountingMonth || e.date?.slice(0, 7)) === selectedMonth && e.date <= today
        && e.kind && !e.transferId,
      )
      .forEach((e) =>
        rows.push({
          id: e.id,
          type: 'savings_movement',
          date: e.date,
          label: e.note || e.kind,
          amountCents: Math.abs(e.amountCents || 0),
          direction: e.kind === 'withdrawal' ? 'in' : 'out',
        }),
      );

    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [incomes, dividends, expenses, transfers, savingsEntries, selectedMonth]);

  // 12-month bar chart data + selected month highlight label
  const chartData = dashboard.cashflowSeries || [];
  const selectedMonthChartLabel = chartMonthLabel(`${selectedMonth}-01`);

  const lwCashflowData = useMemo(() =>
    chartData.map((entry) => ({
      time: `${entry.key}-01`,
      incomeCents: entry.incomeCents,
      expenseCents: entry.expenseCents,
      isSelected: entry.month === selectedMonthChartLabel,
    })),
  [chartData, selectedMonthChartLabel]);

  const selectedChartTime = lwCashflowData.find((d) => d.isSelected)?.time ?? null;

  const savedHint = metrics.savedCents >= 0
    ? t('thisMonth.kpiSaved.hintPositive')
    : t('thisMonth.kpiSaved.hintNegative');

  const savedInvestedKpis = [
    {
      label: t('thisMonth.kpiSaved.label'),
      value: metrics.savedCents,
      hint: savedHint,
      info: t('thisMonth.kpiSaved.info'),
    },
    {
      label: t('thisMonth.kpiInvested.label'),
      value: metrics.investedCents,
      hint: t('thisMonth.kpiInvested.hint'),
      info: t('thisMonth.kpiInvested.info'),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="02"
        eyebrow={monthDisplayLabel(selectedMonth, locale)}
        title={t('thisMonth.title')}
        description={t('thisMonth.description')}
        className="mb-0 pb-6"
        actions={
          <MonthSelector
            id="this-month-selector"
            value={selectedMonth}
            onChange={setSelectedMonth}
            className="mt-8 w-full"
          />
        }
      />

      {/* Monthly KPIs */}
      <section
        aria-label={t('thisMonth.monthlySection')}
        data-tour="this-month-kpis"
        className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-3"
      >
        <div className={`min-w-0 bg-surface p-6 ${rise(1)}`}>
          <Stat
            label={t('thisMonth.kpiIncome.label')}
            value={metrics.incomeCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={t('thisMonth.kpiIncome.hint')}
            info={t('thisMonth.kpiIncome.info')}
            animate
          />
        </div>
        <div className={`min-w-0 bg-surface p-6 ${rise(2)}`}>
          <Stat
            label={t('thisMonth.kpiExpenses.label')}
            value={metrics.expenseCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={t('thisMonth.kpiExpenses.hint')}
            info={t('thisMonth.kpiExpenses.info')}
            animate
          />
        </div>
        <CashflowIncomeCell
          incomeCents={metrics.incomeCents}
          cashflowCents={metrics.cashflowCents}
          currency={currency}
          locale={locale}
          className={rise(3)}
          t={t}
        />
      </section>

      {/* Saved / Invested */}
      <section className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-2">
        {savedInvestedKpis.map((kpi, i) => (
          <div key={kpi.label} className={`min-w-0 bg-surface p-6 ${rise(i + 4)}`}>
            <Stat
              label={kpi.label}
              value={kpi.value}
              mode="currency"
              currency={currency}
              locale={locale}
              hint={kpi.hint}
              info={kpi.info}
              animate
            />
          </div>
        ))}
      </section>

      {/* 12-month bar chart */}
      <Card
        data-tour="this-month-chart"
        eyebrow={t('thisMonth.chartCard.eyebrow')}
        title={t('thisMonth.chartCard.title')}
        description={t('thisMonth.chartCard.description')}
        variant="chart"
        className={rise(5)}
      >
        {lwCashflowData.length ? (
          <LWGroupedHistogram
            seriesA={{ data: lwCashflowData.map((d) => ({ time: d.time, value: d.incomeCents })), color: 'var(--accent)' }}
            seriesB={{ data: lwCashflowData.map((d) => ({ time: d.time, value: d.expenseCents })), color: 'var(--danger)' }}
            selectedTime={selectedChartTime}
            priceFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
          />
        ) : (
          <EmptyState title={t('thisMonth.chartCard.emptyTitle')} description={t('thisMonth.chartCard.emptyDescription')} />
        )}
      </Card>

      {/* Activity log */}
      <Card
        data-tour="this-month-activity"
        eyebrow={t('thisMonth.activityCard.eyebrow')}
        title={t('thisMonth.activityCard.transactionsIn', { month: monthDisplayLabel(selectedMonth, locale) })}
        className={rise(6)}
      >
        {activityLog.length ? (
          <>
          <ul className="divide-y divide-rule">
            {activityLog.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE).map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{item.label}</p>
                  <p className="eyebrow mt-1">
                    {item.type} ·{' '}
                    {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(
                      new Date(item.date),
                    )}
                  </p>
                </div>
                <span
                  className={`numeric text-sm tabular rounded px-1.5 py-0.5 ${
                    item.direction === 'in'
                      ? 'text-positive bg-positive-soft'
                      : item.type === 'transfer'
                        ? 'text-ink-muted bg-surface-raised'
                        : 'text-danger bg-danger-soft'
                  }`}
                >
                  {item.direction === 'in' ? '+' : '−'}
                  {formatCurrency(Math.abs(item.amountCents), currency, locale).replace(
                    /^[−-]/,
                    '',
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Pagination
            page={activityPage}
            totalPages={Math.ceil(activityLog.length / PAGE_SIZE)}
            onPrev={() => setActivityPage((p) => Math.max(1, p - 1))}
            onNext={() => setActivityPage((p) => Math.min(Math.ceil(activityLog.length / PAGE_SIZE), p + 1))}
            t={t}
          />
          </>
        ) : (
          <EmptyState
            title={t('thisMonth.activityCard.emptyTitle')}
            description={t('thisMonth.activityCard.emptyDescription')}
          />
        )}
      </Card>
    </div>
  );
}
