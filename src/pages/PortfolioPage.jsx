import { useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { ChartCard } from '../components/ChartCard';
import { EmptyState } from '../components/EmptyState';
import { DividendForm } from '../components/forms/DividendForm';
import { HoldingForm } from '../components/forms/HoldingForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatNumber } from '../utils/formatters';

const COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#65a30d'];

export default function PortfolioPage() {
  const holdings = useFinanceStore((state) => state.holdings);
  const dividends = useFinanceStore((state) => state.dividends);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const saveDividend = useFinanceStore((state) => state.saveDividend);
  const removeDividend = useFinanceStore((state) => state.removeDividend);
  const refreshPrices = useFinanceStore((state) => state.refreshPrices);
  const [editingId, setEditingId] = useState(null);
  const [editingDividendId, setEditingDividendId] = useState(null);
  const editingHolding = holdings.find((item) => item.id === editingId);
  const editingDividend = dividends.find((item) => item.id === editingDividendId);
  const locale = settings.locale;
  const currency = settings.baseCurrency;

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Module 3"
        title="Portfolio"
        description="Holdings, current market value, allocation, dividends and frontend-only performance analytics."
        actions={<button className="button-primary" onClick={() => refreshPrices()}>Refresh prices</button>}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <SectionCard title="Market value" subtitle="Current portfolio size"><p className="text-3xl font-bold">{formatCurrency(portfolio.currentValueCents, currency, locale)}</p></SectionCard>
        <SectionCard title="TWRR" subtitle="Time-weighted return"><p className="text-3xl font-bold">{formatNumber(portfolio.twrr, locale, 2)}%</p></SectionCard>
        <SectionCard title="XIRR" subtitle="Cashflow-adjusted annualized return"><p className="text-3xl font-bold">{formatNumber(portfolio.xirr, locale, 2)}%</p></SectionCard>
        <SectionCard title="Dividend Yield" subtitle="Portfolio-wide yield from tracked dividends"><p className="text-3xl font-bold">{formatNumber(portfolio.dividendYield, locale, 2)}%</p></SectionCard>
      </section>

      <section className="mobile-stack grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Holding entry" subtitle="Manual positions for Trade Republic and IBKR.">
          <HoldingForm
            initialValue={editingHolding}
            onSubmit={async (value) => { await saveEntity('holdings', value); setEditingId(null); }}
            onCancel={editingHolding ? () => setEditingId(null) : undefined}
          />
        </SectionCard>

        <ChartCard title="Allocation vs target">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={portfolio.allocationActual} dataKey="valueCents" nameKey="ticker" innerRadius={65} outerRadius={110}>
                {portfolio.allocationActual.map((item, index) => <Cell key={item.ticker} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value, name, entry) => [`${formatCurrency(value, currency, locale)} | actual ${entry.payload.actualWeight.toFixed(1)}% vs target ${entry.payload.targetWeight.toFixed(1)}%`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="mobile-stack grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Dividend entry" subtitle="Track received dividends and mirror them into the income module automatically.">
          <DividendForm
            holdings={holdings}
            initialValue={editingDividend}
            onSubmit={async (value) => {
              await saveDividend(value);
              setEditingDividendId(null);
            }}
            onCancel={editingDividend ? () => setEditingDividendId(null) : undefined}
          />
        </SectionCard>

        <SectionCard title="Dividend history" subtitle="Received payouts linked to holdings and included in portfolio yield.">
          {dividends.length ? (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ticker</th>
                    <th>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {dividends.map((dividend) => (
                    <tr key={dividend.id}>
                      <td>{dividend.date}</td>
                      <td>{dividend.ticker}</td>
                      <td>{formatCurrency(dividend.amountCents, dividend.currency, locale)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="button-ghost" onClick={() => setEditingDividendId(dividend.id)}>Edit</button>
                          <button className="button-ghost" onClick={() => removeDividend(dividend.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No dividends tracked yet" description="Add a payout and it will also appear inside the income module." />
          )}
        </SectionCard>
      </section>

      <ChartCard title="Target vs actual weight">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={portfolio.allocationActual}>
            <XAxis dataKey="ticker" stroke="var(--text-muted)" />
            <YAxis hide />
            <Tooltip />
            <Bar dataKey="actualWeight" fill="var(--accent)" radius={[10, 10, 0, 0]} />
            <Bar dataKey="targetWeight" fill="#d97706" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionCard title="Holdings table" subtitle="Current prices can be refreshed manually from Yahoo Finance.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Name</th>
                <th>Platform</th>
                <th>Quantity</th>
                <th>Avg buy</th>
                <th>Current price</th>
                <th>Value</th>
                <th>P&amp;L</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => {
                const valueCents = Math.round(holding.quantity * holding.currentPriceCents);
                const costCents = Math.round(holding.quantity * holding.averageBuyPriceCents);
                const pnlCents = valueCents - costCents;
                const pnlPct = costCents ? (pnlCents / costCents) * 100 : 0;

                return (
                  <tr key={holding.id}>
                    <td>{holding.ticker}</td>
                    <td>{holding.name}</td>
                    <td>{holding.platform}</td>
                    <td>{formatNumber(holding.quantity, locale, 4)}</td>
                    <td>{formatCurrency(holding.averageBuyPriceCents, currency, locale)}</td>
                    <td>{formatCurrency(holding.currentPriceCents, currency, locale)}</td>
                    <td>{formatCurrency(valueCents, currency, locale)}</td>
                    <td>{formatCurrency(pnlCents, currency, locale)} ({formatNumber(pnlPct, locale, 2)}%)</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="button-ghost" onClick={() => setEditingId(holding.id)}>Edit</button>
                        <button className="button-ghost" onClick={() => removeEntity('holdings', holding.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
