import { useMemo, useState } from 'react';
import { useConfirm } from './ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { normalizeDateInput } from '../utils/dates';
import { Card, Button, FormField, Input, EmptyState, Modal, Stat } from './ui';
import { cn } from './ui/cn';
import { rise } from '../utils/motion';
import { ManageCategoriesModal } from './ManageCategoriesModal';

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

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── budget card ──────────────────────────────────────────────────────────────

function BudgetCard({ budget, spentCents, rolloverCents, currency, locale, onEdit, onRemove }) {
  const effectiveCents = budget.monthlyCents + rolloverCents;
  const over = effectiveCents > 0 && spentCents > effectiveCents;
  const pct = effectiveCents > 0 ? (spentCents / effectiveCents) * 100 : 0;
  const remainingCents = effectiveCents - spentCents;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-rule bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-ink">{budget.category}</p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
        </div>
      </div>

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

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          style={{ width: `${Math.min(pct, 100)}%` }}
          className={cn('h-full rounded-full transition-all duration-300', over ? 'bg-danger' : 'bg-accent')}
        />
      </div>

      <p className={cn('mt-1 text-xs', over ? 'text-danger' : 'text-ink-muted')}>
        {over
          ? `Over by ${formatCurrency(Math.abs(remainingCents), currency, locale)}`
          : `${formatCurrency(remainingCents, currency, locale)} remaining`}
      </p>

      {rolloverCents > 0 && (
        <p className="mt-0.5 text-xs text-positive">
          +{formatCurrency(rolloverCents, currency, locale)} rolled over from last month
        </p>
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
  const monthlyCashflowCents = useFinanceStore((s) => s.derived.dashboard.cashflowCents);
  const saveEntity = useFinanceStore((s) => s.saveEntity);
  const removeEntity = useFinanceStore((s) => s.removeEntity);
  const saveSavingsEntry = useFinanceStore((s) => s.saveSavingsEntry);
  const updateSettings = useFinanceStore((s) => s.updateSettings);

  const confirm = useConfirm();
  const { baseCurrency: currency, locale, categories: expenseCategories } = settings;

  const [selectedMonth] = useState(
    () => normalizeDateInput(new Date()).slice(0, 7),
  );
  // modal: { open, category } — category is null for new, string for edit
  const [modal, setModal] = useState({ open: false, category: null });
  const [newCategory, setNewCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [catModalOpen, setCatModalOpen] = useState(false);

  const prevMonth = getPrevMonth(selectedMonth);
  const isEditing = modal.open && modal.category !== null;
  const totalBudgetCents = budgets.reduce((sum, budget) => sum + (budget.monthlyCents || 0), 0);
  const cashflowAfterBudgetsCents = (monthlyCashflowCents || 0) - totalBudgetCents;

  // Expense categories not yet budgeted (for datalist suggestions)
  const unbудgetedSuggestions = expenseCategories.filter(
    (c) => !budgets.some((b) => b.category === c),
  );

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

  const appliedRollovers = useMemo(() => {
    const map = {};
    rollovers.forEach((r) => {
      if (r.toMonth === selectedMonth && r.type === 'rollover') {
        map[r.category] = (map[r.category] || 0) + r.amountCents;
      }
    });
    return map;
  }, [rollovers, selectedMonth]);

  const pendingRollovers = useMemo(() => {
    return budgets
      .map((b) => {
        const createdMonth = b.createdAt?.slice(0, 7);
        if (!createdMonth || createdMonth > prevMonth) return null;

        const prevSpent = prevSpendingByCategory[b.category] || 0;
        const prevRolloverIn = rollovers
          .filter((r) => r.toMonth === prevMonth && r.category === b.category && r.type === 'rollover')
          .reduce((sum, r) => sum + r.amountCents, 0);
        const prevEffective = b.monthlyCents + prevRolloverIn;
        const leftover = prevEffective - prevSpent;
        if (leftover <= 500) return null;
        const alreadyDone = rollovers.some(
          (r) => r.fromMonth === prevMonth && r.category === b.category,
        );
        if (alreadyDone) return null;
        return { category: b.category, fromMonth: prevMonth, amountCents: leftover };
      })
      .filter(Boolean);
  }, [budgets, prevMonth, prevSpendingByCategory, rollovers]);

  // ── actions ───────────────────────────────────────────────────────────────

  const openNew = () => {
    setNewCategory('');
    setBudgetAmount('');
    setModal({ open: true, category: null });
  };

  const openEdit = (category) => {
    const existing = budgets.find((b) => b.category === category);
    setBudgetAmount(existing ? String((existing.monthlyCents / 100).toFixed(2)) : '');
    setModal({ open: true, category });
  };

  const closeModal = () => setModal({ open: false, category: null });

  const saveBudget = async () => {
    const category = isEditing ? modal.category : newCategory.trim();
    if (!category) return;
    const cents = Math.round(parseFloat(budgetAmount || '0') * 100);
    if (!cents || isNaN(cents) || cents <= 0) return;
    // Auto-add to expense categories if it doesn't exist there yet
    if (!expenseCategories.includes(category)) {
      updateSettings({ categories: [...expenseCategories, category] });
    }
    const existing = budgets.find((b) => b.category === category);
    await saveEntity('budgets', {
      id: `budget-${category}`,
      category,
      monthlyCents: cents,
      currency,
      createdAt: existing?.createdAt || new Date().toISOString(),
    });
    closeModal();
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
          Budgets repeat every month — viewing{' '}
          <span className="font-medium text-ink">{monthLabel(selectedMonth)}</span>
        </p>
      </div>

      <section className="grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2">
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat
            label="Total budgets"
            value={totalBudgetCents}
            formatter={(value) => formatCurrency(value, currency, locale)}
            hint={`${budgets.length} planned ${budgets.length === 1 ? 'category' : 'categories'}`}
            info="The sum of every planned monthly category budget."
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(3)}>
          <Stat
            label="Cashflow - budgets"
            value={cashflowAfterBudgetsCents}
            formatter={(value) => formatCurrency(value, currency, locale)}
            hint={cashflowAfterBudgetsCents >= 0 ? 'left after budgets' : 'over monthly cashflow'}
            tone={cashflowAfterBudgetsCents >= 0 ? 'positive' : 'danger'}
            info="Current monthly cashflow minus total planned monthly budgets."
          />
        </div>
      </section>

      {/* budget cards */}
      <Card
        eyebrow="Plan"
        title="Category budgets"
        description="Your monthly limits for variable spending. These repeat automatically — no need to set them each month."
        action={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCatModalOpen(true)}>
              Manage categories
            </Button>
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> Add budget
            </Button>
          </div>
        }
        className={rise(4)}
      >
        {budgets.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map((b) => (
              <BudgetCard
                key={b.id}
                budget={b}
                spentCents={spendingByCategory[b.category] || 0}
                rolloverCents={appliedRollovers[b.category] || 0}
                currency={currency}
                locale={locale}
                onEdit={() => openEdit(b.category)}
                onRemove={async () => {
                  if (await confirm({ title: 'Remove budget', description: `Remove the budget for "${b.category}"? The category itself won't be affected.` }))
                    removeBudget(b.category);
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No budgets yet"
            description="Add a category to start tracking variable spending against a monthly limit."
            action={
              <Button variant="secondary" size="sm" onClick={openNew}>
                <PlusIcon /> Add category
              </Button>
            }
          />
        )}
      </Card>

      {/* rollover section */}
      {pendingRollovers.length > 0 && (
        <Card
          eyebrow="Month-end"
          title={`Leftovers from ${monthLabel(prevMonth)}`}
          description="You stayed under budget in these categories. Roll the surplus forward, move it to savings, or release it back to total balance."
          className={rise(3)}
        >
          <ul className="divide-y divide-rule">
            {pendingRollovers.map((item) => (
              <li key={item.category} className="flex flex-wrap items-center justify-between gap-4 py-4">
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
                  <Button variant="secondary" size="sm" onClick={() => handleRollover(item, 'rollover')}>
                    Roll to {monthLabel(selectedMonth).split(' ')[0]}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleRollover(item, 'savings')}>
                    Move to savings
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleRollover(item, 'balance')}>
                    Roll to total balance
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ManageCategoriesModal open={catModalOpen} onClose={() => setCatModalOpen(false)} />

      {/* add / edit modal */}
      <Modal
        open={modal.open}
        onClose={closeModal}
        eyebrow="Budget"
        title={isEditing ? `Edit budget — ${modal.category}` : 'Add budget category'}
        size="sm"
      >
        {/* datalist for category suggestions */}
        <datalist id="budget-category-suggestions">
          {unbудgetedSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="grid gap-5">
          {!isEditing && (
            <FormField label="Category" htmlFor="budget-category">
              <Input
                id="budget-category"
                type="text"
                list="budget-category-suggestions"
                placeholder="e.g. Alimentacion, Ocio…"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                autoFocus
              />
            </FormField>
          )}

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
              autoFocus={isEditing}
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={saveBudget}>
              {isEditing ? 'Save changes' : 'Add budget'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
