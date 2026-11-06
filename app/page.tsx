"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import "./stats.css";

type Contact = { id: string; name: string; phone: string; opted_in: boolean; unsubscribed_at: string | null; used_at?: string | null };
type Campaign = { id: string; name: string; template_name: string; status: string; created_at: string; speed_mode?: string; button_native?: boolean; button_label?: string | null; button_url?: string | null };
type Log = { id: string; phone: string; status: string; error: string | null; created_at: string; reward?: number };

const ICONS: Record<string, JSX.Element> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13v3" /><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1z" /><circle cx="16.5" cy="14" r="1.2" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.5 0 4.5 2 4.5 4.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><rect x="8" y="8" width="3" height="3" /><rect x="13" y="8" width="3" height="3" /><rect x="8" y="13" width="3" height="3" /><path d="M13 13h3v3" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  wifi: <><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10.5 10.5 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0" /><circle cx="12" cy="19.5" r="1" /></>,
  wifioff: <><path d="M2 9a15 15 0 0 1 4.5-3M17.5 6a15 15 0 0 1 4.5 3M5 12.5a10.5 10.5 0 0 1 3-2M16 10.5a10.5 10.5 0 0 1 3 2M8.5 16a5.5 5.5 0 0 1 3-1.3" /><circle cx="12" cy="19.5" r="1" /><path d="M3 3l18 18" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  down: <path d="M17 7 7 17M7 8v9h9" />,
  up: <path d="M7 17 17 7M8 7h9v9" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  chat: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />,
  db: <><rect x="3" y="4" width="18" height="6" rx="1" /><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M10 14h4" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
};
function Ic({ n, s = 20 }: { n: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flex:"none"}}>{ICONS[n]}</svg>;
}

async function postJson(url: string, token: string | undefined, body: any): Promise<{ ok: boolean; b: any }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    try { return { ok: r.ok, b: await r.json() }; }
    catch { return { ok: false, b: { error: "Server membalas error (" + r.status + "). Kemungkinan file API belum ter-upload atau deployment belum selesai." } }; }
  } catch (e: any) { return { ok: false, b: { error: "Gagal terhubung ke server: " + String(e?.message || e) } }; }
}

