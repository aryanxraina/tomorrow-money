export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Straight-line distance between two points, in km (haversine). */
export function distanceKm(from: LatLng, to: LatLng): number {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLng = rad(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "350 m" under 1 km, otherwise "1.2 km". */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1)} km`;
}
