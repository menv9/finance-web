import { EmptyState } from './ui';
import { formatCurrency } from '../utils/formatters';

export function RecentActivity({ items, currency, locale, emptyTitle, emptyDescription, hideAmounts = false }) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ul className="divide-y divide-rule">
      {items.map((item) => {
        const isPortfolioSaleLoss = item.incomeKind === 'portfolio_sale' && (item.realizedPnlCents || 0) < 0;
        const visualAmountCents = isPortfolioSaleLoss ? item.realizedPnlCents : item.amountCents;
        const amountClass = isPortfolioSaleLoss
          ? 'text-danger'
          : item.direction === 'in'
            ? 'text-positive'
            : 'text-danger';
        return (
          <li key={`${item.type}-${item.id}`} className="flex items-baseline justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{item.label}</p>
              <p className="eyebrow mt-1">
                {item.type} · {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(item.date))}
              </p>
            </div>
            <span
              className={
                'numeric text-sm tabular rounded px-1.5 py-0.5 ' +
                (amountClass === 'text-danger'
                  ? 'text-danger bg-danger-soft'
                  : amountClass === 'text-positive'
                    ? 'text-positive bg-positive-soft'
                    : amountClass)
              }
            >
              {hideAmounts ? '••••' : (
                <>
                  {isPortfolioSaleLoss ? '−' : item.direction === 'in' ? '+' : '−'}
                  {formatCurrency(Math.abs(visualAmountCents), currency, locale).replace(/^[−-]/, '')}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default RecentActivity;
