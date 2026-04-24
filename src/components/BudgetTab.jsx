import { useMemo, useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { normalizeDateInput } from '../utils/dates';
import { Card, Button, FormField, Input, EmptyState, Modal } from './ui';
import { cn } from './ui/cn';
import { rise } from '../utils/motion';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPrevMonth(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ pct, danger }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
      <div
        style={{ width: `${Math.min(pct, 100)}%` }}
        className={cn(
          'h-full rounded-full transition-all duration-300',
          danger ? 'bg-danger' : 'bg-accent',
        )}
      />
    </div>
  );
}

function BudgetCard({ category, budget, spentCents, rolloverCents, currency, locale, onSet, onRemove }) {
  const effectiveCents = (budget?.monthlyCents || 0) + rolloverCents;
  const hasBudget = !!budget;
  const over = hasBudget && effectiveCents > 0 && spentCents > effectiveCents;
  const pct = effectiveCents > 0 ? (spentCents / effectiveCents) * 100 : 0;
  const remainingCents = effectiveCents - spentCents;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-rule bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-ink">{category}</p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={onSet}>
            {hasBudget ? 'Edit' : 'Set'}
          </Button>
          {hasBudget && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {hasBudget ? (
        <>
          <div className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>
              Spent:{' '}
              <span className={cn('font-mono', over && 'font-medium text-danger')}>
                {formatCurrency(spentCents, currency, locale)}
              </span>
            </span>
            <span>
              Budget: <span className="font-mono">{formatCurrency(effectiveCents, currency, locale)}</span>
            </span>
          </div>
          <ProgressBar pct={pct} danger={over} />
          <p className={cn('mt-1 text-xs', over ? 'text-danger' : 'text-ink-muted')}>
            {over
              ? `Over by ${formatCurrency(Math.abs(remainingCents), currency, locale)}`
              : `${formatCurrency(remainingCents, currency, locale)} remaining`}
          </p>
          {rolloverCents > 0 && (
            <p className="mt-0.5 text-xs text-positive">
              +{formatCurrency(rolloverCents, currency, locale)} rolled over
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-ink-faint">No budget set — click "Set" to add a limit.</p>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function BudgetTab() {
  const budgets = useFinanceStore((s) => s.budgets);
  const rollovers = useFinanceStore((s) => s.rollovers);
  const expenses = useFinanceStore((s) => s.expenses);
  const settings = useFinanceStore((s) => s.settings);
  const saveEntity = useFinanceStore((s) => s.saveEntity);
  const removeEntity = useFinanceStore((s) => s.removeEntity);
  const saveSavingsEntry = useFinanceStore((s) => s.saveSavingsEntry);

  const { baseCurrency: currency, locale, categories } = settings;

  const [selectedMonth, setSelectedMonth] = useState(
    () => normalizeDateInput(new Date()).slice(0, 7),
  );
  const [budgetModal, setBudgetModal] = useState({ open: false, category: null });
  const [budgetAmount, setBudgetAmount] = useState('');

  const prevMonth = getPrevMonth(selectedMonth);

  // ── derived spend maps ────────────────────────────────────────────────────

  const spendingByCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      if (!e.date.startsWith(selectedMonth)) return;
      map[e.category] = (map[e.category] || 0) + e.amountCents;
    });
    return map;
  }, [expenses, selectedMonth]);

  const prevSpendingByCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      if (!e.date.startsWith(prevMonth)) return;
      map[e.category] = (map[e.category] || 0) + e.amountCents;
    });
    return map;
  }, [expenses, prevMonth]);

  // Rollovers credited to the currently viewed month
  const appliedRollovers = useMemo(() => {
    const map = {};
    rollovers.forEach((r) => {
      if (r.toMonth === selectedMonth && r.type === 'rollover') {
        map[r.category] = (map[r.category] || 0) + r.amountCents;
      }
    });
    return map;
  }, [rollovers, selectedMonth]);

  // Unprocessed leftovers from previous month
  const pendingRollovers = useMemo(() => {
    return budgets
      .map((b) => {
        // Budget must have existed BEFORE the previous month started
        // (createdAt month <= prevMonth). If createdAt is missing, skip to be safe.
        const createdMonth = b.createdAt?.slice(0, 7);
        if (!createdMonth || createdMonth > prevMonth) return null;

        const prevSpent = prevSpendingByCategory[b.category] || 0;
        const prevRolloverIn = rollovers
          .filter((r) => r.toMonth === prevMonth && r.category === b.category && r.type === 'rollover')
          .reduce((sum, r) => sum + r.amountCents, 0);
        const prevEffective = b.monthlyCents + prevRolloverIn;
        const leftover = prevEffective - prevSpent;
        if (leftover <= 500) return null; // ignore tiny amounts (< €5)
        const alreadyDone = rollovers.some(
          (r) => r.fromMonth === prevMonth && r.category === b.category,
        );
        if (alreadyDone) return null;
        return { category: b.category, fromMonth: prevMonth, amountCents: leftover };
      })
      .filter(Boolean);
  }, [budgets, prevMonth, prevSpendingByCategory, rollovers]);

  // ── actions ───────────────────────────────────────────────────────────────

  const openBudgetModal = (category) => {
    const existing = budgets.find((b) => b.category === category);
    setBudgetAmount(existing ? String((existing.monthlyCents / 100).toFixed(2)) : '');
    setBudgetModal({ open: true, category });
  };

  const closeBudgetModal = () => setBudgetModal({ open: false, category: null });

  const saveBudget = async () => {
    const cents = Math.round(parseFloat(budgetAmount || '0') * 100);
    if (!cents || isNaN(cents) || cents <= 0) return;
    const existing = budgets.find((b) => b.category === budgetModal.category);
    await saveEntity('budgets', {
      id: `budget-${budgetModal.category}`,
      category: budgetModal.category,
      monthlyCents: cents,
      currency,
      // preserve the original creation date so rollover logic stays correct after edits
      createdAt: existing?.createdAt || new Date().toISOString(),
    });
    closeBudgetModal();
  };

  const removeBudget = (category) => removeEntity('budgets', `budget-${category}`);

  const handleRollover = async (item, type) => {
    await saveEntity('rollovers', {
      id: `rollover-${item.category}-${item.fromMonth}`,
      category: item.category,
      fromMonth: item.fromMonth,
      toMonth: selectedMonth,
      amountCents: item.amountCents,
      type,
    });
    if (type === 'savings') {
      await saveSavingsEntry({
        date: `${selectedMonth}-01`,
        amountCents: item.amountCents,
        note: `Budget rollover — ${item.category} (${monthLabel(item.fromMonth)})`,
      });
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-8">
      {/* month selector */}
      <div className={'flex flex-wrap items-center justify-between gap-4 ' + rise(1)}>
        <p className="text-sm text-ink-muted">
          Budgets for{' '}
          <span className="font-medium text-ink">{monthLabel(selectedMonth)}</span>
        </p>
        <div className="w-44">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {/* budget cards */}
      <Card
        eyebrow="Plan"
        title="Category budgets"
        description="Set a monthly spending limit per category. The bar turns red when you go over."
        className={rise(2)}
      >
        {categories.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <BudgetCard
                key={cat}
                category={cat}
                budget={budgets.find((b) => b.category === cat)}
                spentCents={spendingByCategory[cat] || 0}
                rolloverCents={appliedRollovers[cat] || 0}
                currency={currency}
                locale={locale}
                onSet={() => openBudgetModal(cat)}
                onRemove={() => removeBudget(cat)}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No categories" description="Add spending categories in Settings first." />
        )}
      </Card>

      {/* rollover section — only shows when there are unprocessed leftovers */}
      {pendingRollovers.length > 0 && (
        <Card
          eyebrow="Month-end"
          title={`Leftovers from ${monthLabel(prevMonth)}`}
          description="You stayed under budget in these categories. Roll the surplus forward or stash it in savings."
          className={rise(3)}
        >
          <ul className="divide-y divide-rule">
            {pendingRollovers.map((item) => (
              <li
                key={item.category}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{item.category}</p>
                  <p className="eyebrow mt-0.5">
                    Leftover:{' '}
                    <span className="font-mono text-positive">
                      {formatCurrency(item.amountCents, currency, locale)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRollover(item, 'rollover')}
                  >
                    Roll to {monthLabel(selectedMonth).split(' ')[0]}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRollover(item, 'savings')}
                  >
                    Move to savings
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* set / edit budget modal */}
      <Modal
        open={budgetModal.open}
        onClose={closeBudgetModal}
        eyebrow="Budget"
        title={budgetModal.category ? `${budgets.find((b) => b.category === budgetModal.category) ? 'Edit' : 'Set'} budget — ${budgetModal.category}` : 'Set budget'}
        size="sm"
      >
        <div className="grid gap-5">
          <FormField label={`Monthly limit (${currency})`} htmlFor="budget-amount">
            <Input
              id="budget-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveBudget()}
              autoFocus
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBudgetModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveBudget}>
              Save budget
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
