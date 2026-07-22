import { View, Text, Image, StyleSheet } from 'react-native';
import { supabase } from './supabase';

export const INTEREST_FILTERS = [
  { id: 'all', label: 'All', match: null },
  { id: 'sports', label: 'Sports', match: ['Badminton', 'Running'] },
  { id: 'music', label: 'Music', match: ['Music'] },
  { id: 'gaming', label: 'Gaming', match: ['Gaming'] },
  { id: 'tech', label: 'Tech', match: ['AI & Tech', 'Hackathons'] },
  { id: 'art', label: 'Art', match: ['Design', 'Photography', 'Film'] },
];

export const INTEREST_COLORS = {
  'AI & Tech': '#3B82F6',
  'Badminton': '#10B981',
  'Startups': '#F97316',
  'Supper runs': '#EC4899',
  'Gaming': '#8B5CF6',
  'Photography': '#6B7280',
  'Study groups': '#0EA5E9',
  'Travel': '#14B8A6',
  'Music': '#A855F7',
  'Running': '#22C55E',
  'Hackathons': '#EF4444',
  'Film': '#F59E0B',
  'Cooking': '#F97316',
  'Volunteering': '#06B6D4',
  'Finance': '#64748B',
  'Design': '#EC4899',
};

export function getChipColor(interest) {
  return INTEREST_COLORS[interest] || '#6B7280';
}

export function getInitial(name) {
  return name?.[0]?.toUpperCase() || '?';
}

export function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

export function ProfileAvatar({ profile, size = 48, style }) {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (profile?.avatar_url) {
    return <Image source={{ uri: profile.avatar_url }} style={[avatarStyle, style]} />;
  }

  return (
    <View style={[avatarStyles.fallback, avatarStyle, style]}>
      <Text style={[avatarStyles.fallbackText, { fontSize: size * 0.4 }]}>
        {getInitial(profile?.full_name)}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  fallback: {
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
});

export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export function getFriendUserId(friendship, currentUserId) {
  return friendship.requester_id === currentUserId
    ? friendship.addressee_id
    : friendship.requester_id;
}

export async function fetchAcceptedFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, updated_at')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const friendIds = data.map(row =>
    row.requester_id === userId ? row.addressee_id : row.requester_id
  );

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, faculty, year, avatar_url, interests')
    .in('id', friendIds);

  if (profileError) throw profileError;

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  return data
    .map(row => ({
      friendshipId: row.id,
      profile: profileMap[row.requester_id === userId ? row.addressee_id : row.requester_id],
    }))
    .filter(item => item.profile);
}

export async function fetchIncomingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, created_at, requester_id')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const requesterIds = data.map(row => row.requester_id);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, faculty, year, avatar_url, bio, interests')
    .in('id', requesterIds);

  if (profileError) throw profileError;

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  return data
    .map(row => ({
      id: row.id,
      created_at: row.created_at,
      requester: profileMap[row.requester_id],
    }))
    .filter(item => item.requester);
}

