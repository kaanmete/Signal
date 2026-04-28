import { useEffect, useRef } from 'react';

// Simulated face frame with DCT anomaly heatmap overlay.
export default function Heatmap({ height = 280, showBox = true, showHeat = true }) {
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

    // Background "video frame" — a soft gradient simulating a face scene
    const grad = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W / 1.4);
    grad.addColorStop(0, '#3b3a52');
    grad.addColorStop(0.5, '#1f2235');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // simulated face oval
    ctx.fillStyle = 'rgba(180, 150, 130, 0.55)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2 - 8, W * 0.18, H * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Heatmap overlay (8x8 block grid, hotspots near face perimeter)
    if (showHeat) {
      const cols = 16, rows = 12;
      const cw = W / cols, ch = H / rows;
      const cx = cols / 2, cy = rows / 2;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const dx = (i - cx) / (cols / 2);
          const dy = (j - cy) / (rows / 2);
          const r = Math.sqrt(dx * dx + dy * dy);
          // ring of high anomalies near the bounding box edge
          const ring = Math.exp(-Math.pow((r - 0.55) * 4, 2));
          const v = ring + 0.15 * Math.sin(i * 0.7 + j * 0.5);
          if (v > 0.25) {
            const alpha = Math.min(0.7, v);
            const c = v > 0.6 ? '239,68,68' : v > 0.4 ? '245,158,11' : '14,165,233';
            ctx.fillStyle = `rgba(${c},${alpha})`;
            ctx.fillRect(i * cw, j * ch, cw, ch);
          }
        }
      }
    }

    // Face bounding box
    if (showBox) {
      ctx.strokeStyle = 'rgba(56,189,248,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(W * 0.32, H * 0.20, W * 0.36, H * 0.55);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(56,189,248,0.95)';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('face · 0.97', W * 0.32 + 4, H * 0.20 - 4);
    }
  }, [showBox, showHeat, height]);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height, display: 'block', borderRadius: 8 }}
    />
  );
}
