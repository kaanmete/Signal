import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProbabilityGauge from '../components/ProbabilityGauge.jsx';
import Spectrogram from '../components/Spectrogram.jsx';
import Heatmap from '../components/Heatmap.jsx';
import ReportModal from '../components/ReportModal.jsx';
import AudioDetailTab from '../components/AudioDetailTab.jsx';
import TimelineTab from '../components/TimelineTab.jsx';
import { getResults, getReportUrl } from '../api.js';
import './ResultsPage.css';

const TABS = ['Overview', 'Audio Analysis', 'Video Analysis', 'Timeline', 'Raw Data'];

export default function ResultsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [showHeat, setShowHeat] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [frame, setFrame] = useState(1);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const jobId = sessionStorage.getItem('job_id');
  const filename = sessionStorage.getItem('job_filename') || 'media_file';

  useEffect(() => {
    // Try cached results first
    const cached = sessionStorage.getItem('job_results');
    if (cached) {
      try {
        setResults(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (_) {}
    }
    // Fetch from API
    if (!jobId) {
      setError('No analysis job found. Please start a new analysis.');
      setLoading(false);
      return;
    }
    getResults(jobId)
      .then((r) => { setResults(r); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [jobId]);

  if (loading) {
    return (
      <div className="page results-page">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="muted">Loading results…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page results-page">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ color: 'var(--danger-2)', marginBottom: 16 }}>{error}</div>
          <button className="primary" onClick={() => navigate('/')}>Start new analysis</button>
        </div>
      </div>
    );
  }

  const prob = results?.deepfake_probability ?? 0;
  const verdict = results?.verdict ?? 'UNKNOWN';
  const confidence = results?.confidence ?? '—';
  const audioAnomalies = results?.audio_anomalies ?? 0;
  const videoAnomalies = results?.video_anomalies ?? 0;
  const syncMismatches = results?.sync_mismatches ?? 0;
  const allAnomalies = results?.all_anomalies ?? [];
  const audioResults = results?.audio;
  const videoResults = results?.video;
  const correlation = results?.correlation ?? {};

  const verdictIcon = prob >= 70 ? '⚠' : prob >= 40 ? '?' : '✓';

  // `videoResults` may be a populated dict, null (audio-only), or an error stub
  // `{ error: "..." }` if the video pipeline failed mid-run.
  const videoError = videoResults?.error || null;
  const hasVideo = !!videoResults && !videoError;
  const frameCount = videoResults?.frame_count ?? 0;

  return (
    <div className="page results-page">
      <div className="results-header">
        <div>
          <div className="muted tiny">Results</div>
          <h2 className="filename">{results?.filename ?? filename}</h2>
        </div>
        <div className="header-actions">
          {jobId && (
            <a
              href={getReportUrl(jobId)}
              target="_blank"
              rel="noopener noreferrer"
              className="ghost"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              📄 Download PDF
            </a>
          )}
          <button className="ghost" onClick={() => setReportOpen(true)}>📄 Preview Report</button>
          <button className="primary" onClick={() => navigate('/')}>+ New analysis</button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="card gauge-card">
          <div className="card-label">Deepfake probability</div>
          <ProbabilityGauge value={prob} />
          <div className="bar mt-12">
            <div className="bar-fill" style={{ width: `${prob}%` }} />
          </div>
        </div>

        <div className="card verdict-card">
          <div className="card-label">Verdict</div>
          <div className="verdict">
            <span className="verdict-icon">{verdictIcon}</span>
            <span className="verdict-text">{verdict}</span>
          </div>
          <div className="verdict-stats">
            <div className="stat">
              <div className="stat-label">Confidence</div>
              <div className="stat-value">{confidence}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Audio anomalies</div>
              <div className="stat-value">{audioAnomalies} detected</div>
            </div>
            <div className="stat">
              <div className="stat-label">Video anomalies</div>
              <div className="stat-value">{videoAnomalies} detected</div>
            </div>
            <div className="stat">
              <div className="stat-label">Sync mismatches</div>
              <div className="stat-value">{syncMismatches} timestamps</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
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
                <button className="ghost tiny">Export PNG</button>
              </div>
            </div>
            <Spectrogram
              anomalies={(audioResults?.phase_anomaly_times ?? []).map((t) => ({ t }))}
              data={audioResults?.spectrogram_data ?? null}
              duration={audioResults?.duration ?? 30}
            />
            <div className="legend">
              <span className="legend-grad">
                <span className="grad-bar" /> low → high energy (dB)
              </span>
              <span className="legend-mark">
                <span className="mark-line" /> detected anomaly
              </span>
            </div>
          </div>

          {hasVideo ? (
            <div className="card">
              <div className="card-head">
                <h3>Frame · video heatmap</h3>
                <div className="frame-nav mono">
                  <button className="ghost tiny" onClick={() => setFrame((f) => Math.max(1, f - 1))}>◀</button>
                  <span>frame {String(frame).padStart(4, '0')} / {frameCount}</span>
                  <button className="ghost tiny" onClick={() => setFrame((f) => Math.min(frameCount, f + 1))}>▶</button>
                </div>
              </div>
              <Heatmap
                showBox={showBox}
                showHeat={showHeat}
                data={videoResults?.heatmap_grid ?? null}
                faceDetected={videoResults?.face_detected ?? false}
                frameImage={videoResults?.representative_frame_b64 ?? null}
                faceRectNorm={videoResults?.face_rect_norm ?? null}
              />
              <div className="frame-toggles">
                <label><input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} /> face bounding box</label>
                <label><input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} /> DCT heatmap</label>
              </div>
              <div className="legend">
                <span className="badge low">low</span>
                <span className="badge med">med</span>
                <span className="badge high">high</span>
                <span className="muted tiny">DCT high-freq energy: {videoResults.dct_hf_energy?.toFixed(3)}</span>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-head"><h3>Video heatmap</h3></div>
              <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
                {videoError
                  ? `Video pipeline failed: ${videoError}`
                  : 'Audio-only analysis — no video frames to visualize.'}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Audio Analysis' && (
        <AudioDetailTab
          anomalies={allAnomalies.filter((a) =>
            a.type?.toLowerCase().includes('phase') ||
            a.type?.includes('MFCC') ||
            a.type?.includes('HF') ||
            a.type?.includes('Spectral') ||
            a.type?.includes('vocoder')
          )}
          audioResults={audioResults}
        />
      )}

      {tab === 'Video Analysis' && !hasVideo && (
        <div className="card">
          <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
            {videoError
              ? `Video pipeline failed: ${videoError}`
              : 'Audio-only analysis — no video pipeline results available.'}
          </div>
        </div>
      )}

      {tab === 'Video Analysis' && hasVideo && (
        <div className="card">
          <h3 className="section-title">Video spatial analysis</h3>
          <div className="video-grid">
            <div>
              <Heatmap
                showBox
                showHeat
                data={videoResults?.heatmap_grid ?? null}
                faceDetected={videoResults?.face_detected ?? false}
                frameImage={videoResults?.representative_frame_b64 ?? null}
                faceRectNorm={videoResults?.face_rect_norm ?? null}
              />
            </div>
            <div className="video-stats">
              <div className="metric">
                <div className="muted tiny">DCT high-freq energy</div>
                <div className="metric-value">
                  {videoResults?.dct_hf_energy?.toFixed(3) ?? '—'}{' '}
                  <span className={`badge ${videoResults?.dct_hf_energy > 0.5 ? 'high' : 'med'}`}>
                    {videoResults?.dct_hf_energy > 0.5 ? 'HIGH' : 'MED'}
                  </span>
                </div>
              </div>
              <div className="metric">
                <div className="muted tiny">Blending boundary score</div>
                <div className="metric-value">
                  {videoResults?.blending_score?.toFixed(3) ?? '—'}{' '}
                  <span className={`badge ${videoResults?.blending_score > 0.4 ? 'med' : 'low'}`}>
                    {videoResults?.blending_score > 0.4 ? 'MED' : 'LOW'}
                  </span>
                </div>
              </div>
              <div className="metric">
                <div className="muted tiny">Laplacian gradient mean</div>
                <div className="metric-value">{videoResults?.laplacian_mean?.toFixed(1) ?? '—'}</div>
              </div>
              <div className="metric">
                <div className="muted tiny">YCbCr Cr-channel variance</div>
                <div className="metric-value">{videoResults?.ycbcr_variance?.toFixed(5) ?? '—'}</div>
              </div>
              <div className="metric">
                <div className="muted tiny">Face detected</div>
                <div className="metric-value">{videoResults?.face_detected ? 'Yes' : 'No'}</div>
              </div>
              <div className="metric">
                <div className="muted tiny">Frames analyzed</div>
                <div className="metric-value">{videoResults?.frames_analyzed?.toLocaleString() ?? '—'}</div>
              </div>
            </div>
          </div>
          {allAnomalies.filter((a) => a.type?.includes('DCT') || a.type?.includes('Blend')).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 className="section-title">Video Anomalies</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: 'var(--text-2)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Severity</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {allAnomalies.filter((a) => a.type?.includes('DCT') || a.type?.includes('Blend')).map((a, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{a.time}</td>
                      <td style={{ padding: '6px 8px' }}>{a.type}</td>
                      <td style={{ padding: '6px 8px' }}><span className={`badge ${a.severity}`}>{a.severity}</span></td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{((a.confidence ?? 0) * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'Timeline' && (
        <TimelineTab
          audioResults={audioResults}
          videoResults={videoResults}
          correlation={correlation}
        />
      )}

      {tab === 'Raw Data' && (
        <div className="card">
          <h3 className="section-title">Raw mathematical parameters</h3>
          <pre className="raw mono">{JSON.stringify(
            {
              metadata: results?.metadata,
              audio: results?.audio ? {
                stft_window: results.audio.stft_window,
                frame_ms: results.audio.frame_ms,
                mfcc_count: results.audio.mfcc_count,
                phase_variance_max: results.audio.phase_variance_max,
                hf_band_energy_ratio: results.audio.hf_ratio,
                vocoder_detected: results.audio.vocoder_detected,
                snr: results.audio.snr,
                audio_score: results.audio.audio_score,
              } : null,
              video: results?.video ? {
                dct_block: [results.video.dct_block_size, results.video.dct_block_size],
                color_space: results.video.color_space,
                high_freq_ac_mean: results.video.dct_hf_energy,
                laplacian_grad_mean: results.video.laplacian_mean,
                ycbcr_variance: results.video.ycbcr_variance,
                face_detected: results.video.face_detected,
                video_score: results.video.video_score,
              } : null,
              score: {
                audio_weight: results?.metadata?.audio_weight,
                video_weight: results?.metadata?.video_weight,
                deepfake_probability: results?.deepfake_probability != null
                  ? results.deepfake_probability / 100 : null,
              },
            },
            null, 2
          )}</pre>
        </div>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        jobId={jobId}
        results={results}
      />
    </div>
  );
}

