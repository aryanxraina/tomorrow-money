'use client';

import { Banknote, Building2, LocateFixed, MapPin, ShoppingBasket } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { NearbyKind, NearbyPlace } from '@/app/api/nearby/route';
import { Button, Card, Muted, Row, SectionTitle, Segmented, TopBar } from '@/components/ui';
import { formatDistance, type LatLng } from '@/lib/geo';
import { useEffectiveMode } from '@/lib/hooks';
import { useLocation } from '@/lib/use-location';

const KINDS: { id: NearbyKind; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'postoffice', label: 'Post Office' },
  { id: 'foodbank', label: 'Food bank' },
];

const ICON: Record<NearbyKind, ReactNode> = {
  cash: <Banknote size={20} aria-hidden />,
  postoffice: <MapPin size={20} aria-hidden />,
  foodbank: <ShoppingBasket size={20} aria-hidden />,
};

type Radius = '1000' | '2000' | '5000';
const RADII: { id: Radius; label: string }[] = [
  { id: '1000', label: '1 km' },
  { id: '2000', label: '2 km' },
  { id: '5000', label: '5 km' },
];

type Result = { places: NearbyPlace[] } | { error: string; notSetUp?: boolean };

function NearbySearch() {
  const mode = useEffectiveMode();
  const { status, location, error: locationError, ask } = useLocation();
  const [kind, setKind] = useState<NearbyKind>('cash');
  const [radius, setRadius] = useState<Radius>('2000');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  if (mode === 'local') {
    return (
      <Card>
        <SectionTitle>Search near you</SectionTitle>
        <Muted className="mt-0.5">You’re in on-device mode, so we don’t search online. Use the finders below.</Muted>
      </Card>
    );
  }

  async function search(here: LatLng, k: NearbyKind, r: Radius) {
    setLoading(true);
    try {
      const res = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...here, kind: k, radius: Number(r) }),
      });
      const data = (await res.json().catch(() => ({}))) as { places?: NearbyPlace[]; error?: string; code?: string };
      if (res.ok && data.places) setResult({ places: data.places });
      else setResult({ error: data.error || 'The place search didn’t work. Try again later.', notSetUp: data.code === 'MISSING_API_KEY' });
    } catch {
      setResult({ error: 'You seem to be offline. Try again when you’re connected.' });
    } finally {
      setLoading(false);
    }
  }

  async function find() {
    const here = location ?? (await ask());
    if (here) await search(here, kind, radius);
  }

  function changeKind(k: NearbyKind) {
    setKind(k);
    if (location) void search(location, k, radius);
  }

  function changeRadius(r: Radius) {
    setRadius(r);
    if (location) void search(location, kind, r);
  }

  return (
    <Card>
      <SectionTitle>Search near you</SectionTitle>
      <div className="mt-3 space-y-2">
        <Segmented label="What to find" options={KINDS} value={kind} onChange={changeKind} />
        <Segmented label="How far" options={RADII} value={radius} onChange={changeRadius} />
      </div>

      {!location && (
        <>
          <Button className="mt-3 w-full" onClick={find} disabled={status === 'asking'}>
            <LocateFixed size={18} aria-hidden />
            {status === 'asking' ? 'Finding you…' : 'Use my location'}
          </Button>
          <Muted className="mt-2">Your location is sent to Google for this search only. We don’t save it.</Muted>
        </>
      )}
      {locationError && (
        <p role="alert" className="mt-2 text-sm text-risk">
          {locationError}
        </p>
      )}

      {loading && <Muted className="mt-3">Searching…</Muted>}

      {!loading && result && 'error' in result && (
        <Muted className="mt-3">{result.notSetUp ? 'Nearby search isn’t set up yet. Use the finders below.' : result.error}</Muted>
      )}

      {!loading && result && 'places' in result && (
        <>
          {kind === 'cash' && <Muted className="mt-3">Google doesn’t say which machines are free to use. The LINK finder below does.</Muted>}
          {kind === 'foodbank' && <Muted className="mt-3">Most food banks need a referral first. Call ahead, or use the Trussell finder below to see how to get one.</Muted>}
          {result.places.length === 0 ? (
            <Muted className="mt-3">Nothing found within {formatDistance(Number(radius) / 1000)}. Try a bigger distance, or the finders below.</Muted>
          ) : (
            <div className="mt-1 divide-y divide-hair">
              {result.places.map((p) => (
                <Row
                  key={p.id}
                  icon={ICON[kind]}
                  title={p.name}
                  sub={[p.openNow === true ? 'Open now' : p.openNow === false ? 'Closed now' : null, p.address].filter(Boolean).join(' · ')}
                  right={formatDistance(p.distanceKm)}
                  href={p.mapsUrl ?? undefined}
                  external
                />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function Nearby() {
  return (
    <div className="space-y-3">
      <TopBar title="Nearby" back="/more" />
      <NearbySearch />
      <Card>
        <SectionTitle>Find help near you</SectionTitle>
        <Muted className="mt-0.5">These open official finders, which ask for your postcode.</Muted>
        <div className="mt-1 divide-y divide-hair">
          <Row icon={<Banknote size={20} aria-hidden />} title="Free cash machines" sub="LINK cash machine finder" href="https://www.link.co.uk/consumers/locator/" external />
          <Row icon={<Building2 size={20} aria-hidden />} title="Free money advice" sub="Citizens Advice near you" href="https://www.citizensadvice.org.uk/about-us/contact-us/contact-us/contact-us/" external />
          <Row icon={<ShoppingBasket size={20} aria-hidden />} title="Food banks" sub="Trussell food bank finder" href="https://www.trussell.org.uk/emergency-food/find-a-food-bank" external />
          <Row icon={<MapPin size={20} aria-hidden />} title="Post Office branches" sub="Many offer free cash withdrawals" href="https://www.postoffice.co.uk/branch-finder" external />
        </div>
      </Card>
    </div>
  );
}
