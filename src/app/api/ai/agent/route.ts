import type { ModelMessage } from 'ai';
import { ask, readBody, safeMode, type Mode } from '@/lib/ai/provider';
import { agentSystem } from '@/lib/ai/prompts';
import { inventedNumbers } from '@/lib/ai/guard';
import type { Lang } from '@/lib/types';

export async function POST(req: Request) {
  const body = await readBody<{
    mode: Mode;
    lang: Lang;
    question: string;
    context: unknown;
    facts?: unknown;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }>(req);
  if (!body?.question) return Response.json({ text: null, used: 'rules', error: 'bad request' }, { status: 400 });
  const history = (body.history || []).slice(-6);
  const messages: ModelMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: 'user', content: body.facts ? `${body.question}\nAFFORDABILITY FACTS: ${JSON.stringify(body.facts)}` : body.question },
  ];
  try {
    const r = await ask({ mode: safeMode(body.mode), system: agentSystem(body.lang, body.context), messages, maxOutputTokens: 500 });
    const invented = inventedNumbers(r.text, body.context, body.facts, body.question, history.map((m) => m.content));
    if (invented.length) {
      // The model used a number the app never gave it, so the rules answer is shown instead.
      console.warn(`[agent] rejected AI answer: ${invented.length} number(s) not supplied by the app`);
      return Response.json({ text: null, used: 'rules', error: 'number check failed' });
    }
    return Response.json({ text: r.text, used: r.used, model: r.model });
  } catch (e) {
    return Response.json({ text: null, used: 'rules', error: (e as Error).message });
  }
}
