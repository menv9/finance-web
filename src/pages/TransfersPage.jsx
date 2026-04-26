import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { TransferForm } from '../components/forms/TransferForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { useConfirm } from '../components/ConfirmContext';
import { formatCurrency } from '../utils/formatters';
import { Card, Button, Table, EmptyState, Modal, FormField, Input, Select } from '../components/ui';
import { rise } from '../utils/motion';

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FlowPill({ from, to }) {
  const labels = {
    savings: 'Savings',
    income: 'Cashflow',
    cashflow: 'Cashflow',
    expenses: 'Expenses',
    portfolio: 'Portfolio',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <span className="rounded-sm bg-surface-sunken border border-rule px-1.5 py-0.5">
        {labels[from] || from}
      </span>
      <span aria-hidden>→</span>
      <span className="rounded-sm bg-surface-sunken border border-rule px-1.5 py-0.5">
        {labels[to] || to}
      </span>
    </span>
  );
}

export default function TransfersPage() {
  const transfers = useFinanceStore((s) => s.transfers);
  const incomes = useFinanceStore((s) => s.incomes);
  const settings = useFinanceStore((s) => s.settings);
  const executeTransfer = useFinanceStore((s) => s.executeTransfer);
  const removeTransfer = useFinanceStore((s) => s.removeTransfer);
  const confirm = useConfirm();

  const currency = settings.baseCurrency;
  const locale = settings.locale;

  const [modal, setModal] = useState({ open: false, defaultFromModule: 'savings' });

  const openTransfer = (defaultFromModule = 'savings') =>
    setModal({ open: true, defaultFromModule });
  const closeTransfer = () => setModal({ open: false, defaultFromModule: 'savings' });

  const sortedTransfers = [...transfers].sort((a, b) => b.date.localeCompare(a.date));

  // ── Filters ──
  const [filterMonth, setFilterMonth] = useState('');
  const [filterFrom, setFilterFrom] = useState('all');
  const [filterTo, setFilterTo] = useState('all');

  const filteredTransfers = useMemo(
    () =>
      sortedTransfers.filter(
        (t) =>
          (!filterMonth || t.date.startsWith(filterMonth)) &&
          (filterFrom === 'all' || t.fromModule === filterFrom) &&
          (filterTo === 'all' || t.toModule === filterTo),
      ),
    [sortedTransfers, filterMonth, filterFrom, filterTo],
  );

  const batchSelect = useBatchSelect(filteredTransfers);

  useEffect(() => { batchSelect.cancel(); }, [filterMonth, filterFrom, filterTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBatchDeleteTransfers = async () => {
    const ids = [...batchSelect.selectedIds];
    const ok = await confirm({
      title: `Delete ${ids.length} transfer${ids.length !== 1 ? 's' : ''}`,
      description: 'All linked records (savings entries, expenses, portfolio cashflows) will also be removed.',
    });
    if (!ok) return;
    for (const id of ids) await removeTransfer(id);
    batchSelect.cancel();
  };

  const columns = [
    { key: 'date', header: 'Date', width: 110 },
    {
      key: 'flow',
      header: 'Transfer',
      render: (r) => <FlowPill from={r.fromModule} to={r.toModule} />,
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => {
        const linkedIncome = r.fromId ? incomes.find((i) => i.id === r.fromId) : null;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{r.description || '—'}</p>
            {linkedIncome && (
              <p className="truncate text-xs text-ink-faint">{linkedIncome.source}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'amountCents',
      header: 'Amount',
      numeric: true,
      render: (r) => (
        <span className="font-mono tabular">
          {formatCurrency(r.amountCents, currency, locale)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (
              await confirm({
                title: 'Delete transfer',
                description:
                  'This will also remove all linked records (savings entry, expense, or portfolio cashflow).',
              })
            ) {
              removeTransfer(r.id);
            }
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12">
      <PageHeader
        number="06"
        eyebrow="Module"
        title="Transfers"
        description="Move money between savings, portfolio, and expenses. Every transfer creates linked records in both modules automatically."
        actions={
          <Button variant="primary" size="sm" onClick={() => openTransfer('savings')}>
            <PlusIcon /> New transfer
          </Button>
        }
      />

      {/* Quick actions */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Savings → Expenses',
            desc: 'Pay an expense from savings',
            from: 'savings',
          },
          {
            label: 'Savings → Portfolio',
            desc: 'Invest savings into portfolio',
            from: 'savings',
          },
          {
            label: 'Cashflow → Savings / Portfolio',
            desc: 'Allocate part of your monthly cashflow',
            from: 'cashflow',
          },
        ].map((action, i) => (
          <button
            key={action.label}
            type="button"
            onClick={() => openTransfer(action.from)}
            className={'text-left rounded-lg border border-rule bg-surface p-4 hover:border-ink-faint hover:bg-surface-raised transition-colors duration-180 ' + rise(i + 1)}
          >
            <p className="text-sm font-medium text-ink">{action.label}</p>
            <p className="mt-1 text-xs text-ink-muted">{action.desc}</p>
          </button>
        ))}
      </section>

      {/* History */}
      <Card
        eyebrow="History"
        title="All transfers"
        description="Deleting a transfer also removes the linked records from savings, expenses, or portfolio."
        className={rise(2)}
        action={
          !batchSelect.selecting && sortedTransfers.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={batchSelect.start}>
              Select
            </Button>
          ) : null
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <FormField label="Month" htmlFor="trf-month">
            <Input
              id="trf-month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </FormField>
          <FormField label="From" htmlFor="trf-from">
            <Select id="trf-from" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}>
              <option value="all">All sources</option>
              <option value="savings">Savings</option>
              <option value="cashflow">Cashflow</option>
              <option value="income">Income</option>
            </Select>
          </FormField>
          <FormField label="To" htmlFor="trf-to">
            <Select id="trf-to" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}>
              <option value="all">All destinations</option>
              <option value="expenses">Expenses</option>
              <option value="savings">Savings</option>
              <option value="portfolio">Portfolio</option>
            </Select>
          </FormField>
        </div>
        <BatchDeleteBar
          selecting={batchSelect.selecting}
          selectedCount={batchSelect.selectedIds.size}
          onDelete={handleBatchDeleteTransfers}
          onCancel={batchSelect.cancel}
        />
        {sortedTransfers.length ? (
          <Table
            columns={columns}
            rows={filteredTransfers}
            selectable={batchSelect.selecting}
            selectedIds={batchSelect.selectedIds}
            onToggleRow={batchSelect.toggle}
            onToggleAll={batchSelect.toggleAll}
            empty={
              <EmptyState
                title="No results for this filter"
                description="Try a different month, source, or destination."
              />
            }
          />
        ) : (
          <EmptyState
            title="No transfers yet"
            description="Create your first transfer to move money between modules."
            action={
              <Button variant="secondary" size="sm" onClick={() => openTransfer('savings')}>
                <PlusIcon /> New transfer
              </Button>
            }
          />
        )}
      </Card>

      {/* Transfer modal */}
      <Modal
        open={modal.open}
        onClose={closeTransfer}
        eyebrow="Money movement"
        title="New transfer"
        description="Creates linked records in both the source and destination module."
        size="md"
      >
        <TransferForm
          defaultFromModule={modal.defaultFromModule}
          onSubmit={async (spec) => {
            await executeTransfer(spec);
            closeTransfer();
          }}
          onCancel={closeTransfer}
        />
      </Modal>
    </div>
  );
}
