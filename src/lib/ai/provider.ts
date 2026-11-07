// Server-only: one switch between a cloud API and a local small model (QVAC or any OpenAI-compatible server).
import { generateText, type ModelMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type Mode = 'auto' | 'cloud' | 'local';
export type Used = 'cloud' | 'local' | 'rules';

const env = (k: string) => process.env[k]?.trim() || undefined;

export function aiStatus() {
  const anthropic = !!env('ANTHROPIC_API_KEY');
  const openai = !!env('OPENAI_API_KEY');
  return {
    cloud: anthropic || openai,
    cloudName: anthropic ? `Claude (${env('CLOUD_MODEL') || 'claude-sonnet-5-5'})` : openai ? `OpenAI (${env('OPENAI_MODEL') || 'gpt-4.1-mini'})` : null,
    localUrl: env('LOCAL_AI_BASE_URL') || 'http://127.0.0.1:11434/v1',
    localModel: env('LOCAL_AI_MODEL') || 'qwen3-600m',
    google: !!env('GOOGLE_MAPS_API_KEY'),
    finnhub: !!env('FINNHUB_API_KEY'),
  };
}

function cloudModel() {
  if (env('ANTHROPIC_API_KEY')) {
    const id = env('CLOUD_MODEL') || 'claude-sonnet-5-5';
    return { model: createAnthropic({ apiKey: env('ANTHROPIC_API_KEY') })(id), name: `Claude ${id}` };
  }
  const id = env('OPENAI_MODEL') || 'gpt-4.1-mini';
  return { model: createOpenAI({ apiKey: env('OPENAI_API_KEY') })(id), name: `OpenAI ${id}` };
}

function localModel() {
  const s = aiStatus();
  const provider = createOpenAICompatible({ name: 'qvac', baseURL: s.localUrl, apiKey: env('LOCAL_AI_API_KEY') || 'qvac' });
  return { model: provider(s.localModel), name: `On-device ${s.localModel}` };
}

// llama.cpp-based local servers reject concurrent requests on one model: queue them.
let localChain: Promise<unknown> = Promise.resolve();
function queueLocal<T>(fn: () => Promise<T>): Promise<T> {
  const p = localChain.then(fn, fn);
  localChain = p.catch(() => undefined);
  return p;
}

// Quick, cached check so a missing local server costs ~1s, not a long timeout.
let localHealth: { ok: boolean; at: number } | null = null;
async function localUp(): Promise<boolean> {
  if (localHealth && Date.now() - localHealth.at < (localHealth.ok ? 20000 : 5000)) return localHealth.ok;
  let ok = false;
  try {
    const r = await fetch(`${aiStatus().localUrl.replace(/\/$/, '')}/models`, { signal: AbortSignal.timeout(1500) });
    ok = r.status < 500;
  } catch {
    ok = false;
  }
  localHealth = { ok, at: Date.now() };
  return ok;
}

const clean = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

export async function ask(opts: {
  mode: Mode;
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  maxOutputTokens?: number;
}): Promise<{ text: string; used: Used; model: string }> {
  const st = aiStatus();
  // Privacy rule: if the user chose on-device, nothing is ever sent to the cloud.
  const order: ('cloud' | 'local')[] = opts.mode === 'local' ? ['local'] : st.cloud ? ['cloud', 'local'] : ['local'];
  const messages: ModelMessage[] = opts.messages ?? [{ role: 'user', content: opts.prompt || '' }];
  let lastErr = '';
  for (const which of order) {
    try {
      if (which === 'local' && !(await localUp())) throw new Error(`local AI server not reachable at ${st.localUrl}`);
      const m = which === 'cloud' ? cloudModel() : localModel();
      const isQwen3 = which === 'local' && /qwen3/i.test(st.localModel);
      const run = () =>
        generateText({
          model: m.model,
          system: opts.system + (isQwen3 ? '\n/no_think' : ''),
          messages,
          maxOutputTokens: opts.maxOutputTokens ?? 700,
          maxRetries: which === 'cloud' ? 1 : 0,
          abortSignal: AbortSignal.timeout(which === 'cloud' ? 30000 : 120000),
        });
      const res = which === 'local' ? await queueLocal(run) : await run();
      const text = clean(res.text);
      if (!text) throw new Error('empty response');
      return { text, used: which, model: m.name };
    } catch (e) {
      lastErr = (e as Error).message;
      console.warn(`[ai] ${which} failed: ${lastErr}`);
    }
  }
  throw new Error(`no AI available: ${lastErr}`);
}

/** Pull the first JSON object/array out of model text (small models often add chatter). */
export function extractJson<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fence ? fence[1] : text;
  const starts = [src.indexOf('{'), src.indexOf('[')].filter((i) => i >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const open = src[start];
  const close = open === '{' ? '}' : ']';
  const end = src.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(src.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
