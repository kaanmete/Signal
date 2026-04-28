import { useEffect, useRef } from 'react';

// Simulated spectrogram using Canvas. Generates pseudo-random energy values
// in a viridis-like colorblind-safe palette, with anomaly bands highlighted.
export default function Spectrogram({ height = 220, anomalies = [] }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cols = 240;
    const rows = 60;
    const cellW = W / cols;
    const cellH = H / rows;

    // viridis-like color stops
    const stops = [
      [68, 1, 84],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37]
    ];
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const color = (v) => {
      v = Math.max(0, Math.min(1, v));
      const seg = v * (stops.length - 1);
      const i = Math.floor(seg);
      const t = seg - i;
      const a = stops[i];
      const b = stops[Math.min(stops.length - 1, i + 1)];
      return `rgb(${lerp(a[0], b[0], t)},${lerp(a[1], b[1], t)},${lerp(a[2], b[2], t)})`;
    };

    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const freqRatio = 1 - y / rows;
        const base =
          0.45 +
          0.35 * Math.sin(x * 0.08 + y * 0.05) +
          0.2 * Math.sin(x * 0.31 - y * 0.12);
        const harmonic = 0.4 * Math.exp(-Math.pow((freqRatio - 0.25) * 4, 2));
        let v = (base + harmonic) * (0.4 + freqRatio * 0.6);

        // anomaly band overlay (above 8 kHz region)
        if (freqRatio > 0.7 && x > cols * 0.4 && x < cols * 0.7) v += 0.35;

        ctx.fillStyle = color(v);
        ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // anomaly markers
    ctx.strokeStyle = 'rgba(239,68,68,0.9)';
    ctx.lineWidth = 2;
    anomalies.forEach((a) => {
      const x = (a.t / 30) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    });

    // axes labels
    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = '11px JetBrains Mono, monospace';
    ['8', '6', '4', '2', '0'].forEach((label, i) => {
      ctx.fillText(`${label}k`, 4, (i / 4) * (H - 12) + 12);
    });
    ['0', '5', '10', '15', '20', '25', '30'].forEach((label, i) => {
      ctx.fillText(`${label}s`, (i / 6) * (W - 24) + 8, H - 4);
    });
  }, [anomalies, height]);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height, display: 'block', borderRadius: 8 }}
    />
  );
}
