import { useEffect, useRef } from 'react';
import './AudioDetailTab.css';

function MFCCHeatmap({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    if (data && Array.isArray(data) && data.length > 0) {
      const rows = data.length, cols = data[0]?.length ?? 0;
      const cw = W / cols, ch = H / rows;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const v = data[j]?.[i] ?? 0;
          const r = Math.round(v * 60 + 14);
          const g = Math.round(v * 100 + 30);
          const b = Math.round(v * 200 + 55);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
        }
      }
    } else {
      // Synthetic fallback
      const cols = 120, rows = 13;
      const cw = W / cols, ch = H / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const v = 0.5 + 0.5 * Math.sin(i * 0.18 + j * 0.45) * Math.cos(i * 0.07 - j * 0.2);
          const r = Math.round(v * 60 + 14), g = Math.round(v * 100 + 30), b = Math.round(v * 200 + 30);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
        }
      }
    }

    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    [1, 4, 7, 10, 13].forEach((c) => {
      ctx.fillText(`c${c}`, 2, ((13 - c) / 13) * (H - 12) + 12);
    });
  }, [data]);
  return <canvas ref={ref} className="mfcc-canvas" />;
}

function PhaseChart({ phaseData, phaseTimes, anomalyTimes, threshold = 0.35 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Threshold line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.setLineDash([4, 4]);
    const thr = H * (1 - threshold);
    ctx.beginPath(); ctx.moveTo(0, thr); ctx.lineTo(W, thr); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    if (phaseData && phaseData.length > 1) {
      phaseData.forEach((v, i) => {
        const x = (i / phaseData.length) * W;
        const y = H - Math.max(0, Math.min(1, v)) * H * 0.85 - 5;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
    } else {
      // Synthetic fallback
      for (let x = 0; x < W; x++) {
        const v = 0.5 + 0.3 * Math.sin(x * 0.05) + 0.15 * Math.sin(x * 0.13);
        const spike = x > W * 0.55 && x < W * 0.62 ? 0.45 : 0;
        const y = H - (v + spike) * H * 0.7 - 10;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Anomaly markers — cap at 15 to avoid covering the chart
    const maxTime = phaseTimes?.length > 0 ? phaseTimes[phaseTimes.length - 1] : 30;
    const MAX_PHASE_MARKERS = 15;
    const allTimes = anomalyTimes || [];
    const visible  = allTimes.slice(0, MAX_PHASE_MARKERS);
    const overflow = allTimes.length - visible.length;
    visible.forEach((t) => {
      const x = (t / maxTime) * W;
      ctx.fillStyle = 'rgba(239,68,68,0.8)';
      ctx.beginPath();
      ctx.arc(x, H * 0.18, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(226,232,240,0.6)';
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillText(`${t.toFixed(1)}s`, x + 5, H * 0.18 + 3);
    });
    if (overflow > 0) {
      ctx.fillStyle = 'rgba(239,68,68,0.85)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`+${overflow} more anomalies`, W - 130, H * 0.18 + 3);
    }

    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(`threshold ${threshold.toFixed(2)}`, 8, thr - 4);
  }, [phaseData, phaseTimes, anomalyTimes, threshold]);
  return <canvas ref={ref} className="phase-canvas" />;
}

export default function AudioDetailTab({ anomalies = [], audioResults }) {
  const phaseAnomalyCount = audioResults?.phase_anomaly_times?.length ?? 0;
  const hfRatio = audioResults?.hf_ratio ?? 0;
  const vocoderDetected = audioResults?.vocoder_detected ?? false;

  return (
    <div className="audio-detail">
      <div className="card">
        <div className="card-head">
          <h3>MFCC coefficient heatmap (13 × time)</h3>
          <span className="muted tiny">25ms Hamming-windowed frames · FR-09</span>
        </div>
        <MFCCHeatmap data={audioResults?.mfcc_data ?? null} />
      </div>

      <div className="audio-grid">
        <div className="card">
          <div className="card-head">
            <h3>Phase continuity · FR-10</h3>
            <span className={`badge ${phaseAnomalyCount > 0 ? 'high' : 'low'}`}>
              {phaseAnomalyCount > 0 ? `⚠ ${phaseAnomalyCount} spike${phaseAnomalyCount > 1 ? 's' : ''}` : '✓ Stable'}
            </span>
          </div>
          <PhaseChart
            phaseData={audioResults?.phase_data}
            phaseTimes={audioResults?.phase_times}
            anomalyTimes={audioResults?.phase_anomaly_times}
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Vocoder band (&gt;8 kHz) · FR-12</h3>
            <span className={`badge ${vocoderDetected ? 'high' : 'low'}`}>
              {vocoderDetected ? 'ANOMALOUS' : 'NORMAL'}
            </span>
          </div>
          <div className="vb-stats">
            <div className="vb-row">
              <span className="muted">Energy ratio</span>
              <span className="mono">{hfRatio.toFixed(4)}</span>
            </div>
            <div className="vb-row">
              <span className="muted">Normal range</span>
              <span className="mono">0.02 – 0.45</span>
            </div>
            <div className="vb-row">
              <span className="muted">SNR</span>
              <span className="mono">{audioResults?.snr?.toFixed(1) ?? '—'} dB</span>
            </div>
            <div className="vb-row">
              <span className="muted">Vocal tract anomaly</span>
              <span>{audioResults?.vocal_tract_anomaly ? 'Yes' : 'No'}</span>
            </div>
            <div className="vb-row">
              <span className="muted">Suggests</span>
              <span>{vocoderDetected ? 'vocoder / TTS synthesis' : 'Natural speech'}</span>
            </div>
            <div className="bar bar-tall">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.min(100, hfRatio * 200)}%`,
                  background: vocoderDetected ? 'var(--danger)' : 'var(--safe)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Detected audio anomalies</h3>
          <button className="ghost tiny">Export CSV</button>
        </div>
        {anomalies.length === 0 ? (
          <div className="muted" style={{ padding: '12px 0' }}>No audio anomalies detected</div>
        ) : (
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
                  <td><span className={`badge ${a.severity}`}>{a.severity?.toUpperCase()}</span></td>
                  <td className="mono">{((a.confidence ?? a.conf ?? 0) * 100).toFixed(0)}%</td>
                  <td><button className="ghost tiny">Inspect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
