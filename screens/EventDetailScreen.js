import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { fetchEventAttendeesWithMutualFlag } from '../lib/social';

export default function EventDetailScreen({ event, onBack }) {
    const [attendees, setAttendees] = useState([]);
    const [signedUp, setSignedUp] = useState(false);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getUser();
    }, []);

    async function getUser() {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id);
        if (user) {
            await checkSignup(user.id);
            await fetchAttendees(user.id);
        } else {
            setLoading(false);
        }
    }

    async function fetchAttendees(uid) {
        const attendeesWithFlags = await fetchEventAttendeesWithMutualFlag(event.id, uid);
        setAttendees(attendeesWithFlags || []);
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
        } else {
            await supabase.from('event_signups').insert({ event_id: event.id, user_id: userId });
            setSignedUp(true);
        }
        if (userId) await fetchAttendees(userId);
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
                    <View style={[styles.row, styles.rowInline]}>
                        <Text style={styles.meta}>👥 {attendees.length} signed up</Text>
                        {attendees.filter(a => a.isFriend).length > 0 && (
                          <View style={styles.mutualTag}>
                            <Text style={styles.mutualTagText}>{attendees.filter(a => a.isFriend).length} friend{attendees.filter(a => a.isFriend).length === 1 ? '' : 's'} attending</Text>
                          </View>
                        )}
                    </View>

                    <Text style={styles.sectionHeader}>About</Text>
                    <Text style={styles.desc}>{event.description}</Text>

                    {attendees.length > 0 && (
                        <>
                            <Text style={styles.sectionHeader}>Attendees</Text>
                            {attendees.map((a, i) => (
                                <View key={i} style={styles.attendeeRow}>
                                  <Text style={styles.attendee}>• {a.profile?.full_name || 'NUS Student'}</Text>
                                  {a.isFriend && (
                                    <View style={styles.attendeeBadge}>
                                      <Text style={styles.attendeeBadgeText}>friend</Text>
                                    </View>
                                  )}
                                </View>
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
    rowInline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    meta: { fontSize: 14, color: '#444' },
    mutualTag: { backgroundColor: '#d1fae5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    mutualTagText: { color: '#065f46', fontSize: 12, fontWeight: '700' },
    sectionHeader: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 8 },
    desc: { fontSize: 14, color: '#555', lineHeight: 22 },
    attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    attendee: { fontSize: 14, color: '#343a40' },
    attendeeBadge: { backgroundColor: '#d1fae5', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    attendeeBadgeText: { color: '#065f46', fontSize: 12, fontWeight: '700' },
    btn: { margin: 16, backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
    btnWithdraw: { backgroundColor: '#dc2626' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});