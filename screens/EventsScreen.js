import React, { useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, ScrollView, Modal, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

const PRIMARY = '#2563eb';
const SURFACE = '#f5f5f5';
const BORDER = '#e0e0e0';

const CATEGORIES = ['Academic', 'Social', 'Sports', 'Arts', 'Tech', 'Wellness', 'Career', 'Community'];

const DATE_OPTIONS = [
    { label: 'Any date', value: 'any' },
    { label: 'Today', value: 'today' },
    { label: 'This week', value: 'this_week' },
    { label: 'This month', value: 'this_month' },
];

const LOCATIONS = [
    'UTown',
    'Computing',
    'Engineering',
    'Science',
    'Residential',
    'Sports',
    'UCC',
    'Others',
];

const DEFAULT_FILTERS = { categories: [], dateRange: 'any', locations: [] };

function countActive(f) {
    return (f.categories.length > 0 ? 1 : 0) +
        (f.dateRange !== 'any' ? 1 : 0) +
        (f.locations.length > 0 ? 1 : 0);
}

function applyFilters(events, f) {
    return events.filter(event => {
        if (f.categories.length > 0 && !f.categories.includes(event.category)) return false;
        if (f.locations.length > 0) {
            const loc = (event.location || '').toLowerCase();

            const matches = f.locations.some(filter => {
                switch (filter) {
                    case 'UTown':
                        return loc.includes('utown');

                    case 'Computing':
                        return loc.includes('com1') ||
                            loc.includes('computing');

                    case 'Engineering':
                        return loc.includes('engineering') ||
                            loc.includes('i3');

                    case 'Science':
                        return loc.includes('science') ||
                            loc.includes('s16');

                    case 'Residential':
                        return loc.includes('capt') ||
                            loc.includes('college');

                    case 'Sports':
                        return loc.includes('mpsh') ||
                            loc.includes('court');

                    case 'UCC':
                        return loc.includes('university cultural centre');

                    case 'Others':
                        return !(
                            loc.includes('utown') ||
                            loc.includes('com1') ||
                            loc.includes('computing') ||
                            loc.includes('engineering') ||
                            loc.includes('i3') ||
                            loc.includes('science') ||
                            loc.includes('s16') ||
                            loc.includes('capt') ||
                            loc.includes('college') ||
                            loc.includes('mpsh') ||
                            loc.includes('court') ||
                            loc.includes('university cultural centre')
                        );

                    default:
                        return false;
                }
            });

            if (!matches) return false;
        }
        if (f.dateRange !== 'any') {
            const eventDate = new Date(event.date);
            const now = new Date();

            if (f.dateRange === 'today') {
                const isToday =
                    eventDate.getFullYear() === now.getFullYear() &&
                    eventDate.getMonth() === now.getMonth() &&
                    eventDate.getDate() === now.getDate();
                if (!isToday) return false;

            } else if (f.dateRange === 'this_week') {
                const dayOfWeek = now.getDay();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - dayOfWeek);
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 7);
                if (eventDate < startOfWeek || eventDate >= endOfWeek) return false;

            } else if (f.dateRange === 'this_month') {
                const isSameMonth =
                    eventDate.getFullYear() === now.getFullYear() &&
                    eventDate.getMonth() === now.getMonth();
                if (!isSameMonth) return false;
            }
        }

        return true;
    });
}

