import { NextRequest, NextResponse } from 'next/server';

export async function proxyBaileys(request: NextRequest, endpoint: string, method = 'GET', userId?: string, slot?: number) {
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, '');
  const key = process.env.BAILEYS_API_KEY;
  if (!base || !key) return NextResponse.json({ error: 'Backend Baileys belum dikonfigurasi di Environment Variables Vercel.' }, { status: 503 });
  let body: string | undefined;
  if (method !== 'GET') body = await request.text();
  try {
    const upstream = await fetch(`${base}/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(userId ? { 'x-user-id': userId } : {}), ...(slot ? { 'x-slot': String(slot) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    const data = await upstream.json().catch(() => ({ error: 'Respons backend tidak valid.' }));
    return NextResponse.json(data, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Backend Baileys tidak dapat dijangkau. Periksa server Pterodactyl dan alamat API.' }, { status: 502 });
  }
}
