/* Unit tests for HangoutsScreen.js pure logic functions.
   Imports the real functions directly from the screen file. */

jest.mock('../lib/supabase');

import {
  getDistanceMeters,
  formatDistance,
  isActive,
  getMaxHangoutDate,
  isVisibleOnMap,
  formatHangoutTime,
} from '../screens/HangoutsScreen';

describe('getDistanceMeters', () => {
  test('returns 0 for identical coordinates', () => {
    expect(getDistanceMeters(1.2966, 103.7764, 1.2966, 103.7764)).toBeCloseTo(0, 1);
  });
  test('returns a positive distance for two different points', () => {
    const dist = getDistanceMeters(1.2966, 103.7764, 1.3048, 103.8318);
    expect(dist).toBeGreaterThan(5000);
    expect(dist).toBeLessThan(10000);
  });
  test('is symmetric (distance A→B equals B→A)', () => {
    const distAB = getDistanceMeters(1.2966, 103.7764, 1.3048, 103.8318);
    const distBA = getDistanceMeters(1.3048, 103.8318, 1.2966, 103.7764);
    expect(distAB).toBeCloseTo(distBA, 5);
  });
});

describe('formatDistance', () => {
  test('formats metres under 1km without decimals', () => {
    expect(formatDistance(500)).toBe('500m away');
  });
  test('formats exactly 999m as metres', () => {
    expect(formatDistance(999)).toBe('999m away');
  });
  test('formats 1000m and above as kilometres', () => {
    expect(formatDistance(1500)).toBe('1.5km away');
  });
  test('rounds metres to the nearest whole number', () => {
    expect(formatDistance(123.6)).toBe('124m away');
  });
  test('formats large distances correctly', () => {
    expect(formatDistance(10500)).toBe('10.5km away');
  });
});

describe('isActive', () => {
  test('returns true when hangout_time is in the future', () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    expect(isActive({ hangout_time: future })).toBe(true);
  });
  test('returns false when hangout_time is in the past', () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(isActive({ hangout_time: past })).toBe(false);
  });
  test('returns false when hangout_time is just barely in the past (edge case)', () => {
    const now = new Date(Date.now() - 1).toISOString();
    expect(isActive({ hangout_time: now })).toBe(false);
  });
});

describe('getMaxHangoutDate', () => {
  test('returns a date exactly 3 days from now', () => {
    const result = getMaxHangoutDate();
    const expected = new Date();
    expected.setDate(expected.getDate() + 3);
    expect(result.toDateString()).toBe(expected.toDateString());
  });
});

describe('isVisibleOnMap', () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  const past = new Date(Date.now() - 3600000).toISOString();

  test('visible if active and not full', () => {
    const h = { id: '1', hangout_time: future, participant_count: 2, max_participants: 5, created_by: 'other' };
    expect(isVisibleOnMap(h, new Set(), 'user1')).toBe(true);
  });

  test('hidden if hangout has already started', () => {
    const h = { id: '1', hangout_time: past, participant_count: 2, max_participants: 5, created_by: 'other' };
    expect(isVisibleOnMap(h, new Set(), 'user1')).toBe(false);
  });

  test('hidden if full and current user is not a participant', () => {
    const h = { id: '1', hangout_time: future, participant_count: 5, max_participants: 5, created_by: 'other' };
    expect(isVisibleOnMap(h, new Set(), 'user1')).toBe(false);
  });

  test('visible if full but current user has joined', () => {
    const h = { id: '1', hangout_time: future, participant_count: 5, max_participants: 5, created_by: 'other' };
    expect(isVisibleOnMap(h, new Set(['1']), 'user1')).toBe(true);
  });

  test('visible if full but current user is the creator', () => {
    const h = { id: '1', hangout_time: future, participant_count: 5, max_participants: 5, created_by: 'user1' };
    expect(isVisibleOnMap(h, new Set(), 'user1')).toBe(true);
  });

  test('defaults participant_count to 1 and max_participants to 5 when missing', () => {
    const h = { id: '1', hangout_time: future, created_by: 'other' };
    expect(isVisibleOnMap(h, new Set(), 'user1')).toBe(true);
  });
});

describe('formatHangoutTime', () => {
  test('formats a time today as "Today <time>"', () => {
    const today = new Date();
    today.setHours(15, 0, 0, 0);
    const result = formatHangoutTime(today.toISOString());
    expect(result).toMatch(/^Today/);
  });

  test('formats a time tomorrow as "Tomorrow <time>"', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const result = formatHangoutTime(tomorrow.toISOString());
    expect(result).toMatch(/^Tomorrow/);
  });

  test('formats a date further out with weekday and month', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const result = formatHangoutTime(future.toISOString());
    expect(result).not.toMatch(/^Today/);
    expect(result).not.toMatch(/^Tomorrow/);
  });
});