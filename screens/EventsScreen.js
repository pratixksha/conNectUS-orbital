import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function EventsScreen() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [signedUp, setSignedUp] = useState({});
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        getUser();
        fetchEvents();
    }, []);

    async function getUser() {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id);
        if (user) fetchSignups(user.id);
    }

    async function fetchEvents() {
        const { data, error } = await supabase.from('events').select('*').order('date');
        if (error) Alert.alert('Error', error.message);
        else setEvents(data);
        setLoading(false);
    }

    async function fetchSignups(uid) {
        const { data } = await supabase.from('event_signups').select('event_id').eq('user_id', uid);
        const map = {};
        data?.forEach(s => map[s.event_id] = true);
        setSignedUp(map);
    }

    async function toggleSignup(eventId) {
        if (signedUp[eventId]) {
            await supabase.from('event_signups').delete().eq('event_id', eventId).eq('user_id', userId);
            setSignedUp(prev => ({ ...prev, [eventId]: false }));
        } else {
            await supabase.from('event_signups').insert({ event_id: eventId, user_id: userId });
            setSignedUp(prev => ({ ...prev, [eventId]: true }));
        }
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.header}>Events</Text>
            <FlatList
                data={events}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.meta}>📍 {item.location}</Text>
                        <Text style={styles.meta}>🗓 {formatDate(item.date)}</Text>
                        <Text style={styles.desc}>{item.description}</Text>
                        <TouchableOpacity
                            style={[styles.btn, signedUp[item.id] && styles.btnWithdraw]}
                            onPress={() => toggleSignup(item.id)}
                        >
                            <Text style={styles.btnText}>{signedUp[item.id] ? 'Withdraw' : 'Sign Up'}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 16 },
    header: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
    card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
    meta: { fontSize: 13, color: '#666', marginBottom: 2 },
    desc: { fontSize: 14, marginTop: 8, marginBottom: 12 },
    btn: { backgroundColor: '#2563eb', borderRadius: 8, padding: 10, alignItems: 'center' },
    btnWithdraw: { backgroundColor: '#dc2626' },
    btnText: { color: '#fff', fontWeight: '600' },
});