import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';
import { openWebSocket } from '../api.js';
import './ProcessingPage.css';

// Order MUST match the backend pipeline (backend/routers/upload.py):
// upload -> norm -> stft -> phase -> frames -> dct -> agg -> report
const ALL_STAGES = [
  { id: 'upload', label: 'Upload & Demultiplexing',     kind: 'both'  },
  { id: 'norm',   label: 'Audio Normalization (16 kHz)', kind: 'audio' },
  { id: 'stft',   label: 'STFT + MFCC Extraction',       kind: 'audio' },
  { id: 'phase',  label: 'Phase Continuity Check',       kind: 'audio' },
  { id: 'frames', label: 'Frame Extraction (30 fps)',    kind: 'video' },
  { id: 'dct',    label: 'DCT Spatial Analysis',         kind: 'video' },
  { id: 'agg',    label: 'Statistical Aggregation',      kind: 'both'  },
  { id: 'report', label: 'Report Generation',            kind: 'both'  },
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('upload');
  const [logs, setLogs] = useState([]);
  const [done, setDone] = useState(false);
  const wsRef = useRef(null);
  const notifiedRef = useRef(false);

  const jobId = sessionStorage.getItem('job_id');
  const filename = sessionStorage.getItem('job_filename') || 'media_file';
  const fileSize = Number(sessionStorage.getItem('job_filesize') || 0);
  const fileKind = sessionStorage.getItem('job_filetype') || 'video'; // 'audio' | 'video'

  // Filter visible stages: video pipeline only runs for video files; audio
  // pipeline runs for both (a video has its audio track extracted first).
  const STAGES = ALL_STAGES.filter((s) =>
    s.kind === 'both' || s.kind === 'audio' || fileKind === 'video'
  );
  const STAGE_IDS = STAGES.map((s) => s.id);

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  };

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString('en-GB');
    setLogs((l) => [{ ts, msg }, ...l].slice(0, 50));
  };

  useEffect(() => {
    if (!jobId) {
      navigate('/');
      return;
    }

    const ws = openWebSocket(jobId, (msg) => {
      if (msg.ping) return;

      if (msg.stage) {
        setCurrentStage(msg.stage);
        setProgress(msg.progress || 0);
      }
      if (msg.msg) {
        addLog(msg.msg);
      }
      if (msg.done) {
        setProgress(100);
        setDone(true);
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          const prob = msg.results?.deepfake_probability;
          const verdict = msg.results?.verdict || 'Analysis complete';
          toast.success(
            'Analysis complete',
            prob != null ? `Probability: ${prob.toFixed(1)}% — ${verdict}` : verdict
          );
          // Store results in session for ResultsPage
          if (msg.results) {
            sessionStorage.setItem('job_results', JSON.stringify(msg.results));
          }
        }
      }
      if (msg.error) {
        toast.error('Analysis failed', msg.error);
        addLog(`ERROR: ${msg.error}`);
        setDone(true);
      }
    });

    wsRef.current = ws;

    ws.onerror = () => {
      addLog('WebSocket error — retrying connection not available');
    };

    ws.onclose = () => {
      addLog('Connection closed');
    };

    return () => {
      ws.close();
    };
  }, [jobId]);

  const stageStatus = (id) => {
    const si = STAGE_IDS.indexOf(id);
    const ci = STAGE_IDS.indexOf(currentStage);
    if (si < ci || (done && si <= ci)) return 'done';
    if (si === ci && !done) return 'active';
    return 'pending';
  };

  const stageProgress = (id) => {
    if (stageStatus(id) === 'done') return 100;
    if (stageStatus(id) === 'active') {
      // rough approximation within the stage
      const si = STAGE_IDS.indexOf(id);
      const per = 100 / STAGES.length;
      const stageStart = si * per;
      return Math.max(0, Math.min(100, ((progress - stageStart) / per) * 100));
    }
    return 0;
  };

  const eta = Math.max(0, Math.round(((100 - progress) / 100) * 90));
  const etaStr = `${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}`;

  const handleCancel = () => {
    wsRef.current?.close();
    sessionStorage.removeItem('job_id');
    navigate('/');
  };

  return (
    <div className="page processing-page">
      <div className="processing-header">
        <div>
          <div className="muted tiny">Analyzing</div>
          <h2 className="filename">
            {filename}{' '}
            {fileSize > 0 && <span className="muted tiny">· {formatSize(fileSize)}</span>}
          </h2>
        </div>
        <button className="danger" onClick={handleCancel}>Cancel job</button>
      </div>

      <div className="card overall-card">
        <div className="overall-row">
          <span className="muted">Overall progress</span>
          <span className="mono">{progress.toFixed(0)}% · ETA {etaStr}</span>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${progress}%` }} />
        </div>
        {done && (
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
            {STAGES.map((s) => {
              const st = stageStatus(s.id);
              return (
                <li key={s.id} className={`stage ${st}`}>
                  <div className="stage-icon">
                    {st === 'done' ? '✓' : st === 'active' ? '⟳' : '○'}
                  </div>
                  <div className="stage-body">
                    <div className="stage-label">{s.label}</div>
                    {st === 'active' && (
                      <div className="bar bar-sm">
                        <div className="bar-fill" style={{ width: `${stageProgress(s.id)}%` }} />
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
            {logs.length === 0 && <div className="muted">Connecting to analysis pipeline…</div>}
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
