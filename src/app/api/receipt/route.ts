import { ask, aiStatus, extractJson, localOcr, readBody, safeMode, type Mode, type Used } from '@/lib/ai/provider';
import { RECEIPT_SYSTEM, RECEIPT_TEXT_SYSTEM } from '@/lib/ai/prompts';
import { inventedNumbers } from '@/lib/ai/guard';
import { SAMPLE_RECEIPTS, type ParsedReceipt } from '@/lib/data/samples';
import { parseReceiptText } from '@/lib/engine/receipt';

/** Validates model JSON. The code, not the model, decides whether it is a usable receipt. */
function normalise(parsed: ParsedReceipt | null): ParsedReceipt | null {
  if (!parsed || !Array.isArray(parsed.items)) return null;
  const items = parsed.items
    .filter((i) => i && i.name && Number.isFinite(Number(i.price)))
    .map((i) => ({ name: String(i.name), qty: Number(i.qty) || 1, price: Number(i.price) }));
  if (!items.length) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date)) ? parsed.date : '';
  return { ...parsed, merchant: String(parsed.merchant || ''), date, items, total: Number(parsed.total) || items.reduce((s, i) => s + i.price, 0) };
}

async function readWithCloud(mediaType: string, base64: string, mode: Mode) {
  const r = await ask({
    mode,
    cloudOnly: true,
    system: RECEIPT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: base64, mediaType },
          { type: 'text', text: 'Read this receipt and return the JSON.' },
        ],
      },
    ],
    maxOutputTokens: 900,
  });
  const receipt = normalise(extractJson<ParsedReceipt>(r.text));
  return receipt ? { receipt, used: r.used, model: r.model } : null;
}

// Private path: on-device OCR, then plain code. The model only helps when the code finds nothing,
// and its prices must appear in what the OCR actually read.
async function readOnDevice(dataUrl: string) {
  const ocr = await localOcr(dataUrl);
  if (!ocr) return null;
  const used: Used = 'local';
  const parsed = parseReceiptText(ocr);
  if (parsed) {
    const { reconciled, ...rest } = parsed;
    return { receipt: { ...rest, date: rest.date || '' } as ParsedReceipt, used, model: 'QVAC OCR + app code', reconciled };
  }
  const r = await ask({ mode: 'local', system: RECEIPT_TEXT_SYSTEM, prompt: ocr, maxOutputTokens: 900 });
  const receipt = normalise(extractJson<ParsedReceipt>(r.text));
  if (!receipt || inventedNumbers(receipt.items.map((i) => i.price).join(' '), ocr).length) return null;
  return { receipt, used: r.used, model: `QVAC OCR + ${r.model}` };
}

export async function POST(req: Request) {
  const body = await readBody<{ mode: Mode; image: string; sampleId?: string }>(req);
  if (!body) return Response.json({ receipt: null, used: 'rules', error: 'Bad request.' }, { status: 400 });
  const mode = safeMode(body.mode);
  const m = body.image?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (m) {
    if (mode !== 'local' && aiStatus().cloud) {
      try {
        const res = await readWithCloud(m[1], m[2], mode);
        if (res) return Response.json(res);
      } catch (e) {
        console.warn('[receipt] cloud failed', (e as Error).message);
      }
    }
    try {
      const res = await readOnDevice(body.image);
      if (res) return Response.json(res);
    } catch (e) {
      console.warn('[receipt] on-device failed', (e as Error).message);
    }
  }
  const sample = body.sampleId ? SAMPLE_RECEIPTS[body.sampleId] : undefined;
  if (sample) return Response.json({ receipt: sample.parsed, used: 'rules', note: 'Sample receipt read without AI' });
  return Response.json({ receipt: null, used: 'rules', error: 'Could not read this receipt. You can type the items instead.' }, { status: 422 });
}
