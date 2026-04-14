export interface UtcMonthPeriod {
  periodStart: string;
  periodEnd: string;
}

export function getUtcMonthPeriod(now = new Date()): UtcMonthPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const periodStartDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const periodEndDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return {
    periodStart: periodStartDate.toISOString(),
    periodEnd: periodEndDate.toISOString(),
  };
}
