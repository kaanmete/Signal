const SHORTCUTS = [
  { group: 'General', items: [
    { keys: ['Ctrl', 'K'], label: 'Open command palette' },
    { keys: ['?'], label: 'Show this overlay' },
    { keys: ['Esc'], label: 'Close dialog / overlay' }
  ]},
  { group: 'Navigation', items: [
    { keys: ['G', 'U'], label: 'Go to Upload' },
    { keys: ['G', 'R'], label: 'Go to Results' },
    { keys: ['G', 'H'], label: 'Go to History' },
    { keys: ['G', 'S'], label: 'Go to Settings' }
  ]},
  { group: 'Analysis', items: [
    { keys: ['Space'], label: 'Play / pause media' },
    { keys: ['←', '→'], label: 'Step frame backward / forward' },
    { keys: ['Z'], label: 'Toggle zoom on chart' },
    { keys: ['E'], label: 'Export current view as PNG' }
  ]},
  { group: 'Reporting', items: [
    { keys: ['Ctrl', 'P'], label: 'Generate PDF report' },
    { keys: ['Ctrl', 'S'], label: 'Save current state' },
    { keys: ['Ctrl', 'Shift', 'C'], label: 'Copy raw JSON' }
  ]}
];

export default function ShortcutsOverlay({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Keyboard shortcuts</h3>
          <button className="ghost icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="shortcuts-grid">
            {SHORTCUTS.map((g) => (
              <div key={g.group}>
                <div className="section-title">{g.group}</div>
                {g.items.map((s, i) => (
                  <div key={i} className="shortcut-row">
                    <span>{s.label}</span>
                    <span className="shortcut-keys">
                      {s.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
