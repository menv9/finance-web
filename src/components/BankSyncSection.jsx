import { useEffect, useState } from 'react';
import { Button, Card, EmptyState, FormField, Modal, Select } from './ui';
import { createBankLink, getInstitutions, syncBankAccounts } from '../utils/gocardless';

const COUNTRIES = [
  { value: 'ES', label: 'Spain' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'PT', label: 'Portugal' },
  { value: 'BE', label: 'Belgium' },
  { value: 'AT', label: 'Austria' },
];

export function BankSyncSection({ userId, onSyncComplete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [country, setCountry] = useState('ES');
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState('');
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  if (!userId) {
    return (
      <Card
        title="GoCardless bank sync"
        description="Connect your real bank accounts to automatically pull in live balances."
      >
        <p className="text-sm text-ink-muted">
          Sign in with Supabase to connect and sync bank accounts via GoCardless.
        </p>
      </Card>
    );
  }

  useEffect(() => {
    if (!modalOpen) return;
    setLoadingInstitutions(true);
    setInstitutionId('');
    setError(null);
    getInstitutions(country)
      .then(setInstitutions)
      .catch(() => setError('Failed to load banks. Check your GoCardless credentials.'))
      .finally(() => setLoadingInstitutions(false));
  }, [modalOpen, country]);

  const handleConnect = async () => {
    if (!institutionId || !userId) return;
    setConnecting(true);
    setError(null);
    try {
      const { link } = await createBankLink({ institutionId, userId });
      window.location.href = link;
    } catch {
      setError('Failed to start bank connection. Try again.');
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!userId) return;
    setSyncing(true);
    setError(null);
    try {
      const { results } = await syncBankAccounts(userId);
      onSyncComplete?.(results ?? []);
    } catch {
      setError('Sync failed. Make sure your bank is still connected.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Card
        title="GoCardless bank sync"
        description="Connect your real bank accounts to automatically pull in live balances."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" loading={syncing} onClick={handleSync}>
              Sync now
            </Button>
            <Button onClick={() => { setModalOpen(true); setError(null); }}>
              Connect bank
            </Button>
          </div>
        }
      >
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <EmptyState
            title="No banks connected yet"
            description="Connect a bank account to sync live balances automatically."
            action={<Button onClick={() => setModalOpen(true)}>Connect a bank</Button>}
          />
        )}
      </Card>

      {modalOpen ? (
        <Modal
          open
          onClose={() => setModalOpen(false)}
          eyebrow="GoCardless"
          title="Connect a bank"
          description="Pick your country and bank. You'll be redirected to securely authenticate."
        >
          <div className="grid gap-5">
            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <FormField label="Country" htmlFor="gc-country">
              <Select
                id="gc-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Bank" htmlFor="gc-institution">
              {loadingInstitutions ? (
                <p className="text-sm text-ink-muted">Loading banks...</p>
              ) : (
                <Select
                  id="gc-institution"
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                >
                  <option value="">Select a bank...</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </Select>
              )}
            </FormField>

            <div className="flex justify-end gap-2 border-t border-rule pt-5">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={connecting}
                disabled={!institutionId || loadingInstitutions}
                onClick={handleConnect}
              >
                Connect
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
