import { Button, FormField, Input } from './ui';
import { cn } from './ui/cn';

function monthToDate(month) {
  const [year, monthIndex] = (month || '').split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (monthIndex || 1) - 1, 1);
}

function formatMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function shiftMonth(month, amount) {
  const date = monthToDate(month);
  date.setMonth(date.getMonth() + amount);
  return formatMonth(date);
}

function currentMonth() {
  return formatMonth(new Date());
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
      <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
      <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MonthSelector({ id, value, onChange, label = 'Viewing month', className }) {
  return (
    <section className={cn('flex flex-wrap items-end justify-between gap-3 rounded-lg border border-rule bg-surface p-4', className)}>
      <FormField label={label} htmlFor={id} className="min-w-[220px] flex-1">
        <Input
          id={id}
          type="month"
          value={value}
          onChange={(event) => onChange(event.target.value || currentMonth())}
        />
      </FormField>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          className="h-10 w-10 px-0"
          aria-label="Previous month"
          onClick={() => onChange(shiftMonth(value, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button variant="secondary" size="md" onClick={() => onChange(currentMonth())}>
          Today
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="h-10 w-10 px-0"
          aria-label="Next month"
          onClick={() => onChange(shiftMonth(value, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </section>
  );
}
