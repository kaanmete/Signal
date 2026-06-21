import { useEffect, useRef, useState, useCallback } from 'react';
import './TimelineTab.css';

const LANE_H  = 80;   // height of each signal lane
const AXIS_H  = 28;   // time axis strip between lanes
const PAD_L   = 52;   // left margin for lane labels
const PAD_R   = 12;
const PAD_T   = 14;
const PAD_B   = 10;
const PHASE_THR = 0.35; // must match backend PHASE_VAR_THRESHOLD

const CANVAS_H = PAD_T + LANE_H + AXIS_H + LANE_H + PAD_B;

function safeMax(arr) {
  return arr.length === 0 ? 0 : arr.reduce((m, v) => Math.max(m, v), -Infinity);
}

export default function TimelineTab({ audioResults, videoResults, correlation }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoverTime, setHoverTime] = useState(null);

  // ── Data assembly ─────────────────────────────────────────────────────────
  const phaseData          = audioResults?.phase_data           ?? [];
  const phaseTimes         = audioResults?.phase_times          ?? [];
  const phaseAnomalyTimes  = audioResults?.phase_anomaly_times  ?? [];
  const spatialTimes       = videoResults?.spatial_anomaly_times ?? [];
  const corrEvents         = correlation?.correlated_events     ?? [];
  const syncMismatches     = correlation?.sync_mismatches       ?? 0;

  const audioDur = audioResults?.duration ?? 0;
  const videoDur = videoResults?.duration ?? 0;
  const corrDur  = correlation?.duration  ?? 0;
  const rawDur   = Math.max(audioDur, videoDur, corrDur, safeMax(phaseAnomalyTimes), safeMax(spatialTimes));
  const duration = Math.max(rawDur, 10);

  const audioAnomalyList = audioResults?.anomaly_list ?? [];
  const videoAnomalyList = (videoResults && !videoResults.error) ? (videoResults.anomaly_list ?? []) : [];
  const allEvents = [...audioAnomalyList, ...videoAnomalyList]
    .sort((a, b) => (a.time_s ?? 0) - (b.time_s ?? 0));

  // ── Canvas draw ───────────────────────────────────────────────────────────
  const draw = useCallback((bgHoverTime) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.clientWidth;
    const H   = CANVAS_H;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const tx = (t) => PAD_L + (t / duration) * (W - PAD_L - PAD_R);

    const audioTop = PAD_T;
    const audioBot = PAD_T + LANE_H;
    const axisTop  = audioBot;
    const videoTop = axisTop + AXIS_H;
    const videoBot = videoTop + LANE_H;

    // Background
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, W, H);

    // Lane backgrounds with subtle left border accent
    const laneRadius = 6;
    for (const [top, accentColor] of [[audioTop, 'rgba(56,189,248,0.45)'], [videoTop, 'rgba(239,68,68,0.35)']]) {
      ctx.fillStyle = '#0d1424';
      ctx.beginPath();
      ctx.roundRect(PAD_L, top, W - PAD_L - PAD_R, LANE_H, laneRadius);
      ctx.fill();
      ctx.fillStyle = accentColor;
      ctx.fillRect(PAD_L, top, 3, LANE_H);
    }

    // Time gridlines (behind everything)
    const tStep = duration <= 15 ? 5 : duration <= 60 ? 10 : 30;
    for (let s = 0; s <= duration; s += tStep) {
      const x = tx(s);
      ctx.strokeStyle = 'rgba(30,42,74,0.6)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, audioTop);
      ctx.lineTo(x, videoBot);
      ctx.stroke();
    }

    // Correlated A/V bands (full height, both lanes)
    corrEvents.forEach(({ start, end }) => {
      const x1 = tx(start);
      const x2 = Math.max(tx(end), x1 + 2);
      ctx.fillStyle = 'rgba(34,211,238,0.07)';
      ctx.fillRect(x1, audioTop, x2 - x1, videoBot - audioTop);
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x1, audioTop); ctx.lineTo(x1, videoBot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, audioTop); ctx.lineTo(x2, videoBot); ctx.stroke();
      ctx.setLineDash([]);
    });

    // ── Audio lane: phase variance waveform ──────────────────────────────────
    const waveBot = audioBot - 6;
    const waveH   = LANE_H - 16;

    if (phaseData.length > 1) {
      // Filled area
      ctx.beginPath();
      ctx.moveTo(tx(phaseTimes[0] ?? 0), waveBot);
      phaseData.forEach((v, i) => {
        const t = phaseTimes[i] ?? (i / (phaseData.length - 1)) * duration;
        ctx.lineTo(tx(t), waveBot - v * waveH);
      });
      const lastT = phaseTimes[phaseData.length - 1] ?? duration;
      ctx.lineTo(tx(lastT), waveBot);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, audioTop, 0, audioBot);
      grad.addColorStop(0, 'rgba(56,189,248,0.22)');
      grad.addColorStop(1, 'rgba(56,189,248,0.04)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Outline
      ctx.beginPath();
      phaseData.forEach((v, i) => {
        const t = phaseTimes[i] ?? (i / (phaseData.length - 1)) * duration;
        const x = tx(t);
        const y = waveBot - v * waveH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(56,189,248,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Phase threshold dashed line
    const thrY = waveBot - PHASE_THR * waveH;
    ctx.strokeStyle = 'rgba(245,158,11,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD_L + 3, thrY);
    ctx.lineTo(W - PAD_R, thrY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(245,158,11,0.7)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('thr', W - PAD_R - 22, thrY - 2);

    // Phase anomaly spikes on audio lane
    phaseAnomalyTimes.forEach((t) => {
      const x = tx(t);
      ctx.strokeStyle = 'rgba(239,68,68,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, audioTop + 4);
      ctx.lineTo(x, audioBot - 4);
      ctx.stroke();
    });
    // Cluster dots at top of audio lane when there are many anomalies
    if (phaseAnomalyTimes.length > 0) {
      const dotRadius = phaseAnomalyTimes.length > 50 ? 1.5 : 2.5;
      phaseAnomalyTimes.forEach((t) => {
        const x = tx(t);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, audioTop + 8, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // ── Video lane: spatial anomaly bars ────────────────────────────────────
    if (spatialTimes.length > 0) {
      const barMaxH = LANE_H - 20;
      spatialTimes.forEach((t) => {
        const x = tx(t);
        ctx.fillStyle = 'rgba(239,68,68,0.35)';
        ctx.fillRect(x - 1.5, videoTop + 10, 3, barMaxH);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x - 1.5, videoTop + 10, 3, 5);
      });
    } else {
      ctx.fillStyle = 'rgba(100,116,139,0.35)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('no video spatial anomalies', PAD_L + (W - PAD_L - PAD_R) / 2, videoTop + LANE_H / 2 + 4);
    }

    // ── Time axis ─────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(148,163,184,0.75)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    for (let s = 0; s <= duration; s += tStep) {
      ctx.fillText(`${s}s`, tx(s), axisTop + AXIS_H * 0.72);
    }

    // ── Hover cursor ─────────────────────────────────────────────────────────
    if (bgHoverTime !== null) {
      const x = tx(bgHoverTime);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, audioTop);
      ctx.lineTo(x, videoBot);
      ctx.stroke();
      ctx.setLineDash([]);
      // Time label under cursor
      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${bgHoverTime.toFixed(1)}s`, x, videoBot + 12);
    }

    // ── Lane labels ───────────────────────────────────────────────────────────
    ctx.textAlign = 'right';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.fillText('AUDIO', PAD_L - 6, audioTop + LANE_H / 2 + 4);
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.fillText('VIDEO', PAD_L - 6, videoTop + LANE_H / 2 + 4);

    // Anomaly counts in lane top-right
    ctx.textAlign = 'right';
    ctx.font = '9px JetBrains Mono, monospace';
    if (phaseAnomalyTimes.length > 0) {
      ctx.fillStyle = 'rgba(239,68,68,0.7)';
      ctx.fillText(`${phaseAnomalyTimes.length} spikes`, W - PAD_R - 2, audioTop + 13);
    }
    if (spatialTimes.length > 0) {
      ctx.fillStyle = 'rgba(239,68,68,0.7)';
      ctx.fillText(`${spatialTimes.length} events`, W - PAD_R - 2, videoTop + 13);
    }
  }, [phaseData, phaseTimes, phaseAnomalyTimes, spatialTimes, corrEvents, duration]);

  // Redraw whenever data or hover changes
  useEffect(() => {
    draw(hoverTime);
  }, [draw, hoverTime]);

  // Also redraw on window resize
  useEffect(() => {
    const onResize = () => draw(null);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // ── Mouse interaction ─────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const W  = canvas.clientWidth;
    if (px < PAD_L) { setHoverTime(null); setTooltip(null); return; }
    const t = ((px - PAD_L) / (W - PAD_L - PAD_R)) * duration;
    const clampedT = Math.max(0, Math.min(duration, t));
    setHoverTime(clampedT);

    // Find closest event within ±1.5s
    const WINDOW = 1.5;
    let bestEv = null, bestDist = Infinity;
    for (const ev of allEvents) {
      const d = Math.abs((ev.time_s ?? 0) - clampedT);
      if (d < WINDOW && d < bestDist) { bestDist = d; bestEv = ev; }
    }
    // Also check raw phase/spatial anomaly times when no named event nearby
    if (!bestEv) {
      for (const pt of phaseAnomalyTimes) {
        const d = Math.abs(pt - clampedT);
        if (d < WINDOW && d < bestDist) {
          bestDist = d;
          bestEv = { time: `${pt.toFixed(1)}s`, time_s: pt, type: 'Phase discontinuity', severity: 'high', confidence: null };
        }
      }
      for (const st of spatialTimes) {
        const d = Math.abs(st - clampedT);
        if (d < WINDOW && d < bestDist) {
          bestDist = d;
          bestEv = { time: `${st.toFixed(1)}s`, time_s: st, type: 'DCT spatial anomaly', severity: 'high', confidence: null };
        }
      }
    }

    setTooltip(bestEv ? { x: px, y: e.clientY - rect.top, ev: bestEv } : null);
  }, [allEvents, phaseAnomalyTimes, spatialTimes, duration]);

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
    setTooltip(null);
  }, []);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const corrCount = corrEvents.length;

  return (
    <div className="tl-tab">

      {/* Canvas card */}
      <div className="card tl-card">
        <div className="card-head">
          <h3>Audio · video correlation timeline</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge info">{duration.toFixed(1)} s</span>
          </div>
        </div>

        <div className="tl-canvas-wrap">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: CANVAS_H, display: 'block', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
          {tooltip && (
            <div
              className="tl-tooltip"
              style={{
                left: Math.min(tooltip.x + 14, (canvasRef.current?.clientWidth ?? 600) - 180),
                top: tooltip.y - 10,
              }}
            >
              <div className="tl-tt-time">{tooltip.ev.time}</div>
              <div className="tl-tt-type">{tooltip.ev.type}</div>
              <div className="tl-tt-meta">
                <span className={`badge ${tooltip.ev.severity ?? 'med'}`}>
                  {(tooltip.ev.severity ?? 'med').toUpperCase()}
                </span>
                {tooltip.ev.confidence != null && (
                  <span className="mono" style={{ fontSize: 12 }}>
                    {(tooltip.ev.confidence * 100).toFixed(0)}% conf
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="tl-legend">
          <span className="tl-leg-item">
            <span className="tl-dot" style={{ background: 'rgba(56,189,248,0.7)' }} />
            phase variance (audio)
          </span>
          <span className="tl-leg-item">
            <span className="tl-dot" style={{ background: '#ef4444' }} />
            phase anomaly spike
          </span>
          <span className="tl-leg-item">
            <span className="tl-dot" style={{ background: 'rgba(239,68,68,0.5)' }} />
            DCT spatial event (video)
          </span>
          <span className="tl-leg-item">
            <span className="tl-dot" style={{ background: 'rgba(34,211,238,0.6)', borderRadius: 2 }} />
            correlated A/V window
          </span>
          <span className="tl-leg-item">
            <span className="tl-dot" style={{ background: 'rgba(245,158,11,0.65)' }} />
            phase threshold (0.35)
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="tl-stats-row">
        <div className="card tl-stat">
          <div className="tl-stat-label">Phase anomalies</div>
          <div className="tl-stat-val">{phaseAnomalyTimes.length}</div>
          <div className="muted tiny">audio phase spikes</div>
        </div>
        <div className="card tl-stat">
          <div className="tl-stat-label">Spatial events</div>
          <div className="tl-stat-val">{spatialTimes.length}</div>
          <div className="muted tiny">video DCT anomalies</div>
        </div>
        <div className="card tl-stat">
          <div className="tl-stat-label">Correlated</div>
          <div className="tl-stat-val tl-accent">{corrCount}</div>
          <div className="muted tiny">within ±0.5 s window</div>
        </div>
        <div className="card tl-stat">
          <div className="tl-stat-label">Sync mismatches</div>
          <div className={`tl-stat-val ${syncMismatches > 0 ? 'tl-danger' : ''}`}>
            {syncMismatches}
          </div>
          <div className="muted tiny">uncorrelated timestamps</div>
        </div>
      </div>

      {/* Event table */}
      {allEvents.length > 0 ? (
        <div className="card">
          <div className="card-head">
            <h3>All detected events</h3>
            <span className="badge info">{allEvents.length} total</span>
          </div>
          <div className="tl-table-wrap">
            <table className="anomaly-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {allEvents.map((ev, i) => (
                  <tr key={i}>
                    <td className="mono">{ev.time}</td>
                    <td>{ev.type}</td>
                    <td>
                      <span className={`badge ${ev.severity ?? 'med'}`}>
                        {(ev.severity ?? 'med').toUpperCase()}
                      </span>
                    </td>
                    <td className="mono">
                      {ev.confidence != null ? `${(ev.confidence * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>
            No named events detected — hover the timeline to inspect raw anomaly timestamps.
          </div>
        </div>
      )}
    </div>
  );
}
