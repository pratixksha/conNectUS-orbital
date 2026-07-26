import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import {
  ProfileAvatar,
  getChipColor,
  countMutualFriends,
  fetchFriendshipStatus,
  sendFriendRequest,
  getOrCreateConversation,
  getCurrentUserId,
  canMessageUser,
  removeFriendship,
  getMutualFriends,
} from '../lib/social';

export default function UserProfileScreen({
  userId,
  onBack,
  onOpenChat,
  initialFriendship = null,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [friendship, setFriendship] = useState(initialFriendship);
  const [mutualCount, setMutualCount] = useState(0);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [loadingMutualNames, setLoadingMutualNames] = useState(false);
  const [canMessage, setCanMessage] = useState(false);
  const [showMutualsModal, setShowMutualsModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function loadProfile() {
    setLoading(true);
    setShowMutualsModal(false);
    setLoadingMutualNames(false);
    setMutualFriends([]);
    const me = await getCurrentUserId();
    setCurrentUserId(me);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, faculty, year, networking_goal, bio, interests, avatar_url')
      .eq('id', userId)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Could not load profile.');
      onBack();
      return;
    }

    setProfile(data);

    if (!initialFriendship) {
      const status = await fetchFriendshipStatus(me, userId);
      setFriendship(status);
    }

    const mutuals = await countMutualFriends(me, userId);
    setMutualCount(mutuals);

    try {
      const friends = await getMutualFriends(me, userId);
      setMutualFriends(friends || []);
    } catch (err) {
      console.error('Error fetching mutual friends:', err);
      setMutualFriends([]);
    }

    setCanMessage(await canMessageUser(me, userId));
    setLoading(false);
  }

  async function handleSendRequest() {
    setActionLoading(true);
    try {
      await sendFriendRequest(currentUserId, userId);
      setFriendship({ status: 'pending', requester_id: currentUserId, addressee_id: userId });
      Alert.alert('Request sent', 'Your friend request has been sent.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setActionLoading(false);
  }

  async function handleOpenChat() {
    setActionLoading(true);
    try {
      const allowed = await canMessageUser(currentUserId, userId);
      if (!allowed) {
        Alert.alert(
          'Cannot message',
          `${profile.full_name} only accepts messages from friends.`
        );
        setActionLoading(false);
        return;
      }
      const conversationId = await getOrCreateConversation(currentUserId, userId);
      onOpenChat({ conversationId, otherUser: profile });
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setActionLoading(false);
  }

  async function handleOpenMutualsModal() {
    if (mutualCount <= 0) return;

    setShowMutualsModal(true);
    setLoadingMutualNames(true);
    try {
      const friends = await getMutualFriends(currentUserId, userId);
      setMutualFriends(friends || []);
    } catch (err) {
      console.error('Error refreshing mutual friends:', err);
      setMutualFriends([]);
    } finally {
      setLoadingMutualNames(false);
    }
  }

  function handleRemoveFriend() {
    Alert.alert(
      'Remove friend',
      `Remove ${profile.full_name} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await removeFriendship(friendship.id);
              setFriendship(null);
              onBack();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
            setActionLoading(false);
          },
        },
      ]
    );
  }

  function renderActionButton() {
    if (friendship?.status === 'accepted') {
      return (
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleOpenChat}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Chat</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={handleRemoveFriend}
            disabled={actionLoading}
          >
            <Text style={styles.removeBtnText}>Remove Friend</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (friendship?.status === 'pending') {
      const sentByMe = friendship.requester_id === currentUserId;
      return (
        <View style={{ gap: 10 }}>
          {canMessage && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleOpenChat}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Message</Text>}
            </TouchableOpacity>
          )}
          <View style={[styles.primaryBtn, styles.disabledBtn]}>
            <Text style={styles.primaryBtnText}>
              {sentByMe ? 'Request Sent' : 'Request Pending'}
            </Text>
          </View>
        </View>
      );
    }

    // Not friends yet
    return (
      <View style={{ gap: 10 }}>
        {canMessage && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleOpenChat}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Message</Text>}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, canMessage ? styles.secondaryActionBtn : null]}
          onPress={handleSendRequest}
          disabled={actionLoading}
        >
          {actionLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Send Request</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerEyebrow}>NUS STUDENT</Text>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <ProfileAvatar profile={profile} size={96} />
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.subtitle}>
              {profile.year?.replace('Year ', 'Y') || 'Y?'} · {profile.faculty || 'NUS'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>NETWORKING GOAL</Text>
            <Text style={styles.bioText}>
              {profile.networking_goal ? `"${profile.networking_goal}"` : 'No networking goal set'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>BIO</Text>
            <Text style={styles.bioText}>
              {profile.bio ? `"${profile.bio}"` : 'No bio yet'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>INTERESTS</Text>
            <View style={styles.chipsGrid}>
              {(profile.interests || []).length
                ? profile.interests.map(item => {
                    const color = getChipColor(item);
                    return (
                      <View
                        key={item}
                        style={[styles.chip, { backgroundColor: color + '20', borderColor: color }]}
                      >
                        <Text style={[styles.chipText, { color }]}>{item}</Text>
                      </View>
                    );
                  })
                : <Text style={styles.emptyText}>No interests listed</Text>}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.mutualsButton, mutualCount === 0 && styles.mutualsButtonDisabled]}
            onPress={handleOpenMutualsModal}
            activeOpacity={mutualCount > 0 ? 0.75 : 1}
          >
            <View style={styles.mutualAvatars}>
              {mutualFriends.slice(0, 3).map((friend, idx) => (
                <ProfileAvatar
                  key={friend.id || `${friend.full_name}-${idx}`}
                  profile={friend}
                  size={30}
                  style={[styles.mutualAvatar, idx > 0 ? styles.mutualAvatarOverlap : null]}
                />
              ))}
              {mutualCount > 3 && (
                <View style={[styles.mutualAvatar, styles.mutualExtraBadge, styles.mutualAvatarOverlap]}>
                  <Text style={styles.mutualExtraText}>+{mutualCount - 3}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mutualsText}>
                {mutualCount} friend{mutualCount === 1 ? '' : 's'} in common
              </Text>
              <Text style={styles.mutualsHint}>
                {mutualCount > 0 ? 'Tap to view mutual friends' : 'No mutual friends yet'}
              </Text>
            </View>
            {mutualCount > 0 && (
              <Text style={styles.mutualsArrow}>›</Text>
            )}
          </TouchableOpacity>

          <Modal visible={showMutualsModal} transparent animationType="fade" onRequestClose={() => setShowMutualsModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Friends in Common</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {loadingMutualNames ? (
                    <ActivityIndicator color="#1d4ed8" style={{ marginVertical: 10 }} />
                  ) : mutualFriends.length > 0 ? mutualFriends.map((friend, idx) => (
                    <View key={friend.id || `${friend.full_name}-${idx}`} style={styles.modalFriendRow}>
                      <ProfileAvatar profile={friend} size={28} />
                      <Text style={styles.modalItem}>{friend.full_name || 'Unknown'}</Text>
                    </View>
                  )) : (
                    <Text style={styles.modalItem}>No mutual friends found.</Text>
                  )}
                </ScrollView>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowMutualsModal(false)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>

        <View style={styles.footer}>
          {renderActionButton()}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1d4ed8',
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, color: '#fff' },
  headerEyebrow: { fontSize: 10, color: '#bfdbfe', fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  name: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 10 },
  bioText: { fontSize: 15, color: '#444', lineHeight: 22, fontStyle: 'italic' },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '500' },
  emptyText: { fontSize: 14, color: '#aaa' },
  mutualsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f8fafc' },
  mutualsButtonDisabled: { opacity: 0.65 },
  mutualsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  mutualAvatars: { flexDirection: 'row', minWidth: 36 },
  mutualAvatar: { borderWidth: 2, borderColor: '#fff' },
  mutualAvatarOverlap: { marginLeft: -8 },
  mutualExtraBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  mutualExtraText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  mutualsText: { fontSize: 14, fontWeight: '700', color: '#111' },
  mutualsHint: { fontSize: 12, color: '#6b7280' },
  mutualsArrow: { fontSize: 20, color: '#6b7280' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  modalItem: {
    fontSize: 15,
    color: '#334155',
  },
  modalFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  modalCloseBtn: {
    marginTop: 12,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  primaryBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledBtn: { backgroundColor: '#94a3b8' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryActionBtn: { backgroundColor: '#64748b' },
  removeBtn: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  removeBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
});
