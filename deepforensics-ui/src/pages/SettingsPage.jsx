import { useState } from 'react';
import { useToast } from '../components/Toast.jsx';

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'account', label: 'Account' }
];

function Switch({ on, onChange }) {
  return <div className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)} />;
}

export default function SettingsPage() {
  const toast = useToast();
  const [section, setSection] = useState('general');
  const [theme, setTheme] = useState('midnight');
  const [prefs, setPrefs] = useState({
    autoStart: true,
    saveHistory: true,
    deepScan: false,
    notifyDone: true,
    notifyError: true,
    sound: false,
    telemetry: true
  });
  const [thresh, setThresh] = useState(70);

  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const save = () => toast.success('Settings saved', 'Your preferences are stored locally.');
  const reset = () => {
    setPrefs({ autoStart: true, saveHistory: true, deepScan: false, notifyDone: true, notifyError: true, sound: false, telemetry: true });
    setThresh(70);
    setTheme('midnight');
    toast.info('Defaults restored');
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <div className="muted tiny">Preferences</div>
        <h2 style={{ margin: '4px 0 0', fontSize: 24 }}>Settings</h2>
      </div>

      <div className="settings-grid">
        <div className="settings-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={section === s.id ? 'active' : ''}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div>
          {section === 'general' && (
            <div className="card settings-section">
              <div className="section-title">General</div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Auto-start analysis on upload</div>
                  <div className="setting-help">Begin DSP processing immediately after a file is selected.</div>
                </div>
                <Switch on={prefs.autoStart} onChange={() => toggle('autoStart')} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Save analysis history</div>
                  <div className="setting-help">Keep records of previous runs in the History tab (local only).</div>
                </div>
                <Switch on={prefs.saveHistory} onChange={() => toggle('saveHistory')} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Default to deep-scan mode</div>
                  <div className="setting-help">Slower but more precise — denser frame sampling and finer FFT windows.</div>
                </div>
                <Switch on={prefs.deepScan} onChange={() => toggle('deepScan')} />
              </div>
            </div>
          )}

          {section === 'analysis' && (
            <div className="card settings-section">
              <div className="section-title">Analysis pipeline</div>
              <div className="setting-row">
                <div style={{ flex: 1 }}>
                  <div className="setting-label">Manipulation alert threshold</div>
                  <div className="setting-help">Probability above this value triggers a "likely manipulated" verdict.</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, maxWidth: 420 }}>
                    <input
                      type="range"
                      min="0" max="100"
                      value={thresh}
                      onChange={(e) => setThresh(+e.target.value)}
                      style={{ flex: 1, accentColor: 'var(--accent)' }}
                    />
                    <span className="mono" style={{ minWidth: 48, textAlign: 'right' }}>{thresh}%</span>
                  </div>
                </div>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Audio sample rate</div>
                  <div className="setting-help">Target rate for audio resampling.</div>
                </div>
                <select style={{ maxWidth: 140 }} defaultValue="16000">
                  <option value="8000">8 kHz</option>
                  <option value="16000">16 kHz</option>
                  <option value="22050">22.05 kHz</option>
                  <option value="44100">44.1 kHz</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">DCT block size</div>
                  <div className="setting-help">Block dimensions used in the spatial frequency analysis.</div>
                </div>
                <select style={{ maxWidth: 140 }} defaultValue="8">
                  <option value="4">4 × 4</option>
                  <option value="8">8 × 8</option>
                  <option value="16">16 × 16</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Window function</div>
                  <div className="setting-help">Used during STFT framing.</div>
                </div>
                <select style={{ maxWidth: 140 }} defaultValue="hamming">
                  <option>hamming</option>
                  <option>hann</option>
                  <option>blackman</option>
                  <option>rectangular</option>
                </select>
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div className="card settings-section">
              <div className="section-title">Appearance</div>
              <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div>
                  <div className="setting-label">Theme</div>
                  <div className="setting-help">Choose a color palette for the dashboard.</div>
                </div>
                <div className="theme-tiles">
                  {[
                    { id: 'midnight', name: 'Midnight' },
                    { id: 'aurora', name: 'Aurora' },
                    { id: 'slate', name: 'Slate' }
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`theme-tile ${theme === t.id ? 'selected' : ''}`}
                      onClick={() => { setTheme(t.id); toast.info(`Theme: ${t.name}`); }}
                    >
                      <div className={`theme-preview ${t.id}`} />
                      <div className="theme-name">{t.name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Reduce motion</div>
                  <div className="setting-help">Disable non-essential animations.</div>
                </div>
                <Switch on={false} onChange={() => toast.info('Motion preferences updated')} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Compact density</div>
                  <div className="setting-help">Tighter padding to fit more on screen.</div>
                </div>
                <Switch on={false} onChange={() => toast.info('Density updated')} />
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="card settings-section">
              <div className="section-title">Notifications</div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Notify when analysis completes</div>
                  <div className="setting-help">Show a toast when processing finishes.</div>
                </div>
                <Switch on={prefs.notifyDone} onChange={() => toggle('notifyDone')} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Notify on errors</div>
                  <div className="setting-help">Alert on validation or pipeline errors.</div>
                </div>
                <Switch on={prefs.notifyError} onChange={() => toggle('notifyError')} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Play sound</div>
                  <div className="setting-help">Audible chime on completion.</div>
                </div>
                <Switch on={prefs.sound} onChange={() => toggle('sound')} />
              </div>
            </div>
          )}

          {section === 'account' && (
            <div className="card settings-section">
              <div className="section-title">Account</div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Email</div>
                  <div className="setting-help">Used for report metadata and notifications.</div>
                </div>
                <input type="email" defaultValue="kaanmetekucuk286.kmkk@gmail.com" style={{ maxWidth: 320 }} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Anonymous telemetry</div>
                  <div className="setting-help">Help improve detection accuracy by sharing aggregate metrics.</div>
                </div>
                <Switch on={prefs.telemetry} onChange={() => toggle('telemetry')} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label" style={{ color: 'var(--danger-2)' }}>Clear local history</div>
                  <div className="setting-help">Permanently delete all stored analysis records.</div>
                </div>
                <button className="danger" onClick={() => toast.error('History cleared', 'All local records have been removed.')}>
                  Clear history
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="ghost" onClick={reset}>Reset to defaults</button>
            <button className="primary" onClick={save}>Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
