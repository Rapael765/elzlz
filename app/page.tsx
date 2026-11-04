"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import "./stats.css";

type Contact = { id: string; name: string; phone: string; opted_in: boolean; unsubscribed_at: string | null; used_at?: string | null };
type Campaign = { id: string; name: string; template_name: string; status: string; created_at: string; speed_mode?: string; button_label?: string | null; button_url?: string | null };
type Log = { id: string; phone: string; status: string; error: string | null; created_at: string };

export default function Home() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState("beranda");
  const [useBtn, setUseBtn] = useState(false);
  const [btnLabel, setBtnLabel] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
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

  async function waRequest(path: string, method = "GET", body?: any) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const response = await fetch(path + (path.includes("?") ? "&" : "?") + "slot=" + slotRef.current, { method, headers: { Authorization: `Bearer ${s?.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
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
    setProfile(p);
    const [{data:c}, {data:ca}, {data:l}] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", {ascending:false}).limit(100),
      supabase.from("campaigns").select("*").order("created_at", {ascending:false}).limit(20),
      supabase.from("message_logs").select("*").order("created_at", {ascending:false}).limit(20)
    ]);
    setContacts(c || []); setCampaigns(ca || []); setLogs(l || []);
    const { data: st } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(); setSettings(st);
    const { data: ru } = await supabase.from("user_runs").select("*").eq("user_id", session.user.id).maybeSingle(); setRun(ru);
    if (p?.role !== "admin") { const { data: wd } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(10); setMyWd(wd || []); const { data: { session: cs } } = await supabase.auth.getSession(); const mr = await fetch("/api/me", { headers: { Authorization: `Bearer ${cs?.access_token}` } }); if (mr.ok) setMe(await mr.json()); }
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
      name: campaignName.trim(), template_name: template.trim(), button_label: bLabel, button_url: bUrl,
      language_code: "id", body_variables: variables.split("|").map(v => v.trim()).filter(Boolean),
      status: "draft", created_by: session.user.id
    }).select().single();
    if (error) setNotice(error.message);
    else { setCampaignName(""); setTemplate(""); setVariables(""); setUseBtn(false); setBtnLabel(""); setBtnUrl(""); setNotice("Campaign dibuat. Tekan Mulai saat siap."); loadDashboard(); }
  }

  async function startCampaign(id: string) {
    setBusy(true); setNotice("");
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch("/api/campaigns/start", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
      body: JSON.stringify({ campaignId: id, speed })
    });
    const body = await res.json();
    setBusy(false); setNotice(body.message || body.error || "Permintaan selesai.");
    loadDashboard();
  }

  async function stopCampaign(id: string) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch("/api/campaigns/stop", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
      body: JSON.stringify({ campaignId: id })
    });
    const body = await res.json(); setNotice(body.message || body.error || "Selesai."); loadDashboard();
  }

  async function savePrice() {
    const v = parseInt(price, 10);
    if (isNaN(v) || v < 0) return setNotice("Isi tarif dengan angka (Rp).");
    const { error } = await supabase.from("app_settings").update({ price_per_message: v }).eq("id", 1);
    setNotice(error ? error.message : "Tarif per pesan disimpan."); setPrice(""); loadDashboard();
  }
  async function saveRefRate() {
    const v = parseInt(refRateInput, 10);
    if (isNaN(v) || v < 0) return setNotice("Isi komisi referral dengan angka (Rp).");
    const { error } = await supabase.from("app_settings").update({ referral_rate: v }).eq("id", 1);
    setNotice(error ? error.message : "Komisi referral disimpan."); setRefRateInput(""); loadDashboard();
  }
  async function copyRef() {
    try { await navigator.clipboard.writeText(refLink); setNotice("Link undangan disalin."); } catch { setNotice("Salin manual: " + refLink); }
  }
  async function saveMin() {
    const v = parseInt(minInput, 10);
    if (isNaN(v) || v < 0) return setNotice("Isi minimal penarikan dengan angka (Rp).");
    const { error } = await supabase.from("app_settings").update({ min_withdraw: v }).eq("id", 1);
    setNotice(error ? error.message : "Minimal penarikan disimpan."); setMinInput(""); loadDashboard();
  }
  async function submitWithdraw() {
    const { data: { session: cur } } = await supabase.auth.getSession();
    setBusy(true);
    const r = await fetch("/api/withdraw", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur?.access_token}` }, body: JSON.stringify({ amount: Number(wdAmount), method: wdMethod, accountNumber: wdAcc, accountName: wdName }) });
    const b = await r.json(); setBusy(false); setNotice(b.message || b.error || "Selesai.");
    if (r.ok) setWdAmount(""); loadDashboard();
  }
  async function processWd(id: string, action: "paid" | "rejected") {
    const note = action === "rejected" ? (window.prompt("Alasan penolakan (boleh kosong):") || "") : "";
    const { data: { session: cur } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/withdrawals", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur?.access_token}` }, body: JSON.stringify({ id, action, note }) });
    const b = await r.json(); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  const wdLabel: Record<string, string> = { pending: "⏳ Menunggu", paid: "✅ Dibayar", rejected: "❌ Ditolak" };
  async function contactAction(body: any, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const { data: { session: cur } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/contacts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur?.access_token}` }, body: JSON.stringify(body) });
    const b = await r.json(); setBusy(false); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function importTxt() {
    if (!importText) return setNotice("Pilih file .txt dulu.");
    if (!importConsent) return setNotice("Centang konfirmasi persetujuan (opt-in) dulu.");
    setBusy(true);
    const { data: { session: cur } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur?.access_token}` }, body: JSON.stringify({ text: importText }) });
    const b = await r.json(); setBusy(false);
    setNotice(r.ok ? `Terbaca ${b.total} nomor: ${b.inserted} baru ditambahkan, ${b.existing} sudah ada di database, ${b.dupInFile} dobel di file, ${b.invalid} tidak valid.` : (b.error || "Gagal impor."));
    if (r.ok) { setImportText(""); setImportName(""); } loadDashboard();
  }
  async function payout(uid: string) {
    const { data: { session: cur } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/payout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur?.access_token}` }, body: JSON.stringify({ userId: uid }) });
    const b = await r.json(); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function sendNow() {
    setBusy(true);
    try { const d = await waRequest("/api/campaigns/tick", "POST", {}); setNotice(d.message); } catch (e: any) { setNotice(e.message); }
    setBusy(false); loadDashboard();
  }
  async function setLimit(uid: string, v: string) {
    const { data: { session: cur } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/limit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur?.access_token}` }, body: JSON.stringify({ userId: uid, maxDevices: Number(v) }) });
    const b = await r.json(); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function signOut() { await supabase.auth.signOut(); setProfile(null); }

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
  const current = campaigns[0];
  const running = run?.status === "running";
  const doneThis = false;
  const statusLabel = isAdmin && !current ? "Belum ada" : running ? "● Berjalan" : doneThis ? "Selesai" : run?.status === "stopped" ? "Dihentikan" : "Siap";
  const rp = (n: number) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const onlineN = isAdmin ? (overview?.online ?? 0) : devices.filter((d: any) => d.connected).length;
  const offlineN = isAdmin ? (overview?.offline ?? 0) : devices.filter((d: any) => d.registered && !d.connected).length;
  const balanceN = isAdmin ? (overview?.balanceTotal ?? 0) : (profile?.balance ?? 0);
  const earnedN = isAdmin ? (overview?.earnedTotal ?? 0) : (profile?.earned ?? 0);
  const successN = isAdmin ? (overview?.successTotal ?? 0) : (profile?.success_count ?? 0);

  const pendingWd = (overview?.withdrawals || []).filter((w: any) => w.status === "pending").length;
  const tabs: { id: string; label: string; icon: string; badge?: number }[] = isAdmin
    ? [{ id: "beranda", label: "Beranda", icon: "🏠" }, { id: "perangkat", label: "Perangkat", icon: "📱" }, { id: "database", label: "Database", icon: "🗂️" }, { id: "campaign", label: "Campaign", icon: "📣" }, { id: "pengguna", label: "Pengguna", icon: "👥" }, { id: "penarikan", label: "Penarikan", icon: "💸", badge: pendingWd }, { id: "riwayat", label: "Riwayat", icon: "🧾" }]
    : [{ id: "beranda", label: "Dashboard", icon: "🏠" }, { id: "perangkat", label: "Devices", icon: "📱" }, { id: "wallet", label: "Wallets", icon: "💳" }, { id: "referral", label: "Referrals", icon: "👥" }, { id: "profil", label: "Profile", icon: "👤" }];
  const refLink = (typeof window !== "undefined" ? window.location.origin : "") + "/?ref=" + (me?.referral?.code || "");
  return <main className={"dashboard" + (!isAdmin ? " has-bottomnav" : "")}>
    <header className="topbar"><div className="brand"><span className="brand-mark small">SW</span><div><b>setanwawa</b><small>Promotion dashboard</small></div></div>
      <div className="user-area"><span>{session.user.email}</span><button className="ghost" onClick={signOut}>Keluar</button></div>
    </header>
    <div className="content">
      {!isAdmin && <div className="pagehead"><h1>{({ beranda: "Dashboard", perangkat: "Devices", wallet: "Wallets", referral: "Referrals", profil: "Profile" } as Record<string, string>)[tab]}</h1><p className="muted">{({ beranda: "Ringkasan akun kamu hari ini", perangkat: "Kelola perangkat WhatsApp kamu", wallet: "Saldo dan penarikan dana", referral: "Undang teman dan dapat komisi", profil: "Informasi akunmu" } as Record<string, string>)[tab]}</p></div>}
      {isAdmin && <div className="welcome"><div><p className="eyebrow">DASHBOARD {isAdmin ? "ADMIN" : "TOKO"}</p><h1>Halo, {profile?.full_name || "Pemilik Toko"} 👋</h1><p className="muted">Pantau pelanggan dan promosi toko kamu.</p></div><span className="status-pill">● Sistem siap</span></div>}
      {notice && <div className="notice-banner">{notice}</div>}
      {isAdmin && <nav className="tabbar">{tabs.map(t => <button key={t.id} className={tab === t.id ? "tab on" : "tab"} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}>{t.icon} {t.label}{t.badge ? <span className="badge">{t.badge}</span> : null}</button>)}</nav>}
      {tab === "perangkat" && <section className="panel wa-panel">
        <div className="panel-heading"><div><p className="eyebrow">KONEKSI WHATSAPP • BAILEYS</p><h2>Hubungkan WhatsApp</h2></div><span className={waStatus?.connected ? "tag good" : "tag"}>{waStatus?.connected ? "● Terhubung" : "○ Belum terhubung"}</span></div>
        <p className="muted">Backend berjalan di server Pterodactyl. Hubungkan akun WhatsApp milik toko melalui QR atau pairing code.</p>
        <div className="form-grid"><div><button className="primary" onClick={showQr} disabled={!!waStatus?.connected}>Tampilkan QR Code</button>{waQr && <div className="qr-box"><img src={waQr} alt="QR WhatsApp untuk ditautkan" /><small>WhatsApp → Perangkat tertaut → Tautkan perangkat</small></div>}</div>
          <div><label>Nomor WhatsApp<input value={pairPhone} onChange={e=>setPairPhone(e.target.value)} placeholder="62812xxxxxxx" /></label><button className="primary" onClick={getPairingCode} disabled={!!waStatus?.connected}>Buat Pairing Code</button>{pairCode && <div className="pair-code">{pairCode}</div>}</div></div>
        <div style={{display:"flex",gap:8,margin:"8px 0",flexWrap:"wrap"}}>{Array.from({ length: profile?.max_devices ?? 3 }, (_, i) => i + 1).map(n => { const d = devices.find((x: any) => x.slot === n); return <button key={n} className={slot === n ? "primary compact" : "ghost"} onClick={() => setSlot(n)}>{d?.connected ? "🟢" : "⚪"} Perangkat {n}</button>; })}</div>
        <p className="tiny">Kamu bisa menautkan sampai {profile?.max_devices ?? 3} perangkat. Perangkat hanya milik akunmu dan tidak tercampur dengan akun lain.</p>
        {waStatus?.phone && <p className="tiny">Nomor terhubung: {waStatus.phone}</p>}{waStatus?.lastError && <p className="tiny">Info: {waStatus.lastError}</p>}
        {waStatus?.connected && <button className="danger" onClick={disconnectWa}>Putuskan WhatsApp</button>}
      </section>}

      

      {!isAdmin && tab === "beranda" && <div className="infocard"><b>ℹ️ Komisi per pesan</b><p>Kamu mendapatkan <b>{rp(settings?.price_per_message || 0)}</b> untuk setiap pesan yang berhasil terkirim melalui device kamu. Pesan gagal tidak dihitung. Undang teman dan dapat <b>{rp(settings?.referral_rate || 0)}</b> per pesan sukses mereka.</p></div>}
      {tab === "beranda" && <section className="tiles">
        <div className="tile-row">
          <article className="tile"><div><small>ONLINE</small><strong>{onlineN}</strong></div><span className="ico ok">📡</span></article>
          <article className="tile"><div><small>OFFLINE</small><strong>{offlineN}</strong></div><span className="ico bad">🔌</span></article>
        </div>
        <article className="tile big">
          <div className="tile-top"><div><small>🧾 BALANCE</small><strong className="huge">{rp(balanceN)}</strong></div><span className="ico safe">🗄️</span></div>
          <div className="tile-sub">
            <div className="sub"><div><small>Pendapatan</small><strong>{rp(earnedN)}</strong></div><span className="ico warn">💵</span></div>
            <div className="sub"><div><small>Pesan Sukses</small><strong>{successN}</strong></div><span className="ico info">💬</span></div>
          </div>
          <p className="tiny">Tarif {rp(settings?.price_per_message || 0)} per pesan sukses. Pesan gagal tidak dihitung.</p>
        </article>
      </section>}

      {!isAdmin && tab === "beranda" && <>
        <div className="warncard"><b>⚠️ Peringatan</b><p>Jangan menghapus pesan yang sudah terkirim dan jangan mengeluarkan perangkat dari WhatsApp saat pengiriman berjalan, agar akunmu tidak dibatasi.</p></div>
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

      {!isAdmin && tab === "beranda" && <div className="botcard" onClick={() => setTab("perangkat")}><span className="boticon">⚙️</span><div><small>TAMBAH PERANGKAT</small><b>Kelola WhatsApp</b></div><span>›</span></div>}
      {!isAdmin && tab === "beranda" && <button className="fab" aria-label="Mulai kirim" onClick={() => document.getElementById("run")?.scrollIntoView({ behavior: "smooth" })}>➤</button>}

      {!isAdmin && tab === "wallet" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">TARIK SALDO</p><h2>Penarikan dana</h2></div></div>
        <p className="muted">Saldo: <b>{rp(profile?.balance ?? 0)}</b> · Minimal penarikan: <b>{rp(settings?.min_withdraw ?? 0)}</b></p>
        <div style={{display:"flex",gap:8,margin:"8px 0"}}>{(["dana","seabank"] as const).map(m => <button key={m} className={wdMethod === m ? "primary compact" : "ghost"} onClick={() => setWdMethod(m)}>{m === "dana" ? "Dana" : "SeaBank"}</button>)}</div>
        <input value={wdAcc} onChange={(e) => setWdAcc(e.target.value)} placeholder={wdMethod === "dana" ? "Nomor Dana, contoh 0812xxxx" : "Nomor rekening SeaBank"} inputMode="numeric" />
        <input value={wdName} onChange={(e) => setWdName(e.target.value)} placeholder="Nama pemilik akun" />
        <input value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} placeholder="Jumlah penarikan (Rp)" inputMode="numeric" />
        <button className="primary" disabled={busy || (profile?.balance ?? 0) < (settings?.min_withdraw ?? 0)} onClick={submitWithdraw}>Ajukan penarikan</button>
        {(profile?.balance ?? 0) < (settings?.min_withdraw ?? 0) && <p className="tiny">Saldo belum mencapai minimal penarikan.</p>}
        {myWd.length > 0 && <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Metode</th><th>Jumlah</th><th>Status</th></tr></thead><tbody>
          {myWd.map((w: any) => <tr key={w.id}><td>{new Date(w.created_at).toLocaleDateString("id-ID")}</td><td>{w.method === "dana" ? "Dana" : "SeaBank"}</td><td>{rp(w.amount)}</td><td>{wdLabel[w.status]}{w.note ? <><br /><small>{w.note}</small></> : null}</td></tr>)}
        </tbody></table></div>}
      </section>}

      {!isAdmin && tab === "referral" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">REFERRAL</p><h2>Undang &amp; dapat komisi</h2></div></div>
        <p className="muted">Kamu mendapat <b>{rp(settings?.referral_rate || 0)}</b> untuk setiap pesan sukses dari pengguna yang kamu undang.</p>
        <p className="tiny">Kode referral kamu</p>
        <div className="codebox">{me?.referral?.code || "..."}</div>
        <p className="tiny" style={{wordBreak:"break-all"}}>{refLink}</p>
        <button className="primary" onClick={copyRef}>Salin link undangan</button>
        <div className="tile-sub">
          <div className="sub"><div><small>Diundang</small><strong>{me?.referral?.count ?? 0}</strong></div></div>
          <div className="sub"><div><small>Komisi referral</small><strong>{rp(me?.referral?.earned ?? 0)}</strong></div></div>
        </div>
        {(me?.referral?.invited || []).length > 0 && <div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Pesan sukses</th></tr></thead><tbody>
          {(me?.referral?.invited || []).map((u: any, i: number) => <tr key={i}><td>{u.name}</td><td>{u.success_count}</td></tr>)}
        </tbody></table></div>}
      </section>}

      {!isAdmin && tab === "profil" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">PROFIL</p><h2>{profile?.full_name || "Pengguna"}</h2></div></div>
        <p className="muted">{session.user.email}</p>
        <p className="tiny">Peran: Pengguna · Kode referral: <b>{me?.referral?.code || "-"}</b></p>
        <p className="tiny">Tarif {rp(settings?.price_per_message || 0)} per pesan sukses · Komisi referral {rp(settings?.referral_rate || 0)} per pesan sukses pengguna undangan.</p>
        <button className="danger" onClick={signOut}>Keluar</button>
      </section>}

      {isAdmin && tab === "pengguna" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">PENGATURAN ADMIN</p><h2>Tarif &amp; pengguna</h2></div></div>
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
          {(overview?.users || []).map((u: any) => <tr key={u.id}><td>{u.name || u.email}<br /><small>{u.email}</small></td><td>🟢 {u.on} / ⚪ {u.linked - u.on}</td><td><input type="number" min={1} max={9} defaultValue={u.max_devices} onBlur={(e) => Number(e.target.value) !== u.max_devices && setLimit(u.id, e.target.value)} style={{width:64}} /></td><td>{rp(u.balance)}<br /><small>{u.success_count} pesan</small></td><td><button className="ghost" onClick={() => payout(u.id)} disabled={!u.balance}>Reset saldo</button></td></tr>)}
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
            <p className="tiny"><b>📄 Upload database dari file .txt</b> (satu nomor per baris, contoh 628123455577). Nomor yang sudah dipakai satu akun tidak muncul lagi di akun lain.</p>
            <input type="file" accept=".txt,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setImportName(f.name); setImportText(await f.text()); }} />
            {importName && <p className="tiny">File dipilih: {importName}</p>}
            <label className="tiny"><input type="checkbox" checked={importConsent} onChange={(e) => setImportConsent(e.target.checked)} /> Saya mengonfirmasi nomor-nomor ini sudah menyetujui menerima pesan (opt-in).</label>
            <button className="primary" disabled={busy || !importText} onClick={importTxt}>Impor nomor dari file</button>
            <p className="tiny"><b>🗑 Hapus database</b></p>
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
          </>}
          {template.trim() && <div className="wa-preview"><p className="tiny">Pratinjau pesan</p><div className="bubble">{template}</div>{useBtn && btnLabel.trim() && <div className="wabtn">🔗 {btnLabel}</div>}</div>}
          <label>Catatan internal (opsional)<input value={variables} onChange={e=>setVariables(e.target.value)} placeholder="Contoh: Promo akhir pekan" /></label>
          <p className="tiny">Kirim hanya kepada pelanggan yang secara jelas menyetujui promosi. Pastikan pesan memuat cara berhenti, misalnya balas STOP. Pengiriman dijalankan bertahap.</p>
          <button className="primary" onClick={createCampaign}>+ Buat campaign</button>
          <div className="campaign-list">{campaigns.map(c=><div className="campaign" key={c.id}><div><b>{c.name}</b><small>{c.template_name} · {c.status}{c.button_url ? " · 🔗 " + (c.button_label || "tombol") : ""}</small></div><div className="actions">{c.status==="running"?<button className="danger" onClick={()=>stopCampaign(c.id)}>Hentikan</button>:<button className="primary compact" disabled={busy||c.status==="completed"} onClick={()=>startCampaign(c.id)}>Mulai</button>}</div></div>)}
            {!campaigns.length && <p className="empty">Belum ada campaign.</p>}</div>
        </section>}
      </div>}

      {isAdmin && tab === "riwayat" && <section className="panel log-panel"><div className="panel-heading"><div><p className="eyebrow">AKTIVITAS TERBARU</p><h2>Riwayat pengiriman</h2></div><button className="ghost" onClick={loadDashboard}>Muat ulang</button></div>
        <div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Status</th><th>Detail</th><th>Waktu</th></tr></thead><tbody>
          {logs.map(l=><tr key={l.id}><td>{l.phone}</td><td>{l.status}</td><td>{l.error || "—"}</td><td>{new Date(l.created_at).toLocaleString("id-ID")}</td></tr>)}
          {!logs.length && <tr><td colSpan={4} className="empty">Belum ada riwayat pengiriman.</td></tr>}
        </tbody></table></div>
      </section>}
      {isAdmin && tab === "beranda" && <section className="admin-note"><b>Panel admin aktif</b><p>Peran admin mengatur hak akses melalui tabel profiles di Supabase. Jangan pernah membagikan service-role key atau token WhatsApp kepada pengguna.</p></section>}
      {!isAdmin && <nav className="bottomnav">{tabs.map(t => <button key={t.id} className={(tab === t.id ? "bn on" : "bn") + (t.id === "wallet" ? " center" : "")} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}><span className="bi">{t.icon}</span><small>{t.label}</small></button>)}</nav>}
      <footer>setanwawa · Gunakan secara bertanggung jawab dan hormati pilihan pelanggan.</footer>
    </div>
  </main>;
}
