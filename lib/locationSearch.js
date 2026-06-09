const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Bias results toward NUS campus
const NUS_CENTER = '1.2966,103.7764';
const SEARCH_RADIUS = '5000';

export async function searchPlaces(query) {
  if (!API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env');
  }
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    input: query.trim(),
    key: API_KEY,
    location: NUS_CENTER,
    radius: SEARCH_RADIUS,
    components: 'country:sg',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
  );
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Places API: ${data.status}`);
  }

  return (data.predictions || []).map(p => ({
    placeId: p.place_id,
    name: p.structured_formatting?.main_text || p.description,
    subtitle: p.structured_formatting?.secondary_text || '',
    description: p.description,
  }));
}

export async function getPlaceDetails(placeId) {
  if (!API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env');
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: API_KEY,
    fields: 'geometry,name,formatted_address',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  );
  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Place details: ${data.status}`);
  }

  const place = data.result;
  return {
    placeId,
    name: place.name || place.formatted_address,
    subtitle: place.formatted_address,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
  };
}
