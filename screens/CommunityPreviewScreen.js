import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const CATEGORY_COLORS = {
  Study: '#3b82f6', Sports: '#10b981', Music: '#8b5cf6',
  Gaming: '#f59e0b', Food: '#ef4444', Arts: '#ec4899',
  Tech: '#06b6d4', Other: '#94a3b8',
};

export default function CommunityPreviewScreen({ community, onBack, onJoined }) {
  const [joining, setJoining] = useState(false);
  const color = CATEGORY_COLORS[community.category] || '#94a3b8';

  async function handleJoin() {
    setJoining(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('community_members')
      .insert({ community_id: community.id, user_id: user.id });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      onJoined();
    }
    setJoining(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
          <Text style={[styles.avatarText, { color }]}>{community.name[0].toUpperCase()}</Text>
        </View>

        {/* Name + category */}
        <Text style={styles.name}>{community.name}</Text>
        <View style={[styles.catTag, { backgroundColor: color + '22' }]}>
          <Text style={[styles.catText, { color }]}>{community.category || 'Other'}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{community.member_count || 0}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>

        {/* Description */}
        {community.description ? (
          <View style={styles.descBox}>
            <Text style={styles.descText}>{community.description}</Text>
          </View>
        ) : null}
      </View>

      {/* Join button */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.joinBtn, { backgroundColor: color }]} onPress={handleJoin} disabled={joining}>
          <Text style={styles.joinText}>{joining ? 'Joining...' : 'Join Community'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back: { fontSize: 15, color: '#1d4ed8' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  catTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 24 },
  catText: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 32 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  descBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, width: '100%' },
  descText: { fontSize: 15, color: '#475569', lineHeight: 22 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  joinBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});