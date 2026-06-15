import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import {
  ProfileAvatar,
  fetchAcceptedFriends,
  fetchIncomingRequests,
  respondToFriendRequest,
  removeFriendship,
  getCurrentUserId,
} from '../lib/social';
import MeetPeopleScreen from './MeetPeopleScreen';
import UserProfileScreen from './UserProfileScreen';

export default function FriendsScreen({ onBack, onOpenChat }) {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMeetPeople, setShowMeetPeople] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [actionId, setActionId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    setCurrentUserId(userId);
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const [friendsData, requestsData] = await Promise.all([
        fetchAcceptedFriends(userId),
        fetchIncomingRequests(userId),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`friendships:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `addressee_id=eq.${currentUserId}`,
        },
        () => loadData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `requester_id=eq.${currentUserId}`,
        },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadData]);

  async function handleApprove(requestId) {
    setActionId(requestId);
    try {
      await respondToFriendRequest(requestId, 'accepted');
      await loadData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setActionId(null);
  }

  async function handleRemove(requestId) {
    setActionId(requestId);
    try {
      await removeFriendship(requestId);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setActionId(null);
  }

  if (showMeetPeople) {
    return (
      <MeetPeopleScreen
        onBack={() => {
          setShowMeetPeople(false);
          loadData();
        }}
        onOpenChat={(chat) => {
          setShowMeetPeople(false);
          onOpenChat?.(chat);
        }}
      />
    );
  }

  if (selectedUserId) {
    return (
      <UserProfileScreen
        userId={selectedUserId}
        onBack={() => {
          setSelectedUserId(null);
          loadData();
        }}
        onOpenChat={(chat) => {
          setSelectedUserId(null);
          onOpenChat?.(chat);
        }}
      />
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
            <Text style={styles.headerEyebrow}>YOUR NETWORK</Text>
            <Text style={styles.headerTitle}>Friends</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'friends' && styles.tabActive]}
            onPress={() => setTab('friends')}
          >
            <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'requests' && styles.tabActive]}
            onPress={() => setTab('requests')}
          >
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
              Requests{requests.length > 0 ? ` (${requests.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#1d4ed8" />
        ) : tab === 'friends' ? (
          <ScrollView contentContainerStyle={styles.list}>
            {friends.length === 0 && (
              <Text style={styles.emptyText}>No friends yet. Tap Meet People to connect!</Text>
            )}
            {friends.map(({ friendshipId, profile }) => (
              <TouchableOpacity
                key={friendshipId}
                style={styles.row}
                onPress={() => setSelectedUserId(profile.id)}
              >
                <ProfileAvatar profile={profile} size={44} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{profile.full_name}</Text>
                  <Text style={styles.rowSub}>
                    {profile.year?.replace('Year ', 'Y') || 'Y?'} · {profile.faculty || 'NUS'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {requests.length === 0 && (
              <Text style={styles.emptyText}>No pending requests.</Text>
            )}
            {requests.map(request => (
              <View key={request.id} style={styles.requestRow}>
                <TouchableOpacity
                  style={styles.requestInfo}
                  onPress={() => setSelectedUserId(request.requester.id)}
                >
                  <ProfileAvatar profile={request.requester} size={44} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{request.requester.full_name}</Text>
                    <Text style={styles.rowSub}>
                      {request.requester.year?.replace('Year ', 'Y') || 'Y?'} · {request.requester.faculty || 'NUS'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(request.id)}
                    disabled={actionId === request.id}
                  >
                    {actionId === request.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.approveText}>Approve</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemove(request.id)}
                    disabled={actionId === request.id}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.meetBtn} onPress={() => setShowMeetPeople(true)}>
            <Text style={styles.meetBtnText}>Meet People</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
  headerEyebrow: { fontSize: 10, color: '#bfdbfe', fontWeight: '700', letterSpacing: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1d4ed8' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#1d4ed8' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowSub: { fontSize: 13, color: '#666', marginTop: 2 },
  chevron: { fontSize: 22, color: '#cbd5e1' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  requestRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  requestActions: { flexDirection: 'row', gap: 10, paddingLeft: 56 },
  approveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  removeBtn: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  removeText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
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
  meetBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  meetBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
