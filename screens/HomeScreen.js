import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, Image, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import EventDetailScreen from './EventDetailScreen';
import EventsScreen from './EventsScreen';
import { useFocusEffect } from '@react-navigation/native';
import HangoutsScreen from './HangoutsScreen';
import ProfileScreen from './ProfileScreen';
import FriendsScreen from './FriendsScreen';
import ChatsScreen from './ChatsScreen';
import CommunitiesScreen from './CommunitiesScreen';
import CreateCommunityScreen from './CreateCommunityScreen';
import CommunityPreviewScreen from './CommunityPreviewScreen';
import CommunityHomeScreen from './CommunityHomeScreen';


export default function HomeScreen({ onLogout }) {
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [signedUpEvents, setSignedUpEvents] = useState([]);
  const [pendingChat, setPendingChat] = useState(null);
  const [myCommunities, setMyCommunities] = useState([]);
  const [selectedCommunity, setSelectedCommunity] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
      fetchEvents();
      fetchMyCommunities();
    }, [])
  );

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    }
  }

  async function fetchEvents() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('event_signups')
        .select('event_id, events(*)')
        .eq('user_id', user.id)
        .order('events(date)', { ascending: true })
        .limit(3);
      setEvents((data || []).map(r => r.events));
    }
    setLoading(false);
  }

  async function fetchMyCommunities() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('community_members')
        .select('communities(*)')
        .eq('user_id', user.id)
        .limit(3);
      setMyCommunities((data || []).map(r => r.communities));
    }
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
    return <EventDetailScreen event={selectedEvent} onBack={() => { setSelectedEvent(null); fetchEvents(); }} />;
  }

  // Show events screen
  if (currentScreen === 'events') {
    return <EventsScreen onBack={() => setCurrentScreen('home')} />;
  }

  if (currentScreen === 'hangouts') {
    return <HangoutsScreen onBack={() => setCurrentScreen('home')} />;
  }

  if (currentScreen === 'communities') {
    return <CommunitiesScreen
      onBack={() => setCurrentScreen('home')}
      onCreatePress={() => setCurrentScreen('createCommunity')}
      onCommunityPress={(community, isJoined) => {
        setSelectedCommunity(community);
        setCurrentScreen(isJoined ? 'communityHome' : 'communityPreview');
      }}
    />;
  }

  if (currentScreen === 'communityPreview' && selectedCommunity) {
    return <CommunityPreviewScreen
      community={selectedCommunity}
      onBack={() => setCurrentScreen('communities')}
      onJoined={() => setCurrentScreen('communities')}
    />;
  }

  if (currentScreen === 'communityHome' && selectedCommunity) {
    return <CommunityHomeScreen
      community={selectedCommunity}
      onBack={() => setCurrentScreen('communities')}
    />;
  }

  if (currentScreen === 'createCommunity') {
    return <CreateCommunityScreen onBack={() => setCurrentScreen('communities')} onCreated={() => setCurrentScreen('communities')} />;
  }

  if (currentScreen === 'profile') {
    return <ProfileScreen onBack={() => { setCurrentScreen('home'); fetchProfile(); }} />;
  }

  if (currentScreen === 'friends') {
    return (
      <FriendsScreen
        onBack={() => setCurrentScreen('home')}
        onOpenChat={(chat) => {
          setPendingChat(chat);
          setCurrentScreen('chats');
        }}
      />
    );
  }

  if (currentScreen === 'chats') {
    return (
      <ChatsScreen
        initialChat={pendingChat}
        onBack={() => {
          setPendingChat(null);
          setCurrentScreen('home');
        }}
      />
    );
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
          <Text style={styles.appName}>
            con<Text style={{ color: '#ea580c' }}>N</Text>ect<Text style={{ color: '#ea580c' }}>US</Text>
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView>
          {/* Greeting */}
          <View style={styles.greeting}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile?.full_name?.[0] || '?'}</Text>
              </View>
            )}
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
                  <Text style={styles.rsvpText}>View</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* My Communities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Communities</Text>
              <TouchableOpacity onPress={() => navigate('communities')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {myCommunities.length === 0 ? (
              <View style={styles.placeholderCard}>
                <Text style={styles.placeholderText}>You haven't joined any communities yet!</Text>
              </View>
            ) : (
              myCommunities.map(c => (
                <TouchableOpacity key={c.id} style={styles.eventCard} onPress={() => {
                  setSelectedCommunity(c);
                  setCurrentScreen('communityHome');
                }}>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{c.name}</Text>
                    <Text style={styles.eventMeta}>{c.category} · {c.member_count || 0} members</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
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
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.sidebarAvatar} />
              ) : (
                <View style={styles.sidebarAvatar}>
                  <Text style={styles.sidebarAvatarText}>{profile?.full_name?.[0] || '?'}</Text>
                </View>
              )}
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
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('hangouts')}>
              <Text style={styles.navIcon}>📍</Text>
              <Text style={[styles.navText, currentScreen === 'hangouts' && styles.navActive]}>Hangouts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('chats')}>
              <Text style={styles.navIcon}>💬</Text>
              <Text style={[styles.navText, currentScreen === 'chats' && styles.navActive]}>Chats</Text>
            </TouchableOpacity>

            <Text style={styles.navSection}>SOCIAL</Text>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('communities')}>
              <Text style={styles.navIcon}>👥</Text>
              <Text style={styles.navText}>Communities</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigate('friends')}>
              <Text style={styles.navIcon}>🤝</Text>
              <Text style={[styles.navText, currentScreen === 'friends' && styles.navActive]}>Friends</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.navItem} onPress={() => navigate('profile')}>
              <Text style={styles.navIcon}>👤</Text>
              <Text style={[styles.navText, currentScreen === 'profile' && styles.navActive]}>Profile</Text>
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
  sidebar: { width: 260, backgroundColor: '#fff', paddingHorizontal: 16, position: 'absolute', left: 0, top: 0, bottom: 0 },
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