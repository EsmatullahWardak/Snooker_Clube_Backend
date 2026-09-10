import {
  shiftDateKey,
  zonedDateKey,
  zonedDateRange,
  zonedStartOfDay,
} from './time';

describe('club calendar helpers', () => {
  it('uses the configured club timezone for calendar dates', () => {
    const instant = new Date('2026-09-09T20:00:00.000Z');

    expect(zonedDateKey(instant, 'Asia/Kabul')).toBe('2026-09-10');
    expect(zonedStartOfDay('2026-09-10', 'Asia/Kabul').toISOString()).toBe(
      '2026-09-09T19:30:00.000Z',
    );
  });

  it('builds end-exclusive ranges across daylight-saving changes', () => {
    const range = zonedDateRange('2026-03-08', 'America/New_York');

    expect(range.start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('shifts date keys without using the machine timezone', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});
