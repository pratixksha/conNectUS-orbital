import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function EventDetailScreen({ event, onBack }) {
    const [attendees, setAttendees] = useState([]);
    const [signedUp, setSignedUp] = useState(false);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getUser();
        fetchAttendees();
    }, []);

    async function getUser() {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id);
        if (user) checkSignup(user.id);
    }

    async function fetchAttendees() {
        const { data } = await supabase
            .from('event_signups')
            .select('user_id, profiles(full_name)')
            .eq('event_id', event.id);
        setAttendees(data || []);
        setLoading(false);
    }

    async function checkSignup(uid) {
        const { data } = await supabase
            .from('event_signups')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', uid)
            .single();
        setSignedUp(!!data);
    }

    async function toggleSignup() {
        if (signedUp) {
            await supabase.from('event_signups').delete()
                .eq('event_id', event.id).eq('user_id', userId);
            setSignedUp(false);
            setAttendees(prev => prev.filter(a => a.user_id !== userId));
        } else {
            await supabase.from('event_signups').insert({ event_id: event.id, user_id: userId });
            setSignedUp(true);
            fetchAttendees();
        }
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    }

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <ScrollView>
                <View style={styles.imagePlaceholder}>
                    <Text style={styles.imageText}>📅</Text>
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>{event.title}</Text>
                    <View style={styles.row}>
                        <Text style={styles.meta}>🗓 {formatDate(event.date)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.meta}>📍 {event.location}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.meta}>👥 {attendees.length} signed up</Text>
                    </View>

                    <Text style={styles.sectionHeader}>About</Text>
                    <Text style={styles.desc}>{event.description}</Text>

                    {attendees.length > 0 && (
                        <>
                            <Text style={styles.sectionHeader}>Attendees</Text>
                            {attendees.map((a, i) => (
                                <Text key={i} style={styles.attendee}>• {a.profiles?.full_name || 'NUS Student'}</Text>
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>

            <TouchableOpacity
                style={[styles.btn, signedUp && styles.btnWithdraw]}
                onPress={toggleSignup}
            >
                <Text style={styles.btnText}>{signedUp ? 'Withdraw' : 'Sign Up'}</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    backBtn: { padding: 16 },
    backText: { color: '#2563eb', fontSize: 16 },
    imagePlaceholder: { backgroundColor: '#e5e7eb', height: 200, justifyContent: 'center', alignItems: 'center' },
    imageText: { fontSize: 60 },
    content: { padding: 16 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
    row: { marginBottom: 6 },
    meta: { fontSize: 14, color: '#444' },
    sectionHeader: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 8 },
    desc: { fontSize: 14, color: '#555', lineHeight: 22 },
    attendee: { fontSize: 14, color: '#555', marginBottom: 4 },
    btn: { margin: 16, backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
    btnWithdraw: { backgroundColor: '#dc2626' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});