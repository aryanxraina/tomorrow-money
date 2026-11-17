'use client';

import { ChevronLeft, ChevronRight, FileSpreadsheet, Home as HomeIcon, Lock, MessageCircleQuestion, PiggyBank, Sparkles, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SignInStep } from '@/components/Account';
import { StatementImport } from '@/components/StatementImport';
import { Button, Card, Chip, Chips, Field, inputCls, Muted, PoundInput } from '@/components/ui';
import { todayISO } from '@/lib/engine/dates';
import { useAccount } from '@/lib/account';
import { googleConfigured } from '@/lib/google/client';
import { useStore } from '@/lib/store';
import { markOverviewReady } from '@/lib/welcome';
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

type Step = 'signin' | 'about' | 'start' | 'statement' | 'income' | 'balance' | 'costs';
const QUESTION_STEPS: Step[] = ['about', 'start', 'income', 'balance', 'costs'];

const amount = (s: string) => (s.trim() === '' ? null : Number(s));

export default function Onboarding() {
  const router = useRouter();
  const saveAnswers = useStore((s) => s.saveAnswers);
  const user = useAccount((s) => s.user);
  // Signing in comes first, but only when someone starts: exploring the app never asks for it.
  const [step, setStep] = useState<Step>(() => (googleConfigured() && !useAccount.getState().user ? 'signin' : 'about'));
  const [name, setName] = useState(() => useAccount.getState().user?.given ?? '');
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
    const known = ['name'];
    if (incomeTypes.length) known.push('incomeTypes');
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
    markOverviewReady();
    router.push('/home');
  };

  if (step === 'signin') {
    return (
      <SignInStep
        onDone={(kind) => {
          if (kind === 'returning') return router.push('/home');
          setName(useAccount.getState().user?.given ?? '');
          setStep('about');
        }}
      />
    );
  }

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
        <div className="h-2 flex-1 rounded-full bg-card" role="progressbar" aria-label="Check-in progress" aria-valuemin={1} aria-valuemax={QUESTION_STEPS.length} aria-valuenow={position + 1}>
          <div className="progress-fill h-2 rounded-full" style={{ width: `${((position + 1) / QUESTION_STEPS.length) * 100}%`, background: 'var(--chart-line)' }} />
        </div>
        <span className="num flex-none text-[13px] font-medium text-mut">
          Step {position + 1} of {QUESTION_STEPS.length}
        </span>
      </div>

      {step === 'about' && (
        <>
          <Heading
            icon={<Sparkles size={22} aria-hidden />}
            title={user?.given ? `Hi ${user.given}! Let’s understand your money` : 'Let’s understand your money'}
            sub="We’ll help you see where you stand and what you can do next. It takes about 2 minutes, and you can skip anything you’re not sure about."
          />
          <Card className="space-y-4">
            <Field label="What should we call you?" hint={user ? 'From your Google account. Change it to anything you like.' : 'Optional'}>
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
          <Heading icon={<Wallet size={22} aria-hidden />} title="How would you like to add your information?" sub="Both work. You can always add the other later." />
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
          <p className="flex items-center justify-center gap-1.5 px-1 text-center text-[13px] text-mut">
            <Lock size={14} aria-hidden /> You never have to share your bank data. Answering questions works too.
          </p>
        </>
      )}

      {step === 'statement' && (
        <>
          <Heading icon={<FileSpreadsheet size={22} aria-hidden />} title="Add a bank statement" sub="Start with your main account. Three months or more gives the best forecast. It’s read on this device and never uploaded." />
          <StatementImport showTitle={false} onImported={() => router.push('/home')} />
        </>
      )}

      {step === 'income' && (
        <>
          <Heading icon={<PiggyBank size={22} aria-hidden />} title="How much money usually comes in each month?" sub="Include wages, benefits or any other regular income, after tax. A rough number is fine." why="So we can see how your money changes from month to month." />
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
          <Heading icon={<Wallet size={22} aria-hidden />} title="How much do you have right now?" sub="What’s in your main account today. An approximate amount is fine, and you can update it later." why="Your forecast starts from this number." />
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
          <Heading icon={<HomeIcon size={22} aria-hidden />} title="What do you usually pay for essentials?" sub="Leave anything blank if you’re not sure. We’ll only ask again if it matters." why="These are the costs you can’t skip, so they show how long your money could last." />
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

function Heading({ title, sub, why, icon }: { title: string; sub: string; why?: string; icon?: React.ReactNode }) {
  return (
    <div className="px-1">
      {icon && <span className="onboard-icon mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-lime text-lime-ink">{icon}</span>}
      <h1 className="text-balance font-display text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
      <Muted className="mt-1">{sub}</Muted>
      {why && (
        <p className="mt-2 text-[13px] text-mut">
          <span className="font-semibold text-ink">Why we ask: </span>
          {why}
        </p>
      )}
    </div>
  );
}
