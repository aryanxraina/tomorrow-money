import { ask, extractJson, type Mode } from '@/lib/ai/provider';
import { RECEIPT_SYSTEM } from '@/lib/ai/prompts';
import { SAMPLE_RECEIPTS, type ParsedReceipt } from '@/lib/data/samples';

export async function POST(req: Request) {
  const { mode, image, sampleId } = (await req.json()) as { mode: Mode; image: string; sampleId?: string };
  const m = image?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (m) {
    try {
      const r = await ask({
        mode,
        system: RECEIPT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: m[2], mediaType: m[1] },
              { type: 'text', text: 'Read this receipt and return the JSON.' },
            ],
          },
        ],
        maxOutputTokens: 900,
      });
      const parsed = extractJson<ParsedReceipt>(r.text);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length) {
        parsed.items = parsed.items.map((i) => ({ name: String(i.name), qty: Number(i.qty) || 1, price: Number(i.price) || 0 }));
        parsed.total = Number(parsed.total) || parsed.items.reduce((s, i) => s + i.price, 0);
        return Response.json({ receipt: parsed, used: r.used, model: r.model });
      }
    } catch (e) {
      console.warn('[receipt] AI failed', (e as Error).message);
    }
  }
  if (sampleId && SAMPLE_RECEIPTS[sampleId]) {
    return Response.json({ receipt: SAMPLE_RECEIPTS[sampleId].parsed, used: 'rules', note: 'Sample receipt read without AI' });
  }
  return Response.json({ receipt: null, used: 'rules', error: 'Could not read this receipt. You can type the items instead.' }, { status: 422 });
}
