/* Unit tests for pure logic functions from lib/social.js.
 Imports the real functions directly from the shared helpers file.
 The supabase module is mocked so importing lib/social.js does not
 create a real Supabase client or hit the network. */

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

import { getChipColor, getInitial, formatMessageTime, getFriendUserId } from '../lib/social';

describe('getChipColor', () => {
  test('returns the mapped colour for a known interest', () => {
    expect(getChipColor('Gaming')).toBe('#8B5CF6');
  });
  test('returns the fallback grey for an unknown interest', () => {
    expect(getChipColor('Underwater Basket Weaving')).toBe('#6B7280');
  });
  test('returns fallback grey for an empty string', () => {
    expect(getChipColor('')).toBe('#6B7280');
  });
});

describe('getInitial', () => {
  test('returns the uppercase first letter of a lowercase name', () => {
    expect(getInitial('pratiksha')).toBe('P');
  });
  test('returns the first letter unchanged if already uppercase', () => {
    expect(getInitial('Amritaa')).toBe('A');
  });
  test('returns "?" when name is undefined', () => {
    expect(getInitial(undefined)).toBe('?');
  });
  test('returns "?" when name is an empty string', () => {
    expect(getInitial('')).toBe('?');
  });
  test('returns "?" when name is null', () => {
    expect(getInitial(null)).toBe('?');
  });
});

describe('formatMessageTime', () => {
  test('returns "Now" for a timestamp under 1 minute old', () => {
    const justNow = new Date().toISOString();
    expect(formatMessageTime(justNow)).toBe('Now');
  });

  test('returns minutes for a timestamp under 1 hour old', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
    expect(formatMessageTime(tenMinsAgo)).toBe('10m');
  });

  test('returns hours for a timestamp under 1 day old', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    expect(formatMessageTime(twoHoursAgo)).toBe('2h');
  });

  test('returns a formatted date for a timestamp over 1 day old', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const result = formatMessageTime(threeDaysAgo.toISOString());
    expect(result).not.toBe('Now');
    expect(result).not.toMatch(/^\d+[mh]$/);
  });

  test('correctly handles the 59-minute boundary (still minutes, not hours)', () => {
    const fiftyNineMinsAgo = new Date(Date.now() - 59 * 60000).toISOString();
    expect(formatMessageTime(fiftyNineMinsAgo)).toBe('59m');
  });

  test('correctly handles the 23-hour boundary (still hours, not date)', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 3600000).toISOString();
    expect(formatMessageTime(twentyThreeHoursAgo)).toBe('23h');
  });
});

describe('getFriendUserId', () => {
  test('returns addressee_id when current user is the requester', () => {
    const friendship = { requester_id: 'userA', addressee_id: 'userB' };
    expect(getFriendUserId(friendship, 'userA')).toBe('userB');
  });

  test('returns requester_id when current user is the addressee', () => {
    const friendship = { requester_id: 'userA', addressee_id: 'userB' };
    expect(getFriendUserId(friendship, 'userB')).toBe('userA');
  });
});