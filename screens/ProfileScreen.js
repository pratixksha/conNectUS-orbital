import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Modal, Alert, ActivityIndicator, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const INTERESTS = [
  'AI & Tech', 'Badminton', 'Startups', 'Supper runs',
  'Gaming', 'Photography', 'Study groups', 'Travel',
  'Music', 'Running', 'Hackathons', 'Film',
  'Cooking', 'Volunteering', 'Finance', 'Design',
];

const FACULTIES = [
  'Arts & Social Sciences', 'Business', 'Computing', 'Dentistry',
  'Design & Engineering', 'Law', 'Medicine', 'Music', 'Science',
];

const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Graduate', 'Exchange'];

const GOALS = [
  'Find study partners',
  'Meet new friends',
  'Explore internships',
  'Join clubs & communities',
  'Exchange student looking to connect',
];

const INTEREST_COLORS = {
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

function getChipColor(interest) {
  return INTEREST_COLORS[interest] || '#6B7280';
}

function PickerModal({ visible, options, value, onSelect, onClose, title }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.pickerOverlay}>
        <TouchableOpacity style={styles.pickerBg} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.pickerItem, value === opt && styles.pickerItemSelected]}
                onPress={() => { onSelect(opt); onClose(); }}
              >
                <Text style={[styles.pickerItemText, value === opt && styles.pickerItemTextSelected]}>{opt}</Text>
                {value === opt && <Text style={styles.pickerCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen({ onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [year, setYear] = useState('');
  const [goal, setGoal] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Privacy
  const [onlyFriendsMessage, setOnlyFriendsMessage] = useState(false);

  // Pickers
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setName(data.full_name || '');
        setFaculty(data.faculty || '');
        setYear(data.year || '');
        setGoal(data.networking_goal || '');
        setBio(data.bio || '');
        setInterests(data.interests || []);
        setOnlyFriendsMessage(data.only_friends_message ?? false);
        setAvatarUrl(data.avatar_url || null);
      }
    }
    setLoading(false);
  }

  async function pickAndUploadAvatar() {
    console.log('picking avatar...');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('permission status:', status);
    if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library.');
        return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
    });

    console.log('picker result:', result.canceled);
    if (result.canceled) return;

    setUploadingAvatar(true);
    const uri = result.assets[0].uri;
    const ext = uri.split('.').pop();
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user.id}/avatar.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

    if (uploadError) {
        setUploadingAvatar(false);
        Alert.alert('Upload failed', uploadError.message);
        return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;  

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
    console.log('upload complete:', publicUrl);
  }

  function toggleInterest(item) {
    setInterests(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  }

  async function saveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      full_name: name,
      faculty,
      year,
      networking_goal: goal,
      bio,
      interests,
      avatar_url: avatarUrl,
      only_friends_message: onlyFriendsMessage,
    }).eq('id', user.id);

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setProfile(prev => ({ ...prev, full_name: name, faculty, year, networking_goal: goal, bio, interests }));
    setEditing(false);
    Alert.alert('Saved', 'Your profile has been updated.');
  }

  function getInitial() {
    return name?.[0]?.toUpperCase() || '?';
  }

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1d4ed8" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => editing ? saveProfile() : setEditing(true)} style={styles.editBtn}>
            {saving
              ? <ActivityIndicator size="small" color="#1d4ed8" />
              : <Text style={styles.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
            <TouchableOpacity onPress={editing ? pickAndUploadAvatar : null} activeOpacity={editing ? 0.7 : 1}>
                {uploadingAvatar ? (
                <View style={styles.avatar}>
                    <ActivityIndicator color="#1d4ed8" />
                </View>
                ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitial()}</Text>
                </View>
                )}
                {editing && (
                <View style={styles.avatarEditBadge}>
                    <Text style={styles.avatarEditBadgeText}>Edit</Text>
                </View>
                )}
            </TouchableOpacity>

            {editing ? (
                <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#aaa"
                />
            ) : (
                <Text style={styles.nameText}>{name || 'Your name'}</Text>
            )}
            <Text style={styles.subText}>
                {faculty || 'Faculty'} · {year ? year.replace('Year ', 'Y') : 'Year'}
            </Text>
        </View>

          {/* Bio */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>BIO</Text>
            {editing ? (
              <TextInput
                style={styles.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder='"connecting with like-minded people!"'
                placeholderTextColor="#aaa"
                multiline
              />
            ) : (
              <Text style={styles.bioText}>{bio || 'Add a bio...'}</Text>
            )}
          </View>

          {/* Details */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>DETAILS</Text>

            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => editing && setShowFacultyPicker(true)}
              activeOpacity={editing ? 0.7 : 1}
            >
              <Text style={styles.detailLabel}>Faculty</Text>
              <View style={styles.detailRight}>
                <Text style={styles.detailValue}>{faculty || '—'}</Text>
                {editing && <Text style={styles.detailChevron}>›</Text>}
              </View>
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => editing && setShowYearPicker(true)}
              activeOpacity={editing ? 0.7 : 1}
            >
              <Text style={styles.detailLabel}>Year</Text>
              <View style={styles.detailRight}>
                <Text style={styles.detailValue}>{year || '—'}</Text>
                {editing && <Text style={styles.detailChevron}>›</Text>}
              </View>
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => editing && setShowGoalPicker(true)}
              activeOpacity={editing ? 0.7 : 1}
            >
              <Text style={styles.detailLabel}>Networking Goal</Text>
              <View style={styles.detailRight}>
                <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>{goal || '—'}</Text>
                {editing && <Text style={styles.detailChevron}>›</Text>}
              </View>
            </TouchableOpacity>
          </View>

          {/* Interests */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>INTERESTS</Text>
            <View style={styles.chipsGrid}>
              {(editing ? INTERESTS : interests).map(item => {
                const selected = interests.includes(item);
                const color = getChipColor(item);
                if (!editing && !selected) return null;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.chip,
                      selected
                        ? { backgroundColor: color + '20', borderColor: color }
                        : { backgroundColor: '#f8fafc', borderColor: '#e5e7eb' },
                    ]}
                    onPress={() => editing && toggleInterest(item)}
                    activeOpacity={editing ? 0.7 : 1}
                  >
                    <Text style={[styles.chipText, selected && { color }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
              {!editing && interests.length === 0 && (
                <Text style={styles.emptyText}>No interests added yet</Text>
              )}
            </View>
          </View>

          {/* Privacy */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PRIVACY</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Only friends can message me</Text>
                <Text style={styles.toggleSub}>Strangers won't be able to send you messages</Text>
              </View>
              <Switch
                value={onlyFriendsMessage}
                onValueChange={setOnlyFriendsMessage}
                disabled={!editing}
                trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                thumbColor={onlyFriendsMessage ? '#16a34a' : '#9ca3af'}
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      <PickerModal
        visible={showFacultyPicker}
        options={FACULTIES}
        value={faculty}
        onSelect={setFaculty}
        onClose={() => setShowFacultyPicker(false)}
        title="Select Faculty"
      />
      <PickerModal
        visible={showYearPicker}
        options={YEARS}
        value={year}
        onSelect={setYear}
        onClose={() => setShowYearPicker(false)}
        title="Select Year"
      />
      <PickerModal
        visible={showGoalPicker}
        options={GOALS}
        value={goal}
        onSelect={setGoal}
        onClose={() => setShowGoalPicker(false)}
        title="Networking Goal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { width: 60 },
  backText: { fontSize: 15, color: '#1d4ed8' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  editBtn: { width: 60, alignItems: 'flex-end' },
  editBtnText: { fontSize: 15, color: '#1d4ed8', fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingTop: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#1d4ed8' },
  nameInput: {
    fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center',
    borderBottomWidth: 1.5, borderBottomColor: '#1d4ed8',
    paddingVertical: 4, paddingHorizontal: 12, marginBottom: 6, minWidth: 160,
  },
  nameText: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  subText: { fontSize: 14, color: '#888' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 10 },

  bioInput: { fontSize: 15, color: '#111', lineHeight: 22, minHeight: 60, textAlignVertical: 'top' },
  bioText: { fontSize: 15, color: '#444', lineHeight: 22, fontStyle: 'italic' },

  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  detailLabel: { fontSize: 15, color: '#111' },
  detailRight: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '60%' },
  detailValue: { fontSize: 15, color: '#888' },
  detailChevron: { fontSize: 18, color: '#aaa' },
  separator: { height: 1, backgroundColor: '#f1f5f9' },

  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '500', color: '#555' },
  emptyText: { fontSize: 14, color: '#aaa' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, color: '#111', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: '#888', lineHeight: 16 },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  pickerHandle: { width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  pickerItem: {
    paddingVertical: 14, paddingHorizontal: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9',
  },
  pickerItemSelected: { backgroundColor: '#eff6ff' },
  pickerItemText: { fontSize: 16, color: '#111' },
  pickerItemTextSelected: { color: '#1d4ed8', fontWeight: '600' },
  pickerCheck: { fontSize: 16, color: '#1d4ed8' },

  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
},
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#1d4ed8', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1.5, borderColor: '#fff',
  },
  avatarEditBadgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
});