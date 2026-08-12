const PARIS_TZ = 'Europe/Paris';

function parisOffsetMinutes(utcDate) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TZ,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(utcDate).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return (asUtc - utcDate.getTime()) / 60000;
}

// Returns the Unix timestamp (seconds) for 00:00:00 Europe/Paris on the given
// calendar date (y, m, d — m is 1-indexed), handling DST correctly.
export function parisMidnightTimestamp(year, month, day) {
  const guessUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMin = parisOffsetMinutes(new Date(guessUtcMs));
  const utcMs = guessUtcMs - offsetMin * 60000;
  return Math.round(utcMs / 1000);
}

// FFVB's date_jour = Paris midnight of the Wednesday 5 days before the
// Monday of the target week.
export function dateJourForMonday(year, month, day) {
  const monday = new Date(Date.UTC(year, month - 1, day));
  const wed = new Date(monday.getTime() - 5 * 86400000);
  return parisMidnightTimestamp(wed.getUTCFullYear(), wed.getUTCMonth() + 1, wed.getUTCDate());
}

// Generates the Monday of each week from startMonday (inclusive) up to
// endMonday (inclusive), as {year, month, day, dateJour} objects.
export function seasonWeeks(startMonday, endMonday) {
  const weeks = [];
  let cur = new Date(Date.UTC(startMonday.year, startMonday.month - 1, startMonday.day));
  const end = new Date(Date.UTC(endMonday.year, endMonday.month - 1, endMonday.day));
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear(), m = cur.getUTCMonth() + 1, d = cur.getUTCDate();
    weeks.push({ year: y, month: m, day: d, dateJour: dateJourForMonday(y, m, d) });
    cur = new Date(cur.getTime() + 7 * 86400000);
  }
  return weeks;
}
