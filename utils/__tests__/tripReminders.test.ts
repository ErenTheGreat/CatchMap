import { describe, expect, it } from 'vitest';
import {
  buildTripReminderSpotKey,
  computeReminderFireTime,
  reminderMatchesWindow,
} from '@/utils/tripReminders';
import type { TripWindow } from '@/utils/tripPlanner';

function makeWindow(start: Date): TripWindow {
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    startTime: start,
    endTime: end,
    peakRating: 4,
    peakLabel: 'Hot',
    period: 'Dawn Bite',
    hourCount: 2,
  };
}

describe('tripReminders', () => {
  it('schedules reminder 30 minutes before the window', () => {
    const now = new Date(2026, 6, 8, 5, 0, 0);
    const start = new Date(2026, 6, 8, 6, 30, 0);
    const fireAt = computeReminderFireTime(start, now, 30);
    expect(fireAt?.getHours()).toBe(6);
    expect(fireAt?.getMinutes()).toBe(0);
  });

  it('falls back to five minutes before when lead time already passed', () => {
    const now = new Date(2026, 6, 8, 6, 10, 0);
    const start = new Date(2026, 6, 8, 6, 30, 0);
    const fireAt = computeReminderFireTime(start, now, 30);
    expect(fireAt?.getHours()).toBe(6);
    expect(fireAt?.getMinutes()).toBe(25);
  });

  it('matches stored reminder to the same spot and window', () => {
    const start = new Date(2026, 6, 8, 6, 30, 0);
    const window = makeWindow(start);
    expect(
      reminderMatchesWindow(
        {
          notificationId: 'abc',
          windowStartIso: start.toISOString(),
          spotKey: buildTripReminderSpotKey('Shadow Cliffs'),
        },
        window,
        'Shadow Cliffs'
      )
    ).toBe(true);
  });
});
