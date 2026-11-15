import { connection } from 'next/server';
import { distanceKm } from '@/lib/geo';

// Google Places (New) search for help near the person. The location is used for this one search
// and is never stored or logged. Needs GOOGLE_PLACES_API_KEY; without it the page shows links only.

export type NearbyKind = 'cash' | 'postoffice' | 'foodbank';

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  openNow: boolean | null;
  mapsUrl: string | null;
}

// Cash machines and Post Offices are standard Google place types. Food banks are not, so they
// use a text search restricted to the area.
// Google's tags are loose (offices tagged as ATMs, pubs matching "bank"), so a place is only
// shown when its name says what it is. Missing a few beats pointing someone at the wrong door.
// Money advice is deliberately not searched here: Google mostly returns paid debt firms, and
// Citizens Advice offices are poorly listed. The page links to the official finder instead.
const SEARCH: Record<NearbyKind, ({ type: string } | { text: string }) & { keep: RegExp }> = {
  cash: { type: 'atm', keep: /\b(atms?|cash|cashpoint|bank|link|euronet|cardtronics|notemachine)\b/i },
  postoffice: { type: 'post_office', keep: /\bpost office\b/i },
  foodbank: { text: 'food bank', keep: /\b(food ?bank|food pantry|pantry|food hub|food club|larder|trussell|community grocer|community fridge|soup kitchen)\b/i },
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  shortFormattedAddress?: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
};

const FIELDS = 'places.id,places.displayName,places.shortFormattedAddress,places.formattedAddress,places.location,places.regularOpeningHours.openNow,places.googleMapsUri';

export async function POST(req: Request) {
  await connection(); // read the key at request time, not build time
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return Response.json({ error: 'Nearby search isn’t set up.', code: 'MISSING_API_KEY' }, { status: 503 });

  let body: { latitude?: unknown; longitude?: unknown; kind?: unknown; radius?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad request.' }, { status: 400 });
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const kind = body.kind as NearbyKind;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Response.json({ error: 'A valid location is needed.' }, { status: 400 });
  }
  if (!(kind in SEARCH)) return Response.json({ error: 'Unknown search.' }, { status: 400 });
  const radius = Math.min(Math.max(Number(body.radius) || 2000, 500), 10000);

  const search = SEARCH[kind];
  const circle = { circle: { center: { latitude, longitude }, radius } };
  // Text search can only be restricted to a rectangle, so use the box around the circle
  // (the distance filter below trims the corners).
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  const box = { rectangle: { low: { latitude: latitude - dLat, longitude: longitude - dLng }, high: { latitude: latitude + dLat, longitude: longitude + dLng } } };
  const [url, payload] =
    'type' in search
      ? ['https://places.googleapis.com/v1/places:searchNearby', { includedPrimaryTypes: [search.type], maxResultCount: 20, rankPreference: 'DISTANCE', locationRestriction: circle }]
      : ['https://places.googleapis.com/v1/places:searchText', { textQuery: search.text, pageSize: 20, locationRestriction: box }];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ error: 'The place search didn’t work. Try again later.' }, { status: 502 });
    const data = (await res.json()) as { places?: GooglePlace[] };
    const places: NearbyPlace[] = (data.places || [])
      .filter((p) => {
        const name = p.displayName?.text || '';
        return p.location && search.keep.test(name);
      })
      .map((p, i) => ({
        id: p.id || String(i),
        name: p.displayName?.text || 'Unnamed place',
        address: p.shortFormattedAddress || p.formattedAddress || '',
        distanceKm: distanceKm({ latitude, longitude }, p.location!),
        openNow: p.regularOpeningHours?.openNow ?? null,
        mapsUrl: p.googleMapsUri || null,
      }))
      // Keep what's actually inside the circle.
      .filter((p) => p.distanceKm <= radius / 1000 + 0.05)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return Response.json({ places });
  } catch {
    return Response.json({ error: 'The place search didn’t work. Try again later.' }, { status: 502 });
  }
}
