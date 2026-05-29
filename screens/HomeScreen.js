import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import EventDetailScreen from './EventDetailScreen';

export default function HomeScreen({ onLogout }) {
    const [profile, setProfile] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);

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
        if (onLogout) onLogout();
    }

    if (selectedEvent) {
        return <EventDetailScreen event={selectedEvent} onBack={() => setSelectedEvent(null)} />;
    }

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.appName}>conNectUS</Text>
                </View>

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
                        <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
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

                {/* My Communities (placeholder) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Communities</Text>
                        <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
                    </View>
                    <View style={styles.placeholderCard}>
                        <Text style={styles.placeholderText}>Communities coming soon!</Text>
                    </View>
                </View>

                {/* People You Might Know (placeholder) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>People You Might Know</Text>
                        <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
                    </View>
                    <View style={styles.placeholderCard}>
                        <Text style={styles.placeholderText}>Connections coming soon!</Text>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Log out</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
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
    logoutBtn: { margin: 16, padding: 14, alignItems: 'center' },
    logoutText: { color: '#dc2626', fontSize: 15 },
});