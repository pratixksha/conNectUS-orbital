import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

const CATEGORIES = ['Study', 'Sports', 'Music', 'Gaming', 'Food', 'Arts', 'Tech', 'Other'];
const CATEGORY_COLORS = {
  Study: '#3b82f6', Sports: '#10b981', Music: '#8b5cf6',
  Gaming: '#f59e0b', Food: '#ef4444', Arts: '#ec4899',
  Tech: '#06b6d4', Other: '#94a3b8',
};

export default function CreateCommunityScreen({ onBack, onCreated }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Other');
  const [bannerUri, setBannerUri] = useState(null);
  const [creating, setCreating] = useState(false);

  async function pickBanner() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setBannerUri(result.assets[0].uri);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return Alert.alert('Error', 'Community name is required.');
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();

    let banner_url = null;
    if (bannerUri) {
      const ext = bannerUri.split('.').pop().toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append('file', { uri: bannerUri, type: `image/${ext}`, name: `banner.${ext}` });
      const { error: uploadError } = await supabase.storage
        .from('community-banners')
        .upload(path, formData, { contentType: `image/${ext}` });
      if (uploadError) {
        console.log('Banner upload error:', uploadError.message);
      } else {
        const { data: urlData } = supabase.storage.from('community-banners').getPublicUrl(path);
        banner_url = urlData.publicUrl;
      }
    }

    const { data, error } = await supabase.from('communities')
      .insert({ name: name.trim(), description: desc.trim(), category, created_by: user.id, banner_url })
      .select().single();

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await supabase.from('community_members').insert({ community_id: data.id, user_id: user.id });
      onCreated();
    }
    setCreating(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Community</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.label}>BANNER IMAGE</Text>
          <TouchableOpacity style={styles.bannerPicker} onPress={pickBanner}>
            {bannerUri
              ? <Image source={{ uri: bannerUri }} style={styles.bannerPreview} />
              : <Text style={styles.bannerPickerText}>📷 Tap to add a banner</Text>
            }
          </TouchableOpacity>

          <Text style={styles.label}>NAME *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. NUS Foodies"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, { height: 100 }]}
            placeholder="What's this community about?"
            value={desc}
            onChangeText={setDesc}
            multiline
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.chipsGrid}>
            {CATEGORIES.map(cat => {
              const selected = category === cat;
              const color = CATEGORY_COLORS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, selected && { color: '#fff' }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createText}>{creating ? 'Creating...' : 'Create Community'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cancel: { fontSize: 15, color: '#1d4ed8' },
  title: { fontSize: 18, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.8, marginBottom: 8, marginTop: 20 },
  bannerPicker: { height: 120, backgroundColor: '#f8fafc', borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  bannerPreview: { width: '100%', height: '100%' },
  bannerPickerText: { color: '#94a3b8', fontSize: 15 },
  input: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1e293b' },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  chipText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  createBtn: { backgroundColor: '#1d4ed8', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});