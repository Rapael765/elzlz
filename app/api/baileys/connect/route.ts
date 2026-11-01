import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { proxyBaileys } from '@/lib/baileys-proxy';
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Silakan login.' }, { status: 401 });
  return proxyBaileys(request, 'connect', 'POST', user.id);
}
