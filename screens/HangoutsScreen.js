import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Modal, Alert, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { searchPlaces, getPlaceDetails } from '../lib/locationSearch';

const VIBES = ['Sports', 'Chill', 'Food', 'Study', 'Music', 'Gaming', 'Other'];
const CAPACITY_OPTIONS = [2, 3, 4, 5, 8, 10];

const VIBE_COLORS = {
  Study: '#6B7280',
  Sports: '#3B82F6',
  Food: '#F97316',
  Chill: '#EC4899',
  Gaming: '#10B981',
  Music: '#8B5CF6',
  Other: '#EF4444',
};

const NUS_REGION = {
  latitude: 1.2966,
  longitude: 103.7764,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

async function attachProfiles(hangouts) {
  if (!hangouts?.length) return hangouts || [];
  const ids = [...new Set(hangouts.map(h => h.created_by).filter(Boolean))];
  if (!ids.length) return hangouts;
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  const map = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return hangouts.map(h => ({ ...h, profiles: map[h.created_by] || null }));
}

async function attachParticipantCounts(hangouts) {
  if (!hangouts?.length) return hangouts || [];
  const ids = hangouts.map(h => h.id);
  const { data } = await supabase
    .from('hangout_participants')
    .select('hangout_id')
    .in('hangout_id', ids);

  const counts = {};
  (data || []).forEach(row => {
    counts[row.hangout_id] = (counts[row.hangout_id] || 0) + 1;
  });

  return hangouts.map(h => ({
    ...h,
    participant_count: counts[h.id] ?? h.participant_count ?? 0,
  }));
}

async function enrichHangouts(hangouts) {
  return attachParticipantCounts(await attachProfiles(hangouts));
}

export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
}

export function formatHangoutTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = d.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function isActive(hangout) {
  return new Date(hangout.hangout_time) > new Date();
}

export function getMaxHangoutDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d;
}

export function isVisibleOnMap(hangout, joinedIds, userId) {
  if (!isActive(hangout)) return false;
  const isFull = (hangout.participant_count || 1) >= (hangout.max_participants || 5);
  const isParticipant = joinedIds.has(hangout.id) || hangout.created_by === userId;
  return !isFull || isParticipant;
}


