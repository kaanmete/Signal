import { useState } from 'react';
import './ReportModal.css';

export default function ReportModal({ open, onClose }) {
  const [sections, setSections] = useState({
    summary: true,
    audio: true,
    video: true,
    timeline: true,
    raw: true,
    thumbs: false
  });
  const [caseId, setCaseId] = useState('');
  const [analyst, setAnalyst] = useState('');

  if (!open) return null;

  const toggle = (k) => setSections((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Generate forensic report</h3>
          <button className="ghost icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="section-label">Include sections</div>
          <div className="sections">
            <label><input type="checkbox" checked={sections.summary} onChange={() => toggle('summary')} /> Executive summary &amp; probability score</label>
            <label><input type="checkbox" checked={sections.audio} onChange={() => toggle('audio')} /> Audio spectrogram &amp; MFCC charts</label>
            <label><input type="checkbox" checked={sections.video} onChange={() => toggle('video')} /> Video DCT heatmaps (sample frames)</label>
            <label><input type="checkbox" checked={sections.timeline} onChange={() => toggle('timeline')} /> Anomaly timeline</label>
            <label><input type="checkbox" checked={sections.raw} onChange={() => toggle('raw')} /> Raw mathematical parameters (appendix)</label>
            <label><input type="checkbox" checked={sections.thumbs} onChange={() => toggle('thumbs')} /> Include original media thumbnails</label>
          </div>

          <div className="section-label">Report metadata</div>
          <div className="meta-fields">
            <label>
              <span className="muted tiny">Case ID</span>
              <input type="text" value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="e.g. DF-2026-0427" />
            </label>
            <label>
              <span className="muted tiny">Analyst</span>
              <input type="text" value={analyst} onChange={(e) => setAnalyst(e.target.value)} placeholder="Your name" />
            </label>
          </div>
        </div>

        <div className="modal-foot">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={onClose}>Generate &amp; download</button>
        </div>
      </div>
    </div>
  );
}
