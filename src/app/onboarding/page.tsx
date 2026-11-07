'use client';

import { ChevronLeft, ChevronRight, FileSpreadsheet, MessageCircleQuestion } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StatementImport } from '@/components/StatementImport';
import { Button, Card, Chip, Chips, Field, inputCls, Muted, PoundInput } from '@/components/ui';
import { todayISO } from '@/lib/engine/dates';
import { useStore } from '@/lib/store';
import type { Answers, IncomeType, Nation } from '@/lib/types';

const NATIONS: { id: Nation; label: string }[] = [
  { id: 'england', label: 'England' },
  { id: 'wales', label: 'Wales' },
  { id: 'scotland', label: 'Scotland' },
  { id: 'ni', label: 'Northern Ireland' },
];

const INCOME: { id: IncomeType; label: string }[] = [
  { id: 'salary', label: 'Monthly salary' },
  { id: 'four_weekly', label: 'Paid every 4 weeks' },
  { id: 'zero_hours', label: 'Zero-hours or agency' },
  { id: 'gig', label: 'Self-employed or gig work' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'student_loan', label: 'Student loan' },
  { id: 'pension', label: 'Pension' },
];

type Step = 'about' | 'start' | 'statement' | 'income' | 'balance' | 'costs';
const QUESTION_STEPS: Step[] = ['about', 'start', 'income', 'balance', 'costs'];

const amount = (s: string) => (s.trim() === '' ? null : Number(s));