export default function HangoutsScreen({ onBack }) {
  const [allHangouts, setAllHangouts] = useState([]);
  const [myHangouts, setMyHangouts] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [selectedHangout, setSelectedHangout] = useState(null);
  const [showDropPin, setShowDropPin] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const mapRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const [creating, setCreating] = useState(false);

  const [locationQuery, setLocationQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searching, setSearching] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [hangoutTime, setHangoutTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedVibes, setSelectedVibes] = useState([]);
  const [customVibe, setCustomVibe] = useState('');
  const [showCustomVibe, setShowCustomVibe] = useState(false);
  const [details, setDetails] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(5);

  useEffect(() => { getUser(); getLocation(); }, []);
  useEffect(() => { if (userId) fetchAll(); }, [userId]);

  useFocusEffect(useCallback(() => {
    if (userId) fetchAll();
  }, [userId]));

  useEffect(() => {
    const interval = setInterval(() => {
      setAllHangouts(prev => prev.filter(h => isActive(h)));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showMap || !mapFocus) return;
    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: mapFocus.latitude,
        longitude: mapFocus.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }, 400);
    }, 150);
    return () => clearTimeout(timer);
  }, [showMap, mapFocus]);

  useEffect(() => {
    if (!showDropPin || locationQuery.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(locationQuery);
        setSearchResults(results);
      } catch (err) {
        setSearchResults([]);
        if (err.message?.includes('API_KEY')) {
          Alert.alert('Setup required', 'Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file.');
        }
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [locationQuery, showDropPin]);

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id);
  }

  async function getLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  }

  async function fetchAll() {
    const now = new Date().toISOString();
    const [activeRes, joinedRes] = await Promise.all([
      supabase.from('hangouts').select('*').gt('hangout_time', now).order('hangout_time', { ascending: true }),
      supabase.from('hangout_participants').select('hangout_id, hangouts(*)').eq('user_id', userId),
    ]);

    let enrichedActive = [];
    if (!activeRes.error) {
      enrichedActive = await enrichHangouts(activeRes.data || []);
      setAllHangouts(enrichedActive);
    }

    if (!joinedRes.error) {
      const joined = (joinedRes.data || []).map(r => r.hangouts).filter(Boolean);
      const withProfiles = await enrichHangouts(joined);
      setJoinedIds(new Set(withProfiles.map(h => h.id)));

      const createdRes = await supabase.from('hangouts').select('*').eq('created_by', userId);
      const created = createdRes.data || [];
      const createdEnriched = await enrichHangouts(created);
      const combined = [...withProfiles];
      createdEnriched.forEach(h => {
        if (!combined.find(c => c.id === h.id)) combined.push(h);
      });
      setMyHangouts(combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
    setLoading(false);
    return enrichedActive;
  }

  function openMapAtHangout(hangout) {
    setMapFocus({ latitude: hangout.latitude, longitude: hangout.longitude });
    setSelectedHangout(hangout);
    setShowMap(true);
  }

  function openMapOverview() {
    setMapFocus(null);
    setSelectedHangout(null);
    setShowMap(true);
  }

  function openDropPin() { resetForm(); setShowDropPin(true); }

  async function selectPlace(prediction) {
    setResolvingPlace(true);
    try {
      const place = await getPlaceDetails(prediction.placeId);
      setSelectedLocation(place);
      setLocationQuery(place.name);
      setSearchResults([]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load place details.');
    } finally { setResolvingPlace(false); }
  }

  function toggleVibe(v) {
    setSelectedVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function addCustomVibe() {
    const trimmed = customVibe.trim();
    if (!trimmed || selectedVibes.includes(trimmed)) return;
    setSelectedVibes(prev => [...prev, trimmed]);
    setCustomVibe('');
    setShowCustomVibe(false);
  }

  function decreaseCapacity() {
    setMaxParticipants(prev => Math.max(2, prev - 1));
  }

  function increaseCapacity() {
    setMaxParticipants(prev => Math.min(15, prev + 1));
  } 

  async function createHangout() {
    if (!selectedLocation) { Alert.alert('Select location', 'Search and pick a location.'); return; }
    if (selectedVibes.length === 0) { Alert.alert('Missing vibe', 'Please select at least one vibe.'); return; }
    if (hangoutTime < new Date()) {
      Alert.alert('Invalid time', 'Hangout time must be in the future.');
      return;
    }
    if (hangoutTime > getMaxHangoutDate()) {
      Alert.alert('Too far ahead', 'Hangouts can only be scheduled up to 3 days in advance.');
      return;
    }

    const primaryVibe = selectedVibes[0];
    const title = details.trim() ? details.trim().split('\n')[0].slice(0, 50) : `${primaryVibe} Hangout`;

    setCreating(true);
    const { data, error } = await supabase.from('hangouts').insert({
      created_by: userId,
      title,
      location_name: selectedLocation.name,
      hangout_time: hangoutTime.toISOString(),
      vibes: selectedVibes,
      vibe: primaryVibe,
      details: details.trim() || null,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      max_participants: maxParticipants,
      participant_count: 1,
    }).select('*').single();

    if (error) { setCreating(false); Alert.alert('Error', error.message); return; }

    await supabase.from('hangout_participants').insert({ hangout_id: data.id, user_id: userId });

    const [withProfile] = await enrichHangouts([data]);
    setCreating(false);
    setShowDropPin(false);
    resetForm();
    await fetchAll();
    openMapAtHangout(withProfile);
  }

  function resetForm() {
    setLocationQuery(''); setSearchResults([]); setSelectedLocation(null);
    setShowTimePicker(false);
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
    setHangoutTime(d); setSelectedVibes([]); setDetails(''); setMaxParticipants(5);
  }

  async function refreshSelectedHangout(hangoutId) {
    const { data } = await supabase.from('hangouts').select('*').eq('id', hangoutId).single();
    if (!data) return null;
    const [updated] = await enrichHangouts([data]);
    setSelectedHangout(updated);
    return updated;
  }

  async function joinHangout(hangout) {
    if (hangout.created_by === userId || joinedIds.has(hangout.id)) return;
    if ((hangout.participant_count || 0) >= (hangout.max_participants || 5)) {
      Alert.alert('Full', 'This hangout is full.'); return;
    }
    setJoiningId(hangout.id);
    const { error } = await supabase.from('hangout_participants').insert({ hangout_id: hangout.id, user_id: userId });
    if (error) { setJoiningId(null); Alert.alert('Error', error.message); return; }
    setJoiningId(null);
    await fetchAll();
    if (selectedHangout?.id === hangout.id) {
      await refreshSelectedHangout(hangout.id);
    }
  }

  async function leaveHangout(hangout, onClose) {
    Alert.alert('Leave hangout', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('hangout_participants').delete()
            .eq('hangout_id', hangout.id).eq('user_id', userId);
          if (error) { Alert.alert('Error', error.message); return; }
          await fetchAll();
          if (selectedHangout?.id === hangout.id) {
            await refreshSelectedHangout(hangout.id);
          } else {
            onClose?.();
            setSelectedHangout(null);
          }
        },
      },
    ]);
  }

  async function deleteHangout(hangout, onClose) {
    Alert.alert('Delete hangout', 'Are you sure you want to delete this hangout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('hangouts').delete().eq('id', hangout.id);
          if (error) { Alert.alert('Error', error.message); return; }
          onClose?.(); setSelectedHangout(null); fetchAll();
        },
      },
    ]);
  }

  function getDistance(hangout) {
    if (!location) return null;
    return getDistanceMeters(location.latitude, location.longitude, hangout.latitude, hangout.longitude);
  }

  function getMapHangouts() {
    return allHangouts.filter(h => isVisibleOnMap(h, joinedIds, userId));
  }

  function getPublicHangouts() {
    return allHangouts.filter(h => {
      const isFull = (h.participant_count || 1) >= (h.max_participants || 5);
      return isActive(h) && !isFull;
    });
  }

  function renderDetailSheet(hangout, onClose) {
    const spotsLeft = (hangout.max_participants || 5) - (hangout.participant_count || 1);
    const active = isActive(hangout);
    const isCreator = hangout.created_by === userId;
    const hasJoined = joinedIds.has(hangout.id);
    const isFull = spotsLeft <= 0;
    const vibeColor = VIBE_COLORS[hangout.vibe] || '#6B7280';

    return (
      <View style={styles.detailSheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{hangout.title || hangout.location_name}</Text>
          <View style={[styles.vibePill, { backgroundColor: vibeColor + '22' }]}>
            <Text style={[styles.vibePillText, { color: vibeColor }]}>{hangout.vibe}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📍</Text>
          <Text style={styles.detailRowText}>{hangout.location_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>👥</Text>
          <Text style={styles.detailRowText}>
            {hangout.participant_count || 1} / {hangout.max_participants || 5} going
            {active && !isFull ? ` · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left` : ''}
            {active && isFull ? ' · Full' : ''}
          </Text>
        </View>
        {hangout.hangout_time && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🕐</Text>
            <Text style={styles.detailRowText}>{formatHangoutTime(hangout.hangout_time)}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>👤</Text>
          <Text style={styles.detailRowText}>by {hangout.profiles?.full_name || 'Someone'}</Text>
        </View>

        {!active && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredBadgeText}>This hangout has already started</Text>
          </View>
        )}
        {active && isFull && !hasJoined && !isCreator && (
          <View style={[styles.expiredBadge, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.expiredBadgeText, { color: '#991b1b' }]}>This hangout is full</Text>
          </View>
        )}

        {hangout.details ? <Text style={styles.detailDesc}>{hangout.details}</Text> : null}

        {!isCreator && !hasJoined && active && !isFull && (
          <TouchableOpacity style={styles.joinBtn} onPress={() => joinHangout(hangout)}>
            {joiningId === hangout.id
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.joinBtnText}>+ Join Hangout</Text>}
          </TouchableOpacity>
        )}

        {hasJoined && !isCreator && (
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: '#dc2626' }]}
            onPress={() => leaveHangout(hangout, onClose)}
          >
            <Text style={styles.joinBtnText}>Leave hangout</Text>
          </TouchableOpacity>
        )}

        {isCreator && (
          <View style={{ gap: 10, marginTop: 16 }}>
            <View style={[styles.joinBtn, styles.joinBtnMuted]}>
              <Text style={[styles.joinBtnText, { color: '#6b7280' }]}>Your hangout</Text>
            </View>
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: '#dc2626' }]}
              onPress={() => deleteHangout(hangout, onClose)}
            >
              <Text style={styles.joinBtnText}>Delete hangout</Text>
            </TouchableOpacity>
          </View>
        )}

        {onClose && (
          <TouchableOpacity style={styles.closeDetailBtn} onPress={onClose}>
            <Text style={styles.closeDetailText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderLegend() {
    return (
      <View style={styles.legend}>
        {Object.entries(VIBE_COLORS).map(([vibe, color]) => (
          <View key={vibe} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{vibe}</Text>
          </View>
        ))}
      </View>
    );
  }

  function renderMapMarkers() {
    return getMapHangouts().map(h => (
      <Marker
        key={h.id}
        coordinate={{ latitude: h.latitude, longitude: h.longitude }}
        pinColor={VIBE_COLORS[h.vibe] || '#6B7280'}
        onPress={() => setSelectedHangout(h)}
      />
    ));
  }

  function renderDropPinModal() {
    return (
      <Modal visible={showDropPin} animationType="slide">
        <SafeAreaView style={styles.dropPinScreen}>
          <View style={styles.dropPinHeader}>
            <TouchableOpacity onPress={() => setShowDropPin(false)}>
              <Text style={styles.dropPinCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.dropPinTitle}>Drop a pin</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.dropPinScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Text style={styles.fieldLabel}>LOCATION</Text>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={locationQuery}
                onChangeText={(text) => { setLocationQuery(text); setSelectedLocation(null); }}
                placeholder="Search for a place..."
                placeholderTextColor="#aaa"
                autoCorrect={false}
              />
              {(searching || resolvingPlace) && <ActivityIndicator size="small" color="#1d4ed8" style={{ marginRight: 8 }} />}
            </View>

            {selectedLocation && (
              <View style={styles.selectedLocationCard}>
                <Text style={styles.selectedLocationPin}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedLocationName}>{selectedLocation.name}</Text>
                  <Text style={styles.selectedLocationSub}>{selectedLocation.subtitle}</Text>
                </View>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}

            {searchResults.length > 0 && !selectedLocation && (
              <View style={styles.searchResults}>
                {searchResults.map(item => (
                  <TouchableOpacity key={item.placeId} style={styles.searchResultItem} onPress={() => selectPlace(item)}>
                    <Text style={styles.searchResultIcon}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      {item.subtitle ? <Text style={styles.searchResultSub} numberOfLines={1}>{item.subtitle}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabel}>TIME OF HANGOUT</Text>
            <TouchableOpacity style={styles.timeCard} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
              <Text style={styles.timeIcon}>🕐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeText}>{formatHangoutTime(hangoutTime.toISOString())}</Text>
                <Text style={styles.timeHint}>Tap to set · max 3 days ahead</Text>
              </View>
            </TouchableOpacity>
            {showTimePicker && (
              <View style={styles.timePickerContainer}>
                {Platform.OS === 'ios' && (
                  <View style={styles.timePickerHeader}>
                    <Text style={styles.timePickerHint}>Scroll to pick date & time</Text>
                    <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.timePickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DateTimePicker
                  value={hangoutTime}
                  mode="datetime"
                  minimumDate={new Date()}
                  maximumDate={getMaxHangoutDate()}
                  display="spinner"
                  themeVariant="light"
                  onChange={(event, date) => {
                    if (event.type === 'dismissed') {
                      setShowTimePicker(false);
                      return;
                    }
                    if (date) setHangoutTime(date);
                    if (Platform.OS === 'android') setShowTimePicker(false);
                  }}
                  style={styles.timePicker}
                />
              </View>
            )}

            <Text style={styles.fieldLabel}>WHAT'S THE VIBE</Text>
            <View style={styles.vibeRow}>
              {VIBES.map(v => {
                const selected = selectedVibes.includes(v);
                const color = VIBE_COLORS[v];
                return (
                  <TouchableOpacity
                    key={v}
                    style={[styles.vibeChip, selected && { backgroundColor: color, borderColor: color }]}
                    onPress={() => toggleVibe(v)}
                  >
                    <Text style={[styles.vibeChipText, selected && { color: '#fff' }]}>{v}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.vibeChipAdd} onPress={() => setShowCustomVibe(!showCustomVibe)}>
                <Text style={styles.vibeChipAddText}>+</Text>
              </TouchableOpacity>
            </View>
            {showCustomVibe && (
              <View style={styles.customVibeRow}>
                <TextInput
                  style={styles.customVibeInput}
                  placeholder="Custom vibe"
                  placeholderTextColor="#aaa"
                  value={customVibe}
                  onChangeText={setCustomVibe}
                  onSubmitEditing={addCustomVibe}
                />
                <TouchableOpacity style={styles.customVibeBtn} onPress={addCustomVibe}>
                  <Text style={styles.customVibeBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.fieldLabel}>DETAILS (OPTIONAL)</Text>
            <TextInput
              style={styles.detailsInput}
              placeholder="e.g. playing some frisbee, come join!"
              placeholderTextColor="#aaa"
              value={details}
              onChangeText={setDetails}
              multiline
            />

            <Text style={styles.fieldLabel}>MAX CAPACITY</Text>
            <View style={styles.capacitySelector}>
              <TouchableOpacity
                style={styles.capacityButton}
                onPress={decreaseCapacity}
              >
                <Text style={styles.capacityButtonText}>−</Text>
              </TouchableOpacity>

              <Text style={styles.capacityValue}>
                {maxParticipants} people
              </Text>

              <TouchableOpacity
                style={styles.capacityButton}
                onPress={increaseCapacity}
              >
                <Text style={styles.capacityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.expiryInfo}>
              <Text style={styles.expiryInfoText}>
                📌 Pin is visible to all until full. Once full, only participants can see it. Pin disappears when hangout begins.
              </Text>
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.dropPinBtn, creating && { opacity: 0.7 }]}
            onPress={createHangout}
            disabled={creating}
          >
            {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.dropPinBtnText}>Drop pin</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#F97316" /></View>;

  if (showMap) {
    return (
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: mapFocus?.latitude || location?.latitude || NUS_REGION.latitude,
            longitude: mapFocus?.longitude || location?.longitude || NUS_REGION.longitude,
            latitudeDelta: mapFocus ? 0.006 : 0.012,
            longitudeDelta: mapFocus ? 0.006 : 0.012,
          }}
          showsUserLocation
        >
          {renderMapMarkers()}
        </MapView>

        <SafeAreaView style={styles.mapOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.mapBackBtn} onPress={() => { setShowMap(false); setSelectedHangout(null); setMapFocus(null); }}>
            <Text style={styles.mapBackText}>← Back</Text>
          </TouchableOpacity>
          {renderLegend()}
        </SafeAreaView>

        {selectedHangout && !showDropPin && (
          <View style={styles.mapDetailContainer}>
            {renderDetailSheet(selectedHangout, () => setSelectedHangout(null))}
          </View>
        )}

        {!showDropPin && (
          <TouchableOpacity style={styles.mapFab} onPress={openDropPin}>
            <Text style={styles.mapFabIcon}>+</Text>
          </TouchableOpacity>
        )}

        {renderDropPinModal()}
      </View>
    );
  }

  const publicHangouts = getPublicHangouts();

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.menuBtn}>
            <Text style={styles.menuIcon}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.appName}>
            con<Text style={{ color: '#ea580c' }}>N</Text>ect<Text style={{ color: '#ea580c' }}>US</Text>
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.mapPreviewCard} onPress={openMapOverview} activeOpacity={0.9}>
            <MapView
              style={styles.mapPreview}
              scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
              pointerEvents="none"
              initialRegion={{
                latitude: location?.latitude || NUS_REGION.latitude,
                longitude: location?.longitude || NUS_REGION.longitude,
                latitudeDelta: 0.015, longitudeDelta: 0.015,
              }}
            >
              {renderMapMarkers()}
            </MapView>
            <View style={styles.mapPreviewLabel}>
              <Text style={styles.mapPreviewLabelText}>NUS Campus</Text>
              <Text style={styles.mapPreviewTap}>Tap to open map</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Hangouts near you</Text>
          {publicHangouts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No hangouts nearby — drop the first pin!</Text>
            </View>
          ) : (
            publicHangouts.map(h => {
              const dist = getDistance(h);
              const spotsLeft = (h.max_participants || 5) - (h.participant_count || 1);
              return (
                <TouchableOpacity
                  key={h.id}
                  style={styles.hangoutCard}
                  onPress={() => openMapAtHangout(h)}
                >
                  <View style={[styles.statusDot, { backgroundColor: VIBE_COLORS[h.vibe] || '#22c55e' }]} />
                  <View style={styles.hangoutInfo}>
                    <Text style={styles.hangoutTitle}>{h.title || h.location_name}</Text>
                    <Text style={styles.hangoutLocation}>{h.location_name}</Text>
                    <Text style={styles.hangoutMeta}>
                      {h.participant_count || 1}/{h.max_participants || 5} going · {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
                      {dist != null ? ` · ${formatDistance(dist)}` : ''}
                    </Text>
                    <Text style={styles.hangoutTime}>{formatHangoutTime(h.hangout_time)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {myHangouts.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My Hangouts</Text>
              <Text style={styles.sectionSub}>Hangouts you created or joined</Text>
              {myHangouts.map(h => {
                const active = isActive(h);
                const isFull = (h.participant_count || 1) >= (h.max_participants || 5);
                const isCreator = h.created_by === userId;
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={[styles.hangoutCard, !active && styles.hangoutCardExpired]}
                    onPress={() => setSelectedHangout(h)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: active ? (VIBE_COLORS[h.vibe] || '#22c55e') : '#9ca3af' }]} />
                    <View style={styles.hangoutInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.hangoutTitle}>{h.title || h.location_name}</Text>
                        {isCreator && <Text style={styles.creatorBadge}>You</Text>}
                        {isFull && active && <Text style={styles.fullBadge}>Full</Text>}
                      </View>
                      <Text style={styles.hangoutLocation}>{h.location_name}</Text>
                      <Text style={styles.hangoutMeta}>{h.participant_count || 1}/{h.max_participants || 5} going</Text>
                      <Text style={[styles.hangoutTime, !active && { color: '#9ca3af' }]}>
                        {active ? formatHangoutTime(h.hangout_time) : `Started ${formatHangoutTime(h.hangout_time)}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={openDropPin}>
          <Text style={styles.fabText}>+ Drop a pin</Text>
        </TouchableOpacity>

        <Modal visible={!!selectedHangout && !showMap} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBg} onPress={() => setSelectedHangout(null)} />
            {selectedHangout && renderDetailSheet(selectedHangout, () => setSelectedHangout(null))}
          </View>
        </Modal>

        {renderDropPinModal()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuBtn: { width: 60 },
  menuIcon: { fontSize: 15, color: '#1d4ed8', fontWeight: '600' },
  appName: { fontSize: 20, fontWeight: 'bold', color: '#1d4ed8' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  mapPreviewCard: { marginTop: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#86efac', backgroundColor: '#f0fdf4', height: 180 },
  mapPreview: { ...StyleSheet.absoluteFillObject },
  mapPreviewLabel: { position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  mapPreviewLabelText: { fontSize: 13, fontWeight: '600', color: '#166534' },
  mapPreviewTap: { fontSize: 11, color: '#666', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#888', marginBottom: 12 },
  hangoutCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  hangoutCardExpired: { opacity: 0.75, backgroundColor: '#f1f5f9' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  hangoutInfo: { flex: 1 },
  hangoutTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  hangoutLocation: { fontSize: 13, color: '#444', marginBottom: 2 },
  hangoutMeta: { fontSize: 12, color: '#888' },
  hangoutTime: { fontSize: 12, color: '#1d4ed8', marginTop: 2, fontWeight: '500' },
  creatorBadge: { fontSize: 10, color: '#1d4ed8', backgroundColor: '#dbeafe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: '600' },
  fullBadge: { fontSize: 10, color: '#dc2626', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: '600' },
  emptyCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 14, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 28, right: 20, backgroundColor: '#F97316', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  detailTitle: { fontSize: 22, fontWeight: '700' },
  vibePill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  vibePillText: { fontSize: 12, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailIcon: { fontSize: 14, width: 22 },
  detailRowText: { fontSize: 14, color: '#444', flex: 1 },
  detailDesc: { fontSize: 14, color: '#555', marginTop: 8, marginBottom: 4, lineHeight: 20 },
  expiredBadge: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, marginTop: 8 },
  expiredBadgeText: { fontSize: 12, color: '#92400e' },
  joinBtn: { backgroundColor: '#F97316', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  joinBtnMuted: { backgroundColor: '#e5e7eb' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  closeDetailBtn: { alignItems: 'center', marginTop: 12, padding: 8 },
  closeDetailText: { color: '#666', fontSize: 14 },
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapBackBtn: { margin: 16, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  mapBackText: { fontSize: 15, fontWeight: '600', color: '#1d4ed8' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#444' },
  mapDetailContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  mapFab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  mapFabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  dropPinScreen: { flex: 1, backgroundColor: '#fff' },
  dropPinHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropPinCancel: { fontSize: 16, color: '#1d4ed8', width: 60 },
  dropPinTitle: { fontSize: 17, fontWeight: '700' },
  dropPinScroll: { flex: 1, paddingHorizontal: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#888', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#111', paddingVertical: 14 },
  searchResults: { marginTop: 4, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchResultIcon: { fontSize: 16 },
  searchResultName: { fontSize: 15, fontWeight: '600', color: '#111' },
  searchResultSub: { fontSize: 12, color: '#888', marginTop: 2 },
  selectedLocationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#86efac' },
  selectedLocationPin: { fontSize: 20 },
  selectedLocationName: { fontSize: 15, fontWeight: '700', color: '#111' },
  selectedLocationSub: { fontSize: 12, color: '#666', marginTop: 2 },
  selectedCheck: { fontSize: 18, color: '#16a34a', fontWeight: '700' },
  timeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  timeIcon: { fontSize: 20 },
  timeText: { fontSize: 16, fontWeight: '600', color: '#111' },
  timeHint: { fontSize: 12, color: '#888', marginTop: 4 },
  timePickerContainer: { marginTop: 8, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  timePickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  timePickerHint: { fontSize: 12, color: '#888' },
  timePickerDone: { fontSize: 16, fontWeight: '600', color: '#1d4ed8' },
  timePicker: Platform.OS === 'ios' ? { height: 180, width: '100%' } : { width: '100%' },
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  vibeChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  vibeChipAdd: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  vibeChipAddText: { fontSize: 18, color: '#888' },
  customVibeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  customVibeInput: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  customVibeBtn: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  customVibeBtnText: { color: '#fff', fontWeight: '600' },
  detailsInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111', minHeight: 80, textAlignVertical: 'top' },
  capacitySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 8 },
  capacityButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center' },
  capacityButtonText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  capacityValue: { fontSize: 18, fontWeight: '600', minWidth: 100, textAlign: 'center' },
  expiryInfo: { backgroundColor: '#dcfce7', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 8 },
  expiryInfoText: { fontSize: 12, color: '#166534', lineHeight: 18 },
  dropPinBtn: { backgroundColor: '#F97316', margin: 16, borderRadius: 14, padding: 16, alignItems: 'center' },
  dropPinBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});