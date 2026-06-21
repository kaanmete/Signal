import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const COMMANDS = [
  { section: 'Navigation', items: [
    { id: 'go-upload', icon: '⬆', label: 'Go to Upload', to: '/' },
    { id: 'go-processing', icon: '⟳', label: 'Go to Processing', to: '/processing' },
    { id: 'go-results', icon: '◉', label: 'Go to Results', to: '/results' },
    { id: 'go-history', icon: '◷', label: 'Go to History', to: '/history' },
    { id: 'go-settings', icon: '⚙', label: 'Go to Settings', to: '/settings' },
    { id: 'go-about', icon: '?', label: 'About DeepForensics', to: '/about' }
  ]},
  { section: 'Actions', items: [
    { id: 'new', icon: '+', label: 'New analysis', to: '/' },
    { id: 'export-pdf', icon: '📄', label: 'Export PDF report', to: '/results' },
    { id: 'shortcuts', icon: '⌘', label: 'Show keyboard shortcuts', event: 'open-shortcuts' }
  ]}
];

export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q) return COMMANDS;
    const ql = q.toLowerCase();
    return COMMANDS
      .map((s) => ({
        ...s,
        items: s.items.filter((it) => it.label.toLowerCase().includes(ql))
      }))
      .filter((s) => s.items.length);
  }, [q]);

  const flat = filtered.flatMap((s) => s.items);

  const run = (cmd) => {
    if (cmd.to) navigate(cmd.to);
    if (cmd.event) window.dispatchEvent(new CustomEvent(cmd.event));
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); flat[sel] && run(flat[sel]); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  if (!open) return null;

  let idx = -1;

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search commands or pages…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={onKey}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-list">
          {filtered.length === 0 && (
            <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
              No matches
            </div>
          )}
          {filtered.map((s) => (
            <div key={s.section}>
              <div className="cmdk-section">{s.section}</div>
              {s.items.map((it) => {
                idx++;
                const isSel = idx === sel;
                return (
                  <div
                    key={it.id}
                    className={`cmdk-item ${isSel ? 'selected' : ''}`}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => run(it)}
                  >
                    <div className="cmdk-item-icon">{it.icon}</div>
                    <div className="cmdk-item-label">{it.label}</div>
                    {isSel && <span className="kbd">↵</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
          <span><span className="kbd">↵</span> select</span>
          <span><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
