'use client';

import { useCallback, useState } from 'react';
import type { LatLng } from './geo';

export type LocationStatus = 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable';

/** Asks the browser for the person's location, only when they tap a button. Nothing is stored. */
export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [error, setError] = useState('');

  /** Resolves with the location, or null if it couldn't be had (the reason is in `error`). */
  const ask = useCallback(
    () =>
      new Promise<LatLng | null>((resolve) => {
        if (!window.isSecureContext) {
          setStatus('unavailable');
          setError('Your browser only shares location over a secure (https) connection.');
          return resolve(null);
        }
        if (!navigator.geolocation) {
          setStatus('unavailable');
          setError('This browser can’t share your location.');
          return resolve(null);
        }
        setStatus('asking');
        setError('');
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            const here = { latitude: coords.latitude, longitude: coords.longitude };
            setLocation(here);
            setStatus('granted');
            resolve(here);
          },
          (reason) => {
            const denied = reason.code === reason.PERMISSION_DENIED;
            setStatus(denied ? 'denied' : 'unavailable');
            setError(denied ? 'Location is blocked. You can allow it in your browser settings.' : 'We couldn’t find your location. Please try again.');
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
        );
      }),
    [],
  );

  return { status, location, error, ask };
}
