'use client';

import { useEffect, useState } from 'react';
import type { Used } from '@/components/ui';
import { postJSON, useEffectiveMode } from './hooks';
import type { Facts, StepKey } from './narrative';

type Narration = { texts: Partial<Record<StepKey, string>>; used: Used };

// Survives moving between tabs, so the same numbers are never written twice.
const cache = new Map<string, Narration>();

/** The sentence for one section: the AI's wording if it passed the checks, otherwise the app's own. */
export function useNarration(facts: Facts | null, rulesText: Record<StepKey, string> | null, step: StepKey) {
  const mode = useEffectiveMode();
  const key = facts ? `${mode}|${JSON.stringify(facts)}` : '';
  const [finished, setFinished] = useState('');
  const narration = cache.get(key);

  useEffect(() => {
    if (!facts || !rulesText || cache.has(key)) return;
    let alive = true;
    postJSON<{ texts: Narration['texts'] | null; used: Used }>('/api/ai/narrate', { mode, lang: 'en', facts, draft: rulesText })
      .then((r) => {
        if (r.texts) cache.set(key, { texts: r.texts, used: r.used });
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setFinished(key);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ai = narration?.texts[step];
  return { text: ai ?? rulesText?.[step] ?? '', used: ai ? narration?.used : null, writing: !!key && !narration && finished !== key };
}
