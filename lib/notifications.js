import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export async function registerForPushNotifications(userId) {
  try {
    if (!Device.isDevice) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      status = requested;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('[push] No EAS projectId found in app config');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const { error } = await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
    if (error) {
      console.log('[push] Failed to save token:', error.message);
    }

    return token;
  } catch (e) {
    console.log('[push] Registration failed:', e?.message || e);
    return null;
  }
}

export async function scheduleReminder(eventId, userId, eventStart, leadMinutes) {
  const remindAt = new Date(new Date(eventStart).getTime() - leadMinutes * 60_000);
  const { error } = await supabase
    .from('reminders')
    .upsert(
      { event_id: eventId, user_id: userId, remind_at: remindAt.toISOString(), sent: false },
      { onConflict: 'event_id,user_id' }
    );
  return { error };
}

export async function cancelReminder(eventId, userId) {
  await supabase.from('reminders').delete().eq('event_id', eventId).eq('user_id', userId);
}