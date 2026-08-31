import { describe, it, expect } from 'vitest';
import {
  generateTemplateSlots,
  timeStringToTimestamp,
  timestampToTimeString,
} from '../slotGeneration';

const createMockTimestamp = (hour: number, minute: number) => {
  const d = new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
  return {
    toDate: () => d,
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toMillis: () => d.getTime(),
  };
};

describe('slotGeneration in @pcn/shared', () => {
  const mockSchedule = {
    monday: {
      enabled: true,
      slots: [{ startTime: createMockTimestamp(9, 0), endTime: createMockTimestamp(11, 0) }],
    },
    tuesday: { enabled: false, slots: [] },
    wednesday: { enabled: false, slots: [] },
    thursday: { enabled: false, slots: [] },
    friday: { enabled: false, slots: [] },
    saturday: { enabled: false, slots: [] },
    sunday: { enabled: false, slots: [] },
  };

  it('generates 30-minute cadence slots forward from anchor date', () => {
    // 2026-08-31 is a Monday
    const anchorDate = new Date('2026-08-31T00:00:00Z');

    const slots = generateTemplateSlots({
      availableDays: mockSchedule,
      blockedDates: [],
      timezone: 'UTC',
      anchorDate,
      horizonDays: 1,
    });

    expect(slots).toEqual([
      '2026-08-31T09:00:00.000Z',
      '2026-08-31T09:30:00.000Z',
      '2026-08-31T10:00:00.000Z',
      '2026-08-31T10:30:00.000Z',
    ]);
  });

  it('skips dates that are in the blockedDates array', () => {
    const anchorDate = new Date('2026-08-31T00:00:00Z');

    const slots = generateTemplateSlots({
      availableDays: mockSchedule,
      blockedDates: ['2026-08-31'],
      timezone: 'UTC',
      anchorDate,
      horizonDays: 1,
    });

    expect(slots).toEqual([]);
  });

  it('skips days that are not enabled in schedule template', () => {
    // 2026-09-01 is a Tuesday (disabled)
    const anchorDate = new Date('2026-09-01T00:00:00Z');

    const slots = generateTemplateSlots({
      availableDays: mockSchedule,
      blockedDates: [],
      timezone: 'UTC',
      anchorDate,
      horizonDays: 1,
    });

    expect(slots).toEqual([]);
  });

  it('timeStringToTimestamp converts 12-hour string to Timestamp struct', () => {
    const ts = timeStringToTimestamp('10:30 AM', (d) => ({
      toDate: () => d,
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
      toMillis: () => d.getTime(),
    }));
    expect(ts.toDate().getUTCHours()).toBe(10);
    expect(ts.toDate().getUTCMinutes()).toBe(30);
  });

  it('timestampToTimeString converts Timestamp struct to 12-hour string', () => {
    const ts = createMockTimestamp(14, 30);
    expect(timestampToTimeString(ts)).toBe('2:30 PM');
  });
});
