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
  const [myFriends, theirFriends] = await Promise.all([
    fetchAcceptedFriends(currentUserId),
    fetchAcceptedFriends(otherUserId),
  ]);

  const myIds = new Set(myFriends.map(f => f.profile.id));
  return theirFriends.filter(f => myIds.has(f.profile.id)).length;
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