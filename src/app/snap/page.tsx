'use client';

import { useMemo, useRef, useState } from 'react';
import { AiBadge, AiWriting, Button, Card, inputCls, Muted, Pill, type Used } from '@/components/ui';
import { SAMPLE_RECEIPTS, type ParsedReceipt } from '@/lib/data/samples';
import { diffDays, gbp, shortDate, TODAY } from '@/lib/engine/dates';
import { postJSON, useAiStatus, useEffectiveMode, useProfile } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import type { Txn } from '@/lib/types';

async function fileToDataUrl(file: Blob): Promise<string> {
  // shrink big phone photos so they upload fast and fit model limits
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

export default function Snap() {
  const profile = useProfile();
  const mode = useEffectiveMode();
  const status = useAiStatus();
  const addTxn = useStore((s) => s.addTxn);
  const addedAll = useStore((s) => s.added);
  const added = useMemo(() => (profile ? addedAll[profile.id] || [] : []), [addedAll, profile]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<ParsedReceipt | null>(null);
  const [used, setUsed] = useState<Used | null>(null);
  const [model, setModel] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const read = async (image: string, sampleId?: string) => {
    setBusy(true);
    setErr(null);
    setRec(null);
    setSaved(null);
    try {
      const r = await postJSON<{ receipt: ParsedReceipt | null; used: Used; model?: string; error?: string }>('/api/receipt', { mode, image, sampleId });
      if (r.receipt) {
        setRec({ ...r.receipt, date: r.receipt.date || TODAY });
        setUsed(r.used);
        setModel(r.model);
      } else {
        setErr(r.error || 'Could not read that receipt.');
        setRec({ merchant: '', date: TODAY, items: [{ name: '', qty: 1, price: 0 }], total: 0 });
        setUsed(null);
      }
    } catch {
      setErr('Could not read that receipt.');
      setRec({ merchant: '', date: TODAY, items: [{ name: '', qty: 1, price: 0 }], total: 0 });
      setUsed(null);
    } finally {
      setBusy(false);
    }
  };

  const total = rec ? rec.items.reduce((s, i) => s + (Number(i.price) || 0), 0) : 0;
  const match = useMemo(() => {
    if (!rec || !profile) return null;
    return profile.txns.find((t) => t.source === 'bank' && Math.abs(t.amount + total) < 0.05 && Math.abs(diffDays(t.date, rec.date)) <= 2) || null;
  }, [rec, profile, total]);

  // Price tracker: every item you've snapped, with the lowest price seen.
  const items = useMemo(() => {
    const m = new Map<string, { name: string; last: number; where: string; date: string; low: number; lowWhere: string; count: number }>();
    for (const t of added) {
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
  }, [added]);

  if (!profile)
    return (
      <Card>
        <p>Pick a demo person or do your check-in first.</p>
      </Card>
    );

  const save = () => {
    if (!rec) return;
    const id = `rcpt-${Date.now()}`;
    const t: Txn = {
      id,
      date: rec.date,
      description: (rec.merchant || 'Receipt').toUpperCase(),
      merchant: rec.merchant,
      amount: -Math.round(total * 100) / 100,
      category: 'groceries',
      source: match ? 'receipt' : 'manual',
      items: rec.items.filter((i) => i.name),
    };
    addTxn(profile.id, t);
    setSaved(match ? `Items attached to your card payment on ${shortDate(match.date)}. Not counted twice.` : 'Added to your tracker. Your forecast now includes it.');
    setRec(null);
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Snap & Receipt</h1>
        <Muted>Photograph a receipt. We turn it into a list you can check, and only add it with your permission.</Muted>
      </div>

      <Card className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const url = await fileToDataUrl(f);
            setPreview(url);
            read(url);
          }}
        />
        <Button onClick={() => fileRef.current?.click()} className="w-full">
          📷 Snap or upload a receipt
        </Button>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SAMPLE_RECEIPTS).map(([id, s]) => (
            <Button
              key={id}
              variant="soft"
              className="!px-3 !py-1.5"
              onClick={async () => {
                const blob = await (await fetch(s.image)).blob();
                const url = await fileToDataUrl(blob);
                setPreview(url);
                read(url, id);
              }}
            >
              Try: {s.label}
            </Button>
          ))}
        </div>
        <Muted>
          {mode === 'local' || !status?.cloud ? 'On-device: the photo stays on this device.' : 'Cloud AI reads the photo.'} Sample receipts are labelled “demo”.
        </Muted>
      </Card>

      {preview && (
        <Card className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt" className="max-h-72 rounded-lg" />
        </Card>
      )}
      {busy && (
        <Card>
          <AiWriting mode={mode} what="Reading your receipt" />
        </Card>
      )}
      {err && <Card className="bg-amber-50 text-sm text-amber-900">{err} Type the items below instead.</Card>}
      {saved && <Card className="bg-emerald-50 text-sm text-emerald-900">✓ {saved}</Card>}

      {rec && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Is this right?</h2>
            <AiBadge used={used} model={model} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} value={rec.merchant} placeholder="Shop" onChange={(e) => setRec({ ...rec, merchant: e.target.value })} />
            <input type="date" className={inputCls} value={rec.date} onChange={(e) => setRec({ ...rec, date: e.target.value })} />
          </div>
          <div className="space-y-2">
            {rec.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr_28px] gap-2 border-b border-slate-100 pb-2 sm:grid-cols-[1fr_64px_96px_28px] sm:border-0 sm:pb-0">
                <input aria-label="Item" className={`${inputCls} col-span-3 sm:col-span-1`} value={it.name} placeholder="Item" onChange={(e) => setRec({ ...rec, items: rec.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input aria-label="Quantity" type="number" className={inputCls} value={it.qty} onChange={(e) => setRec({ ...rec, items: rec.items.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)) })} />
                <input
                  aria-label="Price"
                  type="number"
                  step="0.01"
                  className={inputCls}
                  value={it.price}
                  onChange={(e) => setRec({ ...rec, items: rec.items.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)) })}
                />
                <button className="text-slate-400" aria-label="Remove item" onClick={() => setRec({ ...rec, items: rec.items.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </div>
            ))}
            <Button variant="ghost" className="!px-2 !py-1" onClick={() => setRec({ ...rec, items: [...rec.items, { name: '', qty: 1, price: 0 }] })}>
              + Add item
            </Button>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span>{gbp(total, 2)}</span>
          </div>
          {rec.total > 0 && Math.abs(rec.total - total) > 0.05 ? <Muted>The receipt says {gbp(rec.total, 2)}. Check the items above.</Muted> : null}
          {match ? (
            <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
              This matches your card payment “{match.description}” on {shortDate(match.date)}. We’ll attach the items to it so it isn’t counted twice.
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">No matching card payment found, so this will be added as a new spend (for example, cash).</div>
          )}
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">
              Yes, add to my tracker
            </Button>
            <Button variant="ghost" onClick={() => setRec(null)}>
              No thanks
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Price tracker: things you buy</h2>
        {items.length ? (
          <div className="mt-2 divide-y divide-slate-100">
            {items.map((i) => (
              <div key={i.name} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-slate-500">
                    last {gbp(i.last, 2)} at {i.where}
                  </div>
                </div>
                {i.low < i.last - 0.01 ? <Pill tone="green">{gbp(i.low, 2)} at {i.lowWhere}</Pill> : <Pill>{i.count}× bought</Pill>}
              </div>
            ))}
          </div>
        ) : (
          <Muted className="mt-1">Snap a receipt to start tracking prices. Snap both samples to see a cheaper price spotted.</Muted>
        )}
      </Card>
    </div>
  );
}
