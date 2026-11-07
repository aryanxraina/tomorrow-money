// Share prices for the watchlist: Finnhub free tier if FINNHUB_API_KEY is set, otherwise sample values.
const SAMPLE: Record<string, { price: number; change: number }> = {
  VWRL: { price: 128.4, change: 0.6 },
  VUSA: { price: 101.2, change: 0.9 },
  AAPL: { price: 231.5, change: -0.4 },
  TSCO: { price: 4.12, change: 0.2 },
};

export async function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get('symbols') || 'VWRL,VUSA,AAPL').split(',').slice(0, 6);
  const key = process.env.FINNHUB_API_KEY;
  const out: { symbol: string; price: number; change: number; source: 'finnhub' | 'sample' }[] = [];
  for (const s of symbols) {
    if (key) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${key}`, { signal: AbortSignal.timeout(5000) });
        const j = (await r.json()) as { c?: number; dp?: number };
        if (j.c) {
          out.push({ symbol: s, price: j.c, change: j.dp || 0, source: 'finnhub' });
          continue;
        }
      } catch {}
    }
    const smp = SAMPLE[s] || { price: 100, change: 0 };
    out.push({ symbol: s, ...smp, source: 'sample' });
  }
  return Response.json({ quotes: out });
}
