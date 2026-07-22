import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getCommunitiesMutualInfo } from '../lib/social';

const CATEGORIES = ['All', 'Study', 'Sports', 'Music', 'Gaming', 'Food', 'Arts', 'Tech', 'Other'];
const CATEGORY_COLORS = {
  Study: '#3b82f6', Sports: '#10b981', Music: '#8b5cf6',
  Gaming: '#f59e0b', Food: '#ef4444', Arts: '#ec4899',
  Tech: '#06b6d4', Other: '#94a3b8',
};

export function filterCommunities(communities, search, activeCategory) {
  return communities.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || c.category === activeCategory;
    return matchSearch && matchCat;
  });
}

export function splitCommunities(filtered, myIds) {
  return {
    myCommunities: filtered.filter(c => myIds.has(c.id)),
    discover: filtered.filter(c => !myIds.has(c.id)),
  };
}

export default function CommunitiesScreen({ onBack, onCreatePress, onCommunityPress }) {
  const [userId, setUserId] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [myIds, setMyIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [mutualModalCommunity, setMutualModalCommunity] = useState(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user.id);
    await fetchCommunities(user.id);
  }

  async function fetchCommunities(uid) {
    setLoading(true);
    const { data } = await supabase
      .from('communities')
      .select('*, community_members(user_id)')
      .order('created_at', { ascending: false });

    if (data) {
      const communityIds = data.map(c => c.id);
      const mutualInfo = await getCommunitiesMutualInfo(uid, communityIds);
      setCommunities(data.map(c => ({
        ...c,
        mutual_count: mutualInfo[c.id]?.count || 0,
        mutual_names: mutualInfo[c.id]?.names || [],
      })));
      const joined = new Set(
        data.filter(c => c.community_members.some(m => m.user_id === uid)).map(c => c.id)
      );
      setMyIds(joined);
    }
    setLoading(false);
  }

  async function toggleMembership(community) {
    const joined = myIds.has(community.id);
    if (joined) {
      await supabase.from('community_members')
        .delete().eq('community_id', community.id).eq('user_id', userId);
      setMyIds(prev => { const s = new Set(prev); s.delete(community.id); return s; });
    } else {
      await supabase.from('community_members')
        .insert({ community_id: community.id, user_id: userId });
      setMyIds(prev => new Set([...prev, community.id]));
    }
    fetchCommunities(userId);
  }

  async function deleteCommunity(community) {
    if (community.member_count > 1) {
      Alert.alert(
        'Cannot Delete',
        'This community still has members. Ask them to leave before deleting, or transfer ownership to someone else.',
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(
      'Delete Community',
      `Are you sure you want to delete "${community.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('communities').delete().eq('id', community.id);
            fetchCommunities(userId);
          }
        }
      ]
    );
  }

  /*const filtered = communities.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || c.category === activeCategory;
    return matchSearch && matchCat;
  });
  const myCommunities = filtered.filter(c => myIds.has(c.id));
  const discover = filtered.filter(c => !myIds.has(c.id)); */

  const filtered = filterCommunities(communities, search, activeCategory);
  const { myCommunities, discover } = splitCommunities(filtered, myIds);

  function CategoryChip({ label, selected, onPress }) {
    const color = CATEGORY_COLORS[label] || '#3b82f6';
    return (
      <TouchableOpacity
        style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
        onPress={onPress}
      >
        <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function CommunityCard({ community }) {
    const joined = myIds.has(community.id);
    const isCreator = community.created_by === userId;
    const color = CATEGORY_COLORS[community.category] || '#94a3b8';
    return (
      <TouchableOpacity style={styles.card} onPress={() => {
        if (joined || !isCreator) {
          onCommunityPress(community, joined);
        }
      }}>
        <View style={[styles.cardAvatar, { backgroundColor: color + '22' }]}>
          <Text style={[styles.cardAvatarText, { color }]}>{community.name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName}>{community.name}</Text>
            <View style={[styles.catTag, { backgroundColor: color + '22' }]}>
              <Text style={[styles.catTagText, { color }]}>{community.category || 'Other'}</Text>
            </View>
          </View>
          {community.description ? <Text style={styles.cardDesc} numberOfLines={1}>{community.description}</Text> : null}
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMeta}>{community.member_count || 0} members</Text>
            {community.mutual_count > 0 && (
              <TouchableOpacity
                style={styles.friendBadge}
                onPress={(e) => { e.stopPropagation(); setMutualModalCommunity(community); }}
              >
                <Text style={styles.friendBadgeText}>{community.mutual_count} friend{community.mutual_count === 1 ? '' : 's'} here</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.cardActions}>
          {isCreator ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={(e) => { e.stopPropagation(); deleteCommunity(community); }}>
              <Text style={styles.deleteText}>🗑</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.joinBtn, joined && styles.leaveBtn]}
              onPress={(e) => { e.stopPropagation(); joined ? toggleMembership(community) : onCommunityPress(community, false); }}
            >
              <Text style={[styles.joinText, joined && styles.leaveText]}>{joined ? 'Leave' : 'View'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading || !userId) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Communities</Text>
        <TouchableOpacity onPress={onCreatePress}>
          <Text style={styles.createBtn}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', height: 56 }}>
        {CATEGORIES.map(cat => (
          <CategoryChip key={cat} label={cat} selected={activeCategory === cat} onPress={() => setActiveCategory(cat)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {myCommunities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Communities</Text>
            {myCommunities.map(c => <CommunityCard key={c.id} community={c} />)}
          </View>
        )}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discover</Text>
          {discover.length === 0
            ? <Text style={styles.empty}>No communities found.</Text>
            : discover.map(c => <CommunityCard key={c.id} community={c} />)
          }
        </View>
      </ScrollView>

      {mutualModalCommunity && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalOverlayBg} onPress={() => setMutualModalCommunity(null)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{mutualModalCommunity.name} friends here</Text>
              {mutualModalCommunity.mutual_names?.length > 0 ? (
                mutualModalCommunity.mutual_names.map((name, index) => (
                  <Text key={index} style={styles.modalItem}>• {name}</Text>
                ))
              ) : (
                <Text style={styles.modalItem}>No friends here yet.</Text>
              )}
              <TouchableOpacity style={styles.modalClose} onPress={() => setMutualModalCommunity(null)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  back: { fontSize: 15, color: '#1d4ed8' },
  title: { fontSize: 18, fontWeight: '700' },
  createBtn: { fontSize: 26, color: '#1d4ed8', fontWeight: '300' },
  searchBox: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchInput: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1e293b' },
  chipsRow: { height: 56, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 10 },
  cardAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardAvatarText: { fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  catTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  catTagText: { fontSize: 11, fontWeight: '600' },
  cardDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardMeta: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  friendBadge: { backgroundColor: '#d1fae5', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  friendBadgeText: { fontSize: 11, fontWeight: '700', color: '#065f46' },
  cardActions: { marginLeft: 8 },
  leaveBtn: { backgroundColor: '#f1f5f9' },
  joinText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  leaveText: { color: '#64748b' },
  deleteBtn: { padding: 6 },
  deleteText: { fontSize: 18 },
  empty: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 20 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalOverlayBg: { ...StyleSheet.absoluteFillObject },
  modalCard: { width: '90%', backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, elevation: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  modalItem: { fontSize: 14, color: '#334155', marginBottom: 10 },
  modalClose: { marginTop: 16, alignSelf: 'flex-end' },
  modalCloseText: { color: '#1d4ed8', fontWeight: '700' },
});