import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';
import { getHistory, deleteAnalysis, getResults } from '../api.js';

export default function HistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    getHistory()
      .then((data) => { setRecords(data); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let r = records.filter((x) => x.name?.toLowerCase().includes(q.toLowerCase()));
    if (filter !== 'all') r = r.filter((x) => x.kind === filter);
    if (sort === 'recent') r = [...r].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (sort === 'prob') r = [...r].sort((a, b) => (b.prob || 0) - (a.prob || 0));
    if (sort === 'name') r = [...r].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return r;
  }, [records, q, filter, sort]);

  const completed = records.filter((r) => r.status === 'completed');
  const stats = {
    total: records.length,
    high: completed.filter((r) => r.verdict === 'high').length,
    med: completed.filter((r) => r.verdict === 'med').length,
    low: completed.filter((r) => r.verdict === 'low').length,
  };

  const openResult = async (r) => {
    if (r.status !== 'completed') {
      toast.info('Not ready', 'This analysis has not completed yet.');
      return;
    }
    sessionStorage.setItem('job_id', r.id);
    sessionStorage.setItem('job_filename', r.name);
    sessionStorage.removeItem('job_results'); // force re-fetch
    navigate('/results');
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteAnalysis(id).catch(() => {});
    setRecords((prev) => prev.filter((r) => r.id !== id));
    toast.success('Deleted', 'Analysis record removed');
  };

  const exportCSV = () => {
    const header = 'id,filename,type,date,probability,verdict,status';
    const rows = records.map((r) =>
      [r.id, r.name, r.kind, r.date, r.prob, r.verdict, r.status].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deepfake_analysis_history.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.info('Exported', 'CSV file downloaded');
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
        </div>
        <div className="stat-card">
          <div className="stat-card-label">High risk</div>
          <div className="stat-card-value" style={{ color: 'var(--danger-2)' }}>{stats.high}</div>
          <div className="stat-card-trend">
            {stats.total > 0 ? Math.round((stats.high / stats.total) * 100) : 0}% of total
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Medium risk</div>
          <div className="stat-card-value" style={{ color: 'var(--warn)' }}>{stats.med}</div>
          <div className="stat-card-trend">
            {stats.total > 0 ? Math.round((stats.med / stats.total) * 100) : 0}% of total
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Low risk</div>
          <div className="stat-card-value" style={{ color: 'var(--safe)' }}>{stats.low}</div>
          <div className="stat-card-trend">
            {stats.total > 0 ? Math.round((stats.low / stats.total) * 100) : 0}% of total
          </div>
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
        <button className="ghost" onClick={exportCSV}>Export CSV</button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="muted">Loading history…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 8 }}>∅</div>
          <div className="muted">
            {records.length === 0
              ? 'No analyses yet. Start by uploading a file.'
              : 'No analyses match your filters'}
          </div>
          {records.length === 0 && (
            <button className="primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
              + New analysis
            </button>
          )}
        </div>
      ) : (
        <div className="history-grid">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="history-card"
              onClick={() => openResult(r)}
              style={{ cursor: r.status === 'completed' ? 'pointer' : 'default', position: 'relative' }}
            >
              <div className="history-thumb" data-icon={r.icon}>
                <div className="history-thumb-bar">
                  <div style={{ width: `${r.prob || 0}%` }} />
                </div>
              </div>
              <div className="history-name" title={r.name}>{r.name}</div>
              <div className="history-meta">
                <span>{r.date}</span>
                <span className="mono">{r.dur || '—'}</span>
              </div>
              <div className="history-foot">
                {r.status === 'completed' ? (
                  <>
                    <span className={`badge ${r.verdict} dot`}>
                      {r.verdict === 'high' ? 'manipulated' : r.verdict === 'med' ? 'inconclusive' : 'authentic'}
                    </span>
                    <span className="mono" style={{
                      color: r.verdict === 'high' ? 'var(--danger-2)' : r.verdict === 'med' ? 'var(--warn)' : 'var(--safe)'
                    }}>
                      {(r.prob || 0).toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <span className="badge info">{r.status}</span>
                )}
                <button
                  className="ghost tiny"
                  style={{ marginLeft: 'auto', opacity: 0.5 }}
                  onClick={(e) => handleDelete(e, r.id)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
