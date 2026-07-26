import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { scheduleReminder, cancelReminder } from '../lib/notifications';
import { exportToCalendar } from '../lib/calendar';

const LEAD_OPTIONS = [
    { label: '30 min before', minutes: 30 },
    { label: '1 hour before', minutes: 60 },
    { label: '1 day before', minutes: 1440 },
];

export default function EventDetailScreen({ event, onBack }) {
    const [attendees, setAttendees] = useState([]);
    const [signedUp, setSignedUp] = useState(false);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reminderMinutes, setReminderMinutes] = useState(null);

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
            await cancelReminder(event.id, userId);
            setSignedUp(false);
            setReminderMinutes(null);
        } else {
            await supabase.from('event_signups').insert({ event_id: event.id, user_id: userId });
            setSignedUp(true);
        }
        fetchAttendees();
    }

    async function handleSetReminder(minutes) {
    const { error } = await scheduleReminder(event.id, userId, event.date, minutes);
    if (error) {
        Alert.alert('Could not set reminder', error.message);
        return;
    }
    setReminderMinutes(minutes);
    Alert.alert('Reminder set', `We'll notify you ${LEAD_OPTIONS.find(o => o.minutes === minutes).label.toLowerCase()}.`);
}

    async function handleAddToCalendar() {
        try {
            await exportToCalendar(event);
            Alert.alert('Added', 'Event added to your calendar.');
        } catch (e) {
            Alert.alert('Could not add event', e.message);
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
                {event.image_url ? (
                    <Image
                        source={{ uri: event.image_url }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Text style={styles.imageText}>📅</Text>
                    </View>
                )}

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

                    <TouchableOpacity style={styles.calendarBtn} onPress={handleAddToCalendar}>
                        <Text style={styles.calendarBtnText}>📆 Add to Calendar</Text>
                    </TouchableOpacity>

                    {signedUp && (
                        <View style={styles.reminderSection}>
                            <Text style={styles.sectionHeader}>Remind me</Text>
                            <View style={styles.reminderRow}>
                                {LEAD_OPTIONS.map(opt => (
                                    <TouchableOpacity
                                        key={opt.minutes}
                                        style={[
                                            styles.reminderChip,
                                            reminderMinutes === opt.minutes && styles.reminderChipActive,
                                        ]}
                                        onPress={() => handleSetReminder(opt.minutes)}
                                    >
                                        <Text style={[
                                            styles.reminderChipText,
                                            reminderMinutes === opt.minutes && styles.reminderChipTextActive,
                                        ]}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

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
    image: { height: 200, width: '100%' },
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
    calendarBtn: { marginTop: 16, borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, padding: 12, alignItems: 'center' },
    calendarBtnText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
    reminderSection: { marginTop: 8 },
    reminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    reminderChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
    reminderChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    reminderChipText: { fontSize: 13, color: '#444' },
    reminderChipTextActive: { color: '#fff', fontWeight: '600' },
});