export async function fetchFriendshipStatus(currentUserId, otherUserId) {
  const { data } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${otherUserId}),` +
      `and(requester_id.eq.${otherUserId},addressee_id.eq.${currentUserId})`
    )
    .maybeSingle();

  return data;
}

export async function sendFriendRequest(requesterId, addresseeId) {
  const { error } = await supabase.from('friendships').insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: 'pending',
  });
  if (error) throw error;
}

export async function respondToFriendRequest(friendshipId, status) {
  const { error } = await supabase
    .from('friendships')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriendship(friendshipId) {
  const { data: friendship, error: fetchError } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('id', friendshipId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;

  const p1 = friendship.requester_id < friendship.addressee_id
    ? friendship.requester_id
    : friendship.addressee_id;
  const p2 = friendship.requester_id < friendship.addressee_id
    ? friendship.addressee_id
    : friendship.requester_id;

  await supabase
    .from('conversations')
    .delete()
    .eq('participant_one', p1)
    .eq('participant_two', p2);
}

export async function fetchDiscoverProfiles(currentUserId, { search = '', interestFilter = 'all' } = {}) {
  let query = supabase
    .from('profiles')
    .select('id, full_name, faculty, year, avatar_url, interests, bio')
    .neq('id', currentUserId)
    .order('full_name', { ascending: true })
    .limit(50);

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},faculty.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const filter = INTEREST_FILTERS.find(f => f.id === interestFilter);
  if (!filter?.match) return data || [];

  return (data || []).filter(profile =>
    (profile.interests || []).some(i => filter.match.includes(i))
  );
}

export async function countMutualFriends(currentUserId, otherUserId) {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId) {
    return 0;
  }

  try {
    const { data, error } = await supabase.rpc('get_mutual_friends', {
      user_a: currentUserId,
      user_b: otherUserId,
    });

    if (!error && Array.isArray(data)) {
      return data.length;
    }
  } catch (rpcErr) {
    console.warn('get_mutual_friends RPC unavailable, falling back to client-side mutual count', rpcErr);
  }

  const [myFriendIds, theirFriendIds] = await Promise.all([
    fetchAcceptedFriendIds(currentUserId),
    fetchAcceptedFriendIds(otherUserId),
  ]);

  let count = 0;
  theirFriendIds.forEach(id => {
    if (id && id !== currentUserId && myFriendIds.has(id)) count += 1;
  });
  return count;
}

// --- Recommendation & mutual helpers ---
export function getInterestOverlap(a = [], b = []) {
  const as = new Set(a || []);
  return (b || []).filter(x => as.has(x)).length;
}

export async function fetchAcceptedFriendIds(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  if (!data) return new Set();
  const ids = new Set();
  data.forEach(r => {
    if (r.requester_id === userId) ids.add(r.addressee_id);
    else if (r.addressee_id === userId) ids.add(r.requester_id);
  });
  return ids;
}

export async function fetchMutualCountsBatch(currentUserId, candidateIds = []) {
  if (!candidateIds?.length) return {};

  try {
    const entries = await Promise.all(candidateIds.map(async (candidateId) => {
      const { data, error } = await supabase.rpc('get_mutual_friends', {
        user_a: currentUserId,
        user_b: candidateId,
      });

      if (error) throw error;
      return [candidateId, Array.isArray(data) ? data.length : 0];
    }));

    return Object.fromEntries(entries);
  } catch (rpcErr) {
    console.warn('Batch mutual RPC unavailable, falling back to client-side mutual counts', rpcErr);
  }

  const myFriendIds = await fetchAcceptedFriendIds(currentUserId);

  const inList = candidateIds.map(id => id).join(',');
  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.in.(${inList}),addressee_id.in.(${inList})`);

  if (error) throw error;

  const map = Object.fromEntries(candidateIds.map(id => [id, new Set()]));
  (data || []).forEach(r => {
    if (map[r.requester_id]) map[r.requester_id].add(r.addressee_id);
    if (map[r.addressee_id]) map[r.addressee_id].add(r.requester_id);
  });

  const counts = {};
  Object.entries(map).forEach(([candidateId, friendsSet]) => {
    let mutual = 0;
    friendsSet.forEach(fid => { if (myFriendIds.has(fid)) mutual += 1; });
    counts[candidateId] = mutual;
  });

  return counts;
}

export async function fetchRecommendedProfiles(currentUserId, { limit = 3 } = {}) {
  const { data: me } = await supabase.from('profiles').select('id, interests').eq('id', currentUserId).single();
  const myInterests = me?.interests || [];
  const acceptedFriendIds = await fetchAcceptedFriendIds(currentUserId);

  const { data: candidates } = await supabase
    .from('profiles')
    .select('id, full_name, faculty, year, avatar_url, interests, bio')
    .neq('id', currentUserId)
    .limit(200);

  const scored = (candidates || [])
    .filter(p => !acceptedFriendIds.has(p.id))
    .map(p => ({
      profile: p,
      overlap: getInterestOverlap(myInterests, p.interests || []),
    }))
    .filter(s => s.overlap > 0)
    .sort((a, b) => (b.overlap - a.overlap) || a.profile.full_name.localeCompare(b.profile.full_name))
    .slice(0, limit);

  const ids = scored.map(s => s.profile.id);
  const mutuals = await fetchMutualCountsBatch(currentUserId, ids);

  return scored.map(s => ({
    ...s.profile,
    interest_overlap: s.overlap,
    friends_in_common: mutuals[s.profile.id] || 0,
  }));
}

