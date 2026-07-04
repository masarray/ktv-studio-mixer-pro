# K500 Live Alpha v0.8.1 — USB toggle + heartbeat stability fix

## Fix utama
1. USB/BT segmented control dibuat SSR-safe.
   - Initial render selalu deterministik `bt`.
   - Pilihan tersimpan di `localStorage` di-hydrate setelah React mount.
   - Mencegah state tombol yang stale sehingga USB tidak perlu dipancing dengan klik BT dulu.

2. USB write queue diperbaiki.
   - Sebelumnya `enqueueWrite()` hanya lanjut jika `writer` serial ada.
   - Pada mode USB HID, `writer` memang `null`, sehingga heartbeat/live-write yang lewat queue diam-diam tidak terkirim.
   - Guard sekarang menerima `writer` atau `hidDevice`.

3. Heartbeat dipisah dari `syncFromDevice()`.
   - Heartbeat loop mulai segera setelah transport verified dan status connected.
   - Cadence tetap 3200 ms mengikuti pola sniff/native app.
   - Pada USB, heartbeat memakai jalur direct `sendReport()` dengan timeout pendek, tidak menunggu queue editor/EQ.

4. USB disconnect listener ditambahkan.
   - Jika kabel USB dicabut atau device dilepas OS, status kembali disconnected dan log menampilkan penyebabnya.

## File yang berubah
- `src/features/k500/live/liveStore.ts`
- `src/components/studio/LiveDevicePanel.tsx`

## Verifikasi
`npm run build` sukses untuk client, SSR, dan Nitro/Cloudflare output.
