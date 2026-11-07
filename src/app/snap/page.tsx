'use client';

import { Camera, Plus, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AiWriting, Button, Card, Chip, Field, inputCls, Muted, NoProfile, Row, SectionTitle, TopBar } from '@/components/ui';
import { diffDays, gbp, shortDate, todayISO } from '@/lib/engine/dates';
import type { ParsedReceipt } from '@/lib/engine/receipt';
import { postJSON, useEffectiveMode, useMoney } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import type { Txn } from '@/lib/types';

async function fileToDataUrl(file: Blob): Promise<string> {
  // Shrink big phone photos so they're quick to read.
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

const blankReceipt = (): ParsedReceipt => ({ merchant: '', date: todayISO(), items: [{ name: '', qty: 1, price: 0 }], total: 0 });

export default function Snap() {
  const money = useMoney();
  const mode = useEffectiveMode();
  const addTxn = useStore((s) => s.addTxn);
  const txns = useStore((s) => s.txns);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<ParsedReceipt | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const read = async (image: string) => {
    setBusy(true);
    setErr(null);
    setRec(null);
    setSaved(null);
    try {
      const r = await postJSON<{ receipt: ParsedReceipt | null; error?: string }>('/api/receipt', { mode, image });
      if (r.receipt) setRec({ ...r.receipt, date: r.receipt.date || todayISO() });
      else {
        setErr('We couldn’t read this one. You can type the items in below instead.');
        setRec(blankReceipt());
      }
    } catch {
      setErr('We couldn’t read this one. You can type the items in below instead.');
      setRec(blankReceipt());
    } finally {
      setBusy(false);
    }
  };

  const total = rec ? rec.items.reduce((s, i) => s + (Number(i.price) || 0), 0) : 0;
  const match = useMemo(() => {
    if (!rec) return null;
    return txns.find((t) => t.source === 'bank' && Math.abs(t.amount + total) < 0.05 && Math.abs(diffDays(t.date, rec.date)) <= 2) || null;
  }, [rec, txns, total]);

  // What you've paid for each item, from your own receipts.
  const items = useMemo(() => {
    const m = new Map<string, { name: string; last: number; where: string; date: string; low: number; lowWhere: string; count: number }>();
    for (const t of txns) {
      for (const it of t.items || []) {
        const unit = it.price / (it.qty || 1);
        const k = it.name.toLowerCase().replace(/[^a-z ]/g, '').trim();
        const cur = m.get(k);
        const where = t.merchant || t.description;
        if (!cur) m.set(k, { name: it.name, last: unit, where, date: t.date, low: unit, lowWhere: where, count: 1 });
        else {
          if (t.date >= cur.date) Object.assign(cur, { last: unit, where, date: t.date });
          if (unit < cur.low) Object.assign(cur, { low: unit, lowWhere: where });
          cur.count++;
        }
      }
    }
    return [...m.values()];
  }, [txns]);

  if (!money) return <NoProfile />;

  const save = () => {
    if (!rec) return;
    const t: Txn = {
      id: `rcpt-${Date.now()}`,
      date: rec.date,
      description: (rec.merchant || 'Receipt').toUpperCase(),
      merchant: rec.merchant,
      amount: -Math.round(total * 100) / 100,
      category: 'groceries',
      source: match ? 'receipt' : 'manual',
      items: rec.items.filter((i) => i.name),
    };
    addTxn(t);
    setSaved(match ? `Items attached to your card payment on ${shortDate(match.date)}, so it isn’t counted twice.` : 'Added. Your forecast now includes it.');
    setRec(null);
    setPreview(null);
  };

  const setItem = (i: number, change: Partial<ParsedReceipt['items'][number]>) => rec && setRec({ ...rec, items: rec.items.map((x, j) => (j === i ? { ...x, ...change } : x)) });

  return (
    <div className="space-y-3">
      <TopBar title="Snap a receipt" back="/home" />

      <Card className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Take or choose a photo of a receipt"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const url = await fileToDataUrl(f);
            setPreview(url);
            read(url);
          }}
        />
        <Button onClick={() => fileRef.current?.click()} className="w-full">
          <Camera size={18} aria-hidden /> Take a photo
        </Button>
        <Button
          variant="soft"
          className="w-full"
          onClick={() => {
            setPreview(null);
            setErr(null);
            setSaved(null);
            setRec(blankReceipt());
          }}
        >
          Type it in instead
        </Button>
        <Muted>We turn your photo into a list for you to check, and nothing is added without your say-so. The photo stays on this device.</Muted>
      </Card>

      {preview && (
        <Card className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your receipt" className="max-h-72 rounded-xl" />
        </Card>
      )}
      {busy && (
        <Card>
          <AiWriting what="Reading your receipt" />
        </Card>
      )}
      {err && <p className="chip-warn rounded-2xl p-3 text-sm">{err}</p>}
      {saved && (
        <p role="status" className="chip-good rounded-2xl p-3 text-sm font-medium">
          {saved}
        </p>
      )}

      {rec && (
        <Card className="space-y-3">
          <SectionTitle>Is this right?</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Shop">
              <input className={inputCls} value={rec.merchant} onChange={(e) => setRec({ ...rec, merchant: e.target.value })} />
            </Field>
            <Field label="Date">
              <input type="date" className={inputCls} value={rec.date} onChange={(e) => setRec({ ...rec, date: e.target.value })} />
            </Field>
          </div>
          <div className="space-y-3">
            {rec.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_96px_32px] items-center gap-2">
                <input aria-label="Item" placeholder="Item" className={inputCls} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                <input aria-label="Price" placeholder="£" type="number" inputMode="decimal" step="0.01" className={`${inputCls} num`} value={it.price || ''} onChange={(e) => setItem(i, { price: Number(e.target.value) })} />
                <button type="button" className="grid h-8 w-8 place-items-center text-mut" aria-label={`Remove ${it.name || 'item'}`} onClick={() => setRec({ ...rec, items: rec.items.filter((_, j) => j !== i) })}>
                  <X size={18} aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-link" onClick={() => setRec({ ...rec, items: [...rec.items, { name: '', qty: 1, price: 0 }] })}>
              <Plus size={16} aria-hidden /> Add an item
            </button>
          </div>
          <div className="num flex justify-between border-t border-hair pt-3 font-semibold">
            <span>Total</span>
            <span>{gbp(total, 2)}</span>
          </div>
          {rec.total > 0 && Math.abs(rec.total - total) > 0.05 && <p className="chip-warn rounded-2xl p-3 text-sm">The receipt says {gbp(rec.total, 2)}, so please check the items above.</p>}
          {match ? (
            <p className="rounded-2xl bg-card-2 p-3 text-sm">This matches a card payment to {match.merchant || match.description} on {shortDate(match.date)}. We’ll attach the items to it, so it isn’t counted twice.</p>
          ) : (
            total > 0 && <p className="rounded-2xl bg-card-2 p-3 text-sm">We can’t see a matching card payment, so this will count as new spending, such as cash.</p>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={total <= 0} className="flex-1">
              Add it
            </Button>
            <Button variant="ghost" onClick={() => setRec(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Prices you’ve paid</SectionTitle>
        {items.length ? (
          <div className="mt-1 divide-y divide-hair">
            {items.map((i) => (
              <Row key={i.name} title={i.name} sub={`Last ${gbp(i.last, 2)} at ${i.where}`} right={i.low < i.last - 0.01 ? <Chip tone="good">{gbp(i.low, 2)} at {i.lowWhere}</Chip> : <span className="text-[13px] font-medium text-mut">Bought {i.count}×</span>} />
            ))}
          </div>
        ) : (
          <Muted className="mt-1">Snap a few receipts to see what you pay for things, and where they were cheapest.</Muted>
        )}
      </Card>
    </div>
  );
}
