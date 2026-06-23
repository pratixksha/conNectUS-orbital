/* Unit tests for canMessageUser() from lib/social.js.
 Imports the real function. The supabase module is mocked with a
 hand-rolled query chain so each call to supabase.from() returns
 controlled fake data, allowing assertions on which tables were
 queried and in what order, without hitting a real database. */

const mockSingle = jest.fn();

// friendships uses: from → select → or → maybeSingle
const mockOrChain = { maybeSingle: mockSingle };
const mockOr = jest.fn(() => mockOrChain);

// profiles uses: from → select → eq → single
const mockEqChain = { single: mockSingle, maybeSingle: mockSingle };
const mockEq = jest.fn(() => mockEqChain);

// select() must support both    .eq() (profiles) and .or() (friendships)
const mockSelect = jest.fn(() => ({ eq: mockEq, or: mockOr }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: (...args) => mockFrom(...args),
  },
}));

import { canMessageUser } from '../lib/social';

describe('canMessageUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns false when the target profile fetch errors out (fail closed)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const result = await canMessageUser('userA', 'userB');

    expect(result).toBe(false);
  });

  test('returns true immediately when target has only_friends_message OFF', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { only_friends_message: false },
      error: null,
    });

    const result = await canMessageUser('userA', 'userB');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  test('returns true when target has only_friends_message ON but sender is an accepted friend', async () => {
    // First call: profiles → eq → single
    mockSingle.mockResolvedValueOnce({
      data: { only_friends_message: true },
      error: null,
    });
    // Second call: friendships → or → maybeSingle
    mockSingle.mockResolvedValueOnce({
      data: { status: 'accepted', requester_id: 'userA', addressee_id: 'userB' },
    });

    const result = await canMessageUser('userA', 'userB');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('friendships');
  });

  test('returns false when target has only_friends_message ON and there is no friendship', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { only_friends_message: true },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: null });

    const result = await canMessageUser('userA', 'userB');

    expect(result).toBe(false);
  });

  test('returns false when target has only_friends_message ON and friendship is still pending', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { only_friends_message: true },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: { status: 'pending', requester_id: 'userA', addressee_id: 'userB' },
    });

    const result = await canMessageUser('userA', 'userB');

    expect(result).toBe(false);
  });

  test('treats a missing only_friends_message field as OFF (defensive default)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {}, 
      error: null,
    });

    const result = await canMessageUser('userA', 'userB');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});