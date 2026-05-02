import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { PageHeader } from '../components/PageHeader';
import { SmartBankImport } from '../components/SmartBankImport';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { Button, Card, Checkbox, EmptyState, FormField, Input, Modal, Stat } from '../components/ui';
import { useTranslation } from '../i18n/useTranslation';

function centsToAmount(value) {
  return ((value || 0) / 100).toFixed(2);
}

function parseAmountToCents(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

function AccountModal({ open, account, currency, onClose, onSave }) {
  const alert = useAlert();
  const { t } = useTranslation();
  const [name, setName] = useState(account?.name || '');
  const [balance, setBalance] = useState(centsToAmount(account?.balanceCents));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      await alert({ title: t('accounts.modal.errorMissingName.title'), description: t('accounts.modal.errorMissingName.description') });
      return;
    }
    const balanceCents = parseAmountToCents(balance);
    if (balanceCents < 0) {
      await alert({ title: t('accounts.modal.errorNegativeBalance.title'), description: t('accounts.modal.errorNegativeBalance.description') });
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave({
        ...account,
        name: trimmedName,
        balanceCents,
        currency,
      });
      if (saved === false) return;
      onClose();
    } catch (err) {
      await alert({ title: t('accounts.modal.errorSave.title'), description: err.message || t('accounts.modal.errorSave.description') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t('accounts.modal.eyebrow')}
      title={account ? t('accounts.modal.titleEdit') : t('accounts.modal.titleNew')}
      description={t('accounts.modal.description')}
    >
      <form id="account-form" className="grid gap-5" onSubmit={handleSubmit}>
        <FormField label={t('accounts.modal.nameLabel')} htmlFor="account-name">
          <Input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('accounts.modal.namePlaceholder')}
            autoFocus
          />
        </FormField>
        <FormField label={t('accounts.modal.balanceLabel', { currency })} htmlFor="account-balance">
          <Input
            id="account-balance"
            type="number"
            step="0.01"
            min="0"
            numeric
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            placeholder="0.00"
          />
        </FormField>
        <div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>{t('accounts.modal.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AccountsPage() {
  const confirm = useConfirm();
  const { t, locale } = useTranslation();
  const accounts = useFinanceStore((state) => state.bankAccounts || []);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const [editingAccount, setEditingAccount] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importingAccount, setImportingAccount] = useState(null);
  const [bankConnectedBanner, setBankConnectedBanner] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('bank') === 'connected') {
      setBankConnectedBanner(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const currency = settings.baseCurrency || 'EUR';
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => Number(Boolean(b.isMain)) - Number(Boolean(a.isMain)) || (a.name || '').localeCompare(b.name || '')),
    [accounts],
  );
  const totalBalanceCents = sortedAccounts.reduce((sum, account) => sum + (account.balanceCents || 0), 0);

  const openNewAccount = () => {
    setEditingAccount(null);
    setModalOpen(true);
  };

  const openEditAccount = (account) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAccount(null);
  };

  const handleSave = async (account) => {
    const previous = account.id ? accounts.find((item) => item.id === account.id) : null;
    const nextAccount = {
      ...account,
      isMain: account.isMain ?? (!previous && accounts.length === 0),
    };
    const balanceChanged = previous && (previous.balanceCents || 0) !== (account.balanceCents || 0);
    if (balanceChanged) {
      const ok = await confirm({
        title: t('accounts.confirmUpdateBalance.title'),
        description: t('accounts.confirmUpdateBalance.description', {
          name: previous.name,
          from: formatCurrency(previous.balanceCents || 0, previous.currency || currency, locale),
          to: formatCurrency(account.balanceCents || 0, account.currency || currency, locale),
        }),
        confirmLabel: t('accounts.confirmUpdateBalance.confirm'),
      });
      if (!ok) return false;
    }
    if (nextAccount.isMain) {
      const otherMainAccounts = accounts.filter((item) => item.id !== nextAccount.id && item.isMain);
      for (const other of otherMainAccounts) {
        await saveEntity('bankAccounts', { ...other, isMain: false });
      }
    }
    await saveEntity('bankAccounts', nextAccount);
    return true;
  };

  const handleMainChange = async (account, checked) => {
    if (checked) {
      const otherMainAccounts = accounts.filter((item) => item.id !== account.id && item.isMain);
      for (const other of otherMainAccounts) {
        await saveEntity('bankAccounts', { ...other, isMain: false });
      }
    }
    await saveEntity('bankAccounts', { ...account, isMain: checked });
  };

  const handleDelete = async (account) => {
    const ok = await confirm({
      title: t('accounts.confirmDelete.title'),
      description: t('accounts.confirmDelete.description', { name: account.name }),
      confirmLabel: t('accounts.confirmDelete.confirm'),
    });
    if (!ok) return;
    await removeEntity('bankAccounts', account.id);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('accounts.eyebrow')}
        title={t('accounts.title')}
        description={t('accounts.description')}
        actions={<Button onClick={openNewAccount}>{t('accounts.addAccount')}</Button>}
      />

      {bankConnectedBanner ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          <span>
            {t('accounts.bankConnected', { strong: t('accounts.bankConnectedSync') }).split(t('accounts.bankConnectedSync')).map((part, i, arr) =>
              i < arr.length - 1
                ? [part, <strong key={i}>{t('accounts.bankConnectedSync')}</strong>]
                : part
            )}
          </span>
          <button
            type="button"
            className="shrink-0 opacity-60 hover:opacity-100"
            onClick={() => setBankConnectedBanner(false)}
          >
            ✕
          </button>
        </div>
      ) : null}

      <div data-tour="accounts-summary" className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label={t('accounts.kpiTotalBalance.label')}
            value={formatCurrency(totalBalanceCents, currency, locale)}
            hint={t('accounts.kpiTotalBalance.hint')}
          />
        </div>
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label={t('accounts.kpiBankAccounts.label')}
            value={String(sortedAccounts.length)}
            hint={t('accounts.kpiBankAccounts.hint')}
          />
        </div>
      </div>

      <Card
        data-tour="accounts-list"
        title={t('accounts.listCard.title')}
        description={t('accounts.listCard.description')}
        action={<Button variant="secondary" onClick={openNewAccount}>{t('accounts.addAccount')}</Button>}
      >
        {sortedAccounts.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sortedAccounts.map((account) => (
              <article
                key={account.id}
                className="rounded-lg border border-rule bg-surface-raised p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-display text-lg text-ink">{account.name}</p>
                      {account.isMain ? (
                        <span className="shrink-0 rounded-sm border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-accent">
                          {t('accounts.listCard.badgeMain')}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{account.currency || currency}</p>
                  </div>
                  <p className="numeric shrink-0 text-lg font-semibold text-ink">
                    {formatCurrency(account.balanceCents || 0, account.currency || currency, locale)}
                  </p>
                </div>
                <div className="mt-4 border-t border-rule pt-3">
                  <Checkbox
                    id={`account-main-${account.id}`}
                    label={t('accounts.listCard.useAsMain')}
                    checked={Boolean(account.isMain)}
                    onChange={(checked) => handleMainChange(account, checked)}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setImportingAccount(account)}>{t('accounts.listCard.importCsv')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditAccount(account)}>{t('common.edit')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(account)}>{t('common.delete')}</Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('accounts.listCard.emptyTitle')}
            description={t('accounts.listCard.emptyDescription')}
            action={<Button onClick={openNewAccount}>{t('accounts.addAccount')}</Button>}
          />
        )}
      </Card>

      {modalOpen ? (
        <AccountModal
          key={editingAccount?.id || 'new'}
          open={modalOpen}
          account={editingAccount}
          currency={currency}
          onClose={closeModal}
          onSave={handleSave}
        />
      ) : null}

      {importingAccount ? (
        <Modal
          key={`import-${importingAccount.id}`}
          open
          onClose={() => setImportingAccount(null)}
          eyebrow={t('accounts.importModal.eyebrow')}
          title={t('accounts.importModal.titlePrefix', { name: importingAccount.name })}
          description={t('accounts.importModal.description')}
          size="lg"
        >
          <SmartBankImport
            categories={settings.categories}
            bankAccountId={importingAccount.id}
            onImportExpenses={async (rows) => {
              for (const row of rows) await saveEntity('expenses', row, { skipAccountAdjustment: true });
            }}
            onImportIncomes={async (rows) => {
              for (const row of rows) await saveEntity('incomes', row, { skipAccountAdjustment: true });
            }}
            onImportComplete={async ({ latestBalanceCents }) => {
              if (latestBalanceCents == null) return;
              await saveEntity('bankAccounts', {
                ...importingAccount,
                balanceCents: latestBalanceCents,
              });
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
