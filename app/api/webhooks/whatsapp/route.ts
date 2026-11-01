import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Configure this URL as the WhatsApp webhook in Meta Developers.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Handles opt-out keyword STOP. Configure webhook subscription to messages.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = createServerClient();
  const messages = body?.entry?.flatMap((e: any) => e.changes || [])
    .flatMap((c: any) => c.value?.messages || []) || [];
  for (const message of messages) {
    const text = message?.text?.body?.trim()?.toLowerCase();
    const from = message?.from;
    if (from && ["stop", "berhenti", "unsubscribe", "berhenti promosi"].includes(text)) {
      await db.from("contacts").update({ opted_in:false, unsubscribed_at:new Date().toISOString() }).eq("phone", from);
    }
  }
  return NextResponse.json({ received: true });
}
