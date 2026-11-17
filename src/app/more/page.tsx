'use client';

import { BookOpen, CalendarClock, Camera, Download, FileSpreadsheet, MapPin, MessageCircle, MessagesSquare, Pencil, Repeat, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { AccountCard } from '@/components/Account';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Muted, Row, SectionTitle, Segmented, Switch, TopBar, Why } from '@/components/ui';
import { todayISO } from '@/lib/engine/dates';
import { useAiStatus } from '@/lib/hooks';
import { downloadFile } from '@/lib/ics';
import { personData, useStore, type ThemeChoice } from '@/lib/store';

const TOOLS = [
  { href: '/ask', title: 'Ask Tomorrow', sub: 'Ask questions about your money', icon: MessageCircle, tone: 'var(--lime)', ink: 'var(--lime-ink)' },
  { href: '/snap', title: 'Scan a receipt', sub: 'Record what you bought', icon: Camera, tone: 'var(--hero)', ink: 'var(--hero-ink)' },
  { href: '/nearby', title: 'Find nearby services', sub: 'Cash machines, Post Offices, food banks', icon: MapPin, tone: 'var(--strip-good)', ink: '#fff' },
  { href: '/community', title: 'What people are saying', sub: 'Real conversations about money', icon: MessagesSquare, tone: 'var(--strip-warn)', ink: 'var(--lime-ink)' },
  { href: '/learn', title: 'Learn about money', sub: 'Simple guides, starting with investing', icon: BookOpen, tone: 'var(--link)', ink: 'var(--card)' },
  { href: '/reminders', title: 'Calendar reminders', sub: 'Bill reminders on your phone', icon: CalendarClock, tone: 'var(--chart-plan)', ink: 'var(--card)' },
];

function csvCell(s: string | number) {
  const text = String(s);
  // A leading = + - or @ would make a spreadsheet treat a merchant name as a formula.
  const safe = /^[=+\-@]/.test(text) && typeof s === 'string' ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export default function More() {
  const router = useRouter();
  const status = useAiStatus();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const bigText = useStore((s) => s.bigText);
  const setBigText = useStore((s) => s.setBigText);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const txns = useStore((s) => s.txns);
  const reset = useStore((s) => s.reset);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exportJson = () => downloadFile(`tomorrow-data-${todayISO()}.json`, JSON.stringify(personData(), null, 2), 'application/json');
  const exportCsv = () => {
    const rows = [['Date', 'Description', 'Amount', 'Category'], ...txns.map((t) => [t.date, t.description, t.amount, t.category])];
    downloadFile(`tomorrow-transactions-${todayISO()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-3">
      <TopBar title="More tools and services" back="/home" settings={false} subtitle="Everything else Tomorrow can help with, in one place." />

      <div className="span-all grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className="tool-tile block">
              <div className="ui-card flex h-full flex-col gap-2 rounded-[22px] bg-card p-3.5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: t.tone, color: t.ink }}>
                  <Icon size={22} aria-hidden />
                </span>
                <span className="font-semibold leading-snug">{t.title}</span>
                <span className="text-[13px] leading-snug text-mut">{t.sub}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <Card className="!py-2">
        <div className="pt-1.5 font-semibold">Your money data</div>
        <Row icon={<FileSpreadsheet size={20} aria-hidden />} title="Statements and transactions" sub="Add a statement or correct a category" href="/spending?view=transactions" />
        <Row icon={<Repeat size={20} aria-hidden />} title="Regular payments" sub="Subscriptions and what you pay for regularly" href="/subscriptions" />
        <Row icon={<Pencil size={20} aria-hidden />} title="Your details" sub="See and change your answers" href="/details" />
      </Card>

      <h2 className="px-1 pt-1 font-display text-[20px] font-semibold tracking-tight">Settings</h2>

      <AccountCard />

      <Card className="space-y-4">
        <SectionTitle>Appearance</SectionTitle>
        <Segmented<ThemeChoice>
          label="Appearance"
          value={theme}
          onChange={setTheme}
          options={[
            { id: 'system', label: 'Automatic' },
            { id: 'light', label: 'Light' },
            { id: 'dark', label: 'Dark' },
          ]}
        />
        <Switch label="Bigger text" checked={bigText} onChange={setBigText} />
      </Card>

      <div id="ai">
        <Card className="space-y-3">
          <SectionTitle>AI and privacy</SectionTitle>
          <p className="text-sm text-mut">
            {status?.localUp
              ? `Explanations are written by ${status.localModel}, running on this computer.`
              : 'No AI is running, so the app’s own rules write everything. All forecasts and plans still work, and the coach answers set questions.'}
          </p>
          <Switch label="Keep everything on this device" hint="Blocks anything that would contact another service." checked={mode === 'local'} onChange={(on) => setMode(on ? 'local' : 'auto')} />
          {status && <p className="text-sm text-mut">Community Pulse: {status.reddit === 'api' ? 'Reddit’s official API.' : status.reddit === 'rss' ? 'Reddit’s public feeds, no key needed.' : 'Reddit is turned off, so it shows sample posts.'} It never contacts Reddit, YouTube or news sites while everything is kept on this device.</p>}
          <Why label="What’s stored, and where?">
            <p>Your answers and transactions are saved in this browser, on this device. Clearing your browser data or losing the device loses them, so download a copy from time to time.</p>
          </Why>
        </Card>
      </div>

      <Card className="space-y-3">
        <SectionTitle>Your data</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" className="!px-4 !py-2.5 !text-sm" onClick={exportJson}>
            <Download size={16} aria-hidden /> Download everything
          </Button>
          <Button variant="soft" className="!px-4 !py-2.5 !text-sm" onClick={exportCsv}>
            <Download size={16} aria-hidden /> Transactions as CSV
          </Button>
        </div>
        {!confirmDelete ? (
          <Button variant="danger" className="!px-0 !py-1 !text-sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden /> Delete all my data on this device
          </Button>
        ) : (
          <div className="chip-risk space-y-2 rounded-2xl p-3 text-sm">
            <p className="font-medium">This permanently removes everything from this device. It can’t be undone.</p>
            <div className="flex gap-2">
              <Button
                className="!bg-[var(--risk)] !px-4 !py-2 !text-sm !text-white"
                onClick={() => {
                  reset();
                  router.push('/');
                }}
              >
                Yes, delete it all
              </Button>
              <Button variant="ghost" className="!px-3 !py-2 !text-sm" onClick={() => setConfirmDelete(false)}>
                Keep my data
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Muted className="px-1">Tomorrow gives guidance to help you decide. It isn’t regulated financial or debt advice. It never sells your data or uses it for credit decisions.</Muted>
    </div>
  );
}
