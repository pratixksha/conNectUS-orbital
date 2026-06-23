import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ProfileAvatar,
  INTEREST_FILTERS,
  fetchDiscoverProfiles,
  fetchFriendshipStatus,
  getCurrentUserId,
} from '../lib/social';
import UserProfileScreen from './UserProfileScreen';

export default function MeetPeopleScreen({ onBack, onOpenChat }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [interestFilter, setInterestFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [friendshipMap, setFriendshipMap] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadProfiles();
  }, [search, interestFilter]);

  async function loadProfiles() {
    setLoading(true);
    const userId = await getCurrentUserId();
    setCurrentUserId(userId);

    try {
      const data = await fetchDiscoverProfiles(userId, { search, interestFilter });
      setProfiles(data);

      const statuses = await Promise.all(
        data.map(async p => {
          const status = await fetchFriendshipStatus(userId, p.id);
          return [p.id, status];
        })
      );
      setFriendshipMap(Object.fromEntries(statuses));
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  }

  function getStatusLabel(userId) {
    const friendship = friendshipMap[userId];
    if (!friendship) return null;
    if (friendship.status === 'accepted') return 'Friends';
    if (friendship.status === 'pending') {
      return friendship.requester_id === currentUserId ? 'Pending' : 'Requested you';
    }
    return null;
  }

  if (selectedUserId) {
    return (
      <UserProfileScreen
        userId={selectedUserId}
        initialFriendship={friendshipMap[selectedUserId]}
        onBack={() => {
          setSelectedUserId(null);
          loadProfiles();
        }}
        onOpenChat={onOpenChat}
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
            <Text style={styles.headerEyebrow}>NUS STUDENTS</Text>
            <Text style={styles.headerTitle}>Meet People</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or faculty..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} 
          contentContainerStyle={styles.filtersRow}
        >
          {INTEREST_FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterChip, interestFilter === filter.id && styles.filterChipActive]}
              onPress={() => setInterestFilter(filter.id)}
            >
              <Text style={[styles.filterText, interestFilter === filter.id && styles.filterTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#1d4ed8" />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {profiles.length === 0 && (
              <Text style={styles.emptyText}>No students found. Try a different search.</Text>
            )}
            {profiles.map(profile => {
              const statusLabel = getStatusLabel(profile.id);
              return (
                <TouchableOpacity
                  key={profile.id}
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
                  {statusLabel
                    ? <Text style={styles.statusBadge}>{statusLabel}</Text>
                    : <Text style={styles.chevron}>›</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
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
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filtersRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, alignItems: 'center', },
  filterChip: {
    paddingHorizontal: 16,     
    paddingVertical: 10,       
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    alignSelf: 'flex-start',   
  },
  filterChipActive: { backgroundColor: '#1d4ed8' },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 16,           
  },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
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
  statusBadge: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
});
