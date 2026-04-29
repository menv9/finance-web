import { BudgetTab } from '../components/BudgetTab';
import { PageHeader } from '../components/PageHeader';

export default function BudgetsPage() {
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="04"
        eyebrow="Module"
        title="Budgets"
        description="Plan monthly category budgets, compare them with cashflow, and decide how leftover budget rolls forward."
      />
      <BudgetTab />
    </div>
  );
}