export async function fetchRecommendedCommunities(currentUserId, { limit = 12 } = {}) {
  const { data: me } = await supabase.from('profiles').select('id, interests').eq('id', currentUserId).single();
  const myInterests = new Set(me?.interests || []);

  const { data: communities } = await supabase
    .from('communities')
    .select('id, name, description, category, member_count, community_members(user_id)')
    .order('member_count', { ascending: false })
    .limit(200);

  if (!communities) return [];

  const myFriendIds = await fetchAcceptedFriendIds(currentUserId);

  const scored = (communities || []).map(c => {
    const memberIds = new Set((c.community_members || []).map(m => m.user_id));
    let friendMembers = 0;
    myFriendIds.forEach(fid => { if (memberIds.has(fid)) friendMembers += 1; });
    const interestMatch = Array.from(myInterests).some(i => (c.category || '').toLowerCase().includes((i || '').toLowerCase())) ? 1 : 0;
    return { community: c, score: friendMembers * 3 + interestMatch };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      id: s.community.id,
      name: s.community.name,
      description: s.community.description,
      category: s.community.category,
      member_count: s.community.member_count || 0,
      friends_here: Array.from(myFriendIds).filter(fid => (s.community.community_members || []).some(m => m.user_id === fid)).length,
    }));

  return scored;
}

export async function fetchRecommendedEvents(currentUserId, { limit = 12 } = {}) {
  const { data: me } = await supabase.from('profiles').select('id, interests, faculty').eq('id', currentUserId).single();
  const interests = me?.interests || [];
  const faculty = (me?.faculty || '').toLowerCase();

  const INTEREST_KEYWORDS = {
    'AI & Tech': ['ai', 'tech', 'technology', 'coding', 'code', 'software', 'data', 'ml', 'hackathon', 'hackathons'],
    Badminton: ['badminton'],
    Startups: ['startup', 'startups', 'entrepreneur', 'entrepreneurship', 'founder', 'venture'],
    'Supper runs': ['supper', 'food', 'night food'],
    Gaming: ['gaming', 'game', 'esports'],
    Photography: ['photography', 'photo', 'camera'],
    'Study groups': ['study group', 'study', 'revision', 'exam prep'],
    Travel: ['travel', 'trip', 'explore'],
    Music: ['music', 'band', 'concert', 'jam'],
    Running: ['running', 'run', 'jog'],
    Hackathons: ['hackathon', 'hackathons', 'build sprint'],
    Film: ['film', 'movie', 'cinema', 'screening'],
    Cooking: ['cooking', 'cook', 'culinary', 'bake'],
    Volunteering: ['volunteer', 'volunteering', 'service', 'charity'],
    Finance: ['finance', 'fintech', 'investment', 'trading', 'banking'],
    Design: ['design', 'ui', 'ux', 'creative'],
  };

  const FACULTY_KEYWORDS = {
    'arts & social sciences': ['arts & social sciences', 'fass', 'social sciences'],
    business: ['business', 'biz'],
    computing: ['computing', 'soc', 'school of computing', 'com1', 'com2'],
    dentistry: ['dentistry'],
    'design & engineering': ['design & engineering', 'engineering', 'cde'],
    law: ['law'],
    medicine: ['medicine', 'med'],
    music: ['music', 'yst'],
    science: ['science', 'fos'],
  };

  const userFacultyKey = Object.keys(FACULTY_KEYWORDS).find(key =>
    faculty.includes(key)
  ) || null;

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })
    .limit(200);

  if (!events) return [];

  const now = new Date();
  const selectedInterestKeywords = interests.flatMap(interest => INTEREST_KEYWORDS[interest] || [interest]);
  const dedupedInterestKeywords = [...new Set(selectedInterestKeywords.map(k => (k || '').toLowerCase()).filter(Boolean))];

  const analyzed = (events || [])
    .filter(e => !e.date || new Date(e.date) >= now)
    .map(e => {
      const text = ((e.title || '') + ' ' + (e.description || '') + ' ' + (e.location || '') + ' ' + (e.category || '')).toLowerCase();
      const interestMatches = dedupedInterestKeywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0);

      const mentionedFacultyKeys = Object.entries(FACULTY_KEYWORDS)
        .filter(([, aliases]) => aliases.some(alias => text.includes(alias)))
        .map(([key]) => key);

      const hasFacultySignal = mentionedFacultyKeys.length > 0;
      const matchesUserFaculty = userFacultyKey
        ? mentionedFacultyKeys.includes(userFacultyKey)
        : false;

      const crossFacultyMismatch = hasFacultySignal && !matchesUserFaculty;
      const allowed = !crossFacultyMismatch || interestMatches >= 2;

      const facultyScore = hasFacultySignal
        ? (matchesUserFaculty ? 2 : 0)
        : (userFacultyKey ? 1 : 0);

      const score = (interestMatches * 3) + facultyScore;
      return {
        event: e,
        score,
        interestMatches,
        matchesUserFaculty,
        hasFacultySignal,
        allowed,
      };
    })
    .filter(item => item.allowed)
    .sort((a, b) => (b.score - a.score) || (new Date(a.event.date || 0) - new Date(b.event.date || 0)));

  const strict = analyzed.filter(item => item.score > 0 && (dedupedInterestKeywords.length === 0 || item.interestMatches > 0));

  const fallback = analyzed.filter(item =>
    !strict.some(s => s.event.id === item.event.id)
  );

  const combined = [...strict, ...fallback]
    .slice(0, limit)
    .map(item => item.event);

  return combined;
}

