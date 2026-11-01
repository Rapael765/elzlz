import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.BAILEYS_API_KEY || '';
const AUTH_DIR = process.env.AUTH_DIR || './data/auth';
const OPT_OUT_FILE = process.env.OPT_OUT_FILE || './data/optouts.json';
const CALLBACK_URL = process.env.OPTOUT_CALLBACK_URL || '';
const CALLBACK_SECRET = process.env.OPTOUT_CALLBACK_SECRET || '';
const MIN_INTERVAL_MS = Math.max(3000, Number(process.env.MIN_SEND_INTERVAL_MS || 5000));
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
let sock = null, qrText = null, connected = false, connecting = false, registered = false, lastSendAt = 0, lastError = null;
let pairingCode = null;

fs.mkdirSync(AUTH_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OPT_OUT_FILE), { recursive: true });
function readOptouts() { try { return new Set(JSON.parse(fs.readFileSync(OPT_OUT_FILE, 'utf8'))); } catch { return new Set(); } }
function writeOptouts(set) { fs.writeFileSync(OPT_OUT_FILE, JSON.stringify([...set]), { mode: 0o600 }); }
const optouts = readOptouts();

async function startSocket() {
  if (connecting || connected) return;
  connecting = true; lastError = null;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    registered = Boolean(state.creds.registered);
    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }
    sock = makeWASocket({ auth: state, version, logger, printQRInTerminal: false, browser: ['El Shop Manager', 'Chrome', '1.0.0'], markOnlineOnConnect: false, syncFullHistory: false });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) { qrText = qr; pairingCode = null; }
      if (connection === 'open') { connected = true; connecting = false; qrText = null; pairingCode = null; lastError = null; logger.info('WhatsApp connected'); }
      if (connection === 'close') {
        connected = false; connecting = false; sock = null;
        const status = lastDisconnect?.error?.output?.statusCode;
        lastError = `Koneksi terputus (${status || 'unknown'})`;
        if (status !== DisconnectReason.loggedOut) setTimeout(() => startSocket().catch(e => logger.error(e)), 3000);
        else { qrText = null; logger.warn('Session logged out; remove saved session before pairing again.'); }
      }
    });
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages || []) {
        if (msg.key?.fromMe || !msg.message || msg.key?.remoteJid?.endsWith('@g.us')) continue;
        const jid = msg.key.remoteJid || '';
        const phone = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim().toUpperCase();
        if (phone && ['STOP', 'BERHENTI', 'UNSUBSCRIBE'].includes(text)) {
          optouts.add(phone); writeOptouts(optouts);
          if (CALLBACK_URL && CALLBACK_SECRET) {
            try { await fetch(CALLBACK_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-optout-secret': CALLBACK_SECRET }, body: JSON.stringify({ phone }) }); }
            catch (e) { logger.error({ err: e }, 'Opt-out callback failed'); }
          }
        }
      }
    });
  } catch (e) { connecting = false; lastError = String(e); logger.error(e); throw e; }
}

function sendJson(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }
async function bodyJson(req) { let s = ''; for await (const c of req) { s += c; if (s.length > 20000) throw new Error('Request terlalu besar'); } return s ? JSON.parse(s) : {}; }
function authorized(req) { return API_KEY && req.headers.authorization === `Bearer ${API_KEY}`; }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'el-shop-baileys' });
  if (!authorized(req)) return sendJson(res, 401, { error: 'Unauthorized' });
  try {
    if (req.method === 'GET' && url.pathname === '/status') return sendJson(res, 200, { connected, connecting, phone: sock?.user?.id?.split(':')[0] || null, qrReady: Boolean(qrText), pairingCode, lastError });
    if (req.method === 'GET' && url.pathname === '/qr') {
      if (!qrText) return sendJson(res, 409, { error: connected ? 'WhatsApp sudah terhubung.' : 'QR belum tersedia. Tunggu beberapa detik lalu muat ulang.' });
      return sendJson(res, 200, { qr: await QRCode.toDataURL(qrText, { width: 320, margin: 2 }) });
    }
    if (req.method === 'POST' && url.pathname === '/connect') {
      await startSocket(); return sendJson(res, 202, { message: 'Proses koneksi dimulai. Muat ulang status/QR beberapa detik lagi.' });
    }
    if (req.method === 'POST' && url.pathname === '/pairing') {
      const { phone } = await bodyJson(req);
      const normalized = String(phone || '').replace(/\D/g, '');
      if (!/^\d{8,15}$/.test(normalized)) return sendJson(res, 400, { error: 'Masukkan nomor internasional, contoh 62812xxxxxxx.' });
      if (!sock && !connecting) await startSocket();
      if (!sock) return sendJson(res, 409, { error: 'Socket sedang disiapkan. Coba lagi beberapa detik.' });
      if (registered) return sendJson(res, 409, { error: 'Perangkat sudah terdaftar. Putuskan sesi dahulu jika ingin memasangkan ulang.' });
      pairingCode = await sock.requestPairingCode(normalized);
      return sendJson(res, 200, { code: pairingCode });
    }
    if (req.method === 'POST' && url.pathname === '/disconnect') {
      if (sock) { try { await sock.logout(); } catch {} }
      connected = false; connecting = false; registered = false; qrText = null; pairingCode = null; sock = null;
      fs.rmSync(AUTH_DIR, { recursive: true, force: true }); fs.mkdirSync(AUTH_DIR, { recursive: true });
      return sendJson(res, 200, { message: 'Sesi WhatsApp diputus.' });
    }
    if (req.method === 'POST' && url.pathname === '/send') {
      const { phone, text } = await bodyJson(req);
      const number = String(phone || '').replace(/\D/g, '');
      const message = String(text || '').trim();
      if (!connected || !sock) return sendJson(res, 409, { error: 'WhatsApp belum terhubung.' });
      if (!/^\d{8,15}$/.test(number) || !message || message.length > 4000) return sendJson(res, 400, { error: 'Nomor atau isi pesan tidak valid.' });
      if (optouts.has(number)) return sendJson(res, 403, { error: 'Pelanggan sudah berhenti berlangganan.' });
      const wait = MIN_INTERVAL_MS - (Date.now() - lastSendAt);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      const result = await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
      lastSendAt = Date.now();
      return sendJson(res, 200, { ok: true, messageId: result?.key?.id || null });
    }
    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) { logger.error(e); return sendJson(res, 500, { error: String(e?.message || e) }); }
});
server.listen(PORT, '0.0.0.0', () => logger.info(`Baileys API listening on ${PORT}`));
startSocket().catch(e => logger.error(e));
