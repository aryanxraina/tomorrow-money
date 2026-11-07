'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Card, Field, inputCls, Muted } from '@/components/ui';
import { getPersonas } from '@/lib/data/personas';
import { categorise } from '@/lib/engine/categorise';
import { useStore } from '@/lib/store';
import type { Answers, Barrier, DebtType, IncomeType, Lang, Txn } from '@/lib/types';
import { LANGS } from '@/lib/i18n';

const EMPTY: Answers = {
  name: '',
  adults: 1,
  children: 0,
  childUnder4: false,
  incomeTypes: [],
  monthlyIncome: 1200,
  housing: 'rent_private',
  housingCost: 600,
  energyPayment: 'direct_debit',
  foodWeekly: 60,
  debts: [],
  debtRepayMonthly: 0,
  savings: 0,
  balance: 200,
  postcode: '',
  councilTaxMonthly: 110,
  ctSingleDiscount: false,
  ctReduction: false,
  allStudents: false,
  onBenefits: false,
  barriers: [],
  language: 'en',
  worry: '',
  yearlyBills: [],
  futureIncome: [],
};

const INCOME: { id: IncomeType; label: string }[] = [
  { id: 'salary', label: 'Monthly salary' },
  { id: 'four_weekly', label: 'Paid every 4 weeks' },
  { id: 'gig', label: 'Gig / self-employed' },
  { id: 'zero_hours', label: 'Zero-hours / agency' },
  { id: 'benefits', label: 'Benefits (e.g. Universal Credit)' },
  { id: 'student_loan', label: 'Student loan' },
  { id: 'pension', label: 'Pension' },
];
const DEBTS: { id: DebtType; label: string }[] = [
  { id: 'overdraft', label: 'Overdraft' },
  { id: 'bnpl', label: 'Buy now, pay later' },
  { id: 'credit_card', label: 'Credit card' },
  { id: 'payday', label: 'Payday / short-term loan' },
  { id: 'arrears', label: 'Behind on bills' },
];
const BARRIERS: { id: Barrier; label: string }[] = [
  { id: 'language', label: 'Prefer another language' },
  { id: 'new_to_uk', label: 'New to the UK' },
  { id: 'no_bank_history', label: 'Little or no credit history' },
  { id: 'low_digital', label: 'Not confident online' },
  { id: 'disability', label: 'Disability or long-term illness' },
];

function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={`rounded-full px-3 py-1.5 text-sm ${on ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">{n}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function parseCsv(text: string): { txns: Txn[]; balance?: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { txns: [] };
  const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const di = head.findIndex((h) => h.includes('date'));
  const ki = head.findIndex((h) => /desc|narrative|details|name|merchant/.test(h));
  const ai = head.findIndex((h) => h === 'amount' || h.includes('amount') || h.includes('value'));
  const bi = head.findIndex((h) => h.includes('balance'));
  const txns: Txn[] = [];
  let balance: number | undefined;
  lines.slice(1).forEach((l, i) => {
    const c = split(l);
    const raw = c[di] || '';
    const m = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    const date = m ? `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : raw.slice(0, 10);
    const amount = Number((c[ai] || '').replace(/[£,]/g, ''));
    if (!date || Number.isNaN(amount)) return;
    const description = (c[ki] || 'Transaction').toUpperCase();
    txns.push({ id: `csv-${i}`, date, description, amount, category: categorise(description, amount), source: 'bank' });
    if (bi >= 0 && c[bi]) balance = Number(c[bi].replace(/[£,]/g, ''));
  });
  txns.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { txns, balance };
}

