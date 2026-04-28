import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import UploadPage from './pages/UploadPage.jsx';
import ProcessingPage from './pages/ProcessingPage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ShortcutsOverlay from './components/ShortcutsOverlay.jsx';

function GlobalKeys({ onOpenCmdK, onOpenShortcuts }) {
  const navigate = useNavigate();

  useEffect(() => {
    let chord = null;
    let chordTimer = null;

    const onKey = (e) => {
      const tag = e.target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;

      // Cmd/Ctrl+K -> command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCmdK();
        return;
      }

      if (isTyping) return;

      // ? -> shortcuts
      if (e.key === '?') {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // g + letter chords
      if (chord === 'g') {
        const map = { u: '/', r: '/results', h: '/history', s: '/settings', p: '/processing', a: '/about' };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
        chord = null;
        clearTimeout(chordTimer);
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        chord = 'g';
        chordTimer = setTimeout(() => { chord = null; }, 900);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(chordTimer);
    };
  }, [navigate, onOpenCmdK, onOpenShortcuts]);

  return null;
}

export default function App() {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const openShortcuts = () => setShortcutsOpen(true);
    window.addEventListener('open-shortcuts', openShortcuts);
    return () => window.removeEventListener('open-shortcuts', openShortcuts);
  }, []);

  return (
    <>
      <NavBar
        onOpenCmdK={() => setCmdkOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <GlobalKeys
        onOpenCmdK={() => setCmdkOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/processing" element={<ProcessingPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/timeline" element={<ResultsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
