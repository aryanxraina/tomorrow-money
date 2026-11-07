'use client';

import { useState } from 'react';
import { Button, Card, CodeBadge, Muted, Pill, Why } from '@/components/ui';
import { gbp } from '@/lib/engine/dates';
import { compareNearby, distanceM, type Comparison, type Place } from '@/lib/engine/location';
import { postJSON, useEffectiveMode, useProfile } from '@/lib/hooks';
import { useStore } from '@/lib/store';

type Scenario = 'grocery' | 'fuel' | 'real';

export default function Pay() {
  const profile = useProfile();
  const mode = useEffectiveMode();
  const busFare = useStore((s) => s.busFare);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ cmp: Comparison; places: Place[]; source: string; here: { lat: number; lng: number } } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!profile)
    return (
      <Card>
        <p>Pick a demo person or do your check-in first.</p>
      </Card>
    );

  const run = async (sc: Scenario) => {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      let here = { lat: profile.demoLocation.lat, lng: profile.demoLocation.lng };
      let currentName: string | undefined = sc === 'grocery' ? profile.demoLocation.label.replace(/ \(demo\)$/, '').replace(/,.*$/, '') : sc === 'fuel' ? 'Esso' : undefined;
      if (sc === 'real') {
        here = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => reject(new Error('Location permission was not given.')),
            { enableHighAccuracy: true, timeout: 10000 },
          ),
        );
        currentName = undefined;
      }
      const r = await postJSON<{ places: Place[]; source: string }>('/api/places', { lat: here.lat, lng: here.lng, scenario: sc === 'fuel' ? 'fuel' : 'grocery', currentName, mode });
      const litres = 30;
      const cmp = compareNearby(here, r.places, profile.basket, { busFare, litres });
      setRes({ cmp, places: r.places, source: r.source, here });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mapsLink = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
  const help = res?.places.filter((p) => ['atm', 'advice', 'foodbank'].includes(p.type)) || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">At the checkout</h1>
        <Muted>Tap before you pay. We check where you are and tell you if the same shop is cheaper nearby, after counting the trip.</Muted>
      </div>
      <Card className="space-y-2">
        <Button className="w-full" onClick={() => run('grocery')} disabled={busy}>
          🛒 I’m paying at {profile.demoLocation.label}
        </Button>
        <Button variant="soft" className="w-full" onClick={() => run('fuel')} disabled={busy}>
          ⛽ I’m filling up at a petrol station (demo)
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => run('real')} disabled={busy}>
          📍 Use my real location
        </Button>
        <Muted>
          {mode === 'local'
            ? 'On-device mode: no map service is called. Nearby places come from data stored on the device.'
            : 'Uses Google Maps Places when a key is set; otherwise sample places around you.'}
        </Muted>
      </Card>

      {busy && <Card>Checking nearby…</Card>}
      {err && <Card className="bg-amber-50 text-amber-900">{err}</Card>}

      {res && (
        <>
          <Card className={res.cmp.verdict === 'switch' ? 'bg-emerald-50 ring-emerald-200' : ''}>
            <div className="flex items-center justify-between">
              <Pill tone={res.cmp.verdict === 'switch' ? 'green' : 'slate'}>
                {res.cmp.verdict === 'switch' ? 'Cheaper option nearby' : res.cmp.verdict === 'stay' ? 'Good choice' : 'Not at a shop'}
              </Pill>
              <CodeBadge />
            </div>
            {res.cmp.current && <div className="mt-2 text-sm text-slate-600">You’re at {res.cmp.current.place.name}</div>}
            {res.cmp.verdict === 'switch' && res.cmp.best && res.cmp.current && (
              <>
                <p className="mt-1 text-lg font-semibold text-emerald-900">
                  {res.cmp.best.place.name} is {Math.max(1, Math.round(res.cmp.best.walkMin))} min away. {res.cmp.kind === 'fuel' ? 'A fill-up' : 'Your usual basket'} is about{' '}
                  {gbp(res.cmp.best.saving, 2)} cheaper there.
                </p>
                <p className="text-sm text-emerald-900">
                  {gbp(res.cmp.best.cost, 2)} vs {gbp(res.cmp.current.cost, 2)} here
                  {res.cmp.best.travelCost > 0 ? `, minus ${gbp(res.cmp.best.travelCost, 2)} for the trip = ${gbp(res.cmp.best.net, 2)} kept` : ', walkable, so you keep all of it'}.
                </p>
                <div className="mt-3 flex gap-2">
                  <a href={mapsLink(res.cmp.best.place)} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">
                    Take me there
                  </a>
                  <Button variant="ghost" onClick={() => setRes(null)}>
                    Pay here anyway
                  </Button>
                </div>
              </>
            )}
            {res.cmp.verdict === 'stay' && <p className="mt-1 text-lg font-semibold">You’re already at a good option. Nothing nearby saves more than the trip costs.</p>}
            {res.cmp.verdict === 'not_at_shop' && <p className="mt-1">You don’t seem to be at a shop right now. Here’s what is nearby.</p>}
            <Why>
              <p>
                Compared: {res.cmp.basketLabel}. Prices are a <b>sample price index</b> for this demo
                {res.cmp.kind === 'fuel' ? ' (live UK pump prices are open data through the Fuel Finder scheme)' : ' (in a launch: your own receipt history and retailer price data)'}.
              </p>
              <p>
                Places from {res.source === 'google' ? 'Google Maps Places' : 'sample data laid out around you'}. Walking at 80 m a minute. Trips over 15 minutes count a{' '}
                {gbp(busFare, 2)} bus fare. We only suggest a switch if you keep at least £2.
              </p>
              {res.cmp.kind === 'grocery' && (
                <ul className="list-disc pl-5">
                  {profile.basket.map((b) => (
                    <li key={b.name}>
                      {b.qty > 1 ? `${b.qty} × ` : ''}
                      {b.name}
                    </li>
                  ))}
                </ul>
              )}
            </Why>
          </Card>

          <Card>
            <h2 className="font-semibold">Other options</h2>
            <div className="mt-2 divide-y divide-slate-100">
              {res.cmp.options.slice(0, 6).map((o) => (
                <div key={o.place.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{o.place.name}</div>
                    <div className="text-xs text-slate-500">
                      {Math.round(distanceM(res.here, o.place))} m · {Math.max(1, Math.round(o.walkMin))} min walk
                    </div>
                  </div>
                  <span className={o.net > 0 ? 'font-medium text-emerald-700' : 'text-slate-500'}>{o.net > 0 ? `save ${gbp(o.net, 2)}` : 'no saving'}</span>
                </div>
              ))}
            </div>
          </Card>

          {help.length > 0 && (
            <Card>
              <h2 className="font-semibold">Help nearby</h2>
              <div className="mt-2 divide-y divide-slate-100">
                {help.map((p) => (
                  <a key={p.id} href={mapsLink(p)} target="_blank" rel="noreferrer" className="flex justify-between py-2 text-sm">
                    <span>{p.name}</span>
                    <span className="text-slate-500">{Math.round(distanceM(res.here, p))} m</span>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
