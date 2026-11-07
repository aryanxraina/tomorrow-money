import type { BasketItem } from '../types';

export type PlaceType = 'supermarket' | 'convenience' | 'fuel' | 'atm' | 'advice' | 'foodbank';

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: PlaceType;
  address?: string;
  source: 'google' | 'sample';
}

// SAMPLE price index for a typical basket (cheapest chain = 1.00). Replace with real price data
// (receipt history, retailer feeds) in production. Shown in the app as "sample prices".
export const CHAIN_INDEX: { re: RegExp; chain: string; index: number }[] = [
  { re: /tesco express|tesco extra express/i, chain: 'Tesco Express', index: 1.24 },
  { re: /sainsbury'?s local/i, chain: "Sainsbury's Local", index: 1.27 },
  { re: /co-?op|cooperative/i, chain: 'Co-op', index: 1.28 },
  { re: /m&s|marks/i, chain: 'M&S Food', index: 1.4 },
  { re: /one stop|spar|londis|premier|nisa|costcutter|convenience|mini ?market/i, chain: 'Convenience store', index: 1.3 },
  { re: /aldi/i, chain: 'Aldi', index: 1.0 },
  { re: /lidl/i, chain: 'Lidl', index: 1.01 },
  { re: /iceland/i, chain: 'Iceland', index: 1.06 },
  { re: /asda/i, chain: 'Asda', index: 1.08 },
  { re: /morrisons/i, chain: 'Morrisons', index: 1.14 },
  { re: /tesco/i, chain: 'Tesco', index: 1.13 },
  { re: /sainsbury/i, chain: "Sainsbury's", index: 1.16 },
  { re: /waitrose/i, chain: 'Waitrose', index: 1.35 },
  { re: /polski|polish/i, chain: 'Polish shop', index: 1.1 },
];

// SAMPLE pump prices (pence per litre). Live UK prices are open data via the Fuel Finder scheme.
export const FUEL_INDEX: { re: RegExp; brand: string; ppl: number }[] = [
  { re: /asda/i, brand: 'Asda', ppl: 135.7 },
  { re: /morrisons/i, brand: 'Morrisons', ppl: 136.9 },
  { re: /tesco/i, brand: 'Tesco', ppl: 136.9 },
  { re: /sainsbury/i, brand: "Sainsbury's", ppl: 137.9 },
  { re: /jet/i, brand: 'Jet', ppl: 139.9 },
  { re: /bp/i, brand: 'BP', ppl: 143.9 },
  { re: /esso/i, brand: 'Esso', ppl: 142.9 },
  { re: /shell/i, brand: 'Shell', ppl: 144.9 },
];

export function chainOf(name: string) {
  return CHAIN_INDEX.find((c) => c.re.test(name)) || null;
}

export function fuelOf(name: string) {
  return FUEL_INDEX.find((f) => f.re.test(name)) || null;
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const WALK_M_PER_MIN = 80;

export interface ShopOption {
  place: Place;
  cost: number;
  saving: number;
  walkMin: number;
  travelCost: number;
  net: number;
  worthIt: boolean;
}

export interface Comparison {
  kind: 'grocery' | 'fuel';
  current: { place: Place; cost: number } | null;
  options: ShopOption[];
  best: ShopOption | null;
  verdict: 'switch' | 'stay' | 'not_at_shop';
  basketLabel: string;
}

export function basketCost(basket: BasketItem[], index: number) {
  return basket.reduce((x, b) => x + b.basePrice * b.qty * index, 0);
}

/** Decide in code; the AI only words the result. */
export function compareNearby(
  here: { lat: number; lng: number },
  places: Place[],
  basket: BasketItem[],
  opts: { busFare?: number; maxWalkFreeMin?: number; minNet?: number; litres?: number } = {},
): Comparison {
  const busFare = opts.busFare ?? 3;
  const maxWalk = opts.maxWalkFreeMin ?? 15;
  const minNet = opts.minNet ?? 2;
  const withDist = places.map((p) => ({ p, d: distanceM(here, p) })).sort((a, b) => a.d - b.d);
  const shopNow = withDist.find((x) => x.d <= 120 && ['supermarket', 'convenience', 'fuel'].includes(x.p.type));
  const kind: Comparison['kind'] = shopNow?.p.type === 'fuel' ? 'fuel' : 'grocery';

  if (kind === 'fuel') {
    const litres = opts.litres ?? 30;
    const priceOf = (p: Place) => ((fuelOf(p.name)?.ppl ?? 141.9) * litres) / 100;
    const current = shopNow ? { place: shopNow.p, cost: priceOf(shopNow.p) } : null;
    const options = withDist
      .filter((x) => x.p.type === 'fuel' && x.p.id !== shopNow?.p.id && x.d < 5000)
      .map(({ p, d }) => {
        const cost = priceOf(p);
        const saving = (current?.cost ?? cost) - cost;
        const walkMin = d / WALK_M_PER_MIN;
        const travelCost = (d / 1000) * 2 * 0.12; // detour fuel, roughly 12p per km
        const net = saving - travelCost;
        return { place: p, cost, saving, walkMin, travelCost, net, worthIt: net >= 1 };
      })
      .sort((a, b) => b.net - a.net);
    const best = options.find((o) => o.worthIt) || null;
    return { kind, current, options, best, verdict: !current ? 'not_at_shop' : best ? 'switch' : 'stay', basketLabel: `${litres} litres of petrol` };
  }

  const costOf = (p: Place) => basketCost(basket, chainOf(p.name)?.index ?? 1.2);
  const current = shopNow ? { place: shopNow.p, cost: costOf(shopNow.p) } : null;
  const options = withDist
    .filter((x) => (x.p.type === 'supermarket' || x.p.type === 'convenience') && x.p.id !== shopNow?.p.id && x.d < 3000)
    .map(({ p, d }) => {
      const cost = costOf(p);
      const saving = (current?.cost ?? cost) - cost;
      const walkMin = d / WALK_M_PER_MIN;
      const travelCost = walkMin <= maxWalk ? 0 : busFare;
      const net = saving - travelCost;
      return { place: p, cost, saving, walkMin, travelCost, net, worthIt: net >= minNet };
    })
    // value your time a little (5p a minute) so a much closer shop wins over a slightly cheaper far one
    .sort((a, b) => b.net - b.walkMin * 0.05 - (a.net - a.walkMin * 0.05));
  const best = options.find((o) => o.worthIt) || null;
  return {
    kind,
    current,
    options,
    best,
    verdict: !current ? 'not_at_shop' : best ? 'switch' : 'stay',
    basketLabel: `your usual basket (${basket.length} items)`,
  };
}

/** Offline / demo provider: realistic places laid out around any point. */
export function samplePlaces(here: { lat: number; lng: number }, scenario: 'grocery' | 'fuel', currentName?: string): Place[] {
  const at = (m: number, bearingDeg: number) => {
    const b = (bearingDeg * Math.PI) / 180;
    const dLat = (m * Math.cos(b)) / 111320;
    const dLng = (m * Math.sin(b)) / (111320 * Math.cos((here.lat * Math.PI) / 180));
    return { lat: here.lat + dLat, lng: here.lng + dLng };
  };
  const mk = (id: string, name: string, type: PlaceType, m: number, bearing: number): Place => ({ id, name, type, source: 'sample', ...at(m, bearing) });
  const list: Place[] = [];
  if (scenario === 'fuel') {
    list.push(mk('f0', currentName || 'Esso', 'fuel', 0, 0));
    list.push(mk('f1', 'Tesco Petrol Station', 'fuel', 900, 70));
    list.push(mk('f2', 'Shell', 'fuel', 1600, 200));
    list.push(mk('f3', 'Asda Petrol', 'fuel', 2800, 300));
  } else {
    list.push(mk('g0', currentName || 'Tesco Express', 'convenience', 0, 0));
    list.push(mk('g1', 'Co-op Food', 'convenience', 250, 140));
    list.push(mk('g2', 'Lidl', 'supermarket', 480, 60));
    list.push(mk('g3', "Sainsbury's Local", 'convenience', 620, 250));
    list.push(mk('g4', 'Aldi', 'supermarket', 1150, 200));
    list.push(mk('g5', 'Asda Superstore', 'supermarket', 2400, 320));
  }
  list.push(mk('a1', 'Post Office (free cash withdrawals)', 'atm', 300, 100));
  list.push(mk('h1', 'Citizens Advice', 'advice', 1500, 20));
  list.push(mk('h2', 'Community food bank', 'foodbank', 1300, 160));
  return list;
}
