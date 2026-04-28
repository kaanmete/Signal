import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';
import './UploadPage.css';

export default function UploadPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [opts, setOpts] = useState({ audio: true, video: true, deep: false });

  const onDropzoneMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      toast.success('File ready', `${f.name} loaded — start analysis when you're ready.`);
    }
  };

  const startAnalysis = () => {
    toast.info('Analysis started', 'Pipeline is initializing…');
    navigate('/processing');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="page upload-page">
      <div className="upload-hero">
        <h1>Deepfake Forensic Analysis Engine</h1>
        <p className="muted">
          Detect synthetic media through DSP signal analysis — STFT, MFCC, DCT, and phase continuity.
        </p>
      </div>

      <div
        className={`dropzone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onMouseMove={onDropzoneMove}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          hidden
          onChange={onPick}
        />
        {!file ? (
          <>
            <div className="dropzone-icon">⬆</div>
            <div className="dropzone-title">Drag &amp; drop your audio or video file</div>
            <div className="muted">or click to browse</div>
            <div className="tiny muted dropzone-hint">
              Supported: .mp4 .mov .wav .mp3 .flac &nbsp;·&nbsp; Max size: 2 GB
            </div>
          </>
        ) : (
          <>
            <div className="file-card">
              <div className="file-icon">🎬</div>
              <div className="file-meta">
                <div className="file-name">{file.name}</div>
                <div className="muted tiny">
                  {file.type || 'unknown'} · {formatSize(file.size)}
                </div>
              </div>
              <button
                className="ghost"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card options-card">
        <div className="options-header">
          <h3>Analysis options</h3>
          <span className="badge info">Advanced</span>
        </div>
        <div className="options-grid">
          <label className="option">
            <input
              type="checkbox"
              checked={opts.audio}
              onChange={(e) => setOpts({ ...opts, audio: e.target.checked })}
            />
            <div>
              <div className="option-title">Audio Pipeline</div>
              <div className="muted tiny">STFT · MFCC · Phase continuity · &gt;8 kHz vocoder check</div>
            </div>
          </label>
          <label className="option">
            <input
              type="checkbox"
              checked={opts.video}
              onChange={(e) => setOpts({ ...opts, video: e.target.checked })}
            />
            <div>
              <div className="option-title">Video Pipeline</div>
              <div className="muted tiny">Face detection · YCbCr · 8×8 DCT · Laplacian boundary</div>
            </div>
          </label>
          <label className="option">
            <input
              type="checkbox"
              checked={opts.deep}
              onChange={(e) => setOpts({ ...opts, deep: e.target.checked })}
            />
            <div>
              <div className="option-title">Deep scan mode</div>
              <div className="muted tiny">Slower, higher precision (denser frame sampling)</div>
            </div>
          </label>
        </div>
      </div>

      <div className="upload-actions">
        <button className="ghost" onClick={() => { toast.info('Loading sample…'); navigate('/processing'); }}>
          Try sample file
        </button>
        <button
          className="primary"
          disabled={!file}
          onClick={startAnalysis}
        >
          Start analysis →
        </button>
      </div>
    </div>
  );
}
