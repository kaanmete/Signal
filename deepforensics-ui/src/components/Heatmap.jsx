import { useEffect, useRef } from 'react';

// Blue → Amber → Red thermal ramp, matching the badge colour scheme
function heatRGBA(v) {
  const c = Math.max(0, Math.min(1, v));
  let r, g, b, a;
  if (c < 0.5) {
    const t = c * 2;
    r = Math.round(14  + t * 231);   // #0ea5e9 → #f59e0b
    g = Math.round(165 - t *   7);
    b = Math.round(233 - t * 222);
    a = 0.2 + t * 0.45;
  } else {
    const t = (c - 0.5) * 2;
    r = Math.round(245 - t *   6);   // #f59e0b → #ef4444
    g = Math.round(158 - t *  90);
    b = Math.round(11  - t *  11);
    a = 0.65 + t * 0.3;
  }
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

/**
 * DCT high-frequency energy heatmap. FR-22.
 * data: 2D array [rows][cols] normalised 0–1 (12×16 grid from backend).
 * frameImage: base64 data URL of a representative video frame (optional).
 * faceRectNorm: [x, y, w, h] as fractions of frame dimensions (optional).
 * When frameImage is provided the heatmap is drawn over the real frame,
 * satisfying the SRS requirement to "overlay onto video frames."
 */
export default function Heatmap({
  height = 280,
  showBox = true,
  showHeat = true,
  data = null,
  faceDetected = false,
  frameImage = null,
  faceRectNorm = null,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const draw = (bgImg) => {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.scale(dpr, dpr);

      const hasData = data && Array.isArray(data) && data.length > 0;

      // ── Background ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#050d1a';
      ctx.fillRect(0, 0, W, H);

      // ── Real video frame as background (FR-22) ──────────────────────────────
      let imgX = 0, imgY = 0, imgW = W, imgH = H;
      if (bgImg) {
        const scale = Math.min(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
        imgW = bgImg.naturalWidth * scale;
        imgH = bgImg.naturalHeight * scale;
        imgX = (W - imgW) / 2;
        imgY = (H - imgH) / 2;
        ctx.drawImage(bgImg, imgX, imgY, imgW, imgH);
        // Darken frame slightly so heatmap colour stands out
        ctx.fillStyle = 'rgba(5, 13, 26, 0.42)';
        ctx.fillRect(0, 0, W, H);
      }

      // ── Determine face region in canvas coordinates ─────────────────────────
      // When frame + face rect are available, map them precisely.
      // Otherwise use hardcoded centre proportions as fallback.
      let bx, by, bw, bh;
      if (faceRectNorm && bgImg) {
        const [nx, ny, nw, nh] = faceRectNorm;
        bx = imgX + nx * imgW;
        by = imgY + ny * imgH;
        bw = nw * imgW;
        bh = nh * imgH;
      } else {
        bx = W * 0.28; by = H * 0.12; bw = W * 0.44; bh = H * 0.70;
      }

      // ── Block grid guide (only drawn when no real frame is behind it) ───────
      if (!bgImg) {
        const gridCols = hasData ? (data[0]?.length ?? 16) : 16;
        const gridRows = hasData ? data.length : 12;
        ctx.strokeStyle = 'rgba(30,41,59,0.55)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i < gridCols; i++) {
          const x = (i / gridCols) * W;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let j = 1; j < gridRows; j++) {
          const y = (j / gridRows) * H;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
      }

      // ── DCT heatmap overlay inside face region ──────────────────────────────
      if (showHeat) {
        if (hasData) {
          const rows = data.length;
          const cols = data[0]?.length ?? 0;
          if (rows > 0 && cols > 0) {
            const cw = bw / cols;
            const ch = bh / rows;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const v = data[r]?.[c] ?? 0;
                if (v > 0.02) {
                  ctx.fillStyle = heatRGBA(v);
                  ctx.fillRect(bx + c * cw, by + r * ch, cw + 0.5, ch + 0.5);
                }
              }
            }
          }
        } else {
          // Synthetic preview
          const cols = 16, rows = 12;
          const cw = bw / cols, ch = bh / rows;
          for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
              const dx = (i - cols / 2) / (cols / 2);
              const dy = (j - rows / 2) / (rows / 2);
              const dist = Math.sqrt(dx * dx + dy * dy);
              const v = Math.exp(-Math.pow((dist - 0.5) * 4, 2)) + 0.1 * Math.sin(i * 0.65 + j * 0.4);
              if (v > 0.15) {
                ctx.fillStyle = heatRGBA(Math.min(1, v));
                ctx.fillRect(bx + i * cw, by + j * ch, cw, ch);
              }
            }
          }
        }
      }

      // ── Analysed region bounding box ─────────────────────────────────────────
      if (showBox) {
        const boxColor = faceDetected ? 'rgba(56,189,248,0.85)' : 'rgba(100,116,139,0.5)';
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        // Corner accent brackets
        const cs = 9;
        ctx.lineWidth = 2;
        ctx.strokeStyle = faceDetected ? 'rgba(56,189,248,1)' : 'rgba(100,116,139,0.75)';
        [
          [bx,      by,       1,  1],
          [bx + bw, by,      -1,  1],
          [bx,      by + bh,  1, -1],
          [bx + bw, by + bh, -1, -1],
        ].forEach(([cx, cy, dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(cx + dx * cs, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + dy * cs);
          ctx.stroke();
        });

        ctx.fillStyle = faceDetected ? 'rgba(56,189,248,0.9)' : 'rgba(100,116,139,0.7)';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(
          faceDetected ? 'face · detected' : 'center region · no face',
          bx + 4, by - 5
        );
      }

      // ── Colour scale legend (bottom-right) ───────────────────────────────────
      const lgW = 72, lgH = 7, lgX = W - lgW - 6, lgY = H - lgH - 14;
      const grad = ctx.createLinearGradient(lgX, 0, lgX + lgW, 0);
      grad.addColorStop(0,   'rgba(14,165,233,0.7)');
      grad.addColorStop(0.5, 'rgba(245,158,11,0.85)');
      grad.addColorStop(1,   'rgba(239,68,68,0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(lgX, lgY, lgW, lgH);
      ctx.fillStyle = 'rgba(148,163,184,0.75)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('low',  lgX, lgY - 2);
      ctx.fillText('high', lgX + lgW - 20, lgY - 2);

      if (!hasData) {
        ctx.fillStyle = 'rgba(100,116,139,0.65)';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillText('preview · awaiting analysis', 8, H - 10);
      }
    };

    if (frameImage) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = frameImage;
    } else {
      draw(null);
    }
  }, [showBox, showHeat, data, faceDetected, frameImage, faceRectNorm, height]);

  return (
    <canvas ref={ref} style={{ width: '100%', height, display: 'block', borderRadius: 8 }} />
  );
}
