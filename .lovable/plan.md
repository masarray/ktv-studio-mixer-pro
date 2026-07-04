
# K500 Preset Studio — DAW Mixer Redesign (React Port)

Tujuan: porting app vanilla JS Anda ke project Lovable (React + TanStack Start + Tailwind v4) dengan tata letak & estetika yang benar-benar mirip Digital Mixer / DAW kelas atas — bukan sekedar dashboard form.

## Arah desain (langsung diterapkan, tidak via prototype)

**Mood**: console studio gelap, premium, classy. Bayangkan SSL/Neve console + Logic Pro X mixer + Universal Audio plugin UI.

- **Palette (dark, semantic tokens di `src/styles.css`)**
  - `--bg`: `oklch(0.14 0.012 250)` (graphite hampir hitam)
  - `--surface`: `oklch(0.18 0.014 250)` (panel rack)
  - `--surface-raised`: `oklch(0.22 0.016 250)` dengan inner highlight 1px untuk efek brushed metal
  - `--bevel-hi` / `--bevel-lo`: garis tipis untuk efek 3D channel strip
  - `--accent` (LED amber): `oklch(0.78 0.17 70)` — untuk readout angka, lampu aktif
  - `--accent-2` (LED cyan): `oklch(0.82 0.13 200)` — untuk select/hover, EQ node aktif
  - `--meter-green` / `--meter-yellow` / `--meter-red`: gradient meter VU
  - `--gold`: `oklch(0.78 0.11 85)` untuk aksen mewah (logo, garis pemisah master section)
- **Tipografi**: heading `Space Grotesk` (atau `Sora`), body `Inter Tight`, **readout angka `JetBrains Mono`** (wajib monospace — meniru LED segment displays). Load via `<link>` di `__root.tsx` head.
- **Texture**: gradient halus + noise SVG `data-uri` di body untuk efek panel logam disikat. Inner shadow + 1px highlight di tiap panel = bevel.
- **Motion**: tidak ada flashy animation. Hanya: meter VU smooth decay, LED glow saat aktif, knob/fader transisi 120ms.

## Tata letak DAW (3 zona × baris meter bridge)

Berbeda dari versi sekarang (sidebar nav + workspace + inspector kolom kanan), versi baru meniru struktur console fisik:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ TRANSPORT BAR — brand · preset name · checksum LED · Import/Export │
├─────────────────────────────────────────────────────────────────────┤
│ METER BRIDGE — VU meter strip semua bus (Mic A/B, Music, Main L/R, │
│ Surround L/R, Center, Sub, Rev, Echo) selalu terlihat              │
├──────────┬───────────────────────────────────────────┬──────────────┤
│  RACK    │  CHANNEL VIEW (page aktif)                │  MASTER      │
│  NAV     │  ┌─ EQ Graph (lebar penuh, dark glass)─┐ │  SECTION     │
│  Mic     │  │  drag node, grid log, LED nodes     │ │              │
│  Music   │  └─────────────────────────────────────┘ │  Master      │
│  Main    │  ┌─ Channel Strips (vertikal) ────────┐ │  faders      │
│  Surr    │  │ Input · Dyn · EQ band table · Out  │ │  (Music/Mic/ │
│  Center  │  │ tiap strip = kolom fader + knob    │ │  Effect)     │
│  Sub     │  │ + LED readout monospace            │ │              │
│  Reverb  │  └─────────────────────────────────────┘ │  Band        │
│  Echo    │  ┌─ Compressor / Filter rack ─────────┐ │  Inspector   │
│  System  │  │ transfer-curve graph + knob row    │ │              │
│          │  └─────────────────────────────────────┘ │  Sonic Guard │
└──────────┴───────────────────────────────────────────┴──────────────┘
```

Kunci "rasa DAW":
- **Channel strip vertikal**: fader panjang (>= 220px), skala dB di sebelahnya, tombol mute/solo kecil di atas, LED label di bawah. Saat ini fader Anda horizontal-pendek — itu yang bikin terasa "form" bukan "mixer".
- **Knob bulat** (CSS conic-gradient + inner shadow) menggantikan number input untuk parameter ms/Hz/ratio. Number tetap muncul sebagai readout monospace di bawah knob.
- **Meter bridge persisten** di atas — fitur ikonik mixer digital, sebelumnya tidak ada.
- **Master section di kanan** diberi garis emas tipis & background sedikit lebih terang → memisahkan secara visual seperti master strip console asli.
- **Tab EQ key** (Mic A / Mic B / dst.) jadi tombol metal kecil ala channel-select Yamaha.
- **Rack nav kiri** jadi kolom sempit ikon + label kecil (icon Lucide: Mic2, Music2, Speaker, Waves, Radio, dst.) — seperti device chooser di Ableton.

## Struktur file (React port)

```
src/
  routes/
    __root.tsx                  # load fonts, body bg, noise overlay
    index.tsx                   # mount <StudioShell />
  features/k500/
    parser.ts                   # port dari k500Parser.js (TS, tanpa perubahan logika)
    types.ts                    # tipe Preset, EqSection, Band, dll
    store.ts                    # Zustand store (preset, page, eqKey, selectedBand, dirty)
    sample.ts                   # import sample binary via ?url
  components/studio/
    StudioShell.tsx             # grid 3-zona + meter bridge + transport
    TransportBar.tsx
    MeterBridge.tsx             # array VU meter (animasi smooth via requestAnimationFrame)
    RackNav.tsx                 # nav kiri (ikon + label)
    MasterSection.tsx           # kanan: master fader + inspector + warnings
    pages/
      MicPage.tsx
      MusicPage.tsx
      OutputPage.tsx            # dipakai main/surround/center/sub via prop
      ReverbPage.tsx
      EchoPage.tsx
      SystemPage.tsx
    EqGraph.tsx                 # SVG, drag node, alt+wheel Q (port wireEqGraphDrag)
    BandTable.tsx
    ChannelStrip.tsx            # vertikal: header · fader · readout · mute
    Fader.tsx                   # vertical range input + custom rail + LED cap
    Knob.tsx                    # rotary knob (drag vertical = nilai)
    LedReadout.tsx              # angka monospace bergaya 7-segment
    CompressorGraph.tsx         # port compressorSvg
    PitchSelector.tsx
  styles.css                    # token + @theme + utility (.panel-bevel, .led-amber, ...)
  assets/sample.k500            # samples/04_KARAOKE_ARTIST.k500