export default function Onboarding() {
  const router = useRouter();
  const setMyProfile = useStore((s) => s.setMyProfile);
  const [a, setA] = useState<Answers>(EMPTY);
  const [csv, setCsv] = useState<{ txns: Txn[]; name: string } | null>(null);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((x) => ({ ...x, [k]: v }));
  const num = (k: keyof Answers) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  const prefill = (id: string) => {
    const p = getPersonas().find((x) => x.id === id);
    if (p) setA({ ...p.answers });
  };

  const submit = () => {
    const answers = { ...a, name: a.name || 'You', onBenefits: a.onBenefits || a.incomeTypes.includes('benefits') };
    setMyProfile(answers, csv?.txns || []);
    router.push('/dashboard');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Your 2-minute check-in</h1>
        <Muted>Every question is optional. We use your answers to predict the next 90 days before any bank data is connected.</Muted>
      </div>
      <Card className="flex flex-wrap items-center gap-2 bg-violet-50 ring-violet-100">
        <span className="text-sm text-violet-900">Demo shortcut: fill in as</span>
        {getPersonas().map((p) => (
          <Button key={p.id} variant="soft" onClick={() => prefill(p.id)} className="!px-3 !py-1.5">
            {p.name}
          </Button>
        ))}
      </Card>

      <Section n={1} title="About you">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <input className={inputCls} value={a.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Language">
            <select className={inputCls} value={a.language} onChange={(e) => set('language', e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Adults at home (including you)">
            <input type="number" min={1} className={inputCls} value={a.adults} onChange={num('adults')} />
          </Field>
          <Field label="Children">
            <input type="number" min={0} className={inputCls} value={a.children} onChange={num('children')} />
          </Field>
          <Field label="Postcode area" hint="Just the first part, e.g. LS9. Used for your council and nearby shops.">
            <input className={inputCls} value={a.postcode} onChange={(e) => set('postcode', e.target.value.toUpperCase())} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={a.childUnder4} onChange={(e) => set('childUnder4', e.target.checked)} /> A child under 4, or pregnant
          </label>
        </div>
        <Field label="Anything that makes money stuff harder?">
          <Chips options={BARRIERS} value={a.barriers} onChange={(v) => set('barriers', v)} />
        </Field>
      </Section>

      <Section n={2} title="Money coming in">
        <Field label="How are you paid? (pick all)">
          <Chips options={INCOME} value={a.incomeTypes} onChange={(v) => set('incomeTypes', v)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Usual income a month (£)">
            <input type="number" className={inputCls} value={a.monthlyIncome} onChange={num('monthlyIncome')} />
          </Field>
          <Field label="In your account now (£)">
            <input type="number" className={inputCls} value={a.balance} onChange={num('balance')} />
          </Field>
          <Field label="Savings (£)">
            <input type="number" className={inputCls} value={a.savings} onChange={num('savings')} />
          </Field>
        </div>
        {a.incomeTypes.includes('student_loan') && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Next loan payment date">
              <input
                type="date"
                className={inputCls}
                value={a.futureIncome[0]?.date || ''}
                onChange={(e) => set('futureIncome', [{ label: 'Student loan', date: e.target.value, amount: a.futureIncome[0]?.amount || 1500 }])}
              />
            </Field>
            <Field label="Amount (£)">
              <input
                type="number"
                className={inputCls}
                value={a.futureIncome[0]?.amount || ''}
                onChange={(e) => set('futureIncome', [{ label: 'Student loan', date: a.futureIncome[0]?.date || '', amount: Number(e.target.value) }])}
              />
            </Field>
          </div>
        )}
      </Section>

      <Section n={3} title="Money going out">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Where you live">
            <select className={inputCls} value={a.housing} onChange={(e) => set('housing', e.target.value as Answers['housing'])}>
              <option value="rent_private">Renting (private)</option>
              <option value="rent_social">Renting (council / housing association)</option>
              <option value="room">Renting a room</option>
              <option value="student_house">Student house</option>
              <option value="mortgage">Mortgage</option>
              <option value="family">With family</option>
            </select>
          </Field>
          <Field label="Rent or mortgage a month (£)">
            <input type="number" className={inputCls} value={a.housingCost} onChange={num('housingCost')} />
          </Field>
          <Field label="Council tax a month (£)" hint="0 if it is included in your rent">
            <input type="number" className={inputCls} value={a.councilTaxMonthly} onChange={num('councilTaxMonthly')} />
          </Field>
          <Field label="Food shopping a week (£)">
            <input type="number" className={inputCls} value={a.foodWeekly} onChange={num('foodWeekly')} />
          </Field>
          <Field label="How you pay for energy">
            <select className={inputCls} value={a.energyPayment} onChange={(e) => set('energyPayment', e.target.value as Answers['energyPayment'])}>
              <option value="direct_debit">Direct Debit</option>
              <option value="prepayment">Prepayment meter / top-ups</option>
              <option value="included">Included in rent</option>
            </select>
          </Field>
          <Field label="Debt repayments a month (£)">
            <input type="number" className={inputCls} value={a.debtRepayMonthly} onChange={num('debtRepayMonthly')} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={a.onBenefits} onChange={(e) => set('onBenefits', e.target.checked)} /> I get benefits
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={a.allStudents} onChange={(e) => set('allStudents', e.target.checked)} /> Everyone at home is a full-time student
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={a.ctReduction} onChange={(e) => set('ctReduction', e.target.checked)} /> I already get Council Tax Reduction
          </label>
          {a.adults === 1 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={a.ctSingleDiscount} onChange={(e) => set('ctSingleDiscount', e.target.checked)} /> I get the 25% single person discount
            </label>
          )}
        </div>
        <Field label="Any of these?">
          <Chips options={DEBTS} value={a.debts} onChange={(v) => set('debts', v)} />
        </Field>
      </Section>

      <Section n={4} title="Coming up, and what worries you">
        <Field label="A big bill coming in the next 3 months?" hint="e.g. MOT, insurance renewal, Christmas">
          <div className="grid grid-cols-3 gap-2">
            <input
              placeholder="What"
              className={inputCls}
              value={a.yearlyBills[0]?.label || ''}
              onChange={(e) => set('yearlyBills', [{ label: e.target.value, date: a.yearlyBills[0]?.date || '', amount: a.yearlyBills[0]?.amount || 0 }])}
            />
            <input
              type="date"
              className={inputCls}
              value={a.yearlyBills[0]?.date || ''}
              onChange={(e) => set('yearlyBills', [{ label: a.yearlyBills[0]?.label || 'Bill', date: e.target.value, amount: a.yearlyBills[0]?.amount || 0 }])}
            />
            <input
              type="number"
              placeholder="£"
              className={inputCls}
              value={a.yearlyBills[0]?.amount || ''}
              onChange={(e) => set('yearlyBills', [{ label: a.yearlyBills[0]?.label || 'Bill', date: a.yearlyBills[0]?.date || '', amount: Number(e.target.value) }])}
            />
          </div>
        </Field>
        <Field label="In your own words: what worries you most about money?" hint="The AI reads this to make your plan personal. Any language is fine.">
          <textarea className={`${inputCls} min-h-20`} value={a.worry} onChange={(e) => set('worry', e.target.value)} />
        </Field>
        <Field label="Optional: upload a bank statement (CSV)" hint="Most UK banks let you export one. It stays in your browser. In a real launch this would connect through Open Banking.">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const parsed = parseCsv(await f.text());
              setCsv({ txns: parsed.txns, name: f.name });
              if (parsed.balance !== undefined) set('balance', parsed.balance);
            }}
          />
          {csv && <span className="mt-1 block text-sm text-emerald-700">Read {csv.txns.length} transactions from {csv.name}</span>}
        </Field>
      </Section>

      <div className="flex gap-3">
        <Button onClick={submit} className="flex-1">
          See my money tomorrow
        </Button>
      </div>
    </div>
  );
}
