interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const dateFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'iso8601',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const values: ZonedParts = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  };
  for (const part of dateFormatter(timeZone).formatToParts(instant)) {
    if (part.type in values) {
      values[part.type as keyof ZonedParts] = Number(part.value);
    }
  }
  return values;
}

function timeZoneOffsetMilliseconds(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - instant.getTime()
  );
}

export function zonedDateKey(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function databaseDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function zonedStartOfDay(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const desiredWallClock = Date.UTC(year, month - 1, day);
  let instant = new Date(desiredWallClock);
  for (let index = 0; index < 3; index += 1) {
    const offset = timeZoneOffsetMilliseconds(instant, timeZone);
    instant = new Date(desiredWallClock - offset);
  }
  return instant;
}

export function zonedDateRange(dateKey: string, timeZone: string) {
  return {
    start: zonedStartOfDay(dateKey, timeZone),
    end: zonedStartOfDay(shiftDateKey(dateKey, 1), timeZone),
  };
}
