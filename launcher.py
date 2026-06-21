"""
Deepfake Forensic Analysis Engine — GUI Launcher
Starts backend (FastAPI) and frontend (Vite/React) with a single click.
Requires Python 3.9+ and Node.js to be installed.
"""
import os
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import scrolledtext, messagebox
import webbrowser

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "deepforensics-ui")

# Detect platform
IS_WIN = sys.platform == "win32"
PYTHON = sys.executable


def _venv_candidates():
    """Possible venv directory names — accept both 'venv' and '.venv'.
    'venv' is checked first because the project historically uses that name.
    """
    return [
        os.path.join(PROJECT_ROOT, "venv"),
        os.path.join(PROJECT_ROOT, ".venv"),
    ]


def find_venv_dir():
    """Return the first existing venv dir that contains a Python interpreter."""
    for d in _venv_candidates():
        if IS_WIN:
            py = os.path.join(d, "Scripts", "python.exe")
        else:
            py = os.path.join(d, "bin", "python")
        if os.path.exists(py):
            return d
    return None


# Active venv dir (may be None on first run; created during Install Dependencies).
VENV_DIR = find_venv_dir() or os.path.join(PROJECT_ROOT, ".venv")


def get_venv_python():
    # Re-resolve each call in case the venv was just created.
    venv = find_venv_dir()
    if venv is None:
        return PYTHON
    if IS_WIN:
        return os.path.join(venv, "Scripts", "python.exe")
    return os.path.join(venv, "bin", "python")


def get_pip():
    venv = find_venv_dir()
    if venv is None:
        return "pip"
    if IS_WIN:
        return os.path.join(venv, "Scripts", "pip.exe")
    return os.path.join(venv, "bin", "pip")


def free_port(port: int) -> list:
    """Kill any process currently bound to `port`. Returns list of PIDs killed.

    On Windows, uvicorn left as a zombie from a previous run (especially when
    --reload was used) keeps holding the port even after the launcher closes.
    We pre-emptively free it here so the next Start always succeeds.
    """
    killed = []
    if IS_WIN:
        try:
            # netstat -ano -p TCP returns "  TCP  0.0.0.0:8000  ...  LISTENING  <PID>"
            out = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True, text=True, timeout=5,
            ).stdout
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and "LISTENING" in parts:
                    local = parts[1]
                    if local.endswith(f":{port}"):
                        pid = parts[-1]
                        if pid.isdigit() and int(pid) != os.getpid():
                            subprocess.run(
                                ["taskkill", "/F", "/PID", pid],
                                capture_output=True, timeout=5,
                            )
                            killed.append(int(pid))
        except Exception:
            pass
    else:
        try:
            out = subprocess.run(
                ["lsof", "-ti", f"tcp:{port}"],
                capture_output=True, text=True, timeout=5,
            ).stdout
            for pid_str in out.split():
                if pid_str.isdigit() and int(pid_str) != os.getpid():
                    subprocess.run(["kill", "-9", pid_str], capture_output=True, timeout=5)
                    killed.append(int(pid_str))
        except Exception:
            pass
    return killed


class LauncherApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Deepfake Forensic Analysis Engine — Launcher")
        self.root.geometry("720x560")
        self.root.resizable(True, True)
        self.root.configure(bg="#0f172a")

        self.backend_proc = None
        self.frontend_proc = None
        self.backend_ready = False
        self.frontend_ready = False
        self._lock = threading.Lock()

        self._build_ui()

    def _build_ui(self):
        # Title bar
        title_frame = tk.Frame(self.root, bg="#1e3a8a", pady=14, padx=20)
        title_frame.pack(fill=tk.X)
        tk.Label(
            title_frame,
            text="Deepfake Forensic Analysis Engine",
            fg="#e2e8f0", bg="#1e3a8a",
            font=("Segoe UI", 15, "bold")
        ).pack(side=tk.LEFT)
        tk.Label(
            title_frame, text="CENG 384",
            fg="#93c5fd", bg="#1e3a8a",
            font=("Segoe UI", 10)
        ).pack(side=tk.RIGHT)

        # Status row
        status_frame = tk.Frame(self.root, bg="#1e293b", pady=10, padx=20)
        status_frame.pack(fill=tk.X)

        self.backend_status = tk.Label(
            status_frame, text="● Backend: stopped",
            fg="#ef4444", bg="#1e293b",
            font=("Consolas", 10)
        )
        self.backend_status.pack(side=tk.LEFT, padx=(0, 20))

        self.frontend_status = tk.Label(
            status_frame, text="● Frontend: stopped",
            fg="#ef4444", bg="#1e293b",
            font=("Consolas", 10)
        )
        self.frontend_status.pack(side=tk.LEFT)

        self.open_btn = tk.Button(
            status_frame, text="Open in Browser",
            bg="#1e40af", fg="white",
            font=("Segoe UI", 9, "bold"),
            relief=tk.FLAT, cursor="hand2", padx=12, pady=4,
            state=tk.DISABLED,
            command=self._open_browser
        )
        self.open_btn.pack(side=tk.RIGHT)

        # Log area
        log_frame = tk.Frame(self.root, bg="#0f172a", padx=12, pady=8)
        log_frame.pack(fill=tk.BOTH, expand=True)

        tk.Label(
            log_frame, text="Console output",
            fg="#64748b", bg="#0f172a",
            font=("Segoe UI", 9)
        ).pack(anchor=tk.W)

        self.log = scrolledtext.ScrolledText(
            log_frame,
            bg="#020617", fg="#94a3b8",
            font=("Consolas", 9),
            relief=tk.FLAT, bd=0,
            state=tk.DISABLED,
            wrap=tk.WORD,
            insertbackground="white"
        )
        self.log.pack(fill=tk.BOTH, expand=True)
        self.log.tag_config("info", foreground="#38bdf8")
        self.log.tag_config("ok", foreground="#4ade80")
        self.log.tag_config("warn", foreground="#fbbf24")
        self.log.tag_config("err", foreground="#f87171")

        # Button row
        btn_frame = tk.Frame(self.root, bg="#0f172a", pady=12, padx=12)
        btn_frame.pack(fill=tk.X)

        self.start_btn = tk.Button(
            btn_frame, text="▶  Start All Services",
            bg="#1d4ed8", fg="white",
            font=("Segoe UI", 10, "bold"),
            relief=tk.FLAT, cursor="hand2", padx=20, pady=8,
            command=self._start_all
        )
        self.start_btn.pack(side=tk.LEFT, padx=(0, 8))

        self.install_btn = tk.Button(
            btn_frame, text="⬇  Install Dependencies",
            bg="#374151", fg="white",
            font=("Segoe UI", 9),
            relief=tk.FLAT, cursor="hand2", padx=14, pady=8,
            command=self._install_deps
        )
        self.install_btn.pack(side=tk.LEFT, padx=(0, 8))

        self.stop_btn = tk.Button(
            btn_frame, text="■  Stop All",
            bg="#7f1d1d", fg="white",
            font=("Segoe UI", 9),
            relief=tk.FLAT, cursor="hand2", padx=14, pady=8,
            state=tk.DISABLED,
            command=self._stop_all
        )
        self.stop_btn.pack(side=tk.LEFT)

        tk.Label(
            btn_frame,
            text="Backend: :8000  ·  Frontend: :5173",
            fg="#475569", bg="#0f172a",
            font=("Consolas", 9)
        ).pack(side=tk.RIGHT)

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _log(self, msg: str, tag: str = ""):
        def _do():
            self.log.config(state=tk.NORMAL)
            ts = time.strftime("%H:%M:%S")
            self.log.insert(tk.END, f"[{ts}] {msg}\n", tag or "")
            self.log.see(tk.END)
            self.log.config(state=tk.DISABLED)
        self.root.after(0, _do)

    def _set_backend_status(self, text: str, color: str):
        self.root.after(0, lambda: self.backend_status.config(text=text, fg=color))

    def _set_frontend_status(self, text: str, color: str):
        self.root.after(0, lambda: self.frontend_status.config(text=text, fg=color))

    def _enable_open_btn(self):
        self.root.after(0, lambda: self.open_btn.config(state=tk.NORMAL))

    def _install_deps(self):
        self.install_btn.config(state=tk.DISABLED)
        threading.Thread(target=self._install_deps_thread, daemon=True).start()

    def _install_deps_thread(self):
        self._log("Installing backend dependencies…", "info")

        # Create venv if needed
        if not os.path.exists(VENV_DIR):
            self._log("Creating Python virtual environment…", "info")
            result = subprocess.run(
                [PYTHON, "-m", "venv", VENV_DIR],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                self._log(f"venv creation failed: {result.stderr}", "err")
                self.root.after(0, lambda: self.install_btn.config(state=tk.NORMAL))
                return
            self._log("Virtual environment created.", "ok")

        pip = get_pip()
        req_file = os.path.join(BACKEND_DIR, "requirements.txt")
        self._log(f"Running pip install -r {req_file}", "info")
        proc = subprocess.Popen(
            [pip, "install", "-r", req_file, "--upgrade-strategy", "only-if-needed"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, cwd=BACKEND_DIR
        )
        for line in proc.stdout:
            line = line.rstrip()
            if line:
                self._log(f"  pip: {line}")
        proc.wait()
        if proc.returncode == 0:
            self._log("Backend dependencies installed successfully.", "ok")
        else:
            self._log("pip install encountered errors (see above).", "warn")

        # Check node_modules
        nm = os.path.join(FRONTEND_DIR, "node_modules")
        if not os.path.exists(nm):
            self._log("Installing frontend npm packages…", "info")
            proc2 = subprocess.Popen(
                ["npm", "install"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, cwd=FRONTEND_DIR,
                shell=IS_WIN
            )
            for line in proc2.stdout:
                l = line.rstrip()
                if l:
                    self._log(f"  npm: {l}")
            proc2.wait()
            if proc2.returncode == 0:
                self._log("Frontend packages installed.", "ok")
            else:
                self._log("npm install failed.", "err")
        else:
            self._log("node_modules already present — skipping npm install.", "ok")

        self._log("All dependencies ready. Click ▶ Start All Services.", "ok")
        self.root.after(0, lambda: self.install_btn.config(state=tk.NORMAL))

    def _start_all(self):
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        threading.Thread(target=self._start_backend_thread, daemon=True).start()
        threading.Thread(target=self._start_frontend_thread, daemon=True).start()

    def _start_backend_thread(self):
        self._set_backend_status("● Backend: starting…", "#fbbf24")
        self._log("Starting FastAPI backend on port 8000…", "info")

        # Free port 8000 in case a zombie uvicorn from a previous run is still
        # listening (common when the launcher was force-closed).
        killed = free_port(8000)
        if killed:
            self._log(
                f"Released port 8000 from stale process(es): {killed}", "warn"
            )

        python_bin = get_venv_python()

        if not os.path.exists(python_bin):
            self._log(
                f"Python interpreter not found at '{python_bin}'. "
                "Click '⬇ Install Dependencies' first to create the virtual environment.",
                "err",
            )
            self._set_backend_status("● Backend: no venv", "#ef4444")
            self.root.after(0, lambda: self.start_btn.config(state=tk.NORMAL))
            return

        self._log(f"Using Python: {python_bin}", "info")

        # Force unbuffered stdout so backend print() calls reach this console
        # in real time. Without this, Windows pipes block-buffer the child
        # process and progress logs (and our [video]/[upload] diagnostics)
        # only show up after a flush deep inside Python's I/O layer.
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        try:
            self.backend_proc = subprocess.Popen(
                # NOTE: --reload removed. The reloader spawns a child process
                # whose stdout does not reliably propagate through the parent
                # pipe on Windows, and end-users don't need hot reload anyway.
                [python_bin, "-u", "-m", "uvicorn", "main:app",
                 "--host", "0.0.0.0", "--port", "8000"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, cwd=BACKEND_DIR, env=env,
                bufsize=1,  # line-buffered on the read side
                creationflags=subprocess.CREATE_NO_WINDOW if IS_WIN else 0
            )
        except FileNotFoundError:
            self._log("uvicorn not found — run Install Dependencies first.", "err")
            self._set_backend_status("● Backend: error", "#ef4444")
            self.root.after(0, lambda: self.start_btn.config(state=tk.NORMAL))
            return

        for line in self.backend_proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            self._log(f"[backend] {line}")
            if "Application startup complete" in line or "Started server" in line or "Uvicorn running" in line:
                self._set_backend_status("● Backend: running :8000", "#4ade80")
                self._log("Backend ready at http://localhost:8000", "ok")
                with self._lock:
                    self.backend_ready = True
                self._check_both_ready()

        self._set_backend_status("● Backend: stopped", "#ef4444")
        self._log("Backend process exited.", "warn")

    def _start_frontend_thread(self):
        self._set_frontend_status("● Frontend: starting…", "#fbbf24")
        self._log("Starting Vite/React frontend on port 5173…", "info")

        killed = free_port(5173)
        if killed:
            self._log(
                f"Released port 5173 from stale process(es): {killed}", "warn"
            )

        nm = os.path.join(FRONTEND_DIR, "node_modules")
        if not os.path.exists(nm):
            self._log("node_modules not found — installing…", "warn")
            subprocess.run(
                ["npm", "install"],
                cwd=FRONTEND_DIR, capture_output=True, shell=IS_WIN
            )

        try:
            self.frontend_proc = subprocess.Popen(
                ["npm", "run", "dev", "--", "--host", "0.0.0.0"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, cwd=FRONTEND_DIR,
                shell=IS_WIN,
                creationflags=subprocess.CREATE_NO_WINDOW if IS_WIN else 0
            )
        except Exception as e:
            self._log(f"Frontend failed to start: {e}", "err")
            self._set_frontend_status("● Frontend: error", "#ef4444")
            return

        for line in self.frontend_proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            self._log(f"[frontend] {line}")
            if "localhost:5173" in line or "Local:" in line or "ready in" in line:
                self._set_frontend_status("● Frontend: running :5173", "#4ade80")
                self._log("Frontend ready at http://localhost:5173", "ok")
                with self._lock:
                    self.frontend_ready = True
                self._check_both_ready()

        self._set_frontend_status("● Frontend: stopped", "#ef4444")
        self._log("Frontend process exited.", "warn")

    def _check_both_ready(self):
        with self._lock:
            if self.backend_ready and self.frontend_ready:
                self._log("✓ All services running — opening browser…", "ok")
                self._enable_open_btn()
                time.sleep(1.5)
                self._open_browser()

    def _open_browser(self):
        webbrowser.open("http://localhost:5173")

    def _stop_all(self):
        self._log("Stopping all services…", "warn")
        if self.backend_proc:
            try:
                self.backend_proc.terminate()
            except Exception:
                pass
            self.backend_proc = None
        if self.frontend_proc:
            try:
                self.frontend_proc.terminate()
            except Exception:
                pass
            self.frontend_proc = None
        # Belt-and-braces: kill any leftover that's still bound to the ports.
        time.sleep(0.4)
        for port in (8000, 5173):
            try:
                free_port(port)
            except Exception:
                pass

        with self._lock:
            self.backend_ready = False
            self.frontend_ready = False

        self._set_backend_status("● Backend: stopped", "#ef4444")
        self._set_frontend_status("● Frontend: stopped", "#ef4444")
        self.root.after(0, lambda: self.open_btn.config(state=tk.DISABLED))
        self.root.after(0, lambda: self.start_btn.config(state=tk.NORMAL))
        self.root.after(0, lambda: self.stop_btn.config(state=tk.DISABLED))
        self._log("All services stopped.", "info")

    def _on_close(self):
        if self.backend_proc or self.frontend_proc:
            if messagebox.askyesno("Quit", "Stop all services and exit?"):
                self._stop_all()
                time.sleep(0.5)
                self.root.destroy()
        else:
            self.root.destroy()


def main():
    root = tk.Tk()
    app = LauncherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
