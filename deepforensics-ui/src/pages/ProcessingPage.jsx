import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';
import './ProcessingPage.css';

const STAGES = [
  { id: 'upload', label: 'Upload & Demultiplexing' },
  { id: 'norm', label: 'Audio Normalization (16 kHz)' },
  { id: 'frames', label: 'Frame Extraction (30 fps)' },
  { id: 'stft', label: 'STFT + MFCC Extraction' },
  { id: 'dct', label: 'DCT Spatial Analysis' },
  { id: 'phase', label: 'Phase Continuity Check' },
  { id: 'agg', label: 'Statistical Aggregation' },
  { id: 'report', label: 'Report Generation' }
];

const SAMPLE_LOGS = [
  'Processed frame 1247/2400',
  'MFCC vector batch #38 computed',
  'DCT block analysis: face region 2 complete',
  'Phase variance: 0.42 (within threshold)',
  'Hamming window applied · 25ms segments',
  'YCbCr conversion complete for frame 1248',
  'Laplacian gradient computed for face perimeter',
  'High-frequency band (>8 kHz) energy: 0.38'
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 1.2);
        if (next >= 100) clearInterval(t);
        return next;
      });
    }, 120);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (progress >= 100 && !notifiedRef.current) {
      notifiedRef.current = true;
      toast.success('Analysis complete', 'Probability score: 87.4% — likely manipulated.');
    }
  }, [progress, toast]);

  useEffect(() => {
    const t = setInterval(() => {
      const ts = new Date().toLocaleTimeString('en-GB');
      const msg = SAMPLE_LOGS[Math.floor(Math.random() * SAMPLE_LOGS.length)];
      setLogs((l) => [{ ts, msg }, ...l].slice(0, 30));
    }, 700);
    return () => clearInterval(t);
  }, []);

  const stageStatus = (i) => {
    const per = 100 / STAGES.length;
    const start = i * per;
    if (progress >= start + per) return 'done';
    if (progress > start) return 'active';
    return 'pending';
  };

  const stageProgress = (i) => {
    const per = 100 / STAGES.length;
    const start = i * per;
    return Math.max(0, Math.min(100, ((progress - start) / per) * 100));
  };

  const eta = Math.max(0, Math.round(((100 - progress) / 100) * 90));
  const etaStr = `${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}`;

  return (
    <div className="page processing-page">
      <div className="processing-header">
        <div>
          <div className="muted tiny">Analyzing</div>
          <h2 className="filename">interview_clip.mp4 <span className="muted tiny">· 1.2 GB</span></h2>
        </div>
        <button className="danger" onClick={() => navigate('/')}>Cancel job</button>
      </div>

      <div className="card overall-card">
        <div className="overall-row">
          <span className="muted">Overall progress</span>
          <span className="mono">{progress.toFixed(0)}% · ETA {etaStr}</span>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${progress}%` }} />
        </div>
        {progress >= 100 && (
          <button
            className="primary view-results"
            onClick={() => navigate('/results')}
          >
            View results →
          </button>
        )}
      </div>

      <div className="processing-grid">
        <div className="card">
          <h3 className="section-title">Pipeline stages</h3>
          <ul className="stages">
            {STAGES.map((s, i) => {
              const st = stageStatus(i);
              return (
                <li key={s.id} className={`stage ${st}`}>
                  <div className="stage-icon">
                    {st === 'done' ? '✓' : st === 'active' ? '⟳' : '○'}
                  </div>
                  <div className="stage-body">
                    <div className="stage-label">{s.label}</div>
                    {st === 'active' && (
                      <div className="bar bar-sm">
                        <div className="bar-fill" style={{ width: `${stageProgress(i)}%` }} />
                      </div>
                    )}
                  </div>
                  {st === 'done' && <span className="muted tiny">done</span>}
                  {st === 'active' && <span className="badge info">running</span>}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <h3 className="section-title">Live log</h3>
          <div className="log mono">
            {logs.length === 0 && <div className="muted">Waiting for events…</div>}
            {logs.map((l, i) => (
              <div key={i} className="log-row">
                <span className="muted">[{l.ts}]</span> {l.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
