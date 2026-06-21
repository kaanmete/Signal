const _raw = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const API_BASE = _raw;
export const WS_BASE  = _raw.replace(/^http/, 'ws');

export async function uploadFile(file, opts) {
  const form = new FormData();
  form.append('file', file);
  form.append('audio', opts.audio ? 'true' : 'false');
  form.append('video', opts.video ? 'true' : 'false');
  form.append('deep', opts.deep ? 'true' : 'false');
  const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function startSample() {
  const res = await fetch(`${API_BASE}/api/sample`, { method: 'POST' });
  if (!res.ok) throw new Error('Sample failed');
  return res.json();
}

export async function getResults(jobId) {
  const res = await fetch(`${API_BASE}/api/results/${jobId}`);
  if (!res.ok) throw new Error('Results not found');
  return res.json();
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error('History fetch failed');
  return res.json();
}

export async function deleteAnalysis(id) {
  await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' });
}

export function getReportUrl(jobId) {
  return `${API_BASE}/api/report/${jobId}`;
}

export function openWebSocket(jobId, onMessage) {
  const ws = new WebSocket(`${WS_BASE}/ws/${jobId}`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch (_) {}
  };
  return ws;
}
