'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, inputCls, Muted, PoundInput, Why } from '@/components/ui';
import { diffDays, gbp, shortDate, todayISO } from '@/lib/engine/dates';
import { applyMapping, decodeStatement, parseStatement, type ColumnMap, type ParsedStatement } from '@/lib/engine/statements';
import { useStore } from '@/lib/store';

const accountId = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'account';

/** Lets the person point at the right columns when the file can't be worked out automatically. */
function ColumnPicker({ parsed, onApply }: { parsed: ParsedStatement; onApply: (m: ColumnMap) => void }) {
  const start = parsed.mapping;
  const [date, setDate] = useState(start?.date ?? 0);
  const [description, setDescription] = useState(start?.description ?? 1);
  const [split, setSplit] = useState(start ? start.amount === null : false);
  const [amount, setAmount] = useState(start?.amount ?? 2);
  const [moneyOut, setMoneyOut] = useState(start?.moneyOut ?? 2);
  const [moneyIn, setMoneyIn] = useState(start?.moneyIn ?? 3);
  const [balance, setBalance] = useState<number | null>(start?.balance ?? null);
  const [flipSign, setFlipSign] = useState(start?.flipSign ?? false);
  const options = parsed.columns.map((c, i) => (
    <option key={i} value={i}>
      {c || `Column ${i + 1}`}
    </option>
  ));
  const firstRow = parsed.rows.find((r) => r.length > 1);
  const select = (label: string, value: number, onChange: (n: number) => void) => (
    <Field label={label} hint={firstRow?.[value] ? `For example: ${firstRow[value]}` : undefined}>
      <select className={inputCls} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options}
      </select>
    </Field>
  );
  return (
    <div className="space-y-3 rounded-2xl bg-card-2 p-3">
      <p className="text-sm font-semibold">Match the columns in your file</p>
      {select('Date', date, setDate)}
      {select('Description', description, setDescription)}
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Money in and out are in separate columns
      </label>
      {split ? (
        <>
          {select('Money out', moneyOut, setMoneyOut)}
          {select('Money in', moneyIn, setMoneyIn)}
        </>
      ) : (
        select('Amount', amount, setAmount)
      )}
      <Field label="Balance, if the file has it">
        <select className={inputCls} value={balance ?? ''} onChange={(e) => setBalance(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">No balance column</option>
          {options}
        </select>
      </Field>
      {!split && (
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={flipSign} onChange={(e) => setFlipSign(e.target.checked)} /> Spending shows as positive numbers in this file
        </label>
      )}
      <Button
        className="w-full"
        onClick={() => onApply({ date, description, amount: split ? null : amount, moneyOut: split ? moneyOut : null, moneyIn: split ? moneyIn : null, balance, hint: start?.hint ?? null, flipSign })}
      >
        Read the file with these columns
      </Button>
    </div>
  );
}

export function StatementImport({ onImported, showTitle = true }: { onImported?: () => void; showTitle?: boolean }) {
  const importStatement = useStore((s) => s.importStatement);
  const accounts = useStore((s) => s.accounts);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState('');
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const today = todayISO();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setDone(null);
    const text = decodeStatement(new Uint8Array(await file.arrayBuffer()));
    const result = parseStatement(text, file.name, 'pending');
    const sameBank = accounts.find((a) => a.bank && a.bank === result.bank);
    setFileName(file.name);
    setParsed(result);
    setAccountName(sameBank?.name ?? (result.bank ? `${result.bank} account` : 'Main account'));
    setBalance(result.closingBalance !== null ? String(Math.abs(result.closingBalance).toFixed(2)) : '');
    setPicking(!result.mapping);
  };

  const confirm = () => {
    if (!parsed?.mapping) return;
    const id = accountId(accountName);
    const final = applyMapping(parsed, parsed.mapping, id);
    const typed = balance.trim() === '' ? null : Number(balance) * (parsed.closingBalance !== null && parsed.closingBalance < 0 ? -1 : 1);
    const held = accounts.find((a) => a.id === id);
    const { added, duplicates } = importStatement(final.txns, {
      id,
      name: accountName.trim() || 'Main account',
      bank: final.bank,
      balance: typed ?? held?.balance ?? null,
      balanceDate: typed !== null ? today : (held?.balanceDate ?? null),
    });
    setDone(`Added ${added} ${added === 1 ? 'transaction' : 'transactions'}${duplicates ? `, and skipped ${duplicates} you already had` : ''}.`);
    setParsed(null);
    setFileName(null);
    onImported?.();
  };

  const stale = parsed?.to ? diffDays(today, parsed.to) : 0;
  const check = parsed?.balanceCheck;
  const reconciled = !!check && check.checked >= 2 && check.matched / check.checked >= 0.8;

  return (
    <Card className="space-y-3">
      <div>
        {showTitle && <h2 className="font-semibold">Add a bank statement</h2>}
        <Muted>Download a CSV from your bank’s app or website, then choose it here. The file is read on this device and isn’t uploaded anywhere.</Muted>
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-lime px-5 py-3 text-[15px] font-semibold text-lime-ink">
        <Upload size={18} aria-hidden />
        Choose a file
        <input
          type="file"
          aria-label="Choose a statement file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>

      {done && (
        <p role="status" className="chip-good rounded-2xl p-3 text-sm font-medium">
          {done}
        </p>
      )}

      {parsed && (
        <div className="space-y-3 border-t border-hair pt-3">
          <p className="break-words text-sm font-semibold">{parsed.bank ? `This looks like a ${parsed.bank} statement.` : fileName}</p>

          {parsed.txns.length > 0 && (
            <div className="num rounded-2xl bg-card-2 p-3 text-sm">
              <div>
                <b>{parsed.txns.length}</b> transactions, <b>{parsed.from && shortDate(parsed.from)}</b> to <b>{parsed.to && shortDate(parsed.to)}</b>
              </div>
              <div>
                Money in <b>{gbp(parsed.moneyIn, 2)}</b>, money out <b>{gbp(parsed.moneyOut, 2)}</b>
              </div>
              {reconciled && <div className="mt-1 text-good">These amounts agree with the running balance in the file.</div>}
            </div>
          )}

          {parsed.problems.map((p) => (
            <p key={p} className="chip-warn rounded-2xl p-3 text-sm">
              {p}
            </p>
          ))}

          {picking ? (
            <ColumnPicker
              parsed={parsed}
              onApply={(m) => {
                setParsed(applyMapping(parsed, m, 'pending'));
                setPicking(false);
              }}
            />
          ) : (
            <button type="button" className="block text-left text-sm font-medium text-link" onClick={() => setPicking(true)}>
              Something look wrong? Match the columns yourself
            </button>
          )}

          {parsed.txns.length > 0 && !picking && (
            <>
              <Field label="Name for this account">
                <input className={inputCls} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </Field>
              <Field
                label="What’s in this account today?"
                hint={parsed.closingBalance !== null ? `The file ends with ${gbp(parsed.closingBalance, 2)} on ${parsed.to && shortDate(parsed.to)}. Change it if it’s different now.` : 'This file has no balance, so please type it in.'}
              >
                <PoundInput value={balance} onChange={setBalance} />
              </Field>
              {stale > 7 && <p className="text-sm text-warn">The newest transaction is {stale} days old, so recent spending won’t be counted. A newer statement would be more accurate.</p>}
              <Button className="w-full" onClick={confirm}>
                Add these transactions
              </Button>
            </>
          )}
        </div>
      )}

      <Why label="How do I get a statement file?">
        <p>Most UK banks let you download transactions as a CSV file, usually under statements or transactions in online banking. Some app-based banks offer it inside the app.</p>
        <p>PDF statements can’t be read yet. You can add several files, and any overlap between them is ignored.</p>
      </Why>
    </Card>
  );
}
