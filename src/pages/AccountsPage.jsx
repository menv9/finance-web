import { useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import { PageHeader } from '../components/PageHeader';
import { SmartBankImport } from '../components/SmartBankImport';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { Button, Card, Checkbox, EmptyState, FormField, Input, Modal, Stat } from '../components/ui';

function centsToAmount(value) {
  return ((value || 0) / 100).toFixed(2);
}

function parseAmountToCents(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

function AccountModal({ open, account, currency, onClose, onSave }) {
  const [name, setName] = useState(account?.name || '');
  const [balance, setBalance] = useState(centsToAmount(account?.balanceCents));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      window.alert('Add an account name.');
      return;
    }
    const balanceCents = parseAmountToCents(balance);
    if (balanceCents < 0) {
      window.alert('Bank account balance cannot be negative.');
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
      window.alert(err.message || 'Unable to save account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Bank account"
      title={account ? 'Edit account' : 'New account'}
      description="Update the real balance held by this bank. This does not create income or expense records."
    >
      <form id="account-form" className="grid gap-5" onSubmit={handleSubmit}>
        <FormField label="Account name" htmlFor="account-name">
          <Input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Santander main"
            autoFocus
          />
        </FormField>
        <FormField label={`Current balance (${currency})`} htmlFor="account-balance">
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
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save account</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AccountsPage() {
  const confirm = useConfirm();
  const accounts = useFinanceStore((state) => state.bankAccounts || []);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const [editingAccount, setEditingAccount] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importingAccount, setImportingAccount] = useState(null);

  const currency = settings.baseCurrency || 'EUR';
  const locale = settings.locale || 'en-GB';
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
        title: 'Update bank funds',
        description: `Are you sure you want to change "${previous.name}" from ${formatCurrency(previous.balanceCents || 0, previous.currency || currency, locale)} to ${formatCurrency(account.balanceCents || 0, account.currency || currency, locale)}? This will update total balance directly without creating income or expense records.`,
        confirmLabel: 'Update balance',
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
      title: 'Delete account',
      description: `Remove "${account.name}" from Accounts? This changes total balance only; income and expenses stay untouched.`,
      confirmLabel: 'Delete account',
    });
    if (!ok) return;
    await removeEntity('bankAccounts', account.id);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Balance control"
        title="Accounts"
        description="Track money by bank and adjust real balances without changing income or expense history."
        actions={<Button onClick={openNewAccount}>Add account</Button>}
      />

      <div data-tour="accounts-summary" className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label="Total balance"
            value={formatCurrency(totalBalanceCents, currency, locale)}
            hint="Sum of every bank account listed below."
          />
        </div>
        <div className="min-w-0 rounded-lg border border-rule bg-surface p-6">
          <Stat
            label="Bank accounts"
            value={String(sortedAccounts.length)}
            hint="Each account can be edited independently."
          />
        </div>
      </div>

      <Card
        data-tour="accounts-list"
        title="Bank accounts"
        description="Edit the current funds in each bank account. Changes update your total balance directly."
        action={<Button variant="secondary" onClick={openNewAccount}>Add account</Button>}
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
                          Main
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
                    label="Use as main account"
                    checked={Boolean(account.isMain)}
                    onChange={(checked) => handleMainChange(account, checked)}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setImportingAccount(account)}>Import CSV</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditAccount(account)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(account)}>Delete</Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No bank accounts yet"
            description="Add your first bank account to make total balance editable from Accounts."
            action={<Button onClick={openNewAccount}>Add account</Button>}
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
          eyebrow="Bank account"
          title={`Import CSV — ${importingAccount.name}`}
          description="Imported transactions will be tagged to this account, and the bank balance will be updated to match the latest running balance from the file."
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
