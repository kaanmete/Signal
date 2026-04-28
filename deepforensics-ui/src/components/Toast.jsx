import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastCtx = createContext(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

let nextId = 1;

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, exiting: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 200);
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId++;
      const t = { id, type: 'info', duration: 4000, ...toast };
      setToasts((s) => [...s, t]);
      if (t.duration > 0) setTimeout(() => remove(id), t.duration);
      return id;
    },
    [remove]
  );

  const api = {
    push,
    success: (title, msg) => push({ type: 'success', title, msg }),
    error: (title, msg) => push({ type: 'error', title, msg }),
    info: (title, msg) => push({ type: 'info', title, msg }),
    remove
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type} ${t.exiting ? 'exit' : ''}`}>
            <div className="toast-icon">{ICONS[t.type]}</div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.msg && <div className="toast-msg">{t.msg}</div>}
            </div>
            <button className="toast-close" onClick={() => remove(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
