'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getPersona } from './data/personas';
import { analyse, estimateFromAnswers } from './engine/analyse';
import { TODAY } from './engine/dates';
import { useStore, type Mode } from './store';
import type { Answers, BasketItem, Lang, Txn } from './types';

export const APP_NAME = 'Tomorrow';

export interface Profile {
  id: string;
  name: string;
  hero?: string;
  tagline?: string;
  answers: Answers;
  txns: Txn[];
  basket: BasketItem[];
  demoLocation: { lat: number; lng: number; label: string };
  isDemo: boolean;
}

const DEFAULT_BASKET: BasketItem[] = [
  { name: 'Milk 4 pints', qty: 1, basePrice: 1.55 },
  { name: 'Bread', qty: 1, basePrice: 0.75 },
  { name: 'Eggs x12', qty: 1, basePrice: 2.39 },
  { name: 'Pasta 500g', qty: 2, basePrice: 0.75 },
  { name: 'Rice 1kg', qty: 1, basePrice: 1.39 },
  { name: 'Chicken 1kg', qty: 1, basePrice: 5.49 },
  { name: 'Bananas', qty: 1, basePrice: 0.95 },
];

export function useProfile(): Profile | null {
  const profileId = useStore((s) => s.profileId);
  const myAnswers = useStore((s) => s.myAnswers);
  const myTxns = useStore((s) => s.myTxns);
  const added = useStore((s) => s.added);
  const addedBills = useStore((s) => s.addedBills);
  return useMemo(() => {
    if (!profileId) return null;
    const extraTxns = added[profileId] || [];
    const extraBills = addedBills[profileId] || [];
    if (profileId === 'me') {
      if (!myAnswers) return null;
      const base = myTxns.length ? myTxns : estimateFromAnswers(myAnswers, TODAY);
      return {
        id: 'me',
        name: myAnswers.name || 'You',
        answers: { ...myAnswers, yearlyBills: [...myAnswers.yearlyBills, ...extraBills] },
        txns: [...base, ...extraTxns],
        basket: DEFAULT_BASKET,
        demoLocation: { lat: 53.4808, lng: -2.2426, label: 'Tesco Express (demo)' },
        isDemo: false,
      };
    }
    const p = getPersona(profileId);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      hero: p.hero,
      tagline: p.tagline,
      answers: { ...p.answers, yearlyBills: [...p.answers.yearlyBills, ...extraBills] },
      txns: [...p.txns, ...extraTxns],
      basket: p.basket,
      demoLocation: p.demoLocation,
      isDemo: true,
    };
  }, [profileId, myAnswers, myTxns, added, addedBills]);
}

export function useAnalysis(profile: Profile | null) {
  return useMemo(() => (profile ? analyse(profile.answers, profile.txns, TODAY) : null), [profile]);
}

export function useLang(profile?: Profile | null): Lang {
  const lang = useStore((s) => s.lang);
  return lang ?? profile?.answers.language ?? 'en';
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** Auto mode falls back to the on-device model when there is no internet. */
export function useEffectiveMode(): Mode {
  const mode = useStore((s) => s.mode);
  const online = useOnline();
  if (mode === 'auto' && !online) return 'local';
  return mode;
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json()) as T;
}

export interface AiStatus {
  cloud: boolean;
  cloudName: string | null;
  localUrl: string;
  localModel: string;
  google: boolean;
  finnhub: boolean;
}

export function useAiStatus() {
  const [s, setS] = useState<AiStatus | null>(null);
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS(null));
  }, []);
  return s;
}
