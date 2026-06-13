// Türkiye saatine göre bugünün tarihi (YYYY-MM-DD). UTC kayması olmaz.
export function todayInTR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