```

## Langkah implementasi

1. **Tokens & shell** — tulis ulang `src/styles.css` dengan palette di atas (semua via `@theme inline` + `:root`), pasang font via `<link>` di `__root.tsx`, set body gelap + noise overlay. Hapus placeholder di `index.tsx`.
2. **Port parser** — copy `k500Parser.js` jadi `features/k500/parser.ts`, tambah tipe TS (`Preset`, `EqSection`, `Band`, dll). Logika tidak diubah → checksum tetap aman.
3. **Store** — Zustand untuk state global (preset, page, eqKey, selectedBand, dirty, originalBytes). Action: `importBuffer`, `setBandValue`, `setPath`, `exportPreset`, `copyMicAtoB`, dll — port 1:1 dari `app.js`.
4. **Komponen primitif** — `Fader` (vertikal, range native + style custom), `Knob` (SVG + drag), `LedReadout`, `ChannelStrip`. Ini fondasi visual.
5. **EQ Graph** — port `renderEqGraph` + `wireEqGraphDrag` jadi `EqGraph.tsx` (gunakan `useRef` + pointer events, bukan global `window.onmousemove`). Glow di node aktif, grid log halus.
6. **Halaman per page** — render channel strip + compressor + filter sesuai page (sama seperti `renderScalarRack` saat ini). Kolom: input strips kiri, dynamics tengah, filter/crossover kanan dalam grid horizontal padat ala mixer.
7. **Meter Bridge** — komputasi level "fake" dari nilai volume saat ini + animasi peak-hold (decay -1 dB/frame) untuk efek hidup, walau tidak ada audio realtime.
8. **Master Section** — gabung `renderMasterStrip` + `renderInspector` + `Sonic guard` jadi kolom kanan dengan vertical fader master + band inspector + warnings.
9. **Transport Bar** — brand, preset name input inline, status checksum sebagai LED bulat (hijau/amber), tombol Import/Demo/Export bergaya tombol metal.
10. **Polish** — bevel 1px, inner shadow tiap panel, gold separator di master, hover state LED, focus ring cyan tipis. Cek responsive minimal 1280px+; di bawah itu rack nav collapse ke ikon saja.

## Detail teknis penting (untuk pengembang)

- **Sample binary** di-import dengan `import sampleUrl from "@/assets/sample.k500?url"` lalu `fetch(sampleUrl)` — tidak perlu route loader.
- **File import/export** tetap client-side (FileReader + Blob) — tidak butuh server function, jadi tidak perlu Lovable Cloud untuk fitur inti ini.
- **Parser**: `parseK500Preset(buffer)` dan `serializeK500Preset(preset)` tetap pure functions, dipanggil dari store action.
- **EQ drag**: pakai `onPointerDown` + `setPointerCapture` di node, hindari mendaftarkan listener di `window` agar tidak bocor antar render.
- **Tidak** tambah dependency berat. Hanya: `zustand` (state), `lucide-react` (icon, sudah ada), `clsx` (sudah ada via shadcn util).
- **shadcn**: tidak perlu Button/Card default — komponen mixer kustom semua (Button shadcn terlalu "form"). Hanya `Tooltip` mungkin dipakai untuk hint.
- **Tidak** menyentuh `routeTree.gen.ts`, tidak membuat `_app/`, tidak menambah route baru — semuanya di `/`.

## Yang tidak dikerjakan di rencana ini

- Audio playback realtime (Web Audio API) — bisa fase berikutnya.
- Undo/redo, preset library, A/B compare — fase berikutnya jika diminta.
- Mobile layout (di bawah 1024px) hanya dapat fallback "buka di desktop" — DAW UI memang butuh lebar.

Setelah Anda approve, saya kerjakan dalam 1 batch besar lalu verifikasi build.
