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
    localOcrModel: env('LOCAL_OCR_MODEL') || 'ocr-en',
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

/** Is the on-device server reachable right now? (for the status route) */
export const localReachable = localUp;

// Removes reasoning, including an unterminated <think> block when the model hit its token limit.
const clean = (t: string) =>
  t
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim();

/** Anything other than an explicit cloud/auto choice is treated as on-device: the privacy-safe default. */
export function safeMode(m: unknown): Mode {
  return m === 'cloud' || m === 'auto' ? m : 'local';
}

/** Parses a request body; returns null instead of throwing on malformed JSON. */
export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function ask(opts: {
  mode: Mode;
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  maxOutputTokens?: number;
  /** Set for image requests: local chat servers silently drop images, so the model would invent an answer. */
  cloudOnly?: boolean;
}): Promise<{ text: string; used: Used; model: string }> {
  const st = aiStatus();
  const mode = safeMode(opts.mode);
  // Privacy rule: if the user chose on-device, nothing is ever sent to the cloud.
  let order: ('cloud' | 'local')[] = mode === 'local' ? ['local'] : st.cloud ? ['cloud', 'local'] : ['local'];
  if (opts.cloudOnly) order = order.filter((w) => w === 'cloud');
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
          // QVAC: turns reasoning off for hybrid-thinking models. Other servers ignore the field.
          ...(which === 'local' ? { providerOptions: { qvac: { reasoning_budget: false } } } : {}),
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
  // Walk each opening bracket and find its balanced close, ignoring brackets inside strings,
  // so chatter before or after the JSON (even with brackets in it) doesn't break parsing.
  for (let start = 0; start < src.length; start++) {
    if (src[start] !== '{' && src[start] !== '[') continue;
    const candidate = balanced(src, start);
    if (!candidate) continue;
    for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
      try {
        return JSON.parse(attempt) as T;
      } catch {
        // try the next repair, then the next bracket
      }
    }
  }
  return null;
}

function balanced(src: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * On-device OCR through QVAC (`/qvac/v1/ocr`). Returns the receipt as lines of text, top to bottom,
 * rebuilt from block positions. Null if the local server has no OCR (for example plain Ollama).
 */
export async function localOcr(dataUrl: string): Promise<string | null> {
  if (!(await localUp())) return null;
  const root = aiStatus().localUrl.replace(/\/v1\/?$/, '');
  try {
    const run = () =>
      fetch(`${root}/qvac/v1/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: aiStatus().localOcrModel, image: dataUrl }),
        signal: AbortSignal.timeout(120000),
      });
    const r = await queueLocal(run);
    if (!r.ok) {
      console.warn(`[ocr] server returned ${r.status}`);
      return null;
    }
    const j = (await r.json()) as { blocks?: { text: string; bbox?: number[] }[] };
    return ocrLines(j.blocks || []);
  } catch (e) {
    console.warn('[ocr] failed', (e as Error).message);
    return null;
  }
}

/** Groups OCR blocks into visual lines using their vertical position, left to right within a line. */
export function ocrLines(blocks: { text: string; bbox?: number[] }[]): string | null {
  if (!blocks.length) return null;
  if (!blocks.every((b) => b.bbox?.length === 4)) return blocks.map((b) => b.text).join('\n');
  const heights = blocks.map((b) => b.bbox![3] - b.bbox![1]).sort((a, z) => a - z);
  const tol = (heights[Math.floor(heights.length / 2)] || 10) * 0.6;
  const mid = (b: { bbox?: number[] }) => (b.bbox![1] + b.bbox![3]) / 2;
  const lines: { y: number; parts: typeof blocks }[] = [];
  for (const b of [...blocks].sort((x, y) => mid(x) - mid(y))) {
    const line = lines.find((l) => Math.abs(l.y - mid(b)) <= tol);
    if (line) line.parts.push(b);
    else lines.push({ y: mid(b), parts: [b] });
  }
  return lines
    .sort((a, z) => a.y - z.y)
    .map((l) =>
      [...l.parts]
        .sort((a, z) => a.bbox![0] - z.bbox![0])
        .map((b) => b.text)
        .join('  '),
    )
    .join('\n');
}
