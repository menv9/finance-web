import { useMemo, useState } from 'react';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { PageHeader } from '../components/PageHeader';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { Button, Card, EmptyState, FormField, Input, Modal, Select, Stat, Textarea } from '../components/ui';
import { useTranslation } from '../i18n/useTranslation';

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
  const alert = useAlert();
  const { t } = useTranslation();
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

  const DEBT_TYPES = [
    { value: 'mortgage', label: t('debts.modal.typeMortgage') },
    { value: 'loan', label: t('debts.modal.typeLoan') },
    { value: 'credit_card', label: t('debts.modal.typeCreditCard') },
    { value: 'personal', label: t('debts.modal.typePersonal') },
  ];

  const DEBT_TYPE_LABELS = DEBT_TYPES.reduce((acc, dt) => ({ ...acc, [dt.value]: dt.label }), {});

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      await alert({
        title: t('debts.modal.errorMissingName.title'),
        description: t('debts.modal.errorMissingName.description'),
      });
      return;
    }
    const originalCents = originalAmount.trim() !== '' ? parseAmountToCents(originalAmount) : null;
    const currentCents = currentBalance.trim() !== '' ? parseAmountToCents(currentBalance) : null;
    if (currentCents !== null && currentCents < 0) {
      await alert({
        title: t('debts.modal.errorNegativeBalance.title'),
        description: t('debts.modal.errorNegativeBalance.description'),
      });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...debt,
        name: name.trim(),
        lender: lender.trim(),
        type,
        originalAmountCents: originalCents ?? currentCents ?? 0,
        currentBalanceCents: currentCents ?? originalCents ?? 0,
        interestRatePercent: interestRate.trim() ? Number(interestRate) : null,
        monthlyPaymentCents: monthlyPayment.trim() ? parseAmountToCents(monthlyPayment) : null,
        startDate: startDate || null,
        endDate: endDate || null,
        currency,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      await alert({
        title: t('debts.modal.errorSave.title'),
        description: err.message || t('debts.modal.errorSave.description'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t('debts.modal.eyebrow')}
      title={isEditing ? t('debts.modal.titleEdit') : t('debts.modal.titleNew')}
      description={t('debts.modal.description')}
      size="lg"
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={t('debts.modal.nameLabel')} htmlFor="debt-name">
            <Input
              id="debt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('debts.modal.namePlaceholder')}
              autoFocus
            />
          </FormField>
          <FormField label={t('debts.modal.lenderLabel')} htmlFor="debt-lender" hint={t('debts.modal.lenderHint')}>
            <Input
              id="debt-lender"
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              placeholder={t('debts.modal.lenderPlaceholder')}
            />
          </FormField>
        </div>

        <FormField label={t('debts.modal.typeLabel')} htmlFor="debt-type">
          <Select id="debt-type" value={type} onChange={(e) => setType(e.target.value)}>
            {DEBT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label={t('debts.modal.originalAmountLabel', { currency })}
            htmlFor="debt-original"
            hint={t('debts.modal.originalAmountHint')}
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
          <FormField label={t('debts.modal.currentBalanceLabel', { currency })} htmlFor="debt-current">
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
          <FormField label={t('debts.modal.interestRateLabel')} htmlFor="debt-interest" hint={t('debts.modal.interestRateHint')}>
            <Input
              id="debt-interest"
              type="number"
              step="0.01"
              min="0"
              numeric
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder={t('debts.modal.interestRatePlaceholder')}
            />
          </FormField>
          <FormField label={t('debts.modal.monthlyPaymentLabel', { currency })} htmlFor="debt-monthly" hint={t('debts.modal.monthlyPaymentHint')}>
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
          <FormField label={t('debts.modal.startDateLabel')} htmlFor="debt-start" hint={t('debts.modal.startDateHint')}>
            <Input
              id="debt-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label={t('debts.modal.endDateLabel')} htmlFor="debt-end" hint={t('debts.modal.endDateHint')}>
            <Input
              id="debt-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label={t('debts.modal.notesLabel')} htmlFor="debt-notes">
          <Textarea
            id="debt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('debts.modal.notesPlaceholder')}
            rows={3}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>{isEditing ? t('debts.modal.saveChanges') : t('debts.modal.addDebt')}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function DebtsPage() {
  const confirm = useConfirm();
  const { t, locale } = useTranslation();
  const debts = useFinanceStore((s) => s.debts || []);
  const settings = useFinanceStore((s) => s.settings);
  const saveDebt = useFinanceStore((s) => s.saveDebt);
  const removeDebt = useFinanceStore((s) => s.removeDebt);

  const [editingDebt, setEditingDebt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const currency = settings.baseCurrency || 'EUR';

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
      title: t('debts.confirmDelete.title'),
      description: t('debts.confirmDelete.description', { name: debt.name }),
      confirmLabel: t('debts.confirmDelete.confirm'),
      danger: true,
    });
    if (!ok) return;
    await removeDebt(debt.id);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('debts.eyebrow')}
        title={t('debts.title')}
        description={t('debts.description')}
        actions={<Button onClick={openNew}>{t('debts.addDebt')}</Button>}
      />

      <div data-tour="debts-summary" className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label={t('debts.kpiTotalDebt.label')}
            value={formatCurrency(totalDebtCents, currency, locale)}
            hint={t('debts.kpiTotalDebt.hint')}
          />
        </div>
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label={t('debts.kpiMonthlyCommitments.label')}
            value={formatCurrency(totalMonthlyCents, currency, locale)}
            hint={t('debts.kpiMonthlyCommitments.hint')}
          />
        </div>
      </div>

      <Card
        data-tour="debts-list"
        title={t('debts.listCard.title')}
        description={t('debts.listCard.description')}
        action={<Button variant="secondary" onClick={openNew}>{t('debts.addDebt')}</Button>}
      >
        {sortedDebts.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sortedDebts.map((debt) => {
              const DEBT_TYPE_LABELS_LOCAL = {
                mortgage: t('debts.modal.typeMortgage'),
                loan: t('debts.modal.typeLoan'),
                credit_card: t('debts.modal.typeCreditCard'),
                personal: t('debts.modal.typePersonal'),
              };
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
                        {DEBT_TYPE_LABELS_LOCAL[debt.type] || t('debts.title')}
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
                        <span>{t('debts.listCard.paid', { amount: formatCurrency(paid, debt.currency || currency, locale) })}</span>
                        <span>{t('debts.listCard.of', { amount: formatCurrency(original, debt.currency || currency, locale) })}</span>
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
                        <span>{t('debts.listCard.rate', { rate: debt.interestRatePercent })}</span>
                      )}
                      {debt.monthlyPaymentCents ? (
                        <span>
                          {t('debts.listCard.monthly', { amount: formatCurrency(debt.monthlyPaymentCents, debt.currency || currency, locale) })}
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(debt)}>{t('common.edit')}</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(debt)}>{t('common.delete')}</Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={t('debts.listCard.emptyTitle')}
            description={t('debts.listCard.emptyDescription')}
            action={<Button onClick={openNew}>{t('debts.addDebt')}</Button>}
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
