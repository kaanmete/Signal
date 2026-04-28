import { useEffect, useRef } from 'react';
import './AudioDetailTab.css';

function MFCCHeatmap() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cols = 120, rows = 13;
    const cw = W / cols, ch = H / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const v = 0.5 + 0.5 * Math.sin(i * 0.18 + j * 0.45) * Math.cos(i * 0.07 - j * 0.2);
        const r = Math.round(v * 60 + 14);
        const g = Math.round(v * 100 + 30);
        const b = Math.round(v * 200 + 30);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
      }
    }
    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    [1, 4, 7, 10, 13].forEach((c, idx) => {
      ctx.fillText(`c${c}`, 2, ((13 - c) / 13) * (H - 12) + 12);
    });
  }, []);
  return <canvas ref={ref} className="mfcc-canvas" />;
}

function PhaseChart() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.setLineDash([4, 4]);
    const thr = H * 0.35;
    ctx.beginPath(); ctx.moveTo(0, thr); ctx.lineTo(W, thr); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const v = 0.5 + 0.3 * Math.sin(x * 0.05) + 0.15 * Math.sin(x * 0.13);
      const spike = x > W * 0.55 && x < W * 0.62 ? 0.45 : 0;
      const y = H - (v + spike) * H * 0.7 - 10;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // anomaly marker
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(W * 0.58, H * 0.18, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText('threshold 0.65', 8, thr - 4);
    ctx.fillText('⚠ spike at 14.2s', W * 0.58 + 8, H * 0.18);
  }, []);
  return <canvas ref={ref} className="phase-canvas" />;
}

export default function AudioDetailTab({ anomalies }) {
  return (
    <div className="audio-detail">
      <div className="card">
        <div className="card-head">
          <h3>MFCC coefficient heatmap (13 × time)</h3>
          <span className="muted tiny">25ms Hamming-windowed frames</span>
        </div>
        <MFCCHeatmap />
      </div>

      <div className="audio-grid">
        <div className="card">
          <div className="card-head">
            <h3>Phase continuity</h3>
            <span className="badge high">⚠ 1 spike</span>
          </div>
          <PhaseChart />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Vocoder band (&gt;8 kHz)</h3>
            <span className="badge high">ABOVE</span>
          </div>
          <div className="vb-stats">
            <div className="vb-row">
              <span className="muted">Energy</span>
              <span className="mono">0.42</span>
            </div>
            <div className="vb-row">
              <span className="muted">Threshold</span>
              <span className="mono">0.18</span>
            </div>
            <div className="vb-row">
              <span className="muted">Suggests</span>
              <span>vocoder / TTS synthesis</span>
            </div>
            <div className="bar bar-tall">
              <div className="bar-fill" style={{ width: '78%', background: 'var(--danger)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Detected audio anomalies</h3>
          <button className="ghost tiny">Export CSV</button>
        </div>
        <table className="anomaly-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Confidence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a, i) => (
              <tr key={i}>
                <td className="mono">{a.time}</td>
                <td>{a.type}</td>
                <td><span className={`badge ${a.severity}`}>{a.severity.toUpperCase()}</span></td>
                <td className="mono">{a.conf.toFixed(2)}</td>
                <td><button className="ghost tiny">Inspect</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
