import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';

export function toDate(dateLike) {
  return typeof dateLike === 'string' ? parseISO(dateLike) : dateLike;
}

export function monthKey(dateLike) {
  return format(toDate(dateLike), 'yyyy-MM');
}

export function monthLabel(dateLike) {
  return format(toDate(dateLike), 'MMM yy');
}

export function isWithinMonth(dateLike, month) {
  return monthKey(dateLike) === month;
}

export function lastTwelveMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = subMonths(startOfMonth(now), 11 - index);
    return {
      key: monthKey(date),
      label: monthLabel(date),
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  });
}

export function upcomingWithinDays(dayOfMonth, daysAhead = 7) {
  const now = new Date();
  // Clamp dayOfMonth to the last valid day of the target month so a chargeDay of
  // 31 in February resolves to Feb 28/29, not Mar 3 via JS Date overflow.
  const clampedDay = (year, monthIndex) => {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return Math.min(dayOfMonth, lastDay);
  };
  const currentMonthCandidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    clampedDay(now.getFullYear(), now.getMonth()),
  );
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthCandidate = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    clampedDay(nextMonth.getFullYear(), nextMonth.getMonth()),
  );
  const dueDate = isBefore(currentMonthCandidate, now) ? nextMonthCandidate : currentMonthCandidate;
  return differenceInCalendarDays(dueDate, now) <= daysAhead ? dueDate : null;
}

export function normalizeDateInput(value) {
  if (!value) return format(new Date(), 'yyyy-MM-dd');
  return format(toDate(value), 'yyyy-MM-dd');
}

export function nextDateInDays(base, days) {
  return addDays(toDate(base), days);
}

export function isUpcoming(dateLike, daysAhead = 7) {
  const date = toDate(dateLike);
  const now = new Date();
  const future = addDays(now, daysAhead);
  return isAfter(date, now) && isBefore(date, future);
}
