import { describe, expect, it } from 'vitest';
import type { HourlyBiteForecast } from '@/lib/api/endpoints/weather';
import {
  buildGoogleCalendarUrl,
  formatTripWindowRange,
  getBestTripWindow,
} from '@/utils/tripPlanner';

function slot(
  hour: number,
  rating: 1 | 2 | 3 | 4 | 5,
  period = 'Morning'
): HourlyBiteForecast {
  const date = new Date(2026, 6, 8, hour, 0, 0);
  return {
    time: date.toISOString(),
    hourLabel: `${hour}:00`,
    activityRating: rating,
    period,
  };
}

describe('tripPlanner', () => {
  it('finds a contiguous window around the peak hour', () => {
    const forecast = [
      slot(5, 2),
      slot(6, 4, 'Dawn Bite'),
      slot(7, 4, 'Dawn Bite'),
      slot(8, 3, 'Morning'),
      slot(9, 2),
    ];

    const window = getBestTripWindow(forecast, new Date(2026, 6, 8, 5, 30));
    expect(window).not.toBeNull();
    expect(window!.peakRating).toBe(4);
    expect(window!.hourCount).toBeGreaterThanOrEqual(2);
    expect(window!.startTime.getHours()).toBe(6);
    expect(window!.endTime.getHours()).toBeGreaterThanOrEqual(8);
  });

  it('formats a readable time range', () => {
    const window = getBestTripWindow([slot(6, 4), slot(7, 4), slot(8, 3)]);
    expect(window).not.toBeNull();
    expect(formatTripWindowRange(window!)).toMatch(/6:00/);
  });

  it('builds a Google Calendar URL with event details', () => {
    const start = new Date(2026, 6, 8, 6, 0);
    const end = new Date(2026, 6, 8, 8, 30);
    const url = buildGoogleCalendarUrl({
      title: 'Fishing — Shadow Cliffs',
      startTime: start,
      endTime: end,
      details: 'Hot bite window',
      latitude: 37.669,
      longitude: -121.842,
    });

    expect(url).toContain('calendar.google.com');
    expect(url).toContain('Fishing');
    expect(url).toContain('20260708T060000');
    expect(url).toContain('37.669');
  });
});
