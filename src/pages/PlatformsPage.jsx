import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { HoldingForm } from '../components/forms/HoldingForm';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { computePortfolioMetrics } from '../utils/finance';
import { Button, Card, EmptyState, FormField, Input, Modal, Select, Table, cn } from '../components/ui';
import { useTranslation } from '../i18n/useTranslation';
import { rise } from '../utils/motion';

function today() {
  return new Date().toISOString().slice(0, 10);
}

const UNASSIGNED_PORTFOLIO_ID = '__unassigned__';

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

function parseCents(value) {
  if (value == null || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function normalizeImportedHolding(row, platform, portfolioId, baseCurrency, sourceCashflows = []) {
  const ticker = String(row.ticker || row.symbol || '').trim().toUpperCase();
  if (!ticker) return null;
  const quantity = Number(row.quantity ?? row.shares ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const averageBuyPriceCents = Number.isFinite(Number(row.averageBuyPriceCents))
    ? Math.round(Number(row.averageBuyPriceCents))
    : parseCents(row.averageBuyPrice ?? row.avgBuyPrice ?? row.buyPrice);
  const currentPriceCents = Number.isFinite(Number(row.currentPriceCents))
    ? Math.round(Number(row.currentPriceCents))
    : parseCents(row.currentPrice ?? row.lastPrice ?? row.price);
  const feeCents = Number.isFinite(Number(row.feeCents))
    ? Math.round(Number(row.feeCents))
    : parseCents(row.fee ?? row.commission);
  const [, decimals = ''] = `${quantity}`.split('.');
  const linkedCashflow = sourceCashflows.find((flow) => flow.holdingId === row.id && flow.date);

  return {
    ticker,
    name: row.name || row.companyName || ticker,
    platform,
    portfolioId,
    purchaseDate: row.purchaseDate || row.date || linkedCashflow?.date || today(),
    quantity,
    quantityDecimals: Number.isInteger(row.quantityDecimals)
      ? row.quantityDecimals
      : Math.min(decimals.length, 20),
    averageBuyPriceCents,
    currentPriceCents,
    feeCents,
    currency: row.currency || baseCurrency,
    feeCurrency: row.feeCurrency || row.currency || baseCurrency,
  };
}

function ManagePlatformsModal({ open, onClose }) {
  const confirm = useConfirm();
  const settings = useFinanceStore((state) => state.settings);
  const holdings = useFinanceStore((state) => state.holdings || []);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const [draft, setDraft] = useState('');
  const platforms = settings.holdingPlatforms?.length ? settings.holdingPlatforms : ['Trade Republic', 'IBKR', 'DEGIRO'];

  const add = () => {
    const name = draft.trim();
    if (!name || platforms.includes(name)) return;
    updateSettings({ holdingPlatforms: [...platforms, name] });
    setDraft('');
  };

  const remove = (platform) => {
    const next = platforms.filter((item) => item !== platform);
    updateSettings({ holdingPlatforms: next.length ? next : ['Trade Republic', 'IBKR', 'DEGIRO'] });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Investing"
      title="Manage platforms"
      description="Platforms are used as brokers for portfolio holdings."
      size="sm"
    >
      <div className="grid gap-6">
        <ul className="divide-y divide-rule">
          {platforms.map((platform) => (
            <li key={platform} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <span className="block truncate text-sm text-ink">{platform}</span>
                {holdings.some((holding) => holding.platform === platform) ? (
                  <span className="text-xs text-ink-faint">Contains holdings</span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={holdings.some((holding) => holding.platform === platform)}
                onClick={async () => {
                  if (holdings.some((holding) => holding.platform === platform)) return;
                  if (await confirm({
                    title: 'Remove platform',
                    description: `Remove "${platform}" from the broker list?`,
                  })) {
                    remove(platform);
                  }
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <FormField label="Add platform" htmlFor="new-platform-input">
          <div className="flex gap-2">
            <Input
              id="new-platform-input"
              type="text"
              placeholder="e.g. Trade Republic"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <Button variant="primary" onClick={add}>Add</Button>
          </div>
        </FormField>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
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
  const [managePlatformsOpen, setManagePlatformsOpen] = useState(false);

  const currency = settings.baseCurrency || 'EUR';
  const platformNames = useMemo(() => {
    const configured = settings.holdingPlatforms?.length ? settings.holdingPlatforms : ['Trade Republic', 'IBKR', 'DEGIRO'];
    const fromHoldings = holdings.map((holding) => holding.platform).filter(Boolean);
    return [...new Set([...configured, ...fromHoldings])].sort((a, b) => a.localeCompare(b));
  }, [holdings, settings.holdingPlatforms]);

  const [activePlatform, setActivePlatform] = useState(platformNames[0] || '');
  const [activePortfolioId, setActivePortfolioId] = useState(investmentPortfolios[0]?.id || '');
  const [holdingModal, setHoldingModal] = useState({ open: false, id: null });
  const [importingJson, setImportingJson] = useState(false);

  const selectedPlatform = activePlatform || platformNames[0] || '';
  const selectedPortfolioId = activePortfolioId || investmentPortfolios[0]?.id || '';
  const editingHolding = holdings.find((holding) => holding.id === holdingModal.id);
  const portfolioFilterOptions = [
    ...investmentPortfolios,
    { id: UNASSIGNED_PORTFOLIO_ID, name: 'Unassigned' },
  ];
  const knownPortfolioIds = new Set(investmentPortfolios.map((portfolio) => portfolio.id));
  const isUnassignedHolding = (holding) => !holding.portfolioId || !knownPortfolioIds.has(holding.portfolioId);
  const platformPortfolioId = (holding) => (
    isUnassignedHolding(holding) ? UNASSIGNED_PORTFOLIO_ID : holding.portfolioId
  );

  const brokerSummaries = platformNames.map((platform) => {
    const platformHoldings = holdings.filter((holding) => (
      holding.platform === platform &&
      !holding.archivedAt &&
      (holding.quantity || 0) > 0
    ));
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
    .filter((holding) => (
      holding.platform === selectedPlatform &&
      (
        selectedPortfolioId === UNASSIGNED_PORTFOLIO_ID
          ? isUnassignedHolding(holding)
          : holding.portfolioId === selectedPortfolioId
      )
    ))
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
            onClick={() => {
              setHoldingModal({ open: true, id: row.id });
            }}
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

  const closeHolding = () => {
    setHoldingModal({ open: false, id: null });
  };

  const importJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!selectedPortfolioId) {
      await alert({
        title: 'Select a portfolio first',
        description: 'Choose a portfolio or Unassigned before importing holdings.',
      });
      return;
    }
    if (!selectedPlatform) {
      await alert({ title: 'Select a platform first', description: 'Choose the broker before importing holdings.' });
      return;
    }
    setImportingJson(true);
    try {
      const parsed = JSON.parse(await file.text());
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.holdings)
          ? parsed.holdings
          : Array.isArray(parsed.data?.holdings)
            ? parsed.data.holdings
            : Array.isArray(parsed.data)
              ? parsed.data
            : [];
      const sourceCashflows = Array.isArray(parsed.data?.portfolioCashflows)
        ? parsed.data.portfolioCashflows
        : Array.isArray(parsed.portfolioCashflows)
          ? parsed.portfolioCashflows
          : [];
      const importPortfolioId = selectedPortfolioId === UNASSIGNED_PORTFOLIO_ID ? '' : selectedPortfolioId;
      const normalized = rows
        .map((row) => normalizeImportedHolding(row, selectedPlatform, importPortfolioId, currency, sourceCashflows))
        .filter(Boolean);
      if (!normalized.length) {
        throw new Error('No valid holdings found. Use an array or an object with a holdings array.');
      }
      for (const holding of normalized) {
        await saveEntity('holdings', holding, { allowUnassignedPortfolio: importPortfolioId === '' });
      }
      if (importPortfolioId) {
        await recordPortfolioSnapshot({
          force: true,
          source: 'broker_json_import',
          portfolioId: importPortfolioId,
          includeGlobal: true,
        });
      } else {
        await recordPortfolioSnapshot({
          force: true,
          source: 'broker_json_import',
          includeGlobal: true,
          includeScoped: false,
        });
      }
      await alert({
        title: 'Import complete',
        description: `${normalized.length} holding${normalized.length === 1 ? '' : 's'} imported into ${selectedPlatform}.`,
      });
    } catch (error) {
      await alert({
        title: 'Unable to import JSON',
        description: error.message || 'Check the file format and try again.',
      });
    } finally {
      setImportingJson(false);
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Investing"
        title="Platforms"
        description="Manage broker holdings and set the real purchase date for historical positions."
      />

      <Card
        eyebrow="Brokers"
        title="Platform summary"
        description="Platform is treated as broker across Investing."
        className={rise(1)}
      >
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setManagePlatformsOpen(true)}
            className="text-xs text-accent hover:underline"
          >
            Manage platforms
          </button>
        </div>
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
        title={selectedPortfolioId === UNASSIGNED_PORTFOLIO_ID ? 'Unassigned holdings' : 'Holdings'}
        description="Historical broker setup does not create cashflows or bank movements."
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {portfolioFilterOptions.length ? (
              <div className="w-48">
                <FormField label="Portfolio" htmlFor="platform-portfolio">
                  {(props) => (
                    <Select
                      {...props}
                      value={selectedPortfolioId}
                      onChange={(event) => setActivePortfolioId(event.target.value)}
                    >
                      {portfolioFilterOptions.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>
            ) : null}
            <label className="inline-flex">
              <Button as="span" variant="secondary" size="sm" loading={importingJson}>
                Import JSON
              </Button>
              <input type="file" accept="application/json" className="hidden" onChange={importJson} />
            </label>
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

      <ManagePlatformsModal open={managePlatformsOpen} onClose={() => setManagePlatformsOpen(false)} />

      <Modal
        open={holdingModal.open}
        onClose={closeHolding}
        eyebrow="Broker holding"
        title={editingHolding ? 'Edit broker holding' : `Add holding to ${selectedPlatform || 'broker'}`}
        description="Set the real purchase date here without creating cashflow, bank, or savings records."
        size="lg"
      >
        <HoldingForm
          key={holdingModal.id || 'new'}
          initialValue={{
            ...(editingHolding || {
              platform: selectedPlatform,
              purchaseDate: today(),
            }),
            portfolioId: editingHolding ? platformPortfolioId(editingHolding) : selectedPortfolioId,
          }}
          finnhubApiKey={settings.finnhubApiKey || ''}
          portfolios={portfolioFilterOptions}
          allowPurchaseDate
          allowPortfolioSelect
          historicalMode
          lockedPlatform={editingHolding?.platform || selectedPlatform}
          onSubmit={async (value) => {
            const nextPortfolioId = value.portfolioId || selectedPortfolioId;
            const normalizedPortfolioId = nextPortfolioId === UNASSIGNED_PORTFOLIO_ID ? '' : nextPortfolioId;
            const previousPortfolioId = editingHolding?.portfolioId || '';
            const saved = await saveEntity('holdings', {
              ...value,
              platform: editingHolding?.platform || selectedPlatform,
              portfolioId: normalizedPortfolioId,
              purchaseDate: value.purchaseDate || today(),
            }, { allowUnassignedPortfolio: normalizedPortfolioId === '' });
            setActivePortfolioId(normalizedPortfolioId || UNASSIGNED_PORTFOLIO_ID);
            const snapshotSource = editingHolding ? 'broker_holding_edited' : 'broker_holding_added';
            const affectedPortfolioIds = [...new Set([previousPortfolioId, saved.portfolioId].filter(Boolean))];
            if (affectedPortfolioIds.length) {
              for (const [index, affectedPortfolioId] of affectedPortfolioIds.entries()) {
                await recordPortfolioSnapshot({
                  force: true,
                  source: snapshotSource,
                  portfolioId: affectedPortfolioId,
                  includeGlobal: index === 0,
                });
              }
            } else {
              await recordPortfolioSnapshot({
                force: true,
                source: snapshotSource,
                includeGlobal: true,
                includeScoped: false,
              });
            }
            closeHolding();
          }}
          onCancel={closeHolding}
        />
      </Modal>
    </div>
  );
}
