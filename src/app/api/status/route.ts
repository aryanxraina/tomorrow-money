import { connection } from 'next/server';
import { aiStatus, localReachable } from '@/lib/ai/provider';
import { redditVia } from '@/lib/community/reddit';

export async function GET() {
  await connection(); // read keys at request time, not build time
  return Response.json({ ...aiStatus(), reddit: redditVia(), localUp: await localReachable() });
}
