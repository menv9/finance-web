import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { HoldingForm } from '../components/forms/HoldingForm';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { computePortfolioMetrics } from '../utils/finance';
import { Button, Card, EmptyState, FormField, Modal, Select, Table, cn } from '../components/ui';
import { useTranslation } from '../i18n/useTranslation';
import { rise } from '../utils/motion';

function today() {
  return new Date().toISOString().slice(0, 10);
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
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M9.8 3.2 12.8 6 6 12.8l-3.4.7.7-3.4 6.5-6.9Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.7 4.4 2.9 2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M3.5 4.5h9M6.5 2.5h3l.5 2M5 4.5l.5 9h5l.5-9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7v4M9 7v4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function holdingPurchaseDate(holding, cashflows) {
  if (holding.purchaseDate) return holding.purchaseDate;
  const buyFlow = cashflows.find((flow) => flow.kind === 'buy' && flow.holdingId === holding.id && flow.date);
  if (buyFlow?.date) return buyFlow.date;
  return holding.createdAt?.slice(0, 10) || '';
}

export default function PlatformsPage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const { locale } = useTranslation();
  const settings = useFinanceStore((state) => state.settings);
  const holdings = useFinanceStore((state) => state.holdings || []);
  const portfolioCashflows = useFinanceStore((state) => state.portfolioCashflows || []);
  const investmentPortfolios = useFinanceStore((state) => state.investmentPortfolios || []);
  const fxRates = useFinanceStore((state) => state.fxRates || {});
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const recordPortfolioSnapshot = useFinanceStore((state) => state.recordPortfolioSnapshot);

  const currency = settings.baseCurrency || 'EUR';
  const platformNames = useMemo(() => {
    const configured = settings.holdingPlatforms?.length ? settings.holdingPlatforms : ['Trade Republic', 'IBKR', 'DEGIRO'];
    const fromHoldings = holdings.map((holding) => holding.platform).filter(Boolean);
    return [...new Set([...configured, ...fromHoldings])].sort((a, b) => a.localeCompare(b));
  }, [holdings, settings.holdingPlatforms]);

  const [activePlatform, setActivePlatform] = useState(platformNames[0] || '');
  const [activePortfolioId, setActivePortfolioId] = useState(investmentPortfolios[0]?.id || '');
  const [holdingModal, setHoldingModal] = useState({ open: false, id: null });

  const selectedPlatform = activePlatform || platformNames[0] || '';
  const selectedPortfolioId = activePortfolioId || investmentPortfolios[0]?.id || '';
  const editingHolding = holdings.find((holding) => holding.id === holdingModal.id);

  const brokerSummaries = platformNames.map((platform) => {
    const platformHoldings = holdings.filter((holding) => holding.platform === platform && !holding.archivedAt && (holding.quantity || 0) > 0);
    const metrics = computePortfolioMetrics(platformHoldings, [], [], [], fxRates, currency);
    return {
      id: platform,
      platform,
      symbols: new Set(platformHoldings.map((holding) => holding.ticker).filter(Boolean)).size,
      holdingsCount: platformHoldings.length,
      costBasisCents: metrics.investedCents,
      marketValueCents: metrics.currentValueCents,
      pnlCents: metrics.pnlCents,
      pnlPercent: metrics.pnlPercent,
    };
  });

  const visibleHoldings = holdings
    .filter((holding) => holding.platform === selectedPlatform)
    .slice()
    .sort((a, b) => (holdingPurchaseDate(b, portfolioCashflows) || '').localeCompare(holdingPurchaseDate(a, portfolioCashflows) || ''));

  const summaryColumns = [
    {
      key: 'platform',
      header: 'Broker',
      width: 170,
      render: (row) => (
        <button
          type="button"
          onClick={() => setActivePlatform(row.platform)}
          className={cn('text-left font-display text-base', selectedPlatform === row.platform ? 'text-accent' : 'text-ink')}
        >
          {row.platform}
        </button>
      ),
    },
    { key: 'symbols', header: 'Symbols', numeric: true, render: (row) => row.symbols },
    { key: 'holdingsCount', header: 'Lots', numeric: true, render: (row) => row.holdingsCount },
    { key: 'costBasisCents', header: 'Cost Basis', numeric: true, render: (row) => formatCurrency(row.costBasisCents, currency, locale) },
    { key: 'marketValueCents', header: 'Market Value', numeric: true, render: (row) => formatCurrency(row.marketValueCents, currency, locale) },
    {
      key: 'pnlCents',
      header: 'Unrealized Gain/Loss',
      numeric: true,
      render: (row) => (
        <span className={row.pnlCents > 0 ? 'text-positive' : row.pnlCents < 0 ? 'text-danger' : 'text-ink-muted'}>
          {formatCurrency(row.pnlCents, currency, locale)} ({formatNumber(row.pnlPercent || 0, locale, 2)}%)
        </span>
      ),
    },
  ];

  const holdingColumns = [
    {
      key: 'ticker',
      header: 'Symbol',
      width: 150,
      noTruncate: true,
      render: (row) => (
        <div className="min-w-0 text-left">
          <p className="truncate font-mono text-sm font-semibold text-accent">{row.ticker}</p>
          <p className="truncate text-xs text-ink-faint">{row.name || row.ticker}</p>
        </div>
      ),
    },
    { key: 'portfolioId', header: 'Portfolio', render: (row) => investmentPortfolios.find((portfolio) => portfolio.id === row.portfolioId)?.name || 'Unassigned' },
    { key: 'purchaseDate', header: 'Purchase Date', render: (row) => holdingPurchaseDate(row, portfolioCashflows) || '-' },
    { key: 'quantity', header: 'Shares', numeric: true, render: (row) => formatNumber(row.quantity || 0, locale, Math.min(row.quantityDecimals ?? 5, 5)) },
    { key: 'averageBuyPriceCents', header: 'Avg Buy', numeric: true, render: (row) => formatCurrency(row.averageBuyPriceCents || 0, row.currency || currency, locale) },
    { key: 'currentPriceCents', header: 'Last Price', numeric: true, render: (row) => formatCurrency(row.currentPriceCents || 0, row.currency || currency, locale) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 96,
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            onClick={() => setHoldingModal({ open: true, id: row.id })}
            aria-label={`Edit ${row.ticker}`}
            title="Edit"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-danger-soft hover:text-danger"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${row.ticker}?`,
                description: 'This removes the broker holding lot. Linked financial records are not created by this historical flow.',
                confirmLabel: 'Delete',
                danger: true,
              });
              if (ok) await removeEntity('holdings', row.id);
            }}
            aria-label={`Delete ${row.ticker}`}
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      ),
    },
  ];

  const openNewHolding = async () => {
    if (!investmentPortfolios.length) {
      await alert({
        title: 'Create a portfolio first',
        description: 'Historical broker holdings still need a portfolio so totals stay consistent.',
      });
      return;
    }
    setHoldingModal({ open: true, id: null });
  };

  const closeHolding = () => setHoldingModal({ open: false, id: null });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Investing"
        title="Platforms"
        description="Manage broker holdings and set the real purchase date for historical positions."
        actions={(
          <Button onClick={openNewHolding}>
            <PlusIcon /> Add broker holding
          </Button>
        )}
      />

      <Card
        eyebrow="Brokers"
        title="Platform summary"
        description="Platform is treated as broker across Investing."
        className={rise(1)}
      >
        {brokerSummaries.length ? (
          <Table columns={summaryColumns} rows={brokerSummaries} density="compact" />
        ) : (
          <EmptyState
            title="No brokers yet"
            description="Add your first broker holding to start grouping positions by platform."
            action={<Button onClick={openNewHolding}>Add broker holding</Button>}
          />
        )}
      </Card>

      <Card
        eyebrow={selectedPlatform || 'Broker'}
        title="Holdings"
        description="Historical broker setup does not create cashflows or bank movements."
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {investmentPortfolios.length ? (
              <div className="w-48">
                <FormField label="Portfolio" htmlFor="platform-portfolio">
                  {(props) => (
                    <Select
                      {...props}
                      value={selectedPortfolioId}
                      onChange={(event) => setActivePortfolioId(event.target.value)}
                    >
                      {investmentPortfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>
            ) : null}
            <Button variant="primary" size="sm" onClick={openNewHolding}>
              <PlusIcon /> Add holding
            </Button>
          </div>
        )}
        className={rise(2)}
      >
        {visibleHoldings.length ? (
          <Table columns={holdingColumns} rows={visibleHoldings} density="compact" stickyFirstColumn />
        ) : (
          <EmptyState
            title="No holdings for this broker"
            description="Add historical lots here when you are loading an existing broker account."
            action={<Button variant="secondary" onClick={openNewHolding}>Add holding</Button>}
          />
        )}
      </Card>

      <Modal
        open={holdingModal.open}
        onClose={closeHolding}
        eyebrow="Broker holding"
        title={editingHolding ? 'Edit broker holding' : `Add holding to ${selectedPlatform || 'broker'}`}
        description="Set the real purchase date here without creating cashflow, bank, or savings records."
        size="lg"
      >
        <HoldingForm
          initialValue={editingHolding || {
            platform: selectedPlatform,
            portfolioId: selectedPortfolioId,
            purchaseDate: today(),
          }}
          finnhubApiKey={settings.finnhubApiKey || ''}
          allowPurchaseDate
          historicalMode
          lockedPlatform={editingHolding?.platform || selectedPlatform}
          onSubmit={async (value) => {
            const saved = await saveEntity('holdings', {
              ...value,
              platform: editingHolding?.platform || selectedPlatform,
              portfolioId: value.portfolioId || selectedPortfolioId,
              purchaseDate: value.purchaseDate || today(),
            });
            await recordPortfolioSnapshot({ force: true, source: editingHolding ? 'broker_holding_edited' : 'broker_holding_added', portfolioId: saved.portfolioId });
            closeHolding();
          }}
          onCancel={closeHolding}
        />
      </Modal>
    </div>
  );
}
