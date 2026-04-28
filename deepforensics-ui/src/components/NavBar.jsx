import { NavLink } from 'react-router-dom';
import './NavBar.css';

export default function NavBar({ onOpenCmdK, onOpenShortcuts }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-text">DeepForensics</span>
        </NavLink>

        <nav className="nav-links">
          <NavLink to="/" end>Upload</NavLink>
          <NavLink to="/processing">Processing</NavLink>
          <NavLink to="/results">Results</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>

        <div className="nav-actions">
          <button
            className="ghost cmdk-btn"
            onClick={onOpenCmdK}
            title="Command palette (Ctrl+K)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="cmdk-btn-label">Search…</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <button
            className="ghost icon-btn"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
          >
            ⌘
          </button>
          <NavLink to="/settings" className="ghost icon-btn settings-link" title="Settings">
            ⚙
          </NavLink>
          <div className="avatar" title="Kaan Mete Küçük">KK</div>
        </div>
      </div>
    </header>
  );
}
