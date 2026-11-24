const newYorkDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York'});
const newYorkHour = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23',
});
const iso = date => date.toISOString().slice(0, 10);
const dateAt = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

function weekdayInMonth(year, month, weekday, occurrence) {
  const first = dateAt(year, month, 1);
  return dateAt(year, month, 1 + (weekday - first.getUTCDay() + 7) % 7 + (occurrence - 1) * 7);
}

function observed(year, month, day) {
  const date = dateAt(year, month, day);
  if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

// Gregorian Easter calculation, used to locate the Good Friday market holiday.
function goodFriday(year) {
  const cycle = year % 19;
  const century = Math.floor(year / 100);
  const remainder = year % 100;
  const correction = Math.floor((century - Math.floor((century + 8) / 25) + 1) / 3);
  const epact = (19 * cycle + century - Math.floor(century / 4) - correction + 15) % 30;
  const weekday = (32 + 2 * (century % 4) + 2 * Math.floor(remainder / 4) - epact - remainder % 4) % 7;
  const adjustment = Math.floor((cycle + 11 * epact + 22 * weekday) / 451);
  const offset = epact + weekday - 7 * adjustment + 114;
  return dateAt(year, Math.floor(offset / 31), offset % 31 - 1);
}

function holidays(year) {
  const memorialDay = dateAt(year, 5, 31);
  memorialDay.setUTCDate(31 - (memorialDay.getUTCDay() + 6) % 7);
  const newYear = dateAt(year, 1, 1);
  // NYSE does not observe a Saturday New Year's Day on the prior Friday.
  if (newYear.getUTCDay() === 0) newYear.setUTCDate(2);
  return new Set([
    newYear, weekdayInMonth(year, 1, 1, 3), weekdayInMonth(year, 2, 1, 3),
    goodFriday(year), memorialDay, observed(year, 6, 19), observed(year, 7, 4),
    weekdayInMonth(year, 9, 1, 1), weekdayInMonth(year, 11, 4, 4), observed(year, 12, 25),
  ].map(iso));
}

export function latestClosedSession(now) {
  const date = new Date(newYorkDate.format(now) + 'T12:00:00Z');
  if (Number(newYorkHour.format(now)) < 17) date.setUTCDate(date.getUTCDate() - 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidays(date.getUTCFullYear()).has(iso(date))) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return iso(date);
}
