jest.mock('../lib/supabase');

import { filterCommunities, splitCommunities } from '../screens/CommunitiesScreen';

const mockCommunities = [
  { id: '1', name: 'NUS Study Group', category: 'Study', community_members: [] },
  { id: '2', name: 'Basketball Club', category: 'Sports', community_members: [] },
  { id: '3', name: 'Guitar Lovers', category: 'Music', community_members: [] },
  { id: '4', name: 'Tech Talks', category: 'Tech', community_members: [] },
];

describe('filterCommunities', () => {
  test('returns all communities when search is empty and category is All', () => {
    expect(filterCommunities(mockCommunities, '', 'All')).toHaveLength(4);
  });

  test('filters by search term (case-insensitive)', () => {
    const result = filterCommunities(mockCommunities, 'study', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('NUS Study Group');
  });

  test('filters by category', () => {
    const result = filterCommunities(mockCommunities, '', 'Sports');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Basketball Club');
  });

  test('filters by both search and category', () => {
    const result = filterCommunities(mockCommunities, 'guitar', 'Music');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Guitar Lovers');
  });

  test('returns empty array when no communities match search', () => {
    expect(filterCommunities(mockCommunities, 'zzznomatch', 'All')).toHaveLength(0);
  });

  test('returns empty array when no communities match category', () => {
    expect(filterCommunities(mockCommunities, '', 'Food')).toHaveLength(0);
  });

  test('search is case-insensitive for uppercase input', () => {
    const result = filterCommunities(mockCommunities, 'TECH', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tech Talks');
  });
});

describe('splitCommunities', () => {
  test('splits joined and unjoined communities correctly', () => {
    const myIds = new Set(['1', '3']);
    const { myCommunities, discover } = splitCommunities(mockCommunities, myIds);
    expect(myCommunities).toHaveLength(2);
    expect(discover).toHaveLength(2);
    expect(myCommunities.map(c => c.id)).toEqual(['1', '3']);
    expect(discover.map(c => c.id)).toEqual(['2', '4']);
  });

  test('returns all in discover when myIds is empty', () => {
    const { myCommunities, discover } = splitCommunities(mockCommunities, new Set());
    expect(myCommunities).toHaveLength(0);
    expect(discover).toHaveLength(4);
  });

  test('returns all in myCommunities when user has joined everything', () => {
    const myIds = new Set(['1', '2', '3', '4']);
    const { myCommunities, discover } = splitCommunities(mockCommunities, myIds);
    expect(myCommunities).toHaveLength(4);
    expect(discover).toHaveLength(0);
  });

  test('returns empty arrays when communities list is empty', () => {
    const { myCommunities, discover } = splitCommunities([], new Set(['1']));
    expect(myCommunities).toHaveLength(0);
    expect(discover).toHaveLength(0);
  });
});