export async function fetchEventAttendeesWithMutualFlag(eventId, currentUserId) {
  const { data: attendees, error: attendeesError } = await supabase
    .from('event_signups')
    .select('user_id')
    .eq('event_id', eventId);

  if (attendeesError) throw attendeesError;
  if (!attendees?.length) return [];

  const userIds = attendees.map(a => a.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const myFriendIds = await fetchAcceptedFriendIds(currentUserId);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  const list = userIds.map(uid => ({
    id: uid,
    profile: profileMap[uid],
    isFriend: myFriendIds.has(uid),
  })).filter(item => item.profile);

  list.sort((a, b) => (b.isFriend ? 1 : 0) - (a.isFriend ? 1 : 0));
  return list;
}

export async function getHangoutsMutualInfo(currentUserId, hangoutIds = []) {
  if (!currentUserId || !hangoutIds?.length) return {};

  const myFriendIds = await fetchAcceptedFriendIds(currentUserId);
  const { data, error } = await supabase
    .from('hangout_participants')
    .select('hangout_id, user_id')
    .in('hangout_id', hangoutIds);

  if (error) throw error;

  const friendIdsByHangout = {};
  (data || []).forEach(row => {
    if (row.user_id !== currentUserId && myFriendIds.has(row.user_id)) {
      friendIdsByHangout[row.hangout_id] = friendIdsByHangout[row.hangout_id] || new Set();
      friendIdsByHangout[row.hangout_id].add(row.user_id);
    }
  });

  const result = {};
  const allFriendIds = [...new Set(Object.values(friendIdsByHangout).flatMap(set => [...set]))];
  let profiles = [];
  if (allFriendIds.length) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', allFriendIds);
    if (profileError) throw profileError;
    profiles = profileRows || [];
  }

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || 'Someone']));
  Object.entries(friendIdsByHangout).forEach(([hangoutId, ids]) => {
    result[hangoutId] = {
      count: ids.size,
      names: [...ids].map(id => profileMap[id] || 'Someone'),
    };
  });

  return result;
}

export async function getEventsMutualInfo(currentUserId, eventIds = []) {
  if (!currentUserId || !eventIds?.length) return {};

  const myFriendIds = await fetchAcceptedFriendIds(currentUserId);
  const { data, error } = await supabase
    .from('event_signups')
    .select('event_id, user_id')
    .in('event_id', eventIds);

  if (error) throw error;

  const friendIdsByEvent = {};
  (data || []).forEach(row => {
    if (row.user_id && row.user_id !== currentUserId && myFriendIds.has(row.user_id)) {
      friendIdsByEvent[row.event_id] = friendIdsByEvent[row.event_id] || new Set();
      friendIdsByEvent[row.event_id].add(row.user_id);
    }
  });

  const allFriendIds = [...new Set(Object.values(friendIdsByEvent).flatMap(set => [...set]))];
  let profiles = [];
  if (allFriendIds.length) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', allFriendIds);
    if (profileError) throw profileError;
    profiles = profileRows || [];
  }

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || 'Someone']));
  const result = {};
  Object.entries(friendIdsByEvent).forEach(([eventId, ids]) => {
    result[eventId] = {
      count: ids.size,
      names: [...ids].map(id => profileMap[id] || 'Someone'),
    };
  });

  return result;
}

