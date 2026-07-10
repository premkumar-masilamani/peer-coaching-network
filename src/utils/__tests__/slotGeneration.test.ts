import { describe, it, expect } from 'vitest';
import {
  timeStringToTimestamp,
  timestampToTimeString,
  generateTemplateSlots,
} from '../slotGeneration';
import type { AvailableDays, DayAvailability } from '../../services/types';

const OFF: DayAvailability = { enabled: false, slots: [] };

const day = (start: string, end: string): DayAvailability => ({
  enabled: true,
  slots: [{ startTime: timeStringToTimestamp(start), endTime: timeStringToTimestamp(end) }],
});

// All days off except the ones supplied by the caller.
const buildDays = (overrides: Partial<AvailableDays>): AvailableDays => ({
  monday: OFF,
  tuesday: OFF,
  wednesday: OFF,
  thursday: OFF,
  friday: OFF,
  saturday: OFF,
  sunday: OFF,
  ...overrides,
});

describe('timeString <-> timestamp converters', () => {
  it('round-trips a display time string losslessly', () => {
    for (const t of ['9:00 AM', '12:00 AM', '12:00 PM', '1:30 PM', '11:30 PM']) {
      expect(timestampToTimeString(timeStringToTimestamp(t))).toBe(t);
    }
  });

  it('anchors the time to the Unix epoch date in UTC', () => {
    const ts = timeStringToTimestamp('9:00 AM');
    expect(ts.toDate().getUTCFullYear()).toBe(1970);
    expect(ts.toDate().getUTCHours()).toBe(9);
    expect(ts.toDate().getUTCMinutes()).toBe(0);
  });
});

describe('generateTemplateSlots', () => {
  // 2026-07-13 is a Monday.
  const anchorDate = new Date('2026-07-13T00:00:00Z');

  it('expands an enabled day into 30-minute UTC slot starts', () => {
    const slots = generateTemplateSlots({
      availableDays: buildDays({ monday: day('9:00 AM', '11:00 AM') }),
      blockedDates: [],
      timezone: 'UTC',
      anchorDate,
      horizonDays: 1,
    });
    expect(slots).toEqual([
      '2026-07-13T09:00:00.000Z',
      '2026-07-13T09:30:00.000Z',
      '2026-07-13T10:00:00.000Z',
      '2026-07-13T10:30:00.000Z',
    ]);
  });

  it('skips disabled days and empty-slot days', () => {
    const slots = generateTemplateSlots({
      availableDays: buildDays({ tuesday: day('9:00 AM', '10:00 AM') }),
      blockedDates: [],
      timezone: 'UTC',
      anchorDate, // Monday; horizon of 1 never reaches Tuesday
      horizonDays: 1,
    });
    expect(slots).toEqual([]);
  });

  it('excludes blocked dates', () => {
    const slots = generateTemplateSlots({
      availableDays: buildDays({ monday: day('9:00 AM', '10:00 AM'), tuesday: day('9:00 AM', '10:00 AM') }),
      blockedDates: ['2026-07-13'], // block the Monday
      timezone: 'UTC',
      anchorDate,
      horizonDays: 2, // Monday + Tuesday
    });
    expect(slots).toEqual([
      '2026-07-14T09:00:00.000Z',
      '2026-07-14T09:30:00.000Z',
    ]);
  });

  it('applies inclusive lower / exclusive upper range bounds', () => {
    const slots = generateTemplateSlots({
      availableDays: buildDays({ monday: day('9:00 AM', '11:00 AM') }),
      blockedDates: [],
      timezone: 'UTC',
      anchorDate,
      horizonDays: 1,
      rangeStartMs: Date.parse('2026-07-13T09:30:00.000Z'),
      rangeEndMs: Date.parse('2026-07-13T10:30:00.000Z'),
    });
    // 09:00 dropped (< start), 10:30 dropped (>= end).
    expect(slots).toEqual([
      '2026-07-13T09:30:00.000Z',
      '2026-07-13T10:00:00.000Z',
    ]);
  });

  it('short-circuits the day sweep once past the upper range bound', () => {
    const slots = generateTemplateSlots({
      availableDays: buildDays({
        monday: day('9:00 AM', '10:00 AM'),
        wednesday: day('9:00 AM', '10:00 AM'),
      }),
      blockedDates: [],
      timezone: 'UTC',
      anchorDate,
      horizonDays: 30,
      // Upper bound lands on Tuesday, so Wednesday is never generated.
      rangeEndMs: Date.parse('2026-07-14T23:59:00.000Z'),
    });
    expect(slots).toEqual([
      '2026-07-13T09:00:00.000Z',
      '2026-07-13T09:30:00.000Z',
    ]);
  });
});
