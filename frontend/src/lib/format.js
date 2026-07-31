/** Money & duration formatters. USD-only for now (§scope). */
export const formatMoney = (cents, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);

export const formatDuration = (minutes) => {
  const m = Math.max(0, Number(minutes) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}min` : `${h}h`;
};
