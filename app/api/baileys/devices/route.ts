import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { proxyBaileys } from '@/lib/baileys-proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Silakan login.' }, { status: 401 });
  return proxyBaileys(request, 'devices', 'GET', user.id);
}
