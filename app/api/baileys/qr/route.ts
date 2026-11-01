import { NextRequest } from 'next/server';
import { getUser, getSlot } from '@/lib/auth';
import { proxyBaileys } from '@/lib/baileys-proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Silakan login.' }, { status: 401 });
  const slot = await getSlot(request, user.id);
  if (!slot) return Response.json({ error: 'Slot perangkat melebihi batas akun ini.' }, { status: 403 });
  return proxyBaileys(request, 'qr', 'GET', user.id, slot);
}