export default function Home() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState("beranda");
  const [devQuery, setDevQuery] = useState("");
  const [devFilter, setDevFilter] = useState<"all" | "online" | "offline">("all");
  const [showPair, setShowPair] = useState(false);
  const [walletMenu, setWalletMenu] = useState(false);
  const [txs, setTxs] = useState<any[]>([]);
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [txLimit, setTxLimit] = useState(25);
  const [txQuery, setTxQuery] = useState("");
  const [refTab, setRefTab] = useState<"users" | "history">("users");
  const [pMethod, setPMethod] = useState<"dana" | "seabank">("dana");
  const [pAcc, setPAcc] = useState("");
  const [pName, setPName] = useState("");
  useEffect(() => { if (profile?.payout_method) { setPMethod(profile.payout_method); setPAcc(profile.payout_account || ""); setPName(profile.payout_name || ""); } }, [profile?.payout_method, profile?.payout_account, profile?.payout_name]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 6000); return () => clearTimeout(t); }, []);
  const [useBtn, setUseBtn] = useState(false);
  const [btnLabel, setBtnLabel] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  const [btnNative, setBtnNative] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [me, setMe] = useState<any>(null);
  const [refRateInput, setRefRateInput] = useState("");
  useEffect(() => { const r = new URLSearchParams(window.location.search).get("ref"); if (r) { setRefCode(r.toUpperCase()); setMode("signup"); } }, []);
  const [price, setPrice] = useState("");
  const [dbCount, setDbCount] = useState<any>({ available: 0, used: 0, total: 0 });
  const [contactFilter, setContactFilter] = useState("");
  const [importText, setImportText] = useState("");
  const [importName, setImportName] = useState("");
  const [importConsent, setImportConsent] = useState(false);
  const [minInput, setMinInput] = useState("");
  const [wdMethod, setWdMethod] = useState<"dana"|"seabank">("dana");
  const [wdAcc, setWdAcc] = useState("");
  const [wdName, setWdName] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [myWd, setMyWd] = useState<any[]>([]);
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [template, setTemplate] = useState("");
  const [variables, setVariables] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [slot, setSlot] = useState(1);
  const slotRef = useRef(1);
  slotRef.current = slot;
  const [devices, setDevices] = useState<any[]>([]);
  const [waQr, setWaQr] = useState("");
  const [pairPhone, setPairPhone] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [speed, setSpeed] = useState<"slow"|"medium"|"fast">("slow");

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) { loadDashboard(); loadWaStatus(); const timer = setInterval(() => { loadWaStatus(); loadDashboard(); }, 8000); return () => clearInterval(timer); } }, [session]);
  useEffect(() => { if (!session || !waQr || waStatus?.connected) return; const t = setInterval(async () => { try { const d = await waRequest("/api/baileys/qr"); if (d.qr) setWaQr(d.qr); } catch {} }, 4000); return () => clearInterval(t); }, [session, waQr, waStatus?.connected, slot]);
  useEffect(() => { setWaQr(""); setPairCode(""); setWaStatus(null); if (session) loadWaStatus(); }, [slot]);
  useEffect(() => { if (waStatus?.connected) { setWaQr(""); setPairCode(""); } }, [waStatus?.connected]);

  async function waRequest(path: string, method = "GET", body?: any, slotOverride?: number) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const response = await fetch(path + (path.includes("?") ? "&" : "?") + "slot=" + (slotOverride ?? slotRef.current), { method, headers: { Authorization: `Bearer ${s?.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Permintaan WhatsApp gagal.");
    return data;
  }
  async function loadWaStatus() { try { const dv = await waRequest("/api/baileys/devices"); setDevices(dv.devices || []); } catch {} try { setWaStatus(await waRequest("/api/baileys/status")); } catch (e: any) { setWaStatus({ connected: false, lastError: e.message }); } }
  async function showQr() { setNotice(""); setWaQr(""); try { await waRequest("/api/baileys/connect", "POST", {}); await new Promise(r => setTimeout(r, 2500)); const d = await waRequest("/api/baileys/qr"); setWaQr(d.qr || ""); } catch (e: any) { setNotice(e.message); } await loadWaStatus(); }
  async function getPairingCode() { setNotice(""); setPairCode(""); try { const d = await waRequest("/api/baileys/pairing", "POST", { phone: pairPhone }); setPairCode(d.code || ""); } catch (e: any) { setNotice(e.message); } await loadWaStatus(); }
  async function disconnectWa() { try { const d = await waRequest("/api/baileys/disconnect", "POST", {}); setNotice(d.message || "WhatsApp diputus."); setWaQr(""); setPairCode(""); await loadWaStatus(); } catch (e: any) { setNotice(e.message); } }

  async function loadDashboard() {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(p); setLoaded(true);
    const [{data:c}, {data:ca}, {data:l}] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", {ascending:false}).limit(100),
      supabase.from("campaigns").select("*").order("created_at", {ascending:false}).limit(20),
      supabase.from("message_logs").select("*").order("created_at", {ascending:false}).limit(20)
    ]);
    setContacts(c || []); setCampaigns(ca || []); setLogs(l || []);
    const { data: st } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(); setSettings(st);
    const { data: ru } = await supabase.from("user_runs").select("*").eq("user_id", session.user.id).maybeSingle(); setRun(ru);
    if (p?.role !== "admin") { const { data: wd } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(10); setMyWd(wd || []); const { data: { session: cs } } = await supabase.auth.getSession(); const mr = await fetch("/api/me", { headers: { Authorization: `Bearer ${cs?.access_token}` } }); if (mr.ok) setMe(await mr.json()); const { data: tx } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(300); setTxs(tx || []); }
    if (p?.role === "admin") {
      const { data: { session: cur } } = await supabase.auth.getSession();
      const r = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${cur?.access_token}` } });
      if (r.ok) setOverview(await r.json());
      const cnt = async (f: (q: any) => any) => (await f(supabase.from("contacts").select("id", { count: "exact", head: true }))).count || 0;
      setDbCount({ available: await cnt((q) => q.eq("opted_in", true).is("unsubscribed_at", null).is("used_at", null)), used: await cnt((q) => q.not("used_at", "is", null)), total: await cnt((q) => q) });
    }
  }

  async function auth() {
    setBusy(true); setNotice("");
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name, ref_code: refCode.trim() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setNotice(result.error.message);
    else if (mode === "signup" && !result.data.session) setNotice("Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu login.");
  }

  async function addContact() {
    setNotice("");
    if (!consent) return setNotice("Centang persetujuan pelanggan terlebih dahulu. Jangan masukkan nomor tanpa izin.");
    const { error } = await supabase.from("contacts").insert({
      name: contactName.trim(), phone: phone.replace(/[^\d]/g, ""), opted_in: true,
      consent_source: "admin-entered"
    });
    if (error) setNotice(error.message);
    else { setContactName(""); setPhone(""); setConsent(false); setNotice("Kontak tersimpan."); loadDashboard(); }
  }

  async function createCampaign() {
    setNotice("");
    if (!campaignName.trim() || !template.trim()) return setNotice("Isi nama campaign dan isi pesan promosi.");
    let bLabel: string | null = null, bUrl: string | null = null;
    if (useBtn) {
      bLabel = btnLabel.trim(); bUrl = btnUrl.trim();
      if (!bLabel || bLabel.length > 25) return setNotice("Isi teks tombol (maksimal 25 huruf).");
      if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(bUrl)) return setNotice("Link tombol harus diawali http:// atau https:// dan berupa alamat yang valid.");
    }
    const { data, error } = await supabase.from("campaigns").insert({
      name: campaignName.trim(), template_name: template.trim(), button_label: bLabel, button_url: bUrl, button_native: useBtn && btnNative,
      language_code: "id", body_variables: variables.split("|").map(v => v.trim()).filter(Boolean),
      status: "draft", created_by: session.user.id
    }).select().single();
    if (error) setNotice(error.message);
    else { setCampaignName(""); setTemplate(""); setVariables(""); setUseBtn(false); setBtnLabel(""); setBtnUrl(""); setBtnNative(false); setNotice("Campaign dibuat. Tekan Aktifkan agar dipakai pengguna."); loadDashboard(); }
  }

  async function startCampaign(id: string) {
    setBusy(true); setNotice("");
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch("/api/campaigns/start", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
      body: JSON.stringify({ campaignId: id, speed })
    });
    const body = await res.json().catch(() => ({ error: "Server membalas error (" + res.status + "). Cek apakah deployment terbaru sudah selesai." }));
    setBusy(false); setNotice(body.message || body.error || "Permintaan selesai.");
    loadDashboard();
  }

  async function stopCampaign(id: string) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch("/api/campaigns/stop", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
      body: JSON.stringify({ campaignId: id })
    });
    const body = await res.json().catch(() => ({ error: "Server membalas error (" + res.status + "). Cek apakah deployment terbaru sudah selesai." })); setNotice(body.message || body.error || "Selesai."); loadDashboard();
  }

  async function savePrice() {
    const v = parseInt(price, 10);
    if (isNaN(v) || v < 0) return setNotice("Isi tarif dengan angka (Rp).");
    const { data: upd, error } = await supabase.from("app_settings").update({ price_per_message: v }).eq("id", 1).select();
    setNotice(error ? error.message : !upd?.length ? "Gagal menyimpan tarif: pastikan kamu login sebagai admin dan SQL sudah dijalankan." : "Tarif per pesan disimpan: " + rp(v) + " per pesan sukses."); setPrice(""); loadDashboard();
  }
  async function saveRefRate() {
    const v = parseInt(refRateInput, 10);
    if (isNaN(v) || v < 0) return setNotice("Isi komisi referral dengan angka (Rp).");
    const { data: upd, error } = await supabase.from("app_settings").update({ referral_rate: v }).eq("id", 1).select();
    setNotice(error ? error.message : !upd?.length ? "Gagal menyimpan: pastikan kamu login sebagai admin dan schema_update7 sudah dijalankan." : "Komisi referral disimpan: " + rp(v) + "."); setRefRateInput(""); loadDashboard();
  }
  async function copyRef() {
    try { await navigator.clipboard.writeText(refLink); setNotice("Link undangan disalin."); } catch { setNotice("Salin manual: " + refLink); }
  }
  async function saveMin() {
    const v = parseInt(minInput, 10);
    if (isNaN(v) || v < 0) return setNotice("Isi minimal penarikan dengan angka (Rp).");
    const { data: upd, error } = await supabase.from("app_settings").update({ min_withdraw: v }).eq("id", 1).select();
    setNotice(error ? error.message : !upd?.length ? "Gagal menyimpan: pastikan kamu login sebagai admin." : "Minimal penarikan disimpan: " + rp(v) + "."); setMinInput(""); loadDashboard();
  }
  async function submitWithdraw() {
    const { data: { session: cur } } = await supabase.auth.getSession();
    setBusy(true);
    const { ok: rok, b } = await postJson("/api/withdraw", cur?.access_token, { amount: Number(wdAmount) }); const r = { ok: rok }; setBusy(false); setNotice(b.message || b.error || "Selesai.");
    if (r.ok) setWdAmount(""); loadDashboard();
  }
  async function processWd(id: string, action: "paid" | "rejected") {
    const note = action === "rejected" ? (window.prompt("Alasan penolakan (boleh kosong):") || "") : "";
    const { data: { session: cur } } = await supabase.auth.getSession();
    const { ok: rok, b } = await postJson("/api/admin/withdrawals", cur?.access_token, { id, action, note }); const r = { ok: rok }; setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  const wdLabel: Record<string, string> = { pending: "Menunggu", paid: "Dibayar", rejected: "Ditolak" };
  async function campaignAction(body: any, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const { data: { session: cur } } = await supabase.auth.getSession();
    const { ok: rok, b } = await postJson("/api/admin/campaigns", cur?.access_token, body); const r = { ok: rok }; setBusy(false); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function contactAction(body: any, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const { data: { session: cur } } = await supabase.auth.getSession();
    const { ok: rok, b } = await postJson("/api/admin/contacts", cur?.access_token, body); const r = { ok: rok }; setBusy(false); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function importTxt() {
    if (!importText) return setNotice("Pilih file .txt dulu.");
    if (!importConsent) return setNotice("Centang konfirmasi persetujuan (opt-in) dulu.");
    setBusy(true);
    const { data: { session: cur } } = await supabase.auth.getSession();
    const { ok: rok, b } = await postJson("/api/admin/import", cur?.access_token, { text: importText }); const r = { ok: rok }; setBusy(false);
    setNotice(r.ok ? `Terbaca ${b.total} nomor: ${b.inserted} baru ditambahkan, ${b.existing} sudah ada di database, ${b.dupInFile} dobel di file, ${b.invalid} tidak valid.` : (b.error || "Gagal impor."));
    if (r.ok) { setImportText(""); setImportName(""); } loadDashboard();
  }
  async function payout(uid: string) {
    const { data: { session: cur } } = await supabase.auth.getSession();
    const { ok: rok, b } = await postJson("/api/admin/payout", cur?.access_token, { userId: uid }); const r = { ok: rok }; setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function sendNow() {
    setBusy(true);
    try { const d = await waRequest("/api/campaigns/tick", "POST", {}); setNotice(d.message); } catch (e: any) { setNotice(e.message); }
    setBusy(false); loadDashboard();
  }
  async function setLimit(uid: string, v: string) {
    const { data: { session: cur } } = await supabase.auth.getSession();
    const { ok: rok, b } = await postJson("/api/admin/limit", cur?.access_token, { userId: uid, maxDevices: Number(v) }); const r = { ok: rok }; setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function disconnectSlot(n: number) {
    if (!window.confirm("Putuskan Perangkat " + n + "?")) return;
    try { const d = await waRequest("/api/baileys/disconnect", "POST", {}, n); setNotice(d.message || "Perangkat diputus."); setWaQr(""); setPairCode(""); await loadWaStatus(); } catch (e: any) { setNotice(e.message); }
  }
  function pickSlot() {
    const max = profile?.max_devices ?? 3; let n = slot;
    for (let i = 1; i <= max; i++) { const d = devices.find((x: any) => x.slot === i); if (!d || !d.registered) { n = i; break; } }
    slotRef.current = n; setSlot(n); return n;
  }
  async function startScan() { setShowPair(false); setPairCode(""); const n = pickSlot(); setNotice("Memproses Perangkat " + n + "…"); await showQr(); }
  function startPair() { setWaQr(""); setPairCode(""); pickSlot(); setShowPair(true); }
  async function saveProfilePayout() {
    const { data: { session: cur } } = await supabase.auth.getSession(); setBusy(true);
    const { ok: rok, b } = await postJson("/api/profile", cur?.access_token, { method: pMethod, account: pAcc, name: pName }); const r = { ok: rok }; setBusy(false); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function shareRef() {
    try { if (navigator.share) await navigator.share({ title: "setanwawa", text: "Daftar di setanwawa pakai kode referral " + (me?.referral?.code || ""), url: refLink }); else await copyRef(); } catch {}
  }
  async function signOut() { await supabase.auth.signOut(); setProfile(null); setLoaded(false); }

  if (!session) return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand-mark">SW</div><p className="eyebrow">TOKO ONLINE • PROMOTION DESK</p>
      <h1>setanwawa</h1><p className="muted">Kelola pelanggan dan campaign toko dari satu dashboard.</p>
      {mode === "signup" && <label>Nama toko / nama kamu<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama" /></label>}
      {mode === "signup" && <label>Kode referral (opsional)<input value={refCode} onChange={e=>setRefCode(e.target.value.toUpperCase())} placeholder="Contoh A1B2C3D4" /></label>}
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@contoh.com" /></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter" /></label>
      <button className="primary full" disabled={busy} onClick={auth}>{busy ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar akun"}</button>
      <p className="switch">{mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <button onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Daftar":"Login"}</button></p>
      {notice && <p className="notice">{notice}</p>}
      <p className="tiny">Gunakan hanya untuk pelanggan yang sudah setuju menerima pesan promosi.</p>
    </section>
  </main>;

  const active = contacts.filter(c=>c.opted_in && !c.unsubscribed_at).length;
  const isAdmin = profile?.role === "admin";
  const current = campaigns.find((c) => c.id === settings?.active_campaign_id) || campaigns[0];
  const running = run?.status === "running";
  const doneThis = false;
  const statusLabel = isAdmin && !current ? "Belum ada" : running ? "● Berjalan" : doneThis ? "Selesai" : run?.status === "stopped" ? "Dihentikan" : "Siap";
  const rp = (n: number) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const onlineN = devices.filter((d: any) => d.connected).length;
  const offlineN = devices.filter((d: any) => d.registered && !d.connected).length;
  const balanceN = profile?.balance ?? 0;
  const earnedN = profile?.earned ?? 0;
  const successN = profile?.success_count ?? 0;

  if (!loaded) return <main className="dashboard"><section className="panel"><p className="muted">Memuat dashboard…</p></section></main>;
  const pendingWd = (overview?.withdrawals || []).filter((w: any) => w.status === "pending").length;
  const tabs: { id: string; label: string; icon: string; badge?: number }[] = isAdmin
    ? [{ id: "beranda", label: "Beranda", icon: "home" }, { id: "perangkat", label: "Perangkat", icon: "phone" }, { id: "database", label: "Database", icon: "db" }, { id: "campaign", label: "Campaign", icon: "send" }, { id: "pengguna", label: "Pengguna", icon: "users" }, { id: "penarikan", label: "Penarikan", icon: "wallet", badge: pendingWd }, { id: "riwayat", label: "Riwayat", icon: "receipt" }]
    : [{ id: "beranda", label: "Dashboard", icon: "home" }, { id: "perangkat", label: "Devices", icon: "phone" }, { id: "wallet", label: "Wallets", icon: "wallet" }, { id: "referral", label: "Referrals", icon: "users" }, { id: "profil", label: "Profile", icon: "user" }];
  const maxD = profile?.max_devices ?? 3;
  const linkedN = devices.filter((d: any) => d.registered || d.connected).length;
  const devId = (n: number) => "dev_" + String(profile?.id || "").replace(/-/g, "").slice(0, 6) + n;
  const devCards = Array.from({ length: maxD }, (_, i) => i + 1).map(n => ({ n, d: devices.find((x: any) => x.slot === n), st: me?.devices?.[String(n)] || { sent: 0, delivered: 0, profit: 0 } })).filter(({ n, d }) => {
    const q = devQuery.trim().toLowerCase();
    if (q && !(devId(n).toLowerCase().includes(q) || String(d?.phone || "").includes(q))) return false;
    if (devFilter === "online") return !!d?.connected;
    if (devFilter === "offline") return !!d && !d.connected && !!d.registered;
    return true;
  });
  const txView = txs.filter((t: any) => (txFilter === "all" || t.direction === txFilter) && (!txQuery.trim() || String(t.note || "").toLowerCase().includes(txQuery.trim().toLowerCase()))).slice(0, txLimit);
  const txStatus: Record<string, string> = { success: "Sukses", pending: "Menunggu", rejected: "Ditolak" };
  const heads: Record<string, string[]> = { beranda: ["Dashboard", "Ringkasan akun kamu hari ini"], perangkat: ["Devices", "Kelola perangkat WhatsApp kamu"], wallet: ["Withdraw", "Tarik saldo ke rekening kamu"], riwayat_saldo: ["History Transaksi", "Mutasi saldo akun kamu"], referral: ["Referrals", "Bagikan link dan dapatkan komisi"], profil: ["Profile", "Informasi akunmu"] };
  const refLink = (typeof window !== "undefined" ? window.location.origin : "") + "/?ref=" + (me?.referral?.code || "");
  return <main className={"dashboard" + (!isAdmin ? " has-bottomnav" : "")}>
    <header className="topbar"><div className="brand"><span className="brand-mark small">SW</span><div><b>setanwawa</b><small>Promotion dashboard</small></div></div>
      <div className="user-area"><span>{session.user.email}</span><button className="ghost" onClick={signOut}>Keluar</button></div>
    </header>
    <div className="content">
      {!isAdmin && <div className="pagehead"><div><h1>{heads[tab]?.[0]}</h1><p className="muted">{heads[tab]?.[1]}</p></div>{tab === "perangkat" && <button className="ghost refreshbtn" onClick={() => { loadWaStatus(); loadDashboard(); }}><Ic n="refresh" s={18} /></button>}</div>}
      {isAdmin && <div className="welcome"><div><p className="eyebrow">DASHBOARD {isAdmin ? "ADMIN" : "TOKO"}</p><h1>Halo, {profile?.full_name || "Pemilik Toko"}</h1><p className="muted">Pantau pelanggan dan promosi toko kamu.</p></div><span className="status-pill">● Sistem siap</span></div>}
      {notice && <div className="notice-banner">{notice}</div>}
      {isAdmin && <nav className="tabbar">{tabs.map(t => <button key={t.id} className={tab === t.id ? "tab on" : "tab"} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}><Ic n={t.icon} s={16} /> {t.label}{t.badge ? <span className="badge">{t.badge}</span> : null}</button>)}</nav>}
      {isAdmin && tab === "perangkat" && <section className="panel wa-panel">
        <div className="panel-heading"><div><p className="eyebrow">KONEKSI WHATSAPP • BAILEYS</p><h2>Hubungkan WhatsApp</h2></div><span className={waStatus?.connected ? "tag good" : "tag"}>{waStatus?.connected ? "● Terhubung" : "○ Belum terhubung"}</span></div>
        <p className="muted">Backend berjalan di server Pterodactyl. Hubungkan akun WhatsApp milik toko melalui QR atau pairing code.</p>
        <div className="form-grid"><div><button className="primary" onClick={showQr} disabled={!!waStatus?.connected}>Tampilkan QR Code</button>{waQr && <div className="qr-box"><img src={waQr} alt="QR WhatsApp untuk ditautkan" /><small>WhatsApp → Perangkat tertaut → Tautkan perangkat</small></div>}</div>
          <div><label>Nomor WhatsApp<input value={pairPhone} onChange={e=>setPairPhone(e.target.value)} placeholder="62812xxxxxxx" /></label><button className="primary" onClick={getPairingCode} disabled={!!waStatus?.connected}>Buat Pairing Code</button>{pairCode && <div className="pair-code">{pairCode}</div>}</div></div>
        <div style={{display:"flex",gap:8,margin:"8px 0",flexWrap:"wrap"}}>{Array.from({ length: profile?.max_devices ?? 3 }, (_, i) => i + 1).map(n => { const d = devices.find((x: any) => x.slot === n); return <button key={n} className={slot === n ? "primary compact" : "ghost"} onClick={() => setSlot(n)}><span className={"dot " + (d?.connected ? "ok" : "off")} /> Perangkat {n}</button>; })}</div>
        <p className="tiny">Kamu bisa menautkan sampai {profile?.max_devices ?? 3} perangkat. Perangkat hanya milik akunmu dan tidak tercampur dengan akun lain.</p>
        {waStatus?.phone && <p className="tiny">Nomor terhubung: {waStatus.phone}</p>}{waStatus?.lastError && <p className="tiny">Info: {waStatus.lastError}</p>}
        {waStatus?.connected && <button className="danger" onClick={disconnectWa}>Putuskan WhatsApp</button>}
      </section>}

      

      {!isAdmin && tab === "beranda" && <div className="infocard"><b className="ihead"><Ic n="info" s={16} /> Komisi per pesan</b><p>Kamu mendapatkan <b>{rp(settings?.price_per_message || 0)}</b> untuk setiap pesan yang berhasil terkirim melalui device kamu. Pesan gagal tidak dihitung. Undang teman dan dapat <b>{rp(settings?.referral_rate || 0)}</b> per pesan sukses mereka.</p></div>}
      {tab === "beranda" && <section className="tiles">
        <div className="tile-row">
          <article className="tile"><div><small>ONLINE</small><strong>{onlineN}</strong></div><span className="ico ok"><Ic n="wifi" /></span></article>
          <article className="tile"><div><small>OFFLINE</small><strong>{offlineN}</strong></div><span className="ico bad"><Ic n="wifioff" /></span></article>
        </div>
        {!isAdmin && <article className="tile"><div><small>SISA DATABASE</small><strong>{me?.dbAvailable ?? 0}</strong><small className="tiny">total database ready</small></div><span className="ico info"><Ic n="db" /></span></article>}
        <article className="tile big">
          <div className="tile-top"><div><small>BALANCE</small><strong className="huge">{rp(balanceN)}</strong></div><span className="ico safe"><Ic n="wallet" /></span></div>
          <div className="tile-sub">
            <div className="sub"><div><small>Pendapatan</small><strong>{rp(earnedN)}</strong></div><span className="ico warn"><Ic n="cash" /></span></div>
            <div className="sub"><div><small>Pesan Sukses</small><strong>{successN}</strong></div><span className="ico info"><Ic n="chat" /></span></div>
          </div>
          <p className="tiny">Tarif {rp(settings?.price_per_message || 0)} per pesan sukses. Pesan gagal tidak dihitung.</p>
        </article>
      </section>}

      {!isAdmin && tab === "beranda" && <>
        <div className="warncard"><b className="ihead"><Ic n="alert" s={16} /> Peringatan</b><p>Jangan menghapus pesan yang sudah terkirim dan jangan mengeluarkan perangkat dari WhatsApp saat pengiriman berjalan, agar akunmu tidak dibatasi.</p></div>
        <section className="panel">
          <div className="panel-heading"><div><h2>Hari Ini</h2></div><span className="tag">Realtime</span></div>
          <div className="todayrow"><span className="dot blue" /><div><b>WA Aktif</b><small>Jumlah device terhubung</small></div><div className="r"><b>{onlineN}</b><small>Connected</small></div></div>
          <div className="todayrow"><span className="dot grey" /><div><b>WA Disconnect</b><small>Perlu reconnect/scan</small></div><div className="r"><b>{offlineN}</b><small>Offline</small></div></div>
          <div className="todayrow"><span className="dot blue" /><div><b>Pesan Sukses</b><small>Terkirim hari ini</small></div><div className="r"><b>{me?.today?.sent ?? 0}</b><small>Delivered</small></div></div>
          <div className="todayrow"><span className="dot orange" /><div><b>Pendapatan</b><small>Komisi hari ini</small></div><div className="r"><b>{rp(me?.today?.earned ?? 0)}</b><small>Today</small></div></div>
        </section>
      </>}

      {tab === "beranda" && <section className="panel run-panel" id="run">
        <div className="panel-heading"><div><p className="eyebrow">KIRIM PROMOSI</p><h2>Jalankan promosi</h2></div><span className="tag">{statusLabel}</span></div>
        {isAdmin ? (current ? <p className="muted"><b>{current.name}</b><br />{current.template_name}</p> : <p className="muted">Belum ada campaign. Buat dulu di bawah.</p>) : <p className="muted">Isi pesan diatur oleh admin. Pilih kecepatan lalu tekan Mulai.</p>}
        <p className="tiny"><b>Kecepatan kirim</b></p>
        <div style={{display:"flex",gap:8,margin:"8px 0"}}>{(["slow","medium","fast"] as const).map(m=><button key={m} className={speed===m?"primary compact":"ghost"} onClick={()=>setSpeed(m)} disabled={running}>{m==="slow"?"Slow":m==="medium"?"Medium":"Fast"}</button>)}</div>
        <p className="tiny">Slow: aman, sekitar 2 pesan/menit. Medium: sekitar 5 pesan/menit. Fast: sekitar 8 pesan/menit (risiko akun dibatasi WhatsApp lebih tinggi).</p>
        {running ? <button className="danger" onClick={()=>stopCampaign("")}>Hentikan</button> : <button className="primary" disabled={busy || (isAdmin && !current) || !devices.some((d: any) => d.connected)} onClick={()=>startCampaign(current?.id || "")}>▶ Mulai</button>}
        {!devices.some((d: any) => d.connected) && <p className="tiny">Hubungkan minimal 1 perangkat WhatsApp dulu untuk memulai.</p>}
        {running && <button className="ghost" disabled={busy} onClick={sendNow}>Kirim sekarang (tes)</button>}
        <p className="tiny">Kecepatan dihitung per perangkat: makin banyak perangkat online, makin banyak pesan per menit.</p>
      </section>}

      {!isAdmin && tab === "beranda" && <div className="botcard" onClick={() => setTab("perangkat")}><span className="boticon"><Ic n="phone" s={20} /></span><div><small>TAMBAH PERANGKAT</small><b>Kelola WhatsApp</b></div><span>›</span></div>}
      {!isAdmin && <button className="fab" aria-label="Mulai kirim" onClick={() => { setTab("beranda"); setWalletMenu(false); setTimeout(() => document.getElementById("run")?.scrollIntoView({ behavior: "smooth" }), 120); }}><Ic n="send" s={20} /></button>}

      {!isAdmin && tab === "perangkat" && <>
        <div className="statrow3">
          <article className="tile"><div><small>TOTAL</small><strong>{linkedN}</strong></div><span className="ico info"><Ic n="monitor" s={18} /></span></article>
          <article className="tile"><div><small>ONLINE</small><strong>{onlineN}</strong></div><span className="ico ok"><Ic n="wifi" s={18} /></span></article>
          <article className="tile"><div><small>OFFLINE</small><strong>{offlineN}</strong></div><span className="ico bad"><Ic n="wifioff" s={18} /></span></article>
        </div>
        <div className="btnrow"><button className="primary bigbtn" onClick={startScan}><Ic n="scan" s={18} /> Scan QR</button><button className="outline bigbtn" onClick={startPair}><Ic n="link" s={18} /> Pairing Code</button></div>
        {waQr && <div className="qr-box"><img src={waQr} alt="QR WhatsApp" /><small>Menautkan Perangkat {slot}. WhatsApp → Perangkat tertaut → Tautkan perangkat.</small></div>}
        {showPair && <section className="panel"><p className="tiny"><b>Pairing Code · Perangkat {slot}</b></p><input value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} placeholder="Nomor WhatsApp, contoh 62812xxxxxxx" inputMode="numeric" /><button className="primary" onClick={getPairingCode}>Buat Pairing Code</button>{pairCode && <div className="pair-code">{pairCode}</div>}</section>}
        <input className="searchbox" value={devQuery} onChange={(e) => setDevQuery(e.target.value)} placeholder="Cari Device ID / nomor WhatsApp..." />
        <div className="chips">{([["all", "Semua"], ["online", "Online"], ["offline", "Offline"]] as const).map(([k, l]) => <button key={k} className={"chip" + (devFilter === k ? " on" : "")} onClick={() => setDevFilter(k)}>{l}</button>)}</div>
        {devCards.map(({ n, d, st }) => <div key={n} className="devcard">
          <div className="devrow"><span className="dl">DEVICE</span><b>{devId(n)}</b><span className={"pill " + (d?.connected ? "ok" : "bad")}>● {d?.connected ? "CONNECTED" : d?.registered ? "DISCONNECTED" : "KOSONG"}</span></div>
          <div className="devrow"><span className="dl">No. WA</span><b>{d?.phone ? "+" + d.phone : "-"}</b></div>
          <div className="devstats"><div><small>Sent:</small> <b>{st.sent}</b></div><div className="green"><small>Delivered:</small> <b>{st.delivered}</b></div><div><small>Profit:</small> <b>{rp(st.profit)}</b></div></div>
          <div className="devrow"><span className="dl">MODE</span><select className="modesel" value={speed} disabled={running} onChange={(e) => setSpeed(e.target.value as any)}><option value="slow">Slow (±2 pesan/menit)</option><option value="medium">Medium (±5 pesan/menit)</option><option value="fast">Fast (±8 pesan/menit)</option></select>{(d?.registered || d?.connected) ? <button className="logoutbtn" aria-label="Putuskan" onClick={() => disconnectSlot(n)}><Ic n="logout" s={18} /></button> : <button className="logoutbtn" aria-label="Tautkan" onClick={startScan}><Ic n="plus" s={18} /></button>}</div>
        </div>)}
        <p className="tiny">Maksimal {maxD} perangkat per akun. Perangkat hanya milik akunmu. Mode kecepatan berlaku untuk semua perangkatmu.</p>
      </>}

      {!isAdmin && tab === "wallet" && <>
        <div className="balcard"><small>Saldo Tersedia</small><strong>{rp(profile?.balance ?? 0)}</strong></div>
        <section className="panel"><h3 className="sh">Metode Penarikan</h3>
          <div className="methodbox"><div>Metode: <b>{profile?.payout_method === "seabank" ? "Bank" : "Wallet"}</b></div><div>Provider: <b>{profile?.payout_method ? (profile.payout_method === "dana" ? "DANA" : "SEABANK") : "-"}</b></div><div>No. Rekening: <b>{profile?.payout_account || "-"}</b></div><div>Atas Nama: <b>{profile?.payout_name || "-"}</b></div></div>
          <p className="tiny">Ubah metode penarikan di halaman Profile. {!profile?.payout_account && <button className="linkbtn" onClick={() => setTab("profil")}>Atur sekarang</button>}</p>
        </section>
        <section className="panel"><h3 className="sh">Jumlah Penarikan <small className="muted">Min. {rp(settings?.min_withdraw ?? 0)}</small></h3>
          <input value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} placeholder={"Minimum " + rp(settings?.min_withdraw ?? 0)} inputMode="numeric" />
          <div className="amountchips">{[5000, 10000, 25000, 50000, 100000].map(v => <button key={v} className="chip" onClick={() => setWdAmount(String(v))}>{rp(v)}</button>)}<button className="chip on" onClick={() => setWdAmount(String(profile?.balance ?? 0))}>Semua</button></div>
          <button className="primary wide" disabled={busy || !profile?.payout_account || Number(wdAmount) < (settings?.min_withdraw ?? 0) || Number(wdAmount) > (profile?.balance ?? 0)} onClick={submitWithdraw}>Tarik Saldo</button>
        </section>
        <section className="panel"><h3 className="sh">Riwayat Penarikan</h3>
          {myWd.length ? myWd.map((w: any) => <div className="todayrow" key={w.id}><div><b>{rp(w.amount)}</b><small>{new Date(w.created_at).toLocaleDateString("id-ID")} · {w.method === "dana" ? "DANA" : "SeaBank"}{w.note ? " · " + w.note : ""}</small></div><div className="r"><small>{wdLabel[w.status]}</small></div></div>) : <p className="muted center">Belum ada penarikan</p>}
        </section>
      </>}

      {!isAdmin && tab === "riwayat_saldo" && <>
        <div className="chips">{([["all", "Semua"], ["credit", <><Ic n="down" s={14} /> Masuk</>], ["debit", <><Ic n="up" s={14} /> Keluar</>]] as const).map(([k, l]) => <button key={k} className={"chip" + (txFilter === k ? " on" : "")} onClick={() => setTxFilter(k)}>{l}</button>)}</div>
        <section className="panel">
          <div className="txbar"><span>Tampil</span><select value={txLimit} onChange={(e) => setTxLimit(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select><span>Cari:</span><input value={txQuery} onChange={(e) => setTxQuery(e.target.value)} /></div>
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>Catatan</th><th>Credit</th><th>Debit</th><th>Status</th></tr></thead><tbody>
            {txView.map((t: any) => <tr key={t.id}><td>{String(t.id).slice(0, 6)}</td><td>{t.note}<br /><small>{new Date(t.created_at).toLocaleString("id-ID")}</small></td><td className="gr">{t.direction === "credit" ? rp(t.amount) : "-"}</td><td className="rd">{t.direction === "debit" ? rp(t.amount) : "-"}</td><td>{txStatus[t.status] || t.status}</td></tr>)}
            {!txView.length && <tr><td colSpan={5} className="empty">No data available in table</td></tr>}
          </tbody></table></div>
        </section>
      </>}

      {!isAdmin && tab === "referral" && <>
        <div className="infocard"><b className="ihead"><Ic n="info" s={16} /> Referral</b><p>Anda mendapatkan <b>{rp(settings?.referral_rate || 0)}</b> untuk setiap pesan yang dikirim oleh user referral Anda.</p></div>
        <section className="panel"><small className="lbl">KODE REFERRAL</small><div className="bigcode">{me?.referral?.code || "..."}</div>
          <div className="btnrow"><button className="primary" onClick={copyRef}><Ic n="copy" s={16} /> Copy</button><button className="outline" onClick={shareRef}><Ic n="share" s={16} /> Share</button></div>
          <div className="linkbox">{refLink}</div>
        </section>
        <section className="panel"><small className="lbl">TOTAL PENDAPATAN REFERRAL</small><div className="bigcode">{rp(me?.referral?.earned ?? 0)}</div>
          <div className="tile-sub"><div className="sub"><div><small>Total Referred</small><strong>{me?.referral?.count ?? 0}</strong></div></div><div className="sub"><div><small>Pendapatan Hari Ini</small><strong>{rp(me?.referral?.today ?? 0)}</strong></div></div></div>
        </section>
        <div className="chips">{([["users", "Pengguna"], ["history", "Riwayat"]] as const).map(([k, l]) => <button key={k} className={"chip" + (refTab === k ? " on" : "")} onClick={() => setRefTab(k)}>{l}</button>)}</div>
        <section className="panel"><h3 className="sh">{refTab === "users" ? "Pengguna dari Referral" : "Riwayat Komisi Referral"}</h3>
          {refTab === "users" ? ((me?.referral?.invited || []).length ? (me.referral.invited as any[]).map((u: any, i: number) => <div className="todayrow" key={i}><div><b>{u.name}</b></div><div className="r"><small>{u.success_count} pesan sukses</small></div></div>) : <p className="muted">Belum ada yang mendaftar dengan kode Anda.</p>)
            : (txs.filter((t: any) => t.kind === "referral").length ? txs.filter((t: any) => t.kind === "referral").slice(0, 50).map((t: any) => <div className="todayrow" key={t.id}><div><b>{rp(t.amount)}</b><small>{new Date(t.created_at).toLocaleString("id-ID")}</small></div><div className="r"><small>{t.note}</small></div></div>) : <p className="muted">Belum ada komisi referral.</p>)}
        </section>
      </>}

      {!isAdmin && tab === "profil" && <>
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">AKUN</p><h2>{profile?.full_name || "Pengguna"}</h2></div></div>
          <p className="muted">{session.user.email}</p>
          <p className="tiny">Peran: Pengguna · Kode referral: <b>{me?.referral?.code || "-"}</b></p>
          <p className="tiny">Tarif {rp(settings?.price_per_message || 0)} per pesan sukses · Komisi referral {rp(settings?.referral_rate || 0)} per pesan sukses pengguna undangan.</p>
        </section>
        <section className="panel"><h3 className="sh">Metode Penarikan</h3>
          <div style={{display:"flex",gap:8,margin:"8px 0"}}>{(["dana", "seabank"] as const).map(m => <button key={m} className={pMethod === m ? "primary compact" : "ghost"} onClick={() => setPMethod(m)}>{m === "dana" ? "DANA" : "SeaBank"}</button>)}</div>
          <input value={pAcc} onChange={(e) => setPAcc(e.target.value)} placeholder={pMethod === "dana" ? "Nomor DANA, contoh 0812xxxx" : "Nomor rekening SeaBank"} inputMode="numeric" />
          <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Atas nama" />
          <button className="primary wide" disabled={busy} onClick={saveProfilePayout}>Simpan metode penarikan</button>
        </section>
        <button className="danger wide" onClick={signOut}>Keluar</button>
      </>}

      {isAdmin && tab === "pengguna" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">PENGATURAN ADMIN</p><h2>Tarif &amp; pengguna</h2></div></div>
        <div className="tile-sub" style={{borderTop:"none",marginTop:0,paddingTop:0}}>
          <div className="sub"><div><small>Total saldo semua pengguna</small><strong>{rp(overview?.balanceTotal ?? 0)}</strong></div></div>
          <div className="sub"><div><small>Perangkat online / offline</small><strong>{overview?.online ?? 0} / {overview?.offline ?? 0}</strong></div></div>
          <div className="sub"><div><small>Total pendapatan pengguna</small><strong>{rp(overview?.earnedTotal ?? 0)}</strong></div></div>
          <div className="sub"><div><small>Total pesan sukses</small><strong>{overview?.successTotal ?? 0}</strong></div></div>
        </div>
        <p className="tiny">Tarif saat ini: {rp(settings?.price_per_message || 0)} per pesan sukses.</p>
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Tarif baru, contoh 50" inputMode="numeric" />
        <button className="primary" onClick={savePrice}>Simpan tarif</button>
        <p className="tiny">Minimal penarikan saat ini: {rp(settings?.min_withdraw ?? 0)}.</p>
        <input value={minInput} onChange={(e) => setMinInput(e.target.value)} placeholder="Minimal penarikan baru, contoh 10000" inputMode="numeric" />
        <button className="primary" onClick={saveMin}>Simpan minimal penarikan</button>
        <p className="tiny">Komisi referral saat ini: {rp(settings?.referral_rate ?? 0)} per pesan sukses pengguna undangan.</p>
        <input value={refRateInput} onChange={(e) => setRefRateInput(e.target.value)} placeholder="Komisi referral baru per pesan, contoh 100" inputMode="numeric" />
        <button className="primary" onClick={saveRefRate}>Simpan komisi referral</button>
        <div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Perangkat</th><th>Maks</th><th>Saldo</th><th></th></tr></thead><tbody>
          {(overview?.users || []).map((u: any) => <tr key={u.id}><td>{u.name || u.email}<br /><small>{u.email}</small></td><td><span className="dot ok" /> {u.on} <span className="dot off" /> {u.linked - u.on}</td><td><input type="number" min={1} max={9} defaultValue={u.max_devices} onBlur={(e) => Number(e.target.value) !== u.max_devices && setLimit(u.id, e.target.value)} style={{width:64}} /></td><td>{rp(u.balance)}<br /><small>{u.success_count} pesan</small></td><td><button className="ghost" onClick={() => payout(u.id)} disabled={!u.balance}>Reset saldo</button></td></tr>)}
        </tbody></table></div>
      </section>}

      {isAdmin && tab === "penarikan" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">PERMINTAAN PENARIKAN</p><h2>{(overview?.withdrawals || []).filter((w: any) => w.status === "pending").length} menunggu</h2></div></div>
        <div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Tujuan</th><th>Jumlah</th><th>Status</th><th></th></tr></thead><tbody>
          {(overview?.withdrawals || []).map((w: any) => <tr key={w.id}><td>{w.name || w.email}<br /><small>{new Date(w.created_at).toLocaleString("id-ID")}</small></td><td>{w.method === "dana" ? "Dana" : "SeaBank"}<br />{w.account_number}<br /><small>{w.account_name}</small></td><td>{rp(w.amount)}</td><td>{wdLabel[w.status]}</td><td>{w.status === "pending" && <><button className="primary compact" onClick={() => processWd(w.id, "paid")}>Sudah dibayar</button> <button className="ghost" onClick={() => processWd(w.id, "rejected")}>Tolak</button></>}</td></tr>)}
        </tbody></table></div>
      </section>}

      {isAdmin && (tab === "database" || tab === "campaign") && <div className="grid">
        {tab === "database" && <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">DATABASE PELANGGAN</p><h2>Upload &amp; tambah nomor</h2></div><span className="tag">Opt-in wajib</span></div>
          <div style={{border:"2px dashed #94a3b8",borderRadius:16,padding:14,margin:"12px 0"}}>
            <p className="muted"><b>{dbCount.available}</b> nomor tersedia · Terpakai {dbCount.used} · Total {dbCount.total}</p>
            <p className="tiny"><b className="ihead"><Ic n="db" s={16} /> Upload database dari file .txt</b> (satu nomor per baris, contoh 628123455577). Nomor yang sudah dipakai satu akun tidak muncul lagi di akun lain.</p>
            <input type="file" accept=".txt,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setImportName(f.name); setImportText(await f.text()); }} />
            {importName && <p className="tiny">File dipilih: {importName}</p>}
            <label className="tiny"><input type="checkbox" checked={importConsent} onChange={(e) => setImportConsent(e.target.checked)} /> Saya mengonfirmasi nomor-nomor ini sudah menyetujui menerima pesan (opt-in).</label>
            <button className="primary" disabled={busy || !importText} onClick={importTxt}>Impor nomor dari file</button>
            <p className="tiny"><b className="ihead"><Ic n="trash" s={16} /> Hapus database</b></p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="ghost" disabled={busy} onClick={() => contactAction({ action: "deleteUsed" }, "Hapus semua nomor yang sudah terpakai? Tindakan ini tidak bisa dibatalkan.")}>Hapus yang terpakai</button>
              <button className="danger" disabled={busy} onClick={() => contactAction({ action: "deleteAll" }, "HAPUS SEMUA database nomor (" + dbCount.total + " nomor)? Tindakan ini tidak bisa dibatalkan.")}>Hapus SEMUA nomor</button>
            </div>
          </div>
          <div className="form-grid"><label>Nama pelanggan<input value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="Nama pelanggan" /></label><label>Nomor WhatsApp<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="62812xxxxxxx" /></label></div>
          <label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /> Pelanggan telah memberi izin menerima promosi WhatsApp.</label>
          <button className="primary" onClick={addContact}>+ Simpan nomor</button>
          <p className="tiny">Masukkan format internasional, contoh 62812xxxxxxx. Jangan mengimpor nomor hasil scraping atau nomor tanpa izin.</p>
          <input value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} placeholder="Cari nomor atau nama (dari 100 terbaru)" />
          <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Nomor</th><th>Status</th><th></th></tr></thead><tbody>
            {contacts.filter(c => { const q = contactFilter.trim().toLowerCase(); return !q || c.phone.includes(q) || (c.name || "").toLowerCase().includes(q); }).slice(0,20).map(c=><tr key={c.id}><td>{c.name}</td><td>{c.phone}</td><td><span className={c.opted_in&&!c.unsubscribed_at?"good":"muted"}>{c.used_at?"Terpakai":c.opted_in&&!c.unsubscribed_at?"Setuju":"Tidak aktif"}</span></td><td><button className="ghost" disabled={busy} onClick={() => contactAction({ action: "delete", id: c.id }, "Hapus nomor " + c.phone + "?")}>Hapus</button></td></tr>)}
            {!contacts.length && <tr><td colSpan={4} className="empty">Belum ada pelanggan.</td></tr>}
          </tbody></table></div>
        </section>}

        {tab === "campaign" && <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">PROMOSI OTOMATIS</p><h2>Buat campaign</h2></div><span className="tag">Baileys</span></div>
          <label>Nama campaign<input value={campaignName} onChange={e=>setCampaignName(e.target.value)} placeholder="Promo akhir pekan" /></label>
          <label>Isi pesan promosi<textarea rows={4} value={template} onChange={e=>setTemplate(e.target.value)} placeholder="Halo, ada promo baru di toko kami! Balas STOP untuk berhenti." /></label>
          <label className="tiny"><input type="checkbox" checked={useBtn} onChange={(e) => setUseBtn(e.target.checked)} /> Tambahkan tombol (teks + tombol link)</label>
          {useBtn && <>
            <label>Teks tombol<input value={btnLabel} onChange={(e) => setBtnLabel(e.target.value)} placeholder="Contoh: Lihat promo" maxLength={25} /></label>
            <label>Link tombol<input value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="https://contoh.com/promo" inputMode="url" /></label>
            <label className="tiny"><input type="checkbox" checked={btnNative} onChange={(e) => setBtnNative(e.target.checked)} /> Pakai tombol asli WhatsApp (eksperimental)</label>
            <p className="tiny">Kalau gagal tampil di HP penerima, pesan otomatis dikirim sebagai teks + link. Uji dulu ke nomormu sendiri. Ada risiko akun dibatasi WhatsApp.</p>
          </>}
          {template.trim() && <div className="wa-preview"><p className="tiny">Pratinjau pesan</p><div className="bubble">{template}</div>{useBtn && btnLabel.trim() && <div className="wabtn"><Ic n="link" s={14} /> {btnLabel}</div>}</div>}
          <label>Catatan internal (opsional)<input value={variables} onChange={e=>setVariables(e.target.value)} placeholder="Contoh: Promo akhir pekan" /></label>
          <p className="tiny">Kirim hanya kepada pelanggan yang secara jelas menyetujui promosi. Pastikan pesan memuat cara berhenti, misalnya balas STOP. Pengiriman dijalankan bertahap.</p>
          <button className="primary" onClick={createCampaign}>+ Buat campaign</button>
          <p className="tiny">Campaign yang berstatus AKTIF dipakai semua pengguna saat menekan Mulai.</p><div className="campaign-list">{campaigns.map(c=><div className="campaign" key={c.id}><div><b>{c.name}</b><small>{c.template_name}{c.button_url ? " · tombol" + (c.button_native ? " asli" : "") + ": " + (c.button_label || "link") : ""}</small></div><div className="actions">{settings?.active_campaign_id === c.id ? <span className="pill ok">AKTIF</span> : <button className="primary compact" disabled={busy} onClick={() => campaignAction({ action: "activate", id: c.id })}>Aktifkan</button>}<button className="ghost" disabled={busy} onClick={() => campaignAction({ action: "delete", id: c.id }, "Hapus campaign " + c.name + "?")}>Hapus</button></div></div>)}
            {!campaigns.length && <p className="empty">Belum ada campaign.</p>}</div>
          {campaigns.length > 1 && <button className="ghost wide" disabled={busy} onClick={() => campaignAction({ action: "deleteInactive" }, "Hapus semua campaign selain yang aktif? Tindakan ini tidak bisa dibatalkan.")}>Hapus campaign lama</button>}
        </section>}
      </div>}

      {isAdmin && tab === "riwayat" && <section className="panel log-panel"><div className="panel-heading"><div><p className="eyebrow">AKTIVITAS TERBARU</p><h2>Riwayat pengiriman</h2></div><button className="ghost" onClick={loadDashboard}>Muat ulang</button></div>
        <div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Status</th><th>Imbalan</th><th>Detail</th><th>Waktu</th></tr></thead><tbody>
          {logs.map(l=><tr key={l.id}><td>{l.phone}</td><td>{l.status}</td><td>{l.status === "sent" ? rp(l.reward || 0) : "—"}</td><td>{l.error || "—"}</td><td>{new Date(l.created_at).toLocaleString("id-ID")}</td></tr>)}
          {!logs.length && <tr><td colSpan={4} className="empty">Belum ada riwayat pengiriman.</td></tr>}
        </tbody></table></div>
      </section>}
      {isAdmin && tab === "beranda" && <section className="admin-note"><b>Panel admin aktif</b><p>Peran admin mengatur hak akses melalui tabel profiles di Supabase. Jangan pernah membagikan service-role key atau token WhatsApp kepada pengguna.</p></section>}
      {!isAdmin && walletMenu && <div className="wmenu"><button onClick={() => { setTab("wallet"); setWalletMenu(false); window.scrollTo({ top: 0 }); }}><Ic n="down" s={18} /> Withdraw</button><button onClick={() => { setTab("riwayat_saldo"); setWalletMenu(false); window.scrollTo({ top: 0 }); }}><Ic n="list" s={18} /> Transaksi Semua</button></div>}
      {!isAdmin && <nav className="bottomnav">{tabs.map(t => <button key={t.id} className={((t.id === "wallet" && (tab === "wallet" || tab === "riwayat_saldo")) || tab === t.id ? "bn on" : "bn") + (t.id === "wallet" ? " center" : "")} onClick={() => { if (t.id === "wallet") { setWalletMenu(!walletMenu); return; } setWalletMenu(false); setTab(t.id); window.scrollTo({ top: 0 }); }}><span className="bi"><Ic n={t.icon} s={t.id === "wallet" ? 24 : 22} /></span><small>{t.label}</small></button>)}</nav>}
      <footer>setanwawa · Gunakan secara bertanggung jawab dan hormati pilihan pelanggan.</footer>
    </div>
  </main>;
}
