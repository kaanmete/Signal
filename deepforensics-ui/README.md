# DeepForensics UI

Sample React UI mockups for the **Deepfake Forensic Analysis Engine** (CENG 384).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Pages

| Route | Description |
|-------|-------------|
| `/` | Upload / landing page (drag-drop + analysis options) |
| `/processing` | Real-time pipeline progress with live log |
| `/results` | Results dashboard — probability gauge, spectrogram, heatmap, tabs |
| `/results` (Timeline tab) | Audio/video anomaly correlation timeline |

## Tech

- React 18 + Vite
- React Router v6
- Pure CSS (no UI framework dependency)
- HTML Canvas for spectrogram / heatmap / MFCC visualizations

## Structure

```
src/
├── App.jsx
├── main.jsx
├── components/
│   ├── NavBar.jsx
│   ├── ProbabilityGauge.jsx
│   ├── Spectrogram.jsx        ← canvas, viridis palette
│   ├── Heatmap.jsx            ← canvas, DCT heat overlay
│   ├── AudioDetailTab.jsx     ← MFCC + phase + vocoder band
│   └── ReportModal.jsx        ← PDF generation modal
├── pages/
│   ├── UploadPage.jsx
│   ├── ProcessingPage.jsx
│   └── ResultsPage.jsx
└── styles/
    └── index.css              ← design tokens & global styles
```

## Notes

- All visualizations are **simulated** (canvas drawn) — wire to your FastAPI/Flask backend by replacing the canvas data sources with real STFT / DCT / MFCC arrays.
- Color palette is colorblind-safe (viridis) per NFR-04.
- Includes WebSocket-style live log placeholder per FR-02.
