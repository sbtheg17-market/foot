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

/** Booking date/time formatters. Browser TZ; keep it human. */
const _sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const _startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const formatBookingDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (_sameDay(d, now)) return "Today";
  if (_sameDay(d, tomorrow)) return "Tomorrow";
  if (_sameDay(d, yesterday)) return "Yesterday";

  const diffDays = Math.round((_startOfDay(d) - _startOfDay(now)) / 86400000);
  if (diffDays > 0 && diffDays < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d);
};

export const formatBookingTime = (iso) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export const formatBookingDateTime = (iso) =>
  `${formatBookingDate(iso)} · ${formatBookingTime(iso)}`;

export const isBookingToday = (iso) => _sameDay(new Date(iso), new Date());
