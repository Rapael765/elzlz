import { NextRequest } from 'next/server';
import { getUser, getSlot } from '@/lib/auth';
import { proxyBaileys } from '@/lib/baileys-proxy';
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Silakan login.' }, { status: 401 });
  const slot = await getSlot(request, user.id);
  if (!slot) return Response.json({ error: 'Slot perangkat melebihi batas akun ini.' }, { status: 403 });
  return proxyBaileys(request, 'disconnect', 'POST', user.id, slot);
}
