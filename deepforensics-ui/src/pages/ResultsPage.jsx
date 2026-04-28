import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProbabilityGauge from '../components/ProbabilityGauge.jsx';
import Spectrogram from '../components/Spectrogram.jsx';
import Heatmap from '../components/Heatmap.jsx';
import ReportModal from '../components/ReportModal.jsx';
import AudioDetailTab from '../components/AudioDetailTab.jsx';
import './ResultsPage.css';

const ANOMALIES = [
  { time: '00:14.2', type: 'Phase discontinuity', severity: 'high', conf: 0.91 },
  { time: '00:18.7', type: 'MFCC vocal-tract deviation', severity: 'med', conf: 0.74 },
  { time: '00:22.1', type: 'HF compression artifact', severity: 'high', conf: 0.88 },
  { time: '00:27.5', type: 'Spectral leakage', severity: 'low', conf: 0.52 },
  { time: '00:31.4', type: 'DCT high-frequency spike', severity: 'high', conf: 0.86 },
  { time: '00:34.8', type: 'Blending boundary detected', severity: 'med', conf: 0.71 }
];

const TABS = ['Overview', 'Audio Analysis', 'Video Analysis', 'Timeline', 'Raw Data'];

export default function ResultsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [showHeat, setShowHeat] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [frame, setFrame] = useState(245);

  return (
    <div className="page results-page">
      <div className="results-header">
        <div>
          <div className="muted tiny">Results</div>
          <h2 className="filename">interview_clip.mp4</h2>
        </div>
        <div className="header-actions">
          <button className="ghost" onClick={() => setReportOpen(true)}>📄 Download PDF</button>
          <button className="ghost">🔗 Share</button>
          <button className="primary" onClick={() => navigate('/')}>+ New analysis</button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="card gauge-card">
          <div className="card-label">Deepfake probability</div>
          <ProbabilityGauge value={87.4} />
          <div className="bar mt-12">
            <div className="bar-fill" style={{ width: '87.4%' }} />
          </div>
        </div>

        <div className="card verdict-card">
          <div className="card-label">Verdict</div>
          <div className="verdict">
            <span className="verdict-icon">⚠</span>
            <span className="verdict-text">LIKELY MANIPULATED</span>
          </div>
          <div className="verdict-stats">
            <div className="stat">
              <div className="stat-label">Confidence</div>
              <div className="stat-value">High</div>
            </div>
            <div className="stat">
              <div className="stat-label">Audio anomalies</div>
              <div className="stat-value">4 detected</div>
            </div>
            <div className="stat">
              <div className="stat-label">Video anomalies</div>
              <div className="stat-value">7 detected</div>
            </div>
            <div className="stat">
              <div className="stat-label">Sync mismatches</div>
              <div className="stat-value">3 timestamps</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="overview-grid">
          <div className="card">
            <div className="card-head">
              <h3>Audio spectrogram</h3>
              <div className="card-controls">
                <button className="ghost tiny">⊕ Zoom</button>
                <button className="ghost tiny">⊖</button>
                <button className="ghost tiny">Reset</button>
                <button className="ghost tiny">Export PNG</button>
              </div>
            </div>
            <Spectrogram anomalies={[{ t: 14.2 }, { t: 22.1 }]} />
            <div className="legend">
              <span className="legend-grad">
                <span className="grad-bar" /> low → high energy (dB)
              </span>
              <span className="legend-mark">
                <span className="mark-line" /> detected anomaly
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Frame · video heatmap</h3>
              <div className="frame-nav mono">
                <button className="ghost tiny" onClick={() => setFrame((f) => Math.max(1, f - 1))}>◀</button>
                <span>frame {String(frame).padStart(4, '0')} / 2400</span>
                <button className="ghost tiny" onClick={() => setFrame((f) => f + 1)}>▶</button>
              </div>
            </div>
            <Heatmap showBox={showBox} showHeat={showHeat} />
            <div className="frame-toggles">
              <label><input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} /> face bounding box</label>
              <label><input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} /> DCT heatmap</label>
              <label><input type="checkbox" /> Laplacian gradient</label>
            </div>
            <div className="legend">
              <span className="badge low">low</span>
              <span className="badge med">med</span>
              <span className="badge high">high</span>
              <span className="muted tiny">DCT high-freq energy: 0.81</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'Audio Analysis' && <AudioDetailTab anomalies={ANOMALIES.filter(a => a.type.toLowerCase().includes('phase') || a.type.includes('MFCC') || a.type.includes('HF') || a.type.includes('Spectral'))} />}

      {tab === 'Video Analysis' && (
        <div className="card">
          <h3 className="section-title">Video spatial analysis</h3>
          <div className="video-grid">
            <div>
              <Heatmap showBox showHeat />
            </div>
            <div className="video-stats">
              <div className="metric">
                <div className="muted tiny">DCT high-freq energy</div>
                <div className="metric-value">0.81 <span className="badge high">HIGH</span></div>
              </div>
              <div className="metric">
                <div className="muted tiny">Blending boundary score</div>
                <div className="metric-value">0.74 <span className="badge med">MED</span></div>
              </div>
              <div className="metric">
                <div className="muted tiny">Laplacian gradient mean</div>
                <div className="metric-value">42.3</div>
              </div>
              <div className="metric">
                <div className="muted tiny">YCbCr Cr-channel variance</div>
                <div className="metric-value">0.058</div>
              </div>
              <div className="metric">
                <div className="muted tiny">Frames analyzed</div>
                <div className="metric-value">2,400</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Timeline' && <TimelineTab />}

      {tab === 'Raw Data' && (
        <div className="card">
          <h3 className="section-title">Raw mathematical parameters</h3>
          <pre className="raw mono">{`{
  "metadata": {
    "file": "interview_clip.mp4",
    "duration_s": 60.0,
    "sample_rate_hz": 16000,
    "fps": 30
  },
  "audio": {
    "stft_window": "hamming",
    "frame_ms": 25,
    "mfcc_count": 13,
    "phase_variance_max": 0.91,
    "hf_band_energy_ratio": 0.42
  },
  "video": {
    "dct_block": [8, 8],
    "color_space": "YCbCr",
    "high_freq_ac_mean": 0.81,
    "laplacian_grad_mean": 42.3
  },
  "score": {
    "audio_weight": 0.45,
    "video_weight": 0.55,
    "deepfake_probability": 0.874
  }
}`}</pre>
        </div>
      )}

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

function TimelineTab() {
  const audioEvents = [
    { t: 14.2, sev: 'high' },
    { t: 18.7, sev: 'med' },
    { t: 22.1, sev: 'high' },
    { t: 27.5, sev: 'low' }
  ];
  const videoEvents = [
    { t: 8.4, sev: 'med' },
    { t: 14.5, sev: 'high' },
    { t: 22.0, sev: 'high' },
    { t: 31.4, sev: 'high' },
    { t: 34.8, sev: 'med' }
  ];
  const correlated = [
    { start: 14.0, end: 14.6 },
    { start: 21.9, end: 22.3 }
  ];
  const duration = 45;

  return (
    <div className="card">
      <h3 className="section-title">Audio · video correlation timeline</h3>

      <div className="timeline">
        <div className="track-label">Audio</div>
        <div className="track">
          {correlated.map((c, i) => (
            <div key={`c1-${i}`} className="corr-band"
                 style={{ left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%` }} />
          ))}
          {audioEvents.map((e, i) => (
            <div key={`a-${i}`} className={`mark down ${e.sev}`} style={{ left: `${(e.t / duration) * 100}%` }} title={`${e.t}s · ${e.sev}`} />
          ))}
        </div>

        <div className="track-label">Video</div>
        <div className="track">
          {correlated.map((c, i) => (
            <div key={`c2-${i}`} className="corr-band"
                 style={{ left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%` }} />
          ))}
          {videoEvents.map((e, i) => (
            <div key={`v-${i}`} className={`mark up ${e.sev}`} style={{ left: `${(e.t / duration) * 100}%` }} title={`${e.t}s · ${e.sev}`} />
          ))}
        </div>

        <div className="axis">
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45].map((s) => (
            <div key={s} className="axis-tick" style={{ left: `${(s / duration) * 100}%` }}>
              <span className="muted tiny">{s}s</span>
            </div>
          ))}
        </div>
      </div>

      <div className="timeline-legend">
        <span><span className="dot high" /> high</span>
        <span><span className="dot med" /> medium</span>
        <span><span className="dot low" /> low</span>
        <span><span className="dot corr" /> correlated</span>
      </div>

      <button className="primary" style={{ marginTop: 16 }}>▶ Play media with overlays</button>
    </div>
  );
}
