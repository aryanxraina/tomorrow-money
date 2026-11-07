'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Answers, DatedAmount, Lang, Txn } from './types';

export type Mode = 'auto' | 'cloud' | 'local';

interface State {
  profileId: string | null; // persona id or 'me'
  myAnswers: Answers | null;
  myTxns: Txn[];
  added: Record<string, Txn[]>; // receipts / manual entries per profile
  addedBills: Record<string, DatedAmount[]>; // bills found in email, per profile
  mode: Mode;
  lang: Lang | null; // null = use the profile's language
  bigText: boolean;
  busFare: number;
  selected: Record<string, string[]>; // chosen plan actions per profile
  setProfile: (id: string | null) => void;
  setMyProfile: (a: Answers, txns: Txn[]) => void;
  addTxn: (profile: string, t: Txn) => void;
  updateTxn: (profile: string, t: Txn) => void;
  addBills: (profile: string, bills: DatedAmount[]) => void;
  setMode: (m: Mode) => void;
  setLang: (l: Lang | null) => void;
  setBigText: (b: boolean) => void;
  setBusFare: (n: number) => void;
  setSelected: (profile: string, ids: string[]) => void;
  reset: () => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      profileId: null,
      myAnswers: null,
      myTxns: [],
      added: {},
      addedBills: {},
      mode: 'auto',
      lang: null,
      bigText: false,
      busFare: 3,
      selected: {},
      setProfile: (id) => set({ profileId: id }),
      setMyProfile: (a, txns) => set((s) => ({ myAnswers: a, myTxns: txns, profileId: 'me', selected: { ...s.selected, me: [] } })),
      addTxn: (p, t) => set((s) => ({ added: { ...s.added, [p]: [...(s.added[p] || []), t] } })),
      updateTxn: (p, t) => set((s) => ({ added: { ...s.added, [p]: (s.added[p] || []).map((x) => (x.id === t.id ? t : x)) } })),
      addBills: (p, bills) =>
        set((s) => {
          const cur = s.addedBills[p] || [];
          const keyOf = (b: DatedAmount) => `${b.label}|${b.date}`;
          const seen = new Set(cur.map(keyOf));
          return { addedBills: { ...s.addedBills, [p]: [...cur, ...bills.filter((b) => !seen.has(keyOf(b)))] } };
        }),
      setMode: (m) => set({ mode: m }),
      setLang: (l) => set({ lang: l }),
      setBigText: (b) => set({ bigText: b }),
      setBusFare: (n) => set({ busFare: n }),
      setSelected: (p, ids) => set((s) => ({ selected: { ...s.selected, [p]: ids } })),
      reset: () => set({ profileId: null, myAnswers: null, myTxns: [], added: {}, addedBills: {}, selected: {}, lang: null }),
    }),
    { name: 'tomorrow-money-v1' },
  ),
);
