'use client';

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { BLANK_ANSWERS } from './answers';
import { todayISO } from './engine/dates';
import { mergeTxns } from './engine/statements';
import type { Account, Answers, Category, ConfirmedSupport, DatedAmount, Txn } from './types';

export type Mode = 'auto' | 'cloud' | 'local';
export type ThemeChoice = 'system' | 'light' | 'dark';

/** Everything that belongs to the person: what gets exported, deleted and (later, by choice) synced. */
export interface PersonData {
  answers: Answers | null;
  known: string[]; // answers they actually gave, as opposed to blanks
  skipped: string[]; // questions they said "not now" to
  txns: Txn[];
  accounts: Account[];
  rules: Record<string, Category>; // their category corrections, by merchant
  confirmed: ConfirmedSupport[];
  bills: DatedAmount[]; // upcoming bills they chose to add, for example from email
  selected: string[] | null; // ticked plan steps; null means the suggested ones
}

const EMPTY_DATA: PersonData = { answers: null, known: [], skipped: [], txns: [], accounts: [], rules: {}, confirmed: [], bills: [], selected: null };

interface State extends PersonData {
  mode: Mode;
  theme: ThemeChoice;
  bigText: boolean;
  storageFull: boolean;
  saveAnswers: (changes: Partial<Answers>, knownFields: string[]) => void;
  skipQuestion: (id: string) => void;
  importStatement: (txns: Txn[], account: Account) => { added: number; duplicates: number };
  addTxn: (t: Txn) => void;
  setRule: (key: string, category: Category) => void;
  confirmSupport: (c: ConfirmedSupport) => void;
  removeConfirmed: (id: string) => void;
  addBills: (bills: DatedAmount[]) => void;
  setSelected: (ids: string[]) => void;
  setMode: (m: Mode) => void;
  setTheme: (t: ThemeChoice) => void;
  setBigText: (b: boolean) => void;
  reset: () => void;
}

// A full browser store mustn't crash the app or silently lose a person's data, so failures are surfaced.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      if (useStore.getState().storageFull) useStore.setState({ storageFull: false });
    } catch {
      useStore.setState({ storageFull: true });
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // nothing to remove
    }
  },
};

const unique = (xs: string[]) => [...new Set(xs)];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...EMPTY_DATA,
      mode: 'auto',
      theme: 'system',
      bigText: false,
      storageFull: false,
      saveAnswers: (changes, knownFields) =>
        set((s) => ({ answers: { ...(s.answers ?? BLANK_ANSWERS), ...changes }, known: unique([...s.known, ...knownFields]), skipped: s.skipped.filter((q) => !knownFields.includes(q)) })),
      skipQuestion: (id) => set((s) => ({ skipped: unique([...s.skipped, id]) })),
      importStatement: (incoming, account) => {
        const merged = mergeTxns(get().txns, incoming);
        set((s) => {
          const accounts = [...s.accounts.filter((a) => a.id !== account.id), account];
          const held = accounts.filter((a) => a.balance !== null);
          const answers = s.answers ?? BLANK_ANSWERS;
          return {
            txns: merged.txns,
            accounts,
            answers: held.length ? { ...answers, balance: held.reduce((sum, a) => sum + (a.balance ?? 0), 0), balanceDate: todayISO() } : answers,
            known: held.length ? unique([...s.known, 'balance']) : s.known,
          };
        });
        return { added: merged.added, duplicates: merged.duplicates };
      },
      addTxn: (t) => set((s) => ({ txns: [...s.txns, t].sort((a, z) => a.date.localeCompare(z.date)), answers: s.answers ?? BLANK_ANSWERS })),
      setRule: (key, category) => set((s) => ({ rules: { ...s.rules, [key]: category } })),
      confirmSupport: (c) => set((s) => ({ confirmed: [...s.confirmed.filter((x) => x.id !== c.id), c] })),
      removeConfirmed: (id) => set((s) => ({ confirmed: s.confirmed.filter((x) => x.id !== id) })),
      addBills: (bills) =>
        set((s) => {
          const keyOf = (b: DatedAmount) => `${b.label}|${b.date}`;
          const seen = new Set(s.bills.map(keyOf));
          return { bills: [...s.bills, ...bills.filter((b) => !seen.has(keyOf(b)))] };
        }),
      setSelected: (ids) => set({ selected: ids }),
      setMode: (m) => set({ mode: m }),
      setTheme: (t) => set({ theme: t }),
      setBigText: (b) => set({ bigText: b }),
      reset: () => set({ ...EMPTY_DATA }),
    }),
    {
      name: 'tomorrow-v2',
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ answers, known, skipped, txns, accounts, rules, confirmed, bills, selected, mode, theme, bigText }) => ({ answers, known, skipped, txns, accounts, rules, confirmed, bills, selected, mode, theme, bigText }),
    },
  ),
);

/** The person's data as one object, for export. */
export const personData = (): PersonData => {
  const { answers, known, skipped, txns, accounts, rules, confirmed, bills, selected } = useStore.getState();
  return { answers, known, skipped, txns, accounts, rules, confirmed, bills, selected };
};
