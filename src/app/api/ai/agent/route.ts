import type { ModelMessage } from 'ai';
import { ask, type Mode } from '@/lib/ai/provider';
import { agentSystem } from '@/lib/ai/prompts';
import type { Lang } from '@/lib/types';

export async function POST(req: Request) {
  const body = (await req.json()) as {
    mode: Mode;
    lang: Lang;
    question: string;
    context: unknown;
    facts?: unknown;
    history?: { role: 'user' | 'assistant'; content: string }[];
  };
  const messages: ModelMessage[] = [
    ...(body.history || []).slice(-6).map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: 'user', content: body.facts ? `${body.question}\nAFFORDABILITY FACTS: ${JSON.stringify(body.facts)}` : body.question },
  ];
  try {
    const r = await ask({ mode: body.mode, system: agentSystem(body.lang, body.context), messages, maxOutputTokens: 500 });
    return Response.json({ text: r.text, used: r.used, model: r.model });
  } catch (e) {
    return Response.json({ text: null, used: 'rules', error: (e as Error).message });
  }
}
