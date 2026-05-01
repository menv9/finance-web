import { useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import { PageHeader } from '../components/PageHeader';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { Button, Card, EmptyState, FormField, Input, Modal, Select, Stat, Textarea } from '../components/ui';

const DEBT_TYPES = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'loan', label: 'Personal loan' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'personal', label: 'Informal / friends' },
];

const DEBT_TYPE_LABELS = DEBT_TYPES.reduce((acc, t) => ({ ...acc, [t.value]: t.label }), {});

function centsToAmount(value) {
  if (value == null) return '';
  return ((value || 0) / 100).toFixed(2);
}

function parseAmountToCents(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

function DebtModal({ open, debt, currency, onClose, onSave }) {
  const isEditing = Boolean(debt?.id);
  const [name, setName] = useState(debt?.name || '');
  const [lender, setLender] = useState(debt?.lender || '');
  const [type, setType] = useState(debt?.type || 'loan');
  const [originalAmount, setOriginalAmount] = useState(centsToAmount(debt?.originalAmountCents));
  const [currentBalance, setCurrentBalance] = useState(centsToAmount(debt?.currentBalanceCents));
  const [interestRate, setInterestRate] = useState(
    debt?.interestRatePercent != null ? String(debt.interestRatePercent) : '',
  );
  const [monthlyPayment, setMonthlyPayment] = useState(centsToAmount(debt?.monthlyPaymentCents));
  const [startDate, setStartDate] = useState(debt?.startDate || '');
  const [endDate, setEndDate] = useState(debt?.endDate || '');
  const [notes, setNotes] = useState(debt?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      window.alert('Add a name for the debt.');
      return;
    }
    const originalCents = parseAmountToCents(originalAmount);
    const currentCents = parseAmountToCents(currentBalance);
    if (currentCents < 0) {
      window.alert('Current balance cannot be negative.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...debt,
        name: name.trim(),
        lender: lender.trim(),
        type,
        originalAmountCents: originalCents || currentCents,
        currentBalanceCents: currentCents,
        interestRatePercent: interestRate.trim() ? Number(interestRate) : null,
        monthlyPaymentCents: monthlyPayment.trim() ? parseAmountToCents(monthlyPayment) : null,
        startDate: startDate || null,
        endDate: endDate || null,
        currency,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      window.alert(err.message || 'Unable to save debt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Debt"
      title={isEditing ? 'Edit debt' : 'New debt'}
      description="Track what you owe. Updating the balance here doesn't affect income or expense records."
      size="lg"
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Name" htmlFor="debt-name">
            <Input
              id="debt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apartment mortgage"
              autoFocus
            />
          </FormField>
          <FormField label="Lender" htmlFor="debt-lender" hint="Bank, person, or institution">
            <Input
              id="debt-lender"
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              placeholder="e.g. BBVA, Santander, Mom"
            />
          </FormField>
        </div>

        <FormField label="Type" htmlFor="debt-type">
          <Select id="debt-type" value={type} onChange={(e) => setType(e.target.value)}>
            {DEBT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label={`Original amount (${currency})`}
            htmlFor="debt-original"
            hint="Total borrowed at the start. Used for the progress bar."
          >
            <Input
              id="debt-original"
              type="number"
              step="0.01"
              min="0"
              numeric
              value={originalAmount}
              onChange={(e) => setOriginalAmount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
          <FormField label={`Current balance (${currency})`} htmlFor="debt-current">
            <Input
              id="debt-current"
              type="number"
              step="0.01"
              min="0"
              numeric
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Interest rate (%)" htmlFor="debt-interest" hint="Optional. Annual rate.">
            <Input
              id="debt-interest"
              type="number"
              step="0.01"
              min="0"
              numeric
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="e.g. 3.25"
            />
          </FormField>
          <FormField label={`Monthly payment (${currency})`} htmlFor="debt-monthly" hint="Optional.">
            <Input
              id="debt-monthly"
              type="number"
              step="0.01"
              min="0"
              numeric
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Start date" htmlFor="debt-start" hint="Optional.">
            <Input
              id="debt-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label="End date" htmlFor="debt-end" hint="Optional. When the debt is expected to be paid off.">
            <Input
              id="debt-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="debt-notes">
          <Textarea
            id="debt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this debt"
            rows={3}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEditing ? 'Save changes' : 'Add debt'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function DebtsPage() {
  const confirm = useConfirm();
  const debts = useFinanceStore((s) => s.debts || []);
  const settings = useFinanceStore((s) => s.settings);
  const saveDebt = useFinanceStore((s) => s.saveDebt);
  const removeDebt = useFinanceStore((s) => s.removeDebt);

  const [editingDebt, setEditingDebt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const currency = settings.baseCurrency || 'EUR';
  const locale = settings.locale || 'en-GB';

  const sortedDebts = useMemo(
    () => [...debts].sort((a, b) => (b.currentBalanceCents || 0) - (a.currentBalanceCents || 0)),
    [debts],
  );

  const totalDebtCents = sortedDebts.reduce((sum, d) => sum + Math.max(0, d.currentBalanceCents || 0), 0);
  const totalMonthlyCents = sortedDebts.reduce((sum, d) => sum + (d.monthlyPaymentCents || 0), 0);

  const openNew = () => { setEditingDebt(null); setModalOpen(true); };
  const openEdit = (debt) => { setEditingDebt(debt); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingDebt(null); };

  const handleSave = async (debt) => {
    await saveDebt(debt);
  };

  const handleDelete = async (debt) => {
    const ok = await confirm({
      title: 'Delete debt',
      description: `Remove "${debt.name}" from Debts? Linked expenses won't be deleted.`,
      confirmLabel: 'Delete debt',
      danger: true,
    });
    if (!ok) return;
    await removeDebt(debt.id);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Liability control"
        title="Debts"
        description="Track mortgages, loans, credit cards, and informal debts. Linked expense payments reduce the balance automatically."
        actions={<Button onClick={openNew}>Add debt</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label="Total debt"
            value={formatCurrency(totalDebtCents, currency, locale)}
            hint="Sum of every active debt below."
          />
        </div>
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label="Monthly commitments"
            value={formatCurrency(totalMonthlyCents, currency, locale)}
            hint="Sum of monthly payments declared on each debt."
          />
        </div>
      </div>

      <Card
        title="Active debts"
        description="Edit a debt's balance directly, or pay it down by linking an expense from the Expenses module."
        action={<Button variant="secondary" onClick={openNew}>Add debt</Button>}
      >
        {sortedDebts.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sortedDebts.map((debt) => {
              const original = debt.originalAmountCents || debt.currentBalanceCents || 0;
              const remaining = Math.max(0, debt.currentBalanceCents || 0);
              const paid = Math.max(0, original - remaining);
              const progressPercent = original > 0 ? Math.min(100, Math.round((paid / original) * 100)) : 0;
              return (
                <article
                  key={debt.id}
                  className="rounded-lg border border-rule bg-surface-raised p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="eyebrow text-[0.6rem] text-ink-muted">
                        {DEBT_TYPE_LABELS[debt.type] || 'Debt'}
                        {debt.lender ? ` · ${debt.lender}` : ''}
                      </p>
                      <p className="mt-1 truncate font-display text-lg text-ink">{debt.name}</p>
                    </div>
                    <p className="numeric shrink-0 text-lg font-semibold text-ink">
                      {formatCurrency(remaining, debt.currency || currency, locale)}
                    </p>
                  </div>

                  {original > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
                        <span>Paid {formatCurrency(paid, debt.currency || currency, locale)}</span>
                        <span>of {formatCurrency(original, debt.currency || currency, locale)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-700"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {(debt.interestRatePercent != null || debt.monthlyPaymentCents) && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      {debt.interestRatePercent != null && (
                        <span>Rate · <span className="numeric text-ink">{debt.interestRatePercent}%</span></span>
                      )}
                      {debt.monthlyPaymentCents ? (
                        <span>
                          Monthly · <span className="numeric text-ink">
                            {formatCurrency(debt.monthlyPaymentCents, debt.currency || currency, locale)}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(debt)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(debt)}>Delete</Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No debts yet"
            description="Add a mortgage, loan, credit card balance, or anything you owe to track it here."
            action={<Button onClick={openNew}>Add debt</Button>}
          />
        )}
      </Card>

      {modalOpen ? (
        <DebtModal
          key={editingDebt?.id || 'new'}
          open={modalOpen}
          debt={editingDebt}
          currency={currency}
          onClose={closeModal}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
