import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { useSortable } from '../hooks/useSortable';
import { sortRows } from '../utils/sort';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import LWHistogram from '../components/charts/LWHistogram';
import { MonthSelector } from '../components/MonthSelector';
import { PageHeader } from '../components/PageHeader';
import { IncomeForm } from '../components/forms/IncomeForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { buildDividendIncomeRows, computeIncomeSeries, isFixedIncomeSchedule, isReceivedIncome } from '../utils/finance';
import { normalizeDateInput } from '../utils/dates';
import { formatCurrency } from '../utils/formatters';
import { Card, Button, Stat, EmptyState, Modal, FormField, Input, Select } from '../components/ui';
import { rise } from '../utils/motion';
import { useTranslation } from '../i18n/useTranslation';

const COLORS = ['var(--accent)', '#8FB97E', '#C9A96E', '#7A9CC6', '#B48EAD'];

const PAGE_SIZE = 5;

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
        ‹ {t('common.previous')}
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
        {t('common.next')} ›
      </button>
    </div>
  );
}

function incomeReportMonth(row) {
  return row.accountingMonth || row.date?.slice(0, 7);
}

function addMonthsToMonth(month, offset) {
  const [year, monthNumber] = (month || '').split('-').map(Number);
  if (!year || !monthNumber) return month;
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthOffset(fromMonth, toMonth) {
  const [fromYear, fromMonthNumber] = (fromMonth || '').split('-').map(Number);
  const [toYear, toMonthNumber] = (toMonth || '').split('-').map(Number);
  if (!fromYear || !fromMonthNumber || !toYear || !toMonthNumber) return 0;
  return (toYear - fromYear) * 12 + (toMonthNumber - fromMonthNumber);
}

function fixedIncomeDueDate(schedule, month) {
  const configuredReceivedMonth = schedule.date?.slice(0, 7);
  const configuredReportMonth = schedule.accountingMonth || configuredReceivedMonth;
  const receivedMonthOffset = monthOffset(configuredReportMonth, configuredReceivedMonth);
  const receivedMonth = addMonthsToMonth(month, receivedMonthOffset);
  const fallbackDay = Number(schedule.date?.slice(8, 10)) || 1;
  const day = Math.min(Math.max(Number(schedule.payDay || fallbackDay), 1), 31);
  const lastDay = new Date(Number(receivedMonth.slice(0, 4)), Number(receivedMonth.slice(5, 7)), 0).getDate();
  return `${receivedMonth}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="M9.8 3.2 12.8 6 6 12.8l-3.4.7.7-3.4 6.5-6.9Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.7 4.4 2.9 2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="M3.5 4.5h9M6.5 2.5h3l.5 2M5 4.5l.5 9h5l.5-9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7v4M9 7v4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IncomeLedgerList({
  rows,
  currency,
  locale,
  selectable,
  selectedIds,
  onToggleRow,
  openEdit,
  onDeleteIncome,
  onMarkReceived,
  t,
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
      {rows.map((row) => {
        const isEditable = row.ledgerType === 'income' || row.ledgerType === 'fixed-schedule';
        const isPending = row.ledgerType === 'fixed-pending';
        const isPortfolioSaleLoss = row.incomeKind === 'portfolio_sale' && (row.realizedPnlCents || 0) < 0;
        const displayAmountCents = isPortfolioSaleLoss ? row.realizedPnlCents : row.amountCents;
        const amountClass = row.incomeKind === 'portfolio_sale'
          ? displayAmountCents > 0
            ? 'text-positive'
            : 'text-danger'
          : 'text-positive';
        return (
          <li
            key={row.id}
            className={selectable && selectedIds?.has(row.id) ? 'bg-accent-soft' : 'transition-colors duration-120 hover:bg-surface-raised'}
          >
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              {selectable ? (
                isEditable ? (
                  <input
                    type="checkbox"
                    aria-label={t('income.rowAriaSelect')}
                    checked={selectedIds?.has(row.id)}
                    onChange={() => onToggleRow?.(row.id)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-[color:var(--accent)]"
                  />
                ) : (
                  <span className="mt-1 block h-4 w-4 shrink-0" />
                )
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-4">
                  <p className="min-w-0 truncate text-sm text-ink">
                    {row.source || t('income.incomeFallback')}
                  </p>
                  <span
                    className={`numeric shrink-0 rounded px-1.5 py-0.5 text-sm tabular ${
                      amountClass === 'text-danger'
                        ? 'text-danger bg-danger-soft'
                        : 'text-positive bg-positive-soft'
                    }`}
                  >
                    {displayAmountCents >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(displayAmountCents), row.currency || currency, locale).replace(/^[−-]/, '')}
                  </span>
                </div>
                {incomeReportMonth(row) && incomeReportMonth(row) !== row.date?.slice(0, 7) ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    {t('income.reportsIn', { month: incomeReportMonth(row) })}
                  </p>
                ) : null}
                <div className="mt-1 flex min-w-0 items-center justify-between gap-4">
                  <p className="min-w-0 truncate eyebrow">
                    {row.incomeKind || 'income'} · {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(row.date))}
                  </p>
                  {isPending ? (
                    <div className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                      <button
                        type="button"
                        className="rounded-md border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent hover:border-accent"
                        onClick={() => onMarkReceived?.(row)}
                      >
                        {t('income.markReceived')}
                      </button>
                    </div>
                  ) : isEditable ? (
                    <div className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                        aria-label={t('income.rowAriaEdit')}
                        title={t('income.rowAriaEdit')}
                        onClick={() => openEdit(row.id)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                        aria-label={t('income.rowAriaDelete')}
                        title={t('income.rowAriaDelete')}
                        onClick={() => onDeleteIncome(row.id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-ink-faint">{row.ledgerType === 'portfolio-sale-cashflow' ? t('income.viaPortfolio') : ''}</span>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function IncomePage() {
  const { t, locale } = useTranslation();
  const incomes = useFinanceStore((state) => state.incomes);
  const dividends = useFinanceStore((state) => state.dividends);
  const bankAccounts = useFinanceStore((state) => state.bankAccounts || []);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const markFixedIncomeReceived = useFinanceStore((state) => state.markFixedIncomeReceived);
  const confirm = useConfirm();
  const [modal, setModal] = useState({ open: false, id: null });
  const [incomePage, setIncomePage] = useState(1);
  const currency = settings.baseCurrency;
  const editingIncome = incomes.find((income) => income.id === modal.id);

  const openNew = () => setModal({ open: true, id: null });
  const openEdit = (id) => setModal({ open: true, id });
  const close = () => setModal({ open: false, id: null });

  // ── Filters ──
  const [selectedMonth, setSelectedMonth] = useState(normalizeDateInput(new Date()).slice(0, 7));
  const [filterKind, setFilterKind] = useState('all');
  const [sourceSearch, setSourceSearch] = useState('');

  const incomeColumns = [
    { key: 'date', header: t('income.tableHeaders.received'), width: 110, sortable: true },
    {
      key: 'accountingMonth',
      header: t('income.tableHeaders.reportsIn'),
      width: 115,
      sortable: true,
      hideOnMobile: true,
      render: (r) => incomeReportMonth(r) || '-',
    },
    { key: 'source', header: t('income.tableHeaders.source'), sortable: true },
    {
      key: 'incomeKind',
      header: t('income.tableHeaders.kind'),
      sortable: true,
      hideOnMobile: true,
      render: (r) => (
        <span className="inline-flex items-center rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted border border-rule">
          {r.incomeKind}
        </span>
      ),
    },
    {
      key: 'details',
      header: t('income.tableHeaders.details'),
      hideOnMobile: true,
      render: (r) =>
        r.incomeKind === 'fixed'
          ? `${r.frequency} · day ${r.payDay}`
          : r.incomeKind === 'variable'
          ? `${r.client || '—'} · ${r.invoiceStatus || 'draft'}`
          : r.assetTicker || 'asset pending',
    },
    {
      key: 'amountCents',
      header: t('income.tableHeaders.amount'),
      numeric: true,
      sortable: true,
      render: (r) => {
        const isPortfolioSaleLoss = r.incomeKind === 'portfolio_sale' && (r.realizedPnlCents || 0) < 0;
        const displayAmountCents = isPortfolioSaleLoss ? r.realizedPnlCents : r.amountCents;
        return (
          <span
            className={
              r.incomeKind === 'portfolio_sale'
                ? displayAmountCents > 0
                  ? 'text-positive'
                  : 'text-danger'
                : 'text-positive'
            }
          >
            {formatCurrency(displayAmountCents, r.currency, locale)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noTruncate: true,
      render: (r) => (
        r.ledgerType === 'income' ? (
          <div className="flex flex-wrap justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(r.id)}>{t('common.edit')}</Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              if (await confirm({ title: t('income.confirmDeleteOne.title'), description: t('income.confirmDeleteOne.description') }))
                removeEntity('incomes', r.id);
            }}>{t('common.delete')}</Button>
          </div>
        ) : (
          <span className="text-xs text-ink-faint px-2 py-1">{t('income.viaPortfolio')}</span>
        )
      ),
    },
  ];

  const dividendIncomeRows = useMemo(() => buildDividendIncomeRows(dividends), [dividends]);

  const incomeLedgerRows = useMemo(
    () => [
      ...incomes.filter(isReceivedIncome).map((income) => ({ ...income, ledgerType: 'income' })),
      ...dividendIncomeRows,
    ],
    [dividendIncomeRows, incomes],
  );

  const fixedSchedules = useMemo(
    () =>
      incomes
        .filter(isFixedIncomeSchedule)
        .sort((a, b) => Number(a.payDay || 1) - Number(b.payDay || 1))
        .map((income) => ({ ...income, ledgerType: 'fixed-schedule' })),
    [incomes],
  );

  const pendingFixedRows = useMemo(() => {
    const today = normalizeDateInput(new Date());
    return fixedSchedules
      .filter((schedule) => fixedIncomeDueDate(schedule, selectedMonth) <= today)
      .filter((schedule) => !incomeLedgerRows.some((row) =>
        row.incomeKind === 'fixed_payment' &&
        row.fixedIncomeId === schedule.id &&
        incomeReportMonth(row) === selectedMonth
      ))
      .map((schedule) => ({
        ...schedule,
        id: `pending-${schedule.id}-${selectedMonth}`,
        fixedIncomeId: schedule.id,
        date: fixedIncomeDueDate(schedule, selectedMonth),
        accountingMonth: selectedMonth,
        incomeKind: 'fixed_pending',
        ledgerType: 'fixed-pending',
      }));
  }, [fixedSchedules, incomeLedgerRows, selectedMonth]);

  const filteredIncomeRows = useMemo(
    () =>
      incomeLedgerRows.filter(
        (row) =>
          incomeReportMonth(row) === selectedMonth &&
          !isFixedIncomeSchedule(row) &&
          (filterKind === 'all' || row.incomeKind === filterKind) &&
          (!sourceSearch || (row.source || '').toLowerCase().includes(sourceSearch.toLowerCase())),
      ),
    [filterKind, incomeLedgerRows, selectedMonth, sourceSearch],
  );

  const selectedMonthRows = useMemo(
    () => incomeLedgerRows.filter((row) =>
      incomeReportMonth(row) === selectedMonth &&
      row.incomeKind !== 'transfer' &&
      row.incomeKind !== 'portfolio_sale'
    ),
    [incomeLedgerRows, selectedMonth],
  );

  const { sortKey: incSortKey, sortDir: incSortDir, onSort: onIncSort } = useSortable('date', 'desc');
  const sortedIncomeRows = useMemo(
    () => sortRows(filteredIncomeRows, incSortKey, incSortDir),
    [filteredIncomeRows, incSortKey, incSortDir],
  );

  const batchSelect = useBatchSelect(sortedIncomeRows.filter((row) => row.ledgerType === 'income'));

  useEffect(() => { batchSelect.cancel(); }, [selectedMonth, filterKind, sourceSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setIncomePage(1); }, [selectedMonth, filterKind, sourceSearch]);

  const handleBatchDeleteIncomes = async () => {
    const ids = [...batchSelect.selectedIds];
    const ok = await confirm({
      title: t('income.confirmDeleteBatch.title', { count: ids.length, plural: ids.length !== 1 ? 's' : '' }),
      description: t('income.confirmDeleteBatch.description'),
    });
    if (!ok) return;
    for (const id of ids) await removeEntity('incomes', id);
    batchSelect.cancel();
  };

  const sourceBreakdown = useMemo(() => {
    const portfolioKinds = new Set(['dividend']);
    const totals = selectedMonthRows.reduce((acc, i) => {
      const key = portfolioKinds.has(i.incomeKind) ? 'Holdings' : i.source;
      acc[key] = (acc[key] || 0) + i.amountCents;
      return acc;
    }, {});
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [selectedMonthRows]);

  const selectedMonthIncome = selectedMonthRows.reduce((sum, row) => sum + row.amountCents, 0);
  const selectedMonthSideIncome = selectedMonthRows
    .filter((row) => row.incomeKind === 'variable')
    .reduce((sum, row) => sum + row.amountCents, 0);
  const topSource = sourceBreakdown.slice().sort((a, b) => b.value - a.value)[0];

  const lwIncomeData = useMemo(() =>
    computeIncomeSeries(incomes, dividendIncomeRows).map((entry) => ({
      time: `${entry.key}-01`,
      value: entry.amountCents,
    })),
  [incomes, dividendIncomeRows]);
  const fixedIncomeRows = useMemo(
    () =>
      fixedSchedules
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((income) => ({ ...income, ledgerType: 'fixed-schedule' })),
    [fixedSchedules],
  );

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="03"
        eyebrow={t('income.eyebrow')}
        title={t('income.title')}
        description={t('income.description')}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> {t('income.newIncome')}
            </Button>
            <MonthSelector
              id="income-view-month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="mt-8 w-full"
            />
          </>
        }
      />

      {/* KPIs */}
      <section data-tour="income-stats" className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-3">
        <div className={'min-w-0 bg-surface p-6 ' + rise(1)}>
          <Stat
            label={t('income.kpiSelectedMonth.label')}
            value={selectedMonthIncome}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={t('income.kpiSelectedMonth.hintRecords', { count: selectedMonthRows.length })}
            info={t('income.kpiSelectedMonth.info')}
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat
            label={t('income.kpiSideIncome.label')}
            value={selectedMonthSideIncome}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={t('income.kpiSideIncome.hint')}
            info={t('income.kpiSideIncome.info')}
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(3)}>
          <Stat
            label={t('income.kpiTopSource.label')}
            value={topSource ? formatCurrency(topSource.value, currency, locale) : '—'}
            mode="custom"
            hint={topSource?.name || t('income.kpiTopSource.hintNoRecords')}
            info={t('income.kpiTopSource.info')}
          />
        </div>
      </section>

      {/* split + trend — same grid pattern as portfolio */}
      <section className={'grid gap-6 lg:grid-cols-12 ' + rise(3)}>
        <Card data-tour="income-chart" eyebrow={t('income.chartCard.eyebrow')} title={t('income.chartCard.title')} variant="chart" className="lg:col-span-8">
          <LWHistogram data={lwIncomeData} color="var(--accent)" />
        </Card>

        <Card eyebrow={t('income.sourceCard.eyebrow')} title={t('income.sourceCard.title')} className="lg:col-span-4">
          {sourceBreakdown.length ? (
            <div className="flex flex-col gap-5">
              <div className="relative mx-auto h-[200px] w-full max-w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="95%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {sourceBreakdown.map((item, index) => (
                        <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex flex-col gap-2">
                {(() => {
                  const total = sourceBreakdown.reduce((s, i) => s + i.value, 0);
                  return sourceBreakdown
                    .slice()
                    .sort((a, b) => b.value - a.value)
                    .map((item) => {
                      const originalIndex = sourceBreakdown.findIndex((s) => s.name === item.name);
                      const color = COLORS[originalIndex % COLORS.length];
                      const share = total ? (item.value / total) * 100 : 0;
                      return (
                        <li key={item.name} className="flex items-center gap-2 min-w-0">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
                          <span className="min-w-0 flex-1 truncate text-xs text-ink">{item.name || 'Unnamed'}</span>
                          <span className="w-20 shrink-0 font-mono tabular text-xs text-ink-muted">{formatCurrency(item.value, currency, locale)}</span>
                          <span className="w-9 shrink-0 font-mono tabular text-xs text-ink-faint text-right">{share.toFixed(1)}%</span>
                          <div className="w-14 shrink-0 h-1 rounded-full bg-rule overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${share}%`, background: color }} />
                          </div>
                        </li>
                      );
                    });
                })()}
              </ul>
            </div>
          ) : (
            <EmptyState title={t('income.sourceCard.emptyTitle')} description={t('income.sourceCard.emptyDescription')} />
          )}
        </Card>
      </section>

      {/* ledgers */}
      <section className="grid gap-6 lg:grid-cols-12">
      <Card
        data-tour="income-log"
        eyebrow={t('income.ledgerCard.eyebrow')}
        title={t('income.ledgerCard.title')}
        description={t('income.ledgerCard.description')}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {!batchSelect.selecting && sortedIncomeRows.some((row) => row.ledgerType === 'income') && (
              <Button variant="secondary" size="sm" onClick={batchSelect.start}>
                {t('income.select')}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> {t('income.addIncome')}
            </Button>
          </div>
        }
        className={'lg:col-span-8 ' + rise(5)}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField label={t('income.ledgerCard.kindLabel')} htmlFor="income-kind">
            <Select id="income-kind" value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
              <option value="all">{t('income.ledgerCard.allKinds')}</option>
              <option value="variable">{t('income.ledgerCard.kindVariable')}</option>
              <option value="fixed_payment">{t('income.ledgerCard.kindFixedPayment')}</option>
              <option value="dividend">{t('income.ledgerCard.kindDividend')}</option>
            </Select>
          </FormField>
          <FormField label={t('income.ledgerCard.sourceLabel')} htmlFor="income-source">
            <Input
              id="income-source"
              type="text"
              placeholder={t('income.ledgerCard.searchPlaceholder')}
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
            />
          </FormField>
        </div>
        <BatchDeleteBar
          selecting={batchSelect.selecting}
          selectedCount={batchSelect.selectedIds.size}
          onDelete={handleBatchDeleteIncomes}
          onCancel={batchSelect.cancel}
        />
        {filteredIncomeRows.length ? (
          <>
            <IncomeLedgerList
              rows={sortedIncomeRows.slice((incomePage - 1) * PAGE_SIZE, incomePage * PAGE_SIZE)}
              currency={currency}
              locale={locale}
              selectable={batchSelect.selecting}
              selectedIds={batchSelect.selectedIds}
              onToggleRow={batchSelect.toggle}
              openEdit={openEdit}
              onMarkReceived={(row) => markFixedIncomeReceived(row.fixedIncomeId, row.accountingMonth, row.date)}
              onDeleteIncome={async (id) => {
                if (await confirm({ title: t('income.confirmDeleteOne.title'), description: t('income.confirmDeleteOne.description') }))
                  removeEntity('incomes', id);
              }}
              t={t}
            />
            <Pagination
              page={incomePage}
              totalPages={Math.ceil(sortedIncomeRows.length / PAGE_SIZE)}
              onPrev={() => setIncomePage((p) => Math.max(1, p - 1))}
              onNext={() => setIncomePage((p) => Math.min(Math.ceil(sortedIncomeRows.length / PAGE_SIZE), p + 1))}
              t={t}
            />
          </>
        ) : (
          <EmptyState
            title={incomeLedgerRows.length ? t('income.ledgerCard.emptyTitleFiltered') : t('income.ledgerCard.emptyTitleEmpty')}
            description={incomes.length ? t('income.ledgerCard.emptyDescriptionFiltered') : t('income.ledgerCard.emptyDescriptionEmpty')}
            action={
              !incomeLedgerRows.length && (
                <Button variant="secondary" size="sm" onClick={openNew}>
                  <PlusIcon /> {t('income.addIncome')}
                </Button>
              )
            }
          />
        )}
      </Card>

      <Card
        data-tour="income-fixed"
        eyebrow={t('income.fixedCard.eyebrow')}
        title={t('income.fixedCard.title')}
        description={t('income.fixedCard.description')}
        action={
          <Button variant="primary" size="sm" onClick={openNew}>
            <PlusIcon /> {t('income.addFixed')}
          </Button>
        }
        className={'lg:col-span-4 ' + rise(6)}
      >
        {fixedIncomeRows.length || pendingFixedRows.length ? (
          <IncomeLedgerList
            rows={[...pendingFixedRows, ...fixedIncomeRows].slice(0, PAGE_SIZE)}
            currency={currency}
            locale={locale}
            selectable={false}
            selectedIds={new Set()}
            openEdit={openEdit}
            onMarkReceived={(row) => markFixedIncomeReceived(row.fixedIncomeId, row.accountingMonth, row.date)}
            onDeleteIncome={async (id) => {
              if (await confirm({ title: t('income.confirmDeleteFixed.title'), description: t('income.confirmDeleteFixed.description') }))
                removeEntity('incomes', id);
            }}
            t={t}
          />
        ) : (
          <>
            {settings.setupIntent?.recurringIncome && (
              <div className="mb-4 rounded-md border border-accent/30 bg-accent-soft px-4 py-3">
                <p className="text-sm font-medium text-ink">{t('income.fixedCard.recurringIncomeHint')}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{t('income.fixedCard.recurringIncomeHintDescription')}</p>
              </div>
            )}
            <EmptyState
              title={t('income.fixedCard.emptyTitle')}
              description={t('income.fixedCard.emptyDescription')}
              action={
                <Button variant="secondary" size="sm" onClick={openNew}>
                  <PlusIcon /> {t('income.addFixed')}
                </Button>
              }
            />
          </>
        )}
      </Card>
      </section>

      <Modal
        open={modal.open}
        onClose={close}
        eyebrow={t('income.modal.eyebrow')}
        title={editingIncome ? t('income.modal.titleEdit') : t('income.modal.titleNew')}
        description={t('income.modal.description')}
        size="lg"
      >
        <IncomeForm
          bankAccounts={bankAccounts}
          initialValue={editingIncome}
          onSubmit={async (value) => {
            await saveEntity('incomes', value);
            close();
          }}
          onCancel={close}
        />
      </Modal>

    </div>
  );
}