export default function Onboarding() {
  const router = useRouter();
  const saveAnswers = useStore((s) => s.saveAnswers);
  const [step, setStep] = useState<Step>('about');
  const [name, setName] = useState('');
  const [nation, setNation] = useState<Nation | null>(null);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [income, setIncome] = useState('');
  const [balance, setBalance] = useState('');
  const [overdrawn, setOverdrawn] = useState(false);
  const [rent, setRent] = useState('');
  const [councilTax, setCouncilTax] = useState('');
  const [food, setFood] = useState('');

  const saveAbout = () => saveAnswers({ name: name.trim(), nation }, ['name', nation ? 'nation' : ''].filter(Boolean));

  const finish = () => {
    const changes: Partial<Answers> = { name: name.trim(), nation, incomeTypes, onBenefits: incomeTypes.includes('benefits') };
    const known = ['name', 'incomeTypes'];
    if (nation) known.push('nation');
    const add = (field: keyof Answers, value: number | null) => {
      if (value === null || Number.isNaN(value)) return;
      (changes as Record<string, unknown>)[field] = value;
      known.push(field);
    };
    add('monthlyIncome', amount(income));
    add('housingCost', amount(rent));
    add('councilTaxMonthly', amount(councilTax));
    add('foodWeekly', amount(food));
    const b = amount(balance);
    if (b !== null && !Number.isNaN(b)) {
      changes.balance = overdrawn ? -Math.abs(b) : b;
      changes.balanceDate = todayISO();
      known.push('balance');
    }
    saveAnswers(changes, known);
    router.push('/home');
  };

  const position = QUESTION_STEPS.indexOf(step === 'statement' ? 'start' : step);
  const back = () => setStep(step === 'statement' || step === 'income' ? 'start' : step === 'start' ? 'about' : step === 'balance' ? 'income' : 'balance');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1 pt-1">
        {step !== 'about' && (
          <button type="button" aria-label="Back" onClick={back} className="-ml-2 grid h-9 w-9 place-items-center rounded-full">
            <ChevronLeft size={24} aria-hidden />
          </button>
        )}
        <div className="h-1.5 flex-1 rounded-full bg-card" role="progressbar" aria-label="Check-in progress" aria-valuemin={1} aria-valuemax={QUESTION_STEPS.length} aria-valuenow={position + 1}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${((position + 1) / QUESTION_STEPS.length) * 100}%`, background: 'var(--chart-line)' }} />
        </div>
      </div>

      {step === 'about' && (
        <>
          <Heading title="Let’s get to know your money" sub="It takes about 2 minutes. Skip anything you’re not sure about." />
          <Card className="space-y-4">
            <Field label="What should we call you?" hint="Optional">
              <input className={inputCls} value={name} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-medium">Where do you live?</span>
              <div className="grid grid-cols-2 gap-2">
                {NATIONS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    aria-pressed={nation === n.id}
                    onClick={() => setNation(n.id)}
                    className={`rounded-2xl px-4 py-3 text-left text-[15px] font-medium transition ${nation === n.id ? 'bg-hero text-hero-ink' : 'bg-card-2 text-ink'}`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
              {(nation === 'scotland' || nation === 'ni') && <p className="mt-2 text-[13.5px] text-mut">Your forecast and plan will work fully. Our benefit checks only cover England and Wales so far, so we’ll point you to the right official service instead.</p>}
            </div>
          </Card>
          <Button
            className="w-full"
            onClick={() => {
              saveAbout();
              setStep('start');
            }}
          >
            Continue
          </Button>
        </>
      )}

      {step === 'start' && (
        <>
          <Heading title="How would you like to start?" sub="You can always add the other later." />
          <button type="button" onClick={() => setStep('statement')} className="block w-full text-left">
            <Card className="flex items-center gap-3">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-lime text-lime-ink">
                <FileSpreadsheet size={22} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  Add a bank statement <Chip tone="good">Most accurate</Chip>
                </span>
                <span className="mt-0.5 block text-sm text-mut">A CSV file from your bank. It’s read on this device and isn’t uploaded.</span>
              </span>
              <ChevronRight size={20} className="flex-none text-mut" aria-hidden />
            </Card>
          </button>
          <button type="button" onClick={() => setStep('income')} className="block w-full text-left">
            <Card className="flex items-center gap-3">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-card-2 text-ink">
                <MessageCircleQuestion size={22} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Answer a few questions</span>
                <span className="mt-0.5 block text-sm text-mut">Rough numbers are fine. We’ll make an estimate from them.</span>
              </span>
              <ChevronRight size={20} className="flex-none text-mut" aria-hidden />
            </Card>
          </button>
        </>
      )}

      {step === 'statement' && (
        <>
          <Heading title="Add a bank statement" sub="Start with your main account. Three months or more gives the best forecast." />
          <StatementImport showTitle={false} onImported={() => router.push('/home')} />
        </>
      )}

      {step === 'income' && (
        <>
          <Heading title="Money coming in" sub="After tax, and roughly is fine." />
          <Card className="space-y-4">
            <div>
              <span className="mb-1.5 block text-sm font-medium">How are you paid?</span>
              <Chips options={INCOME} value={incomeTypes} onChange={setIncomeTypes} />
            </div>
            <Field label="Usual income a month">
              <PoundInput value={income} onChange={setIncome} />
            </Field>
          </Card>
          <Button className="w-full" onClick={() => setStep('balance')}>
            Continue
          </Button>
        </>
      )}

      {step === 'balance' && (
        <>
          <Heading title="What’s in your main account today?" sub="Your forecast starts from this number." />
          <Card className="space-y-3">
            <Field label="Balance today">
              <PoundInput value={balance} onChange={setBalance} />
            </Field>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--hero)]" checked={overdrawn} onChange={(e) => setOverdrawn(e.target.checked)} />
              My account is overdrawn
            </label>
          </Card>
          <Button className="w-full" onClick={() => setStep('costs')}>
            Continue
          </Button>
        </>
      )}

      {step === 'costs' && (
        <>
          <Heading title="Your regular costs" sub="Leave anything blank if you’re not sure. We’ll ask again later if it matters." />
          <Card className="space-y-4">
            <Field label="Rent or mortgage a month">
              <PoundInput value={rent} onChange={setRent} />
            </Field>
            <Field label="Council tax a month" hint="Put 0 if it’s included in your rent">
              <PoundInput value={councilTax} onChange={setCouncilTax} />
            </Field>
            <Field label="Food shopping a week">
              <PoundInput value={food} onChange={setFood} />
            </Field>
          </Card>
          <Button className="w-full" onClick={finish}>
            See my next 90 days
          </Button>
          <Muted className="px-1 text-center">Your answers stay on this device.</Muted>
        </>
      )}
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-1">
      <h1 className="text-balance font-display text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
      <Muted className="mt-1">{sub}</Muted>
    </div>
  );
}
