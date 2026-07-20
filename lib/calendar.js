import * as Calendar from 'expo-calendar';
import { Platform, Linking } from 'react-native';

function toICSDate(d) {
  return new Date(d).toISOString().replace(/-|:|\.\d{3}/g, '');
}

export function googleCalendarUrl(event) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toICSDate(event.date)}/${toICSDate(event.end_date)}`,
    details: event.description ?? '',
    location: event.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function addToAppleCalendar(event) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Calendar permission denied');
  }
  const defaultCal = await Calendar.getDefaultCalendarAsync();
  await Calendar.createEventAsync(defaultCal.id, {
    title: event.title,
    startDate: new Date(event.date),
    endDate: new Date(event.end_date),
    location: event.location ?? '',
    notes: event.description ?? '',
  });
}

export async function exportToCalendar(event) {
  if (Platform.OS === 'ios') {
    await addToAppleCalendar(event);
  } else {
    await Linking.openURL(googleCalendarUrl(event));
  }
}