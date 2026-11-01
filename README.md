# El Shop Manager — Baileys + Vercel + Pterodactyl

Project ini memisahkan website Next.js di Vercel dan backend WhatsApp Baileys di server Node.js yang berjalan melalui Pterodactyl.

## Struktur

- `app/` — dashboard Next.js dan API proxy Vercel.
- `lib/` — helper Supabase dan proxy backend Baileys.
- `supabase/schema.sql` — skema database awal.
- `baileys-server/` — backend Baileys yang dipasang sebagai server Node.js di Pterodactyl.

**Penting:** Baileys adalah integrasi WhatsApp Web tidak resmi, bukan WhatsApp Business Platform resmi. Penggunaan dapat tidak stabil dan dapat berisiko terhadap akun/nomor. Gunakan hanya untuk komunikasi yang diizinkan, khususnya pelanggan yang secara jelas setuju menerima pesan. Jangan mengirim spam, pesan ke daftar hasil scraping, atau mengabaikan permintaan berhenti. Backend membatasi kecepatan pengiriman dan memblokir nomor yang membalas STOP/BERHENTI.

## A. Siapkan Supabase

1. Buat project Supabase.
2. Buka SQL Editor, jalankan `supabase/schema.sql`.
3. Salin Project URL, anon key, dan service role key dari Project Settings → API.
4. Atur Authentication → URL Configuration dengan domain Vercel setelah deployment.

## B. Deploy website ke GitHub dan Vercel

1. Ekstrak ZIP ini.
2. Buat repository GitHub baru, misalnya `el-shop-manager`.
3. Upload seluruh isi folder project (isi ZIP, bukan folder pembungkusnya) ke repository.
4. Login ke Vercel, pilih Add New → Project, lalu import repository tersebut.
5. Framework akan terdeteksi sebagai Next.js. Deploy setelah environment variables tersedia (atau deploy dulu lalu isi variabel dan redeploy).
6. Di Vercel → Project → Settings → Environment Variables, isi:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BAILEYS_API_URL` — URL HTTPS backend Baileys, misalnya `https://baileys.domainkamu.com` (tanpa `/` di akhir).
   - `BAILEYS_API_KEY` — rahasia panjang acak; nilainya harus sama dengan yang di Pterodactyl.
   - `OPTOUT_CALLBACK_SECRET` — rahasia panjang acak; nilainya harus sama dengan yang di Pterodactyl.
   - `CRON_SECRET` — rahasia acak untuk cron.
   - `INITIAL_ADMIN_EMAIL` — email admin awal.
7. Simpan dan lakukan Redeploy.

Jangan masukkan file `.env` ke GitHub. Jangan pernah menaruh API key di kode browser.

## C. Siapkan backend Baileys di Pterodactyl

Pterodactyl Panel hanya panel untuk mengelola proses server. Website Vercel tidak tersambung ke URL panelnya; website tersambung ke URL API backend Node.js yang berjalan di dalam server Pterodactyl.

1. Login ke Pterodactyl milik penyedia hosting.
2. Buat server baru dan pilih Egg/Docker Image Node.js yang menyediakan Node.js 20 atau lebih baru.
3. Pastikan server mendapat alokasi port. Catat port tersebut.
4. Upload **isi folder `baileys-server/`** ke File Manager server Pterodactyl: `package.json`, `server.js`, dan `.env.example` (jangan upload file `.env` yang berisi rahasia ke GitHub).
5. Atur Startup Command menjadi `npm install && npm start` jika panel mengizinkan perintah tersebut. Jika startup command sudah ditetapkan oleh penyedia, gunakan format startup Node.js dari penyedia dan pastikan menjalankan `npm start`.
6. Atur environment variables server Pterodactyl:
   - `PORT` = port allocation yang diberikan panel.
   - `BAILEYS_API_KEY` = nilai yang sama persis dengan Vercel.
   - `AUTH_DIR` = `./data/auth`.
   - `OPT_OUT_FILE` = `./data/optouts.json`.
   - `MIN_SEND_INTERVAL_MS` = `5000`.
   - `OPTOUT_CALLBACK_URL` = `https://DOMAIN-VERCEL/api/webhooks/baileys`.
   - `OPTOUT_CALLBACK_SECRET` = nilai yang sama persis dengan Vercel.