export async function getMutualFriendNames(currentUserId, targetUserId) {
  const mutuals = await getMutualFriends(currentUserId, targetUserId);
  return mutuals.map(friend => friend.full_name || 'Unknown');
}

export async function getMutualFriends(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return [];
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_mutual_friends', {
      user_a: currentUserId,
      user_b: targetUserId,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map(row => ({
        id: row.id,
        full_name: row.full_name || 'Unknown',
        avatar_url: row.avatar_url || null,
      }));
    }

    const [myFriendIds, theirFriendIds] = await Promise.all([
      fetchAcceptedFriendIds(currentUserId),
      fetchAcceptedFriendIds(targetUserId),
    ]);

    const mutualIds = Array.from(theirFriendIds).filter(id => myFriendIds.has(id));
    if (!mutualIds.length) return [];

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', mutualIds);

    if (error) throw error;
    return (profiles || []).map(p => ({
      id: p.id,
      full_name: p.full_name || 'Unknown',
      avatar_url: p.avatar_url || null,
    }));
  } catch (err) {
    console.error('Error getting mutual friends:', err);
    return [];
  }
}

export async function getCommunitiesMutualInfo(currentUserId, communityIds = []) {
  if (!communityIds?.length) return {};

  const myFriendIds = await fetchAcceptedFriendIds(currentUserId);
  const { data: communities, error } = await supabase
    .from('communities')
    .select('id, community_members(user_id)')
    .in('id', communityIds);

  if (error) throw error;

  const result = {};
  for (const community of communities || []) {
    const mutualIds = (community.community_members || [])
      .map(m => m.user_id)
      .filter(id => myFriendIds.has(id));

    if (!mutualIds.length) {
      result[community.id] = { count: 0, names: [] };
      continue;
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', mutualIds);

    if (profileError) throw profileError;

    result[community.id] = {
      count: mutualIds.length,
      names: (profiles || []).map(p => p.full_name || 'Unknown'),
    };
  }

  return result;
}

export async function getOrCreateConversation(userA, userB, initiatorId = userA) {
  const otherUserId = initiatorId === userA ? userB : userA;
  const allowed = await canMessageUser(initiatorId, otherUserId);
  if (!allowed) {
    throw new Error('You cannot message this user');
  }

  const p1 = userA < userB ? userA : userB;
  const p2 = userA < userB ? userB : userA;

  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_one', p1)
    .eq('participant_two', p2)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ participant_one: p1, participant_two: p2 })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', p1)
        .eq('participant_two', p2)
        .single();
      if (retryError) throw retryError;
      return retry.id;
    }
    throw error;
  }

  return data.id;
}

export async function fetchConversations(userId) {
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, participant_one, participant_two, last_message_at')
    .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  if (!convs?.length) return [];

  const convIds = convs.map(c => c.id);
  const otherIds = convs.map(c =>
    c.participant_one === userId ? c.participant_two : c.participant_one
  );

  const [{ data: profiles }, { data: messages }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').in('id', otherIds),
    supabase
      .from('messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false }),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  const latestByConv = {};
  (messages || []).forEach(msg => {
    if (!latestByConv[msg.conversation_id]) {
      latestByConv[msg.conversation_id] = msg;
    }
  });

  return convs.map(conv => {
    const otherId = conv.participant_one === userId ? conv.participant_two : conv.participant_one;
    return {
      id: conv.id,
      otherUser: profileMap[otherId] || { id: otherId, full_name: 'Unknown' },
      lastMessage: latestByConv[conv.id] || null,
      lastMessageAt: conv.last_message_at,
    };
  });
}

export async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, content, sender_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function sendMessage(conversationId, senderId, content) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: trimmed,
  });
  if (error) throw error;
}

export async function canMessageUser(currentUserId, targetUserId) {
  const { data: targetProfile, error } = await supabase
    .from('profiles')
    .select('only_friends_message')
    .eq('id', targetUserId)
    .single();

  if (error || !targetProfile) return false;

  // If the target hasn't restricted messaging, anyone can message them
  if (!targetProfile.only_friends_message) return true;

  // Otherwise, only accepted friends can message them
  const friendship = await fetchFriendshipStatus(currentUserId, targetUserId);
  return friendship?.status === 'accepted';
}