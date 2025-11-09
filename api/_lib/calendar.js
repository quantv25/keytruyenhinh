export const Calendar = {
  isLeap: (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  },
  getDaysInMonth: (year, month) => {
    return [
      31,
      Calendar.isLeap(year) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ][month - 1];
  }};

export function getCalendarKeys(year, month, granularity, app) {
  const keys = [];
  const labels = [];
  const daysInMonth = month ? Calendar.getDaysInMonth(year, month) : 12;

  if (granularity === 'day') {
    for (let i = 1; i <= daysInMonth; i++) {
      const day = String(i).padStart(2, "0");
      const m = String(month).padStart(2, "0");
      const label = `${year}-${m}-${day}`;
      keys.push(`installs:day:${app}:${label}`);
      labels.push(label);
    }
  } else { // month
    for (let i = 1; i <= 12; i++) {
      const m = String(i).padStart(2, "0");
      const label = `${year}-${m}`;
      keys.push(`installs:month:${app}:${label}`);
      labels.push(label);
    }
  }
  return { keys, labels };
}

export function getYearlyKeys(fromYear, toYear, app) {
  const keys = [];
  const labels = [];
  for (let y = fromYear; y <= toYear; y++) {
    const label = String(y);
    keys.push(`installs:year:${app}:${label}`);
    labels.push(label);
  }
  return { keys, labels };
}
