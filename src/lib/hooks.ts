'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { analyse, estimateFromAnswers, planForecast, type Analysis } from './engine/analyse';
import { todayISO } from './engine/dates';
import type { Forecast } from './engine/forecast';
import { buildFacts, templates } from './narrative';
import { useStore, type Mode } from './store';
import type { Answers, Category, ConfirmedSupport, Txn } from './types';

export const APP_NAME = 'Tomorrow';

export interface Profile {
  name: string;
  answers: Answers;
  txns: Txn[];
  /** True when the forecast is built from their answers because there's no bank data yet. */
  estimated: boolean;
  newestBankDate: string | null;
  known: string[];
  rules: Record<string, Category>;
  confirmed: ConfirmedSupport[];
}

// Screens share one result, so moving between tabs doesn't re-run the forecast.
let lastAnalysis: { inputs: unknown[]; profile: Profile; analysis: Analysis } | null = null;

function shared(inputs: unknown[], build: () => Profile) {
  if (lastAnalysis && lastAnalysis.inputs.length === inputs.length && lastAnalysis.inputs.every((x, i) => x === inputs[i])) return lastAnalysis;
  const profile = build();
  const analysis = analyse(profile.answers, profile.txns, todayISO(), { rules: profile.rules, confirmed: profile.confirmed, known: profile.known });
  lastAnalysis = { inputs, profile, analysis };
  return lastAnalysis;
}

/** The person's data and everything worked out from it. Null until they've started. */
export function useMoney() {
  const answers = useStore((s) => s.answers);
  const txns = useStore((s) => s.txns);
  const bills = useStore((s) => s.bills);
  const known = useStore((s) => s.known);
  const rules = useStore((s) => s.rules);
  const confirmed = useStore((s) => s.confirmed);
  const selectedStore = useStore((s) => s.selected);

  const result = useMemo(() => {
    if (!answers) return null;
    const today = todayISO();
    return shared([answers, txns, bills, known, rules, confirmed, today], () => {
      const bank = txns.filter((t) => t.source === 'bank');
      const estimated = bank.length === 0;
      return {
        name: answers.name || 'there',
        answers: { ...answers, yearlyBills: [...answers.yearlyBills, ...bills] },
        txns: estimated ? [...estimateFromAnswers(answers, today), ...txns] : txns,
        estimated,
        newestBankDate: bank.reduce<string | null>((m, t) => (!m || t.date > m ? t.date : m), null),
        known,
        rules,
        confirmed,
      };
    });
  }, [answers, txns, bills, known, rules, confirmed]);

  return useMemo(() => {
    if (!result) return null;
    const { profile, analysis: an } = result;
    // Claims don't change the forecast until confirmed, so only the other steps can be ticked.
    const selectedIds = selectedStore ?? an.actions.filter((a) => a.kind !== 'claim').map((a) => a.id);
    const selectedActions = an.actions.filter((a) => a.kind !== 'claim' && selectedIds.includes(a.id));
    const plan: Forecast = planForecast(an, selectedActions);
    const facts = buildFacts(profile, an, plan, selectedActions.map((a) => a.title));
    return { profile, an, plan, selectedIds, selectedActions, facts, rulesText: templates(facts) };
  }, [result, selectedStore]);
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

/** With no internet, everything behaves as it does in On-device mode. */
export function useEffectiveMode(): Mode {
  const mode = useStore((s) => s.mode);
  const online = useOnline();
  if (mode === 'auto' && !online) return 'local';
  return mode;
}

const subscribeNever = () => () => undefined;

/** False during the server render and hydration, true afterwards (state lives in localStorage). */
export function useMounted() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
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
  localUp: boolean;
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
