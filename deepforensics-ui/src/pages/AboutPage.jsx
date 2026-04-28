const FEATURES = [
  { icon: '🎵', title: 'STFT spectrogram', desc: 'Short-Time Fourier Transform reveals time-localized frequency anomalies in audio.' },
  { icon: '📊', title: 'MFCC features', desc: '13-coefficient Mel-frequency cepstral analysis flags vocal-tract inconsistencies.' },
  { icon: '🌀', title: 'Phase continuity', desc: 'Phase coherence checks expose splice points and synthesis discontinuities.' },
  { icon: '🧊', title: 'DCT spatial analysis', desc: '8×8 block frequency decomposition over YCbCr highlights face-blending artifacts.' },
  { icon: '👤', title: 'Face detection', desc: 'Localizes facial regions before applying Laplacian and high-frequency analysis.' },
  { icon: '📈', title: 'Score fusion', desc: 'Audio and video anomaly streams combine into a single deepfake probability score.' }
];

const TEAM = [
  { name: 'Kaan Mete Küçük', color: '#4f46e5' },
  { name: 'Ahmet Serdar Erünsal', color: '#06b6d4' },
  { name: 'Berat Yılmaz', color: '#10b981' },
  { name: 'Alim Barış Sevindik', color: '#f59e0b' },
  { name: 'Erol Yağız Gemalmaz', color: '#ef4444' },
  { name: 'Göktuğ Yıldırım', color: '#8b5cf6' }
];

const initials = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');

export default function AboutPage() {
  return (
    <div className="page">
      <div className="about-hero">
        <h1>Deepfake Forensic Analysis Engine</h1>
        <p>Detect synthetic media through Digital Signal Processing — no black-box ML required.</p>
      </div>

      <div className="section-title">DSP capabilities</div>
      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="card feature-card">
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">How it works</div>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, color: 'var(--text-2)', fontSize: 14 }}>
          <li>Upload audio or video — the engine validates the format and extracts metadata.</li>
          <li>Audio is resampled to 16 kHz and segmented into 25 ms Hamming-windowed frames.</li>
          <li>STFT and MFCC features are extracted; phase continuity is monitored frame-to-frame.</li>
          <li>Video is split into 30 fps frames and converted to YCbCr; faces are localized.</li>
          <li>Each face region is divided into 8×8 blocks and analyzed via DCT for high-frequency artifacts.</li>
          <li>Audio and video anomaly scores are fused into a final probability score.</li>
          <li>Visualizations and a downloadable PDF report summarize the findings.</li>
        </ol>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Tech stack</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Python', 'FastAPI', 'NumPy', 'Librosa', 'OpenCV', 'Matplotlib', 'React 18', 'Vite', 'Canvas API'].map((t) => (
            <span key={t} className="badge info">{t}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Team — CENG 384</div>
        <div className="team-grid">
          {TEAM.map((m) => (
            <div key={m.name} className="team-card">
              <div className="team-avatar" style={{ background: `linear-gradient(135deg, ${m.color}, ${m.color}aa)` }}>
                {initials(m.name)}
              </div>
              <div className="team-name">{m.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32, color: 'var(--text-3)', fontSize: 12 }}>
        Built for educational purposes — Middle East Technical University · 2026
      </div>
    </div>
  );
}