7. Pastikan folder `data/` berada pada penyimpanan server yang persisten. Jangan menghapus folder ini saat restart biasa karena berisi sesi perangkat dan daftar opt-out.
8. Start server. Console seharusnya menunjukkan `Baileys API listening on ...`.
9. Uji endpoint `/health` pada alamat backend. Respons yang diharapkan: `{"ok":true,"service":"el-shop-baileys"}`.

### URL backend dan HTTPS

Untuk produksi, arahkan subdomain seperti `baileys.domainkamu.com` ke IP dan port server Pterodactyl menggunakan reverse proxy HTTPS (misalnya Nginx/Caddy yang dikelola penyedia VPS). Isi URL subdomain HTTPS tersebut sebagai `BAILEYS_API_URL` di Vercel. Jangan gunakan URL login panel Pterodactyl sebagai `BAILEYS_API_URL`. Jika penyedia hanya memberi IP:port tanpa HTTPS, tanyakan cara mengaktifkan HTTPS/reverse proxy kepada penyedia hosting sebelum dipakai.

## D. Hubungkan WhatsApp dari dashboard

1. Buka website Vercel dan login.
2. Di bagian **Hubungkan WhatsApp**, tekan **Tampilkan QR Code**.
3. Di WhatsApp pada HP: Setelan → Perangkat tertaut → Tautkan perangkat, lalu scan QR yang tampil di dashboard.
4. Alternatif pairing code: masukkan nomor dengan kode negara (contoh format `62812...`), tekan **Buat Pairing Code**, lalu masukkan kode melalui menu perangkat tertaut jika WhatsApp menampilkan opsi tautkan dengan nomor telepon.
5. Dashboard akan memperbarui status koneksi secara berkala.

Sesi disimpan pada `baileys-server/data/auth`. Jangan membagikan isi folder tersebut karena dapat memberikan akses ke sesi WhatsApp.

## E. Membuat campaign

1. Tambahkan kontak dengan nomor internasional.
2. Centang pernyataan bahwa pelanggan sudah menyetujui menerima promosi.
3. Buat campaign dan isi **Isi pesan promosi**.
4. Pastikan pesan menjelaskan toko/pengirim dan cara berhenti, misalnya “Balas STOP untuk berhenti menerima pesan”.
5. Tekan Mulai. Cron Vercel memproses paling banyak dua kontak per campaign setiap menit; backend juga memberi jeda minimal lima detik antar-pesan.
6. Pelanggan yang membalas `STOP`, `BERHENTI`, atau `UNSUBSCRIBE` akan masuk daftar opt-out backend dan ditandai berhenti di database. Mereka tidak akan diproses oleh campaign berikutnya.
7. Gunakan tombol Hentikan untuk menghentikan campaign.

## F. Admin Supabase

1. Isi `INITIAL_ADMIN_EMAIL` sebelum mendaftarkan akun admin.
2. Daftar/login melalui website menggunakan email tersebut.
3. Jalankan SQL berikut di Supabase SQL Editor (ganti email):

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

Jangan membagikan service-role key.

## Troubleshooting singkat

- **Backend tidak dapat dijangkau:** periksa server Pterodactyl aktif, alokasi port, domain/reverse proxy HTTPS, dan `BAILEYS_API_URL`.
- **Unauthorized:** samakan `BAILEYS_API_KEY` di Vercel dan Pterodactyl.
- **QR belum tersedia:** tunggu beberapa detik lalu tekan Tampilkan QR Code lagi; periksa Console Pterodactyl.
- **Sesi keluar/logged out:** gunakan Putuskan WhatsApp di dashboard, lalu mulai koneksi ulang. Jika sesi rusak, hentikan server dan hapus hanya isi `data/auth`, lalu start kembali.
- **Campaign gagal:** periksa status koneksi WhatsApp, nomor tujuan, log dashboard, dan Console Pterodactyl.

## Batasan dan keamanan

- Baileys tidak resmi dan tidak menjamin kompatibilitas/keberlangsungan layanan.
- Versi awal memakai database kontak bersama seperti project asal; jangan membuka pendaftaran publik atau multi-toko sebelum skema dan kebijakan akses diubah menjadi multi-tenant.
- Endpoint backend dilindungi API key. Gunakan HTTPS untuk koneksi Vercel ke backend.
- Penyimpanan sesi wajib persisten dan hanya dapat diakses pemilik server.
- Uji dengan sejumlah kecil pelanggan yang sudah memberi izin. Hormati opt-out dan aturan WhatsApp yang berlaku.
