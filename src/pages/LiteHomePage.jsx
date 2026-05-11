import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import { buildRecentActivity } from '../utils/finance';
import { Card, Stat, Button } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import RecentActivity from '../components/RecentActivity';
import { useTranslation } from '../i18n/useTranslation';
import { rise } from '../utils/motion';

function openEntryModal(kind) {
  window.dispatchEvent(new CustomEvent('finance:open-entry-modal', { detail: kind }));
}

function PlusBig() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function LiteHomePage() {
  const { t, locale } = useTranslation();
  const settings = useFinanceStore((state) => state.settings);
  const expenses = useFinanceStore((state) => state.expenses);
  const incomes = useFinanceStore((state) => state.incomes);
  const dividends = useFinanceStore((state) => state.dividends);
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const profile = useFinanceStore((state) => state.profile);
  const currency = settings.baseCurrency;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return t('lite.home.greetingNight');
    if (hour < 12) return t('lite.home.greetingMorning');
    if (hour < 18) return t('lite.home.greetingAfternoon');
    return t('lite.home.greetingEvening');
  }, [t]);

  const recent = useMemo(
    () => buildRecentActivity({ expenses, incomes, dividends, limit: 6 }),
    [expenses, incomes, dividends],
  );

  const firstName = profile?.displayName?.split(' ')[0] || '';
  const title = firstName ? `${greeting}, ${firstName}` : greeting;

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={t('lite.home.description')} />

      <section className={'grid grid-cols-2 gap-3 ' + rise(0)}>
        <button
          type="button"
          onClick={() => openEntryModal('expense')}
          className="group flex flex-col items-start gap-3 rounded-2xl border border-rule bg-surface-raised p-5 text-left transition-all hover:border-accent hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger transition-transform group-hover:scale-105">
            <PlusBig />
          </span>
          <span className="text-base font-medium text-ink">{t('lite.home.addExpense')}</span>
          <span className="eyebrow">{t('lite.home.addExpenseHint')}</span>
        </button>

        <button
          type="button"
          onClick={() => openEntryModal('income')}
          className="group flex flex-col items-start gap-3 rounded-2xl border border-rule bg-surface-raised p-5 text-left transition-all hover:border-accent hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-positive-soft text-positive transition-transform group-hover:scale-105">
            <PlusBig />
          </span>
          <span className="text-base font-medium text-ink">{t('lite.home.addIncome')}</span>
          <span className="eyebrow">{t('lite.home.addIncomeHint')}</span>
        </button>
      </section>

      <section className={rise(1)}>
        <Card>
          <Stat
            label={t('lite.home.balance')}
            value={dashboard.availableBalanceCents}
            mode="currency"
            hint={t('lite.home.balanceHint')}
          />
        </Card>
      </section>

      <section className={rise(2)}>
        <Card
          title={t('lite.home.recent')}
          action={
            <Button as={Link} to="/expenses" variant="ghost" size="sm">
              {t('lite.home.viewAll')}
            </Button>
          }
        >
          <RecentActivity
            items={recent}
            currency={currency}
            locale={locale}
            emptyTitle={t('lite.home.emptyTitle')}
            emptyDescription={t('lite.home.emptyDescription')}
          />
        </Card>
      </section>
    </div>
  );
}