function Chip({ label, active, onPress, badge }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={[chipStyles.chip, active && chipStyles.chipActive]}
        >
            <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
            {!!badge && (
                <View style={chipStyles.badge}>
                    <Text style={chipStyles.badgeText}>{badge}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

function FilterPanel({ title, visible, onClose, onApply, children }) {
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <TouchableOpacity style={panelStyles.overlay} activeOpacity={1} onPress={onClose} />
            <SafeAreaView style={panelStyles.sheet}>
                <View style={panelStyles.handle} />
                <View style={panelStyles.header}>
                    <Text style={panelStyles.title}>{title}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={panelStyles.close}>✕</Text>
                    </TouchableOpacity>
                </View>
                <View style={panelStyles.body}>{children}</View>
                <TouchableOpacity style={panelStyles.applyBtn} onPress={onApply}>
                    <Text style={panelStyles.applyText}>Apply</Text>
                </TouchableOpacity>
            </SafeAreaView>
        </Modal>
    );
}

export default function EventsScreen({ onBack }) {
    const [events, setEvents] = useState([]);
    const [signedUpEvents, setSignedUpEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [draft, setDraft] = useState(DEFAULT_FILTERS);
    const [openPanel, setOpenPanel] = useState(null);

    useFocusEffect(
        React.useCallback(() => { fetchAll(); }, [])
    );

    async function fetchAll() {
        const { data: { user } } = await supabase.auth.getUser();
        const [{ data: eventsData }, { data: signupsData }] = await Promise.all([
            supabase.from('events').select('*').order('date'),
            supabase.from('event_signups').select('event_id').eq('user_id', user.id)
        ]);
        setEvents(eventsData || []);
        setSignedUpEvents((signupsData || []).map(r => r.event_id));
        setLoading(false);
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function openWith(panel) {
        setDraft(filters);
        setOpenPanel(panel);
    }

    function applyDraft() {
        setFilters(draft);
        setOpenPanel(null);
    }

    function toggleDraft(key, value) {
        setDraft(d => {
            const arr = d[key];
            return { ...d, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
        });
    }

    const dateLabel = filters.dateRange === 'any'
        ? 'Date'
        : DATE_OPTIONS.find(o => o.value === filters.dateRange)?.label ?? 'Date';

    const visibleEvents = applyFilters(events, filters);

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <SafeAreaView style={styles.container}>
            {onBack && (
                <TouchableOpacity onPress={onBack} style={{ padding: 16 }}>
                    <Text style={{ color: PRIMARY, fontSize: 16 }}>← Back</Text>
                </TouchableOpacity>
            )}

            <Text style={styles.header}>Events</Text>

            {/* Filter bar */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
                contentContainerStyle={chipStyles.bar}
            >
                {countActive(filters) > 0 && (
                    <TouchableOpacity style={chipStyles.clearBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
                        <Text style={chipStyles.clearText}>Clear all</Text>
                    </TouchableOpacity>
                )}
                <Chip
                    label="Category"
                    active={filters.categories.length > 0}
                    badge={filters.categories.length || undefined}
                    onPress={() => openWith('category')}
                />
                <Chip
                    label={dateLabel}
                    active={filters.dateRange !== 'any'}
                    onPress={() => openWith('date')}
                />
                <Chip
                    label="Campus Area"
                    active={filters.locations.length > 0}
                    badge={filters.locations.length || undefined}
                    onPress={() => openWith('location')}
                />
            </ScrollView>

            {/* Events list */}
            <FlatList
                data={visibleEvents}
                keyExtractor={item => item.id}
                ListEmptyComponent={
                    <Text style={styles.empty}>No events match your filters.</Text>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.meta}>📍 {item.location}</Text>
                        <Text style={styles.meta}>🗓 {formatDate(item.date)}</Text>
                        <Text style={styles.desc}>{item.description}</Text>
                        <TouchableOpacity
                            style={styles.btn}
                            onPress={() => router.push(`/event/${item.id}`)}
                        >
                            <Text style={styles.btnText}>
                                {signedUpEvents.includes(item.id) ? 'View' : 'RSVP'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            />

            {/* Category panel */}
            <FilterPanel title="Category" visible={openPanel === 'category'} onClose={() => setOpenPanel(null)} onApply={applyDraft}>
                <View style={panelStyles.grid}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[panelStyles.optChip, draft.categories.includes(cat) && panelStyles.optChipActive]}
                            onPress={() => toggleDraft('categories', cat)}
                        >
                            <Text style={[panelStyles.optText, draft.categories.includes(cat) && panelStyles.optTextActive]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </FilterPanel>

            {/* Date panel */}
            <FilterPanel title="Date range" visible={openPanel === 'date'} onClose={() => setOpenPanel(null)} onApply={applyDraft}>
                <View style={panelStyles.radioList}>
                    {DATE_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={panelStyles.radioRow}
                            onPress={() => setDraft(d => ({ ...d, dateRange: opt.value }))}
                        >
                            <View style={[panelStyles.radio, draft.dateRange === opt.value && panelStyles.radioActive]} />
                            <Text style={panelStyles.radioLabel}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </FilterPanel>

            {/* Location panel */}
            <FilterPanel title="Campus Area" visible={openPanel === 'location'} onClose={() => setOpenPanel(null)} onApply={applyDraft}>
                <View style={panelStyles.grid}>
                    {LOCATIONS.map(loc => (
                        <TouchableOpacity
                            key={loc}
                            style={[panelStyles.optChip, draft.locations.includes(loc) && panelStyles.optChipActive]}
                            onPress={() => toggleDraft('locations', loc)}
                        >
                            <Text style={[panelStyles.optText, draft.locations.includes(loc) && panelStyles.optTextActive]}>
                                {loc}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </FilterPanel>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 16 },
    header: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, paddingHorizontal: 16 },
    card: { backgroundColor: SURFACE, borderRadius: 12, padding: 16, marginBottom: 12, marginHorizontal: 16 },
    title: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
    meta: { fontSize: 13, color: '#666', marginBottom: 2 },
    desc: { fontSize: 14, marginTop: 8, marginBottom: 12 },
    btn: { backgroundColor: PRIMARY, borderRadius: 8, padding: 10, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '600' },
    empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
});

const chipStyles = StyleSheet.create({
    bar: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        paddingTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: '#fff',
    },

    chipActive: {
        backgroundColor: PRIMARY,
        borderColor: PRIMARY,
    },

    text: {
        fontSize: 14,
        color: '#333',
    },

    textActive: {
        color: '#fff',
    },
});

const panelStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 8 : 16 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
    title: { fontSize: 16, fontWeight: '600', color: '#111' },
    close: { fontSize: 16, color: '#888', padding: 4 },
    body: { padding: 20 },
    applyBtn: { marginHorizontal: 20, marginTop: 8, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    applyText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    optChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
    optChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    optText: { fontSize: 13, color: '#333' },
    optTextActive: { color: '#fff', fontWeight: '500' },
    radioList: { gap: 16 },
    radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: BORDER },
    radioActive: { borderColor: PRIMARY, backgroundColor: PRIMARY },
    radioLabel: { fontSize: 15, color: '#222' },
});