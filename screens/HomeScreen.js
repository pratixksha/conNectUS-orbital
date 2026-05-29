import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import EventDetailScreen from './EventDetailScreen';
import EventsScreen from './EventsScreen';


export default function HomeScreen({ onLogout }) {
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('home');

  useEffect(() => {
    fetchProfile();
    fetchEvents();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    }
  }

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('*').order('date').limit(3);
    setEvents(data || []);
    setLoading(false);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  function navigate(screen) {
    setSidebarOpen(false);
    setCurrentScreen(screen);
  }

  // Show event detail
  if (selectedEvent) {
    return <EventDetailScreen event={selectedEvent} onBack={() => setSelectedEvent(null)} />;
  }

  // Show events screen
  if (currentScreen === 'events') {
    return <EventsScreen onBack={() => setCurrentScreen('home')} />;
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuBtn}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.appName}>conNectUS</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView>
          {/* Greeting */}
          <View style={styles.greeting}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile?.full_name?.[0] || '?'}</Text>
            </View>
            <View>
              <Text style={styles.greetName}>Hey, {profile?.full_name?.split(' ')[0] || 'there'} 👋</Text>
              <Text style={styles.greetSub}>{profile?.faculty} · Y{profile?.year?.replace('Year ', '')}</Text>
            </View>
          </View>

          {/* Upcoming Events */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <TouchableOpacity onPress={() => navigate('events')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {events.map(event => (
              <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => setSelectedEvent(event)}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventMeta}>{formatDate(event.date)} · {event.location}</Text>
                </View>
                <View style={styles.rsvpBtn}>
                  <Text style={styles.rsvpText}>RSVP</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* My Communities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Communities</Text>
              <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
            </View>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Communities coming soon!</Text>
            </View>
          </View>

          {/* People You Might Know */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>People You Might Know</Text>
              <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
            </View>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Connections coming soon!</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Sidebar Modal */}
      <Modal visible={sidebarOpen} transparent animationType="none">
        <View style={styles.overlay}>
          {/* Tap outside to close */}
          <TouchableOpacity style={styles.overlayBg} onPress={() => setSidebarOpen(false)} />

          {/* Sidebar */}
          <SafeAreaView style={styles.sidebar}>
            {/* Profile */}
            <View style={styles.sidebarProfile}>
              <View style={styles.sidebarAvatar}>
                <Text style={styles.sidebarAvatarText}>{profile?.full_name?.[0] || '?'}</Text>
              </View>
              <Text style={styles.sidebarName}>{profile?.full_name || 'NUS Student'}</Text>
              <Text style={styles.sidebarSub}>{profile?.faculty} · Y{profile?.year?.replace('Year ', '')}</Text>
            </View>

            {/* Nav Items */}
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('home')}>
              <Text style={styles.navIcon}>🏠</Text>
              <Text style={[styles.navText, currentScreen === 'home' && styles.navActive]}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('events')}>
              <Text style={styles.navIcon}>📅</Text>
              <Text style={[styles.navText, currentScreen === 'events' && styles.navActive]}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('home')}>
              <Text style={styles.navIcon}>📍</Text>
              <Text style={styles.navText}>Hangouts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('home')}>
              <Text style={styles.navIcon}>💬</Text>
              <Text style={styles.navText}>Chats</Text>
            </TouchableOpacity>

            <Text style={styles.navSection}>SOCIAL</Text>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('home')}>
              <Text style={styles.navIcon}>👥</Text>
              <Text style={styles.navText}>Communities</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('home')}>
              <Text style={styles.navIcon}>🤝</Text>
              <Text style={styles.navText}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('home')}>
              <Text style={styles.navIcon}>👤</Text>
              <Text style={styles.navText}>Profile</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.navItem} onPress={() => navigate('home')}>
              <Text style={styles.navIcon}>⚙️</Text>
              <Text style={styles.navText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
              <Text style={styles.navIcon}>↩️</Text>
              <Text style={[styles.navText, { color: '#dc2626' }]}>Log out</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuBtn: { width: 32 },
  menuIcon: { fontSize: 22 },
  appName: { fontSize: 20, fontWeight: 'bold', color: '#1d4ed8' },
  greeting: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#1d4ed8' },
  greetName: { fontSize: 20, fontWeight: 'bold' },
  greetSub: { fontSize: 13, color: '#666', marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  seeAll: { fontSize: 13, color: '#1d4ed8' },
  eventCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 10 },
  eventInfo: { flex: 1, marginRight: 12 },
  eventTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  eventMeta: { fontSize: 12, color: '#666' },
  rsvpBtn: { backgroundColor: '#1d4ed8', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  rsvpText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  placeholderCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 20, alignItems: 'center' },
  placeholderText: { color: '#999', fontSize: 14 },
  // Sidebar
  overlay: { flex: 1, flexDirection: 'row' },
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sidebar: { width: 260, backgroundColor: '#fff', paddingHorizontal: 16 },
  sidebarProfile: { paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 12 },
  sidebarAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  sidebarAvatarText: { fontSize: 24, fontWeight: 'bold', color: '#1d4ed8' },
  sidebarName: { fontSize: 17, fontWeight: '700' },
  sidebarSub: { fontSize: 13, color: '#666', marginTop: 2 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  navIcon: { fontSize: 18, width: 28 },
  navText: { fontSize: 16, color: '#1e293b' },
  navActive: { color: '#1d4ed8', fontWeight: '700' },
  navSection: { fontSize: 11, color: '#94a3b8', fontWeight: '700', marginTop: 16, marginBottom: 4, letterSpacing: 1 },
});