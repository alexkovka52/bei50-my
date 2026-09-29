const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** UTC weekday for a `YYYY-MM-DD` calendar date. Null when the date is not real. */
export function weekdayIndex(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return utc.getUTCDay();
}

export function weekdayNames(isoDate: string): { weekday: string; weekdayShort: string } | null {
  const index = weekdayIndex(isoDate);
  if (index === null) return null;
  return { weekday: WEEKDAYS[index] ?? "Sunday", weekdayShort: WEEKDAYS_SHORT[index] ?? "Sun" };
}
