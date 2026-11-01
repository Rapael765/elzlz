import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
  const secret = process.env.OPTOUT_CALLBACK_SECRET;
  if (!secret || request.headers.get('x-optout-secret') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phone } = await request.json();
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(normalized)) return NextResponse.json({ error: 'Nomor tidak valid.' }, { status: 400 });
  const db = createServerClient();
  const { error } = await db.from('contacts').update({ unsubscribed_at: new Date().toISOString() }).eq('phone', normalized);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
