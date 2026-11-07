'use client';

import { BookOpen, Download, FileSpreadsheet, MapPin, Pencil, Repeat, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Muted, PoundInput, Row, SectionTitle, Segmented, Switch, TopBar, Why } from '@/components/ui';
import { todayISO } from '@/lib/engine/dates';
import { useAiStatus, useMoney } from '@/lib/hooks';
import { downloadFile } from '@/lib/ics';
import { personData, useStore, type ThemeChoice } from '@/lib/store';

function csvCell(s: string | number) {
  const text = String(s);
  // A leading = + - or @ would make a spreadsheet treat a merchant name as a formula.
  const safe = /^[=+\-@]/.test(text) && typeof s === 'string' ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export default function More() {
  const router = useRouter();
  const money = useMoney();
  const status = useAiStatus();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const bigText = useStore((s) => s.bigText);
  const setBigText = useStore((s) => s.setBigText);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const saveAnswers = useStore((s) => s.saveAnswers);
  const txns = useStore((s) => s.txns);
  const reset = useStore((s) => s.reset);
  const [savings, setSavings] = useState(money ? String(money.profile.answers.savings || '') : '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exportJson = () => downloadFile(`tomorrow-data-${todayISO()}.json`, JSON.stringify(personData(), null, 2), 'application/json');
  const exportCsv = () => {
    const rows = [['Date', 'Description', 'Amount', 'Category'], ...txns.map((t) => [t.date, t.description, t.amount, t.category])];
    downloadFile(`tomorrow-transactions-${todayISO()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-3">
      <TopBar title="More" back="/home" settings={false} />

      <Card className="!py-2">
        <Row icon={<FileSpreadsheet size={20} aria-hidden />} title="Statements and transactions" sub="Add a statement or correct a category" href="/spending?view=transactions" />
        <Row icon={<Repeat size={20} aria-hidden />} title="Subscriptions" sub="What you pay for regularly" href="/subscriptions" />
        <Row icon={<MapPin size={20} aria-hidden />} title="Nearby" sub="Free cash machines, advice and food banks" href="/nearby" />
        <Row icon={<BookOpen size={20} aria-hidden />} title="Learn about investing" sub="When it makes sense, and how it works" href="/learn" />
        <Row icon={<Pencil size={20} aria-hidden />} title="Redo my check-in" sub="Update your answers" href="/onboarding" />
      </Card>

      {money && (
        <Card className="space-y-2">
          <SectionTitle>Savings</SectionTitle>
          <Field label="Savings you could use in an emergency" hint="Counted in your safe days.">
            <PoundInput
              value={savings}
              onChange={(v) => {
                setSavings(v);
                saveAnswers({ savings: Number(v) || 0 }, ['savings']);
              }}
            />
          </Field>
        </Card>
      )}

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
