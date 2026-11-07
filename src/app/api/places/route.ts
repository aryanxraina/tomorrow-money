import { samplePlaces, type Place, type PlaceType } from '@/lib/engine/location';

// Google Places (New) Nearby Search when a key is set and the user is not in on-device mode.
// Offline / on-device / Tether build: sample places laid out around the user (no external API).
async function google(lat: number, lng: number, scenario: 'grocery' | 'fuel'): Promise<Place[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY!;
  const call = async (types: string[], radius: number) => {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.shortFormattedAddress',
      },
      body: JSON.stringify({
        includedTypes: types,
        maxResultCount: 15,
        rankPreference: 'DISTANCE',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Google Places ${res.status}`);
    const j = (await res.json()) as {
      places?: { id: string; displayName?: { text: string }; location: { latitude: number; longitude: number }; primaryType?: string; shortFormattedAddress?: string }[];
    };
    return (j.places || []).map((p) => {
      const t = p.primaryType || '';
      const type: PlaceType = t === 'gas_station' ? 'fuel' : t === 'atm' ? 'atm' : t === 'convenience_store' ? 'convenience' : 'supermarket';
      return { id: p.id, name: p.displayName?.text || 'Shop', lat: p.location.latitude, lng: p.location.longitude, type, address: p.shortFormattedAddress, source: 'google' as const };
    });
  };
  const shops = scenario === 'fuel' ? await call(['gas_station'], 5000) : await call(['supermarket', 'grocery_store', 'convenience_store'], 2500);
  return shops;
}

export async function POST(req: Request) {
  const { lat, lng, scenario, currentName, mode } = (await req.json()) as {
    lat: number;
    lng: number;
    scenario: 'grocery' | 'fuel';
    currentName?: string;
    mode: 'auto' | 'cloud' | 'local';
    demo?: boolean;
  };
  const useGoogle = !!process.env.GOOGLE_MAPS_API_KEY && mode !== 'local' && !currentName;
  if (useGoogle) {
    try {
      const places = await google(lat, lng, scenario);
      if (places.length) return Response.json({ places, source: 'google' });
    } catch (e) {
      console.warn('[places] google failed', (e as Error).message);
    }
  }
  return Response.json({ places: samplePlaces({ lat, lng }, scenario, currentName), source: 'sample' });
}
