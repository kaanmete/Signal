import { useEffect, useRef } from 'react';

// 11-stop viridis palette (colorblind-safe, perceptually uniform)
const VIRIDIS = [
  [68,  1,  84], [72, 35, 116], [64, 67, 135], [52, 94, 141],
  [41, 120, 142], [32, 144, 140], [34, 167, 132], [68, 190, 112],
  [121, 209, 81], [189, 222, 38], [253, 231, 37],
];

function viridisRGB(v) {
  v = Math.max(0, Math.min(1, v));
  const idx = v * (VIRIDIS.length - 1);
  const i = Math.floor(idx);
  const t = idx - i;
  const a = VIRIDIS[i];
  const b = VIRIDIS[Math.min(VIRIDIS.length - 1, i + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const MAX_MARKERS = 12;

/**
 * STFT spectrogram canvas.
 * data: 2D array [rows][cols] normalised 0–1 from backend (80×200 target).
 * Renders pixel-perfect via ImageData with gamma correction for visibility.
 */
export default function Spectrogram({ height = 240, anomalies = [], data = null, duration = 30 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.scale(dpr, dpr);

    // Padding for axes
    const PL = 38, PB = 20, PT = 8, PR = 6;
    const pW = W - PL - PR;
    const pH = H - PB - PT;

    // Background
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, W, H);

    // ── Spectrogram pixels ──────────────────────────────────────────────────
    const hasData = data && Array.isArray(data) && data.length > 0;

    if (hasData) {
      const rows = data.length;
      const cols = data[0]?.length ?? 0;
      if (rows > 0 && cols > 0) {
        const imgData = ctx.createImageData(pW, pH);
        const d = imgData.data;
        for (let py = 0; py < pH; py++) {
          // Flip vertically: row 0 in data = lowest frequency → canvas bottom
          const srcRow = Math.round(((pH - 1 - py) / (pH - 1)) * (rows - 1));
          const rowArr = data[srcRow];
          for (let px = 0; px < pW; px++) {
            const srcCol = Math.round((px / (pW - 1)) * (cols - 1));
            const raw = rowArr?.[srcCol] ?? 0;
            // Gamma < 1 brightens mid-range so faint harmonics are visible
            const v = Math.pow(Math.max(0, Math.min(1, raw)), 0.6);
            const [r, g, b] = viridisRGB(v);
            const off = (py * pW + px) * 4;
            d[off] = r; d[off + 1] = g; d[off + 2] = b; d[off + 3] = 255;
          }
        }
        ctx.putImageData(imgData, PL, PT);
      }
    } else {
      // Synthetic fallback – shows what the real data would look like
      const imgData = ctx.createImageData(pW, pH);
      const d = imgData.data;
      for (let py = 0; py < pH; py++) {
        const fr = 1 - py / pH;
        for (let px = 0; px < pW; px++) {
          const x = px / pW;
          const base = 0.35 + 0.28 * Math.sin(x * 14 + fr * 4) + 0.14 * Math.sin(x * 33 - fr * 9);
          const harm  = 0.5  * Math.exp(-Math.pow((fr - 0.20) * 6, 2));
          let v = (base + harm) * (0.3 + fr * 0.7);
          if (fr > 0.6 && x > 0.35 && x < 0.65) v += 0.28;
          const [r, g, b] = viridisRGB(Math.pow(Math.max(0, Math.min(1, v)), 0.6));
          const off = (py * pW + px) * 4;
          d[off] = r; d[off + 1] = g; d[off + 2] = b; d[off + 3] = 255;
        }
      }
      ctx.putImageData(imgData, PL, PT);
      ctx.fillStyle = 'rgba(100,116,139,0.85)';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('preview – no data', PL + 8, PT + 20);
    }

    // ── Frequency axis (left) ───────────────────────────────────────────────
    const freqTicks = [
      { hz: 8000, label: '8k' },
      { hz: 4000, label: '4k' },
      { hz: 2000, label: '2k' },
      { hz: 500,  label: '500' },
    ];
    ctx.textAlign = 'right';
    ctx.font = '10px JetBrains Mono, monospace';
    freqTicks.forEach(({ hz, label }) => {
      const y = PT + pH * (1 - hz / 8000);
      ctx.fillStyle = 'rgba(148,163,184,0.8)';
      ctx.fillText(label, PL - 4, y + 4);
      ctx.strokeStyle = 'rgba(148,163,184,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + pW, y); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(100,116,139,0.7)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Hz', 2, PT + 12);

    // ── Time axis (bottom) ──────────────────────────────────────────────────
    const tStep = duration <= 15 ? 5 : duration <= 60 ? 10 : 30;
    ctx.textAlign = 'center';
    ctx.font = '10px JetBrains Mono, monospace';
    for (let s = 0; s <= duration; s += tStep) {
      const x = PL + (s / Math.max(duration, 0.001)) * pW;
      ctx.fillStyle = 'rgba(148,163,184,0.8)';
      ctx.fillText(`${s}s`, x, H - 4);
      ctx.strokeStyle = 'rgba(148,163,184,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + pH); ctx.stroke();
    }

    // ── Anomaly markers (capped to avoid overload) ──────────────────────────
    const visible  = anomalies.slice(0, MAX_MARKERS);
    const overflow = anomalies.length - visible.length;
    visible.forEach((a) => {
      const x = PL + (a.t / Math.max(duration, 0.001)) * pW;
      ctx.strokeStyle = 'rgba(239,68,68,0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + pH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(x, PT + 5, 3, 0, Math.PI * 2); ctx.fill();
    });
    if (overflow > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(239,68,68,0.85)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`+${overflow} more`, PL + 6, PT + 18);
    }
  }, [anomalies, data, duration, height]);

  return (
    <canvas ref={ref} style={{ width: '100%', height, display: 'block', borderRadius: 8 }} />
  );
}
