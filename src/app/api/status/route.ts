import { connection } from 'next/server';
import { aiStatus, localReachable } from '@/lib/ai/provider';

export async function GET() {
  await connection(); // read keys at request time, not build time
  return Response.json({ ...aiStatus(), localUp: await localReachable() });
}
