"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./stats.css";

type Contact = { id: string; name: string; phone: string; opted_in: boolean; unsubscribed_at: string | null };
type Campaign = { id: string; name: string; template_name: string; status: string; created_at: string; speed_mode?: string };
type Log = { id: string; phone: string; status: string; error: string | null; created_at: string };

export default function Home() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [price, setPrice] = useState("");
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
  useEffect(() => { if (!session || !waQr || waStatus?.connected) return; const t = setInterval(async () => { try { const d = await waRequest("/api/baileys/qr"); if (d.qr) setWaQr(d.qr); } catch {} }, 4000); return () => clearInterval(t); }, [session, waQr, waStatus?.connected]);
  useEffect(() => { if (waStatus?.connected) { setWaQr(""); setPairCode(""); } }, [waStatus?.connected]);

  async function waRequest(path: string, method = "GET", body?: any) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const response = await fetch(path, { method, headers: { Authorization: `Bearer ${s?.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Permintaan WhatsApp gagal.");
    return data;
  }
  async function loadWaStatus() { try { setWaStatus(await waRequest("/api/baileys/status")); } catch (e: any) { setWaStatus({ connected: false, lastError: e.message }); } }
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
    if (p?.role === "admin") {
      const { data: { session: cur } } = await supabase.auth.getSession();
      const r = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${cur?.access_token}` } });
      if (r.ok) setOverview(await r.json());
    }
  }

  async function auth() {
    setBusy(true); setNotice("");
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
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
    const { data, error } = await supabase.from("campaigns").insert({
      name: campaignName.trim(), template_name: template.trim(),
      language_code: "id", body_variables: variables.split("|").map(v => v.trim()).filter(Boolean),
      status: "draft", created_by: session.user.id
    }).select().single();
    if (error) setNotice(error.message);
    else { setCampaignName(""); setTemplate(""); setVariables(""); setNotice("Campaign dibuat. Tekan Mulai saat siap."); loadDashboard(); }
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
  async function payout(uid: string) {
    const { data: { session: cur } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/payout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur?.access_token}` }, body: JSON.stringify({ userId: uid }) });
    const b = await r.json(); setNotice(b.message || b.error || "Selesai."); loadDashboard();
  }
  async function signOut() { await supabase.auth.signOut(); setProfile(null); }

  if (!session) return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand-mark">ES</div><p className="eyebrow">TOKO ONLINE • PROMOTION DESK</p>
      <h1>El Shop Manager</h1><p className="muted">Kelola pelanggan dan campaign toko dari satu dashboard.</p>
      {mode === "signup" && <label>Nama toko / nama kamu<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama" /></label>}
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
  const doneThis = run?.status === "completed" && run?.campaign_id === current?.id;
  const statusLabel = !current ? "Belum ada" : running ? "● Berjalan" : doneThis ? "Selesai" : run?.status === "stopped" ? "Dihentikan" : "Siap";
  const rp = (n: number) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const onlineN = isAdmin ? (overview?.online ?? 0) : (waStatus?.connected ? 1 : 0);
  const offlineN = isAdmin ? (overview?.offline ?? 0) : (waStatus?.connected ? 0 : 1);
  const balanceN = isAdmin ? (overview?.balanceTotal ?? 0) : (profile?.balance ?? 0);
  const earnedN = isAdmin ? (overview?.earnedTotal ?? 0) : (profile?.earned ?? 0);
  const successN = isAdmin ? (overview?.successTotal ?? 0) : (profile?.success_count ?? 0);

  return <main className="dashboard">
    <header className="topbar"><div className="brand"><span className="brand-mark small">ES</span><div><b>El Shop Manager</b><small>Promotion dashboard</small></div></div>
      <div className="user-area"><span>{session.user.email}</span><button className="ghost" onClick={signOut}>Keluar</button></div>
    </header>
    <div className="content">
      <div className="welcome"><div><p className="eyebrow">DASHBOARD {isAdmin ? "ADMIN" : "TOKO"}</p><h1>Halo, {profile?.full_name || "Pemilik Toko"} 👋</h1><p className="muted">Pantau pelanggan dan promosi toko kamu.</p></div><span className="status-pill">● Sistem siap</span></div>
      {notice && <div className="notice-banner">{notice}</div>}
      <section className="panel wa-panel">
        <div className="panel-heading"><div><p className="eyebrow">KONEKSI WHATSAPP • BAILEYS</p><h2>Hubungkan WhatsApp</h2></div><span className={waStatus?.connected ? "tag good" : "tag"}>{waStatus?.connected ? "● Terhubung" : "○ Belum terhubung"}</span></div>
        <p className="muted">Backend berjalan di server Pterodactyl. Hubungkan akun WhatsApp milik toko melalui QR atau pairing code.</p>
        <div className="form-grid"><div><button className="primary" onClick={showQr} disabled={!!waStatus?.connected}>Tampilkan QR Code</button>{waQr && <div className="qr-box"><img src={waQr} alt="QR WhatsApp untuk ditautkan" /><small>WhatsApp → Perangkat tertaut → Tautkan perangkat</small></div>}</div>
          <div><label>Nomor WhatsApp<input value={pairPhone} onChange={e=>setPairPhone(e.target.value)} placeholder="62812xxxxxxx" /></label><button className="primary" onClick={getPairingCode} disabled={!!waStatus?.connected}>Buat Pairing Code</button>{pairCode && <div className="pair-code">{pairCode}</div>}</div></div>
        {waStatus?.phone && <p className="tiny">Nomor terhubung: {waStatus.phone}</p>}{waStatus?.lastError && <p className="tiny">Info: {waStatus.lastError}</p>}
        {waStatus?.connected && <button className="danger" onClick={disconnectWa}>Putuskan WhatsApp</button>}
      </section>

      <section className="panel run-panel">
        <div className="panel-heading"><div><p className="eyebrow">KIRIM PROMOSI</p><h2>Jalankan promosi</h2></div><span className="tag">{statusLabel}</span></div>
        {current ? <p className="muted"><b>{current.name}</b><br />{current.template_name}</p> : <p className="muted">Admin belum membuat campaign.</p>}
        <p className="tiny"><b>Kecepatan kirim</b></p>
        <div style={{display:"flex",gap:8,margin:"8px 0"}}>{(["slow","medium","fast"] as const).map(m=><button key={m} className={speed===m?"primary compact":"ghost"} onClick={()=>setSpeed(m)} disabled={running}>{m==="slow"?"Slow":m==="medium"?"Medium":"Fast"}</button>)}</div>
        <p className="tiny">Slow: aman, sekitar 2 pesan/menit. Medium: sekitar 5 pesan/menit. Fast: sekitar 8 pesan/menit (risiko akun dibatasi WhatsApp lebih tinggi).</p>
        {running ? <button className="danger" onClick={()=>stopCampaign(current.id)}>Hentikan</button> : <button className="primary" disabled={busy || !current || !waStatus?.connected || doneThis} onClick={()=>startCampaign(current.id)}>▶ Mulai</button>}
        {!waStatus?.connected && <p className="tiny">Hubungkan WhatsApp dulu untuk memulai.</p>}
      </section>

      <section className="tiles">
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
      </section>

      {isAdmin && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">PENGATURAN ADMIN</p><h2>Tarif &amp; pengguna</h2></div></div>
        <p className="tiny">Tarif saat ini: {rp(settings?.price_per_message || 0)} per pesan sukses.</p>
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Tarif baru, contoh 50" inputMode="numeric" />
        <button className="primary" onClick={savePrice}>Simpan tarif</button>
        <div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Perangkat</th><th>Saldo</th><th></th></tr></thead><tbody>
          {(overview?.users || []).map((u: any) => <tr key={u.id}><td>{u.name || u.email}<br /><small>{u.email}</small></td><td>{u.online ? "🟢 Online" : "⚪ Offline"}</td><td>{rp(u.balance)}<br /><small>{u.success_count} pesan</small></td><td><button className="ghost" onClick={() => payout(u.id)} disabled={!u.balance}>Reset saldo</button></td></tr>)}
        </tbody></table></div>
      </section>}

      {isAdmin && <div className="grid">
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">DATABASE PELANGGAN</p><h2>Tambah nomor</h2></div><span className="tag">Opt-in wajib</span></div>
          <div className="form-grid"><label>Nama pelanggan<input value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="Nama pelanggan" /></label><label>Nomor WhatsApp<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="62812xxxxxxx" /></label></div>
          <label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /> Pelanggan telah memberi izin menerima promosi WhatsApp.</label>
          <button className="primary" onClick={addContact}>+ Simpan nomor</button>
          <p className="tiny">Masukkan format internasional, contoh 62812xxxxxxx. Jangan mengimpor nomor hasil scraping atau nomor tanpa izin.</p>
          <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Nomor</th><th>Status</th></tr></thead><tbody>
            {contacts.slice(0,8).map(c=><tr key={c.id}><td>{c.name}</td><td>{c.phone}</td><td><span className={c.opted_in&&!c.unsubscribed_at?"good":"muted"}>{c.opted_in&&!c.unsubscribed_at?"Setuju":"Tidak aktif"}</span></td></tr>)}
            {!contacts.length && <tr><td colSpan={3} className="empty">Belum ada pelanggan.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">PROMOSI OTOMATIS</p><h2>Buat campaign</h2></div><span className="tag">Baileys</span></div>
          <label>Nama campaign<input value={campaignName} onChange={e=>setCampaignName(e.target.value)} placeholder="Promo akhir pekan" /></label>
          <label>Isi pesan promosi<input value={template} onChange={e=>setTemplate(e.target.value)} placeholder="Halo, ada promo baru di toko kami! Balas STOP untuk berhenti." /></label>
          <label>Catatan internal (opsional)<input value={variables} onChange={e=>setVariables(e.target.value)} placeholder="Contoh: Promo akhir pekan" /></label>
          <p className="tiny">Kirim hanya kepada pelanggan yang secara jelas menyetujui promosi. Pastikan pesan memuat cara berhenti, misalnya balas STOP. Pengiriman dijalankan bertahap.</p>
          <button className="primary" onClick={createCampaign}>+ Buat campaign</button>
          <div className="campaign-list">{campaigns.map(c=><div className="campaign" key={c.id}><div><b>{c.name}</b><small>{c.template_name} · {c.status}</small></div><div className="actions">{c.status==="running"?<button className="danger" onClick={()=>stopCampaign(c.id)}>Hentikan</button>:<button className="primary compact" disabled={busy||c.status==="completed"} onClick={()=>startCampaign(c.id)}>Mulai</button>}</div></div>)}
            {!campaigns.length && <p className="empty">Belum ada campaign.</p>}</div>
        </section>
      </div>}

      {isAdmin && <section className="panel log-panel"><div className="panel-heading"><div><p className="eyebrow">AKTIVITAS TERBARU</p><h2>Riwayat pengiriman</h2></div><button className="ghost" onClick={loadDashboard}>Muat ulang</button></div>
        <div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Status</th><th>Detail</th><th>Waktu</th></tr></thead><tbody>
          {logs.map(l=><tr key={l.id}><td>{l.phone}</td><td>{l.status}</td><td>{l.error || "—"}</td><td>{new Date(l.created_at).toLocaleString("id-ID")}</td></tr>)}
          {!logs.length && <tr><td colSpan={4} className="empty">Belum ada riwayat pengiriman.</td></tr>}
        </tbody></table></div>
      </section>}
      {isAdmin && <section className="admin-note"><b>Panel admin aktif</b><p>Peran admin mengatur hak akses melalui tabel profiles di Supabase. Jangan pernah membagikan service-role key atau token WhatsApp kepada pengguna.</p></section>}
      <footer>El Shop Manager · Gunakan secara bertanggung jawab dan hormati pilihan pelanggan.</footer>
    </div>
  </main>;
}
