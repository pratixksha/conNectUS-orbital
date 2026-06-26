/* Unit tests for CommunityHomeScreen.js pure logic functions. */

jest.mock('../lib/supabase');

import { timeAgo, extractHashtags } from '../screens/CommunityHomeScreen';

describe('timeAgo', () => {
  test('returns "just now" for timestamps less than 60 seconds ago', () => {
    const recent = new Date(Date.now() - 30000).toISOString();
    expect(timeAgo(recent)).toBe('just now');
  });

  test('returns minutes ago for timestamps between 1 and 59 minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5m ago');
  });

  test('returns hours ago for timestamps between 1 and 23 hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe('3h ago');
  });

  test('returns days ago for timestamps 24+ hours ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe('2d ago');
  });

  test('returns "just now" for a timestamp exactly at the boundary (59s ago)', () => {
    const boundary = new Date(Date.now() - 59000).toISOString();
    expect(timeAgo(boundary)).toBe('just now');
  });
});

describe('extractHashtags', () => {
  test('extracts a single hashtag', () => {
    expect(extractHashtags('Hello #NUS')).toEqual(['NUS']);
  });

  test('extracts multiple hashtags', () => {
    expect(extractHashtags('Studying #CS2040S and #algorithms tonight')).toEqual(['CS2040S', 'algorithms']);
  });

  test('returns empty array when no hashtags present', () => {
    expect(extractHashtags('No tags here')).toEqual([]);
  });

  test('handles hashtags at the start of the string', () => {
    expect(extractHashtags('#NUS welcome everyone')).toEqual(['NUS']);
  });

  test('ignores standalone hash symbols with no word characters', () => {
    expect(extractHashtags('Hello # world')).toEqual([]);
  });

  test('handles mixed content correctly', () => {
    expect(extractHashtags('#food #Arts great community!')).toEqual(['food', 'Arts']);
  });
});