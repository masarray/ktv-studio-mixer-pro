# K500 Live Alpha v0.8.8 — Native Bridge: Zero-Popup Smart Connect

## Kenapa jalur ini
Popup pemilihan device adalah security model browser dan tidak bisa dilewati
dari dalam web app. App native "smart" karena berjalan di OS. Solusi: beri app
ini komponen OS-nya sendiri — bridge Node kecil yang otomatis hidup bersama
`vite dev` (plugin `k500BridgePlugin` di vite.config.ts) atau standalone via
`npm run bridge`.

## Arsitektur
Web app ──WebSocket ws://127.0.0.1:8500/k500──▶ tools/k500-bridge.mjs
                                                 ├─ BT : serialport → sisir semua COM BTHENUM,
                                                 │       probe heartbeat 0x1C, first responder wins,
                                                 │       COM terakhir yang sukses dicoba pertama
                                                 └─ USB: node-hid → VID 10C4 PID 0321 (DSP AUDIO),
                                                         framing USB (len16, report 64B) di sisi bridge

- App SELALU mengirim frame framing-BT; konversi USB milik bridge.
- Connect: Path 1 = bridge (nol popup). Bridge tidak jalan → fallback ke
  Web Serial/WebHID lama (popup sekali per origin).
- Bridge putus (dev server restart) → status disconnected dengan pesan jelas.
- Protokol WS: connect/tx/disconnect ↔ hello/status/connected/rx/error/closed.

## Setup (sekali)
`npm install`  →  `npm run dev`  →  klik Connect. Tidak ada popup.
Dependensi baru (devDependencies): ws, serialport, node-hid (prebuilt Windows).

## Catatan
- Versi deploy (Cloudflare) tetap bisa zero-popup selama bridge jalan di PC
  user (`npm run bridge`); ws://127.0.0.1 diizinkan dari halaman https.
- Probe protokol tetap satu-satunya penentu identitas device — tidak pernah
  menebak dari nama port saja.
