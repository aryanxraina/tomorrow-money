// Saved results for the simple Community Pulse sources (YouTube, news). Server only.
// Each source is collected in one go, saved to .cache/<name>-pulse.json, and collected again only
// when old. A minimum gap between collections protects the free daily quotas, even if someone
// keeps pressing "Collect again".
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PulsePost } from './topics';

export interface SourceResult {
  posts: PulsePost[];
  fetchedAt: string;
}

interface Slot {
  memory: SourceResult | null;
  running: Promise<void> | null;
  error: string | null;
  lastStart: number;
}

// Kept on globalThis so dev hot-reloads don't start a second collection.
const g = globalThis as unknown as { __pulseSources?: Record<string, Slot> };
const slots = (g.__pulseSources ??= {});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function cachedSource(name: string, opts: { freshMs: number; minGapMs: number; collect: () => Promise<PulsePost[]> }) {
  const file = path.join(process.cwd(), '.cache', `${name}-pulse.json`);
  const slot = (slots[name] ??= { memory: null, running: null, error: null, lastStart: 0 });

  async function read(): Promise<SourceResult | null> {
    if (slot.memory) return slot.memory;
    try {
      slot.memory = JSON.parse(await fs.readFile(file, 'utf8')) as SourceResult;
    } catch {
      slot.memory = null;
    }
    return slot.memory;
  }

  async function run() {
    slot.lastStart = Date.now();
    try {
      const posts = await opts.collect();
      // An empty result never replaces posts we already have.
      if (posts.length || !slot.memory) {
        slot.memory = { posts, fetchedAt: new Date().toISOString() };
        await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => undefined);
        await fs.writeFile(file, JSON.stringify(slot.memory)).catch((e) => console.warn(`[${name}] could not save`, (e as Error).message));
      }
      slot.error = null;
      console.log(`[${name}] collected ${posts.length} posts`);
    } catch (e) {
      slot.error = (e as Error).message;
      console.warn(`[${name}] collection stopped:`, slot.error);
    } finally {
      slot.running = null;
    }
  }

  return {
    read,
    /** Saved posts; starts a collection if they're old (or `force`), within the quota gap. */
    async get(force = false): Promise<{ result: SourceResult | null; error: string | null; collecting: boolean }> {
      const result = await read();
      const last = Math.max(slot.lastStart, result ? Date.parse(result.fetchedAt) : 0);
      const sinceLast = Date.now() - last;
      const stale = !result || sinceLast > opts.freshMs;
      if (!slot.running && sinceLast > opts.minGapMs && (force || stale)) slot.running = run();
      // Nothing saved yet: wait a little so the first visit has something to show.
      if (!result && slot.running) await Promise.race([slot.running, wait(15_000)]);
      return { result: slot.memory, error: slot.error, collecting: !!slot.running };
    },
  };
}

/** Turns HTML entities in API text (&amp; &#39; …) into characters. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
