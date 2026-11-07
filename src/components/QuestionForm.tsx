'use client';

import { useState } from 'react';
import { Button, Chips, inputCls, PoundInput, Segmented } from '@/components/ui';
import { todayISO } from '@/lib/engine/dates';
import type { Question, QuestionValue } from '@/lib/engine/questions';
import { useStore } from '@/lib/store';

/** One question's input, with Save and, when `onSkip` is given, a way to leave it for now. */
export function QuestionForm({ question, onDone, onSkip }: { question: Question; onDone?: () => void; onSkip?: () => void }) {
  const answers = useStore((s) => s.answers);
  const known = useStore((s) => s.known);
  const saveAnswers = useStore((s) => s.saveAnswers);
  const skipQuestion = useStore((s) => s.skipQuestion);
  // Only what they've actually told us. A blank default, such as "no benefits", mustn't look like their answer.
  const current = answers && known.includes(question.id) ? question.read(answers) : null;
  const [text, setText] = useState(typeof current === 'number' && current !== 0 ? String(Math.abs(current)) : typeof current === 'string' ? current : '');
  const [negative, setNegative] = useState(typeof current === 'number' && current < 0);
  const [many, setMany] = useState<string[]>(Array.isArray(current) ? current : []);
  const [yes, setYes] = useState<'yes' | 'no' | ''>(current === true ? 'yes' : current === false ? 'no' : '');
  const [one, setOne] = useState(typeof current === 'string' ? current : '');
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');

  let value: QuestionValue = null;
  let ready = false;
  switch (question.kind) {
    case 'money':
    case 'count':
    case 'day':
      value = Number(text);
      ready = text.trim() !== '' && !Number.isNaN(value) && (question.kind !== 'day' || (value >= 1 && value <= 31));
      break;
    case 'signed-money':
      value = negative ? -Math.abs(Number(text)) : Number(text);
      ready = text.trim() !== '' && !Number.isNaN(value);
      break;
    case 'yesno':
      value = yes === 'yes';
      ready = yes !== '';
      break;
    case 'one':
      value = one;
      ready = one !== '';
      break;
    case 'many':
      value = many;
      ready = true;
      break;
    case 'dated':
      value = { date, amount: Number(text), label };
      ready = !!date && Number(text) > 0;
      break;
  }

  const save = () => {
    if (!ready || !answers) return;
    const changes = question.write(value, answers);
    if (question.id === 'balance') changes.balanceDate = todayISO();
    saveAnswers(changes, [question.id]);
    onDone?.();
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {question.kind === 'money' && <PoundInput label={question.title} value={text} onChange={setText} />}
      {question.kind === 'signed-money' && (
        <>
          <PoundInput label={question.title} value={text} onChange={setText} />
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={negative} onChange={(e) => setNegative(e.target.checked)} /> My account is overdrawn
          </label>
        </>
      )}
      {question.kind === 'count' && <input aria-label={question.title} type="number" inputMode="numeric" min="0" step="1" className={`${inputCls} num`} value={text} onChange={(e) => setText(e.target.value)} />}
      {question.kind === 'day' && <input aria-label={question.title} placeholder="Day, from 1 to 31" type="number" inputMode="numeric" min="1" max="31" step="1" className={`${inputCls} num`} value={text} onChange={(e) => setText(e.target.value)} />}
      {question.kind === 'yesno' && (
        <Segmented
          label={question.title}
          value={yes}
          onChange={setYes}
          options={[
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
          ]}
        />
      )}
      {question.kind === 'one' && (
        <div className="grid gap-2">
          {question.options?.map((o) => (
            <button key={o.id} type="button" aria-pressed={one === o.id} onClick={() => setOne(o.id)} className={`rounded-2xl px-4 py-3 text-left text-[15px] font-medium transition ${one === o.id ? 'bg-hero text-hero-ink' : 'bg-card-2 text-ink'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {question.kind === 'many' && question.options && <Chips options={question.options} value={many} onChange={setMany} />}
      {question.kind === 'dated' && (
        <div className="space-y-2">
          {question.namePlaceholder && <input aria-label={question.namePlaceholder} placeholder={question.namePlaceholder} className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />}
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Date" type="date" min={todayISO()} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            <PoundInput label="Amount" value={text} onChange={setText} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!ready} className="flex-1">
          {question.kind === 'many' && !many.length ? 'None of these' : 'Save'}
        </Button>
        {onSkip && question.noneLabel && (
          <Button
            variant="soft"
            onClick={() => {
              saveAnswers({}, [question.id]);
              onDone?.();
            }}
          >
            {question.noneLabel}
          </Button>
        )}
        {onSkip && !question.noneLabel && (
          <Button
            variant="ghost"
            onClick={() => {
              skipQuestion(question.id);
              onSkip();
            }}
          >
            Not now
          </Button>
        )}
      </div>
    </form>
  );
}
