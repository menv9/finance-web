import { BudgetTab } from '../components/BudgetTab';
import { PageHeader } from '../components/PageHeader';
import { useTranslation } from '../i18n/useTranslation';

export default function BudgetsPage() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="04"
        eyebrow={t('budgets.eyebrow')}
        title={t('budgets.title')}
        description={t('budgets.description')}
      />
      <BudgetTab />
    </div>
  );
}
