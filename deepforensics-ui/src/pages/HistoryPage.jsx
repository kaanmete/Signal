import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';

const RECORDS = [
  { id: 1, name: 'interview_clip.mp4', kind: 'video', icon: '🎬', date: '2026-04-27 14:22', dur: '1:00', prob: 87.4, verdict: 'high' },
  { id: 2, name: 'press_briefing.wav', kind: 'audio', icon: '🎙', date: '2026-04-26 09:11', dur: '5:32', prob: 18.2, verdict: 'low' },
  { id: 3, name: 'ceo_announcement.mp4', kind: 'video', icon: '🎬', date: '2026-04-25 17:48', dur: '2:14', prob: 64.1, verdict: 'med' },
  { id: 4, name: 'voice_memo_03.mp3', kind: 'audio', icon: '🎙', date: '2026-04-24 11:05', dur: '0:48', prob: 92.3, verdict: 'high' },
  { id: 5, name: 'training_demo.mov', kind: 'video', icon: '🎬', date: '2026-04-23 19:30', dur: '3:21', prob: 7.6, verdict: 'low' },
  { id: 6, name: 'phone_call_export.flac', kind: 'audio', icon: '🎙', date: '2026-04-22 08:50', dur: '4:02', prob: 41.7, verdict: 'med' },
  { id: 7, name: 'witness_statement.mp4', kind: 'video', icon: '🎬', date: '2026-04-21 13:14', dur: '6:18', prob: 78.9, verdict: 'high' },
  { id: 8, name: 'podcast_segment.wav', kind: 'audio', icon: '🎙', date: '2026-04-20 16:00', dur: '12:45', prob: 22.4, verdict: 'low' }
];

export default function HistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');

  const filtered = useMemo(() => {
    let r = RECORDS.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    if (filter !== 'all') r = r.filter((x) => x.kind === filter);
    if (sort === 'recent') r = [...r].sort((a, b) => b.date.localeCompare(a.date));
    if (sort === 'prob') r = [...r].sort((a, b) => b.prob - a.prob);
    if (sort === 'name') r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [q, filter, sort]);

  const stats = {
    total: RECORDS.length,
    high: RECORDS.filter((r) => r.verdict === 'high').length,
    med: RECORDS.filter((r) => r.verdict === 'med').length,
    low: RECORDS.filter((r) => r.verdict === 'low').length
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <div className="muted tiny">Archive</div>
        <h2 style={{ margin: '4px 0 0', fontSize: 24 }}>Analysis history</h2>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-card-label">Total runs</div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-trend up">↑ 12% this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">High risk</div>
          <div className="stat-card-value" style={{ color: 'var(--danger-2)' }}>{stats.high}</div>
          <div className="stat-card-trend">{Math.round((stats.high / stats.total) * 100)}% of total</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Medium risk</div>
          <div className="stat-card-value" style={{ color: 'var(--warn)' }}>{stats.med}</div>
          <div className="stat-card-trend">{Math.round((stats.med / stats.total) * 100)}% of total</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Low risk</div>
          <div className="stat-card-value" style={{ color: 'var(--safe)' }}>{stats.low}</div>
          <div className="stat-card-trend">{Math.round((stats.low / stats.total) * 100)}% of total</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-wrap">
          <input
            type="search"
            placeholder="Search by filename…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">All media</option>
          <option value="audio">Audio only</option>
          <option value="video">Video only</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="recent">Most recent</option>
          <option value="prob">Highest probability</option>
          <option value="name">Name (A→Z)</option>
        </select>
        <button className="ghost" onClick={() => toast.info('Exporting CSV…')}>Export CSV</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 8 }}>∅</div>
          <div className="muted">No analyses match your filters</div>
        </div>
      ) : (
        <div className="history-grid">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="history-card"
              onClick={() => navigate('/results')}
            >
              <div className="history-thumb" data-icon={r.icon}>
                <div className="history-thumb-bar">
                  <div style={{ width: `${r.prob}%` }} />
                </div>
              </div>
              <div className="history-name" title={r.name}>{r.name}</div>
              <div className="history-meta">
                <span>{r.date}</span>
                <span className="mono">{r.dur}</span>
              </div>
              <div className="history-foot">
                <span className={`badge ${r.verdict} dot`}>
                  {r.verdict === 'high' ? 'manipulated' : r.verdict === 'med' ? 'inconclusive' : 'authentic'}
                </span>
                <span className="mono" style={{ color: r.verdict === 'high' ? 'var(--danger-2)' : r.verdict === 'med' ? 'var(--warn)' : 'var(--safe)' }}>
                  {r.prob.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
