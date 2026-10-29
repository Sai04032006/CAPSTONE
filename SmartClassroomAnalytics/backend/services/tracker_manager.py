import os
import sys
import time
import signal
import subprocess
import threading
from collections import deque
from datetime import datetime
from pathlib import Path

# Paths derived from project root
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
AI_DIR = PROJECT_ROOT / "ai"
TRACKER_SCRIPT = AI_DIR / "integration" / "identity_tracking_test.py"
STORAGE_DIR = PROJECT_ROOT / "storage"
STOP_FLAG = STORAGE_DIR / "tracker_stop.flag"
LOG_FILE = STORAGE_DIR / "tracker.log"


class TrackerManager:
    """
    Manages the lifecycle of the AI camera tracking subprocess (YOLO + InsightFace).
    Handles starting, monitoring, log capture, error reporting, and clean graceful shutdown.
    """

    def __init__(self):
        self.process: subprocess.Popen | None = None
        self.session_id: int | None = None
        self.status: str = "IDLE"  # IDLE, STARTING, RUNNING, STOPPED, FAILED
        self.started_at: datetime | None = None
        self.last_error: str | None = None
        self.recent_logs: deque[str] = deque(maxlen=60)
        self._lock = threading.Lock()
        self._reader_thread: threading.Thread | None = None

    def is_running(self) -> bool:
        if self.process is None:
            return False
        return self.process.poll() is None

    def get_status(self) -> dict:
        with self._lock:
            if self.process is not None:
                ret = self.process.poll()
                if ret is not None:
                    # Process has terminated
                    if self.status in ("STARTING", "RUNNING"):
                        if ret == 0:
                            self.status = "STOPPED"
                        else:
                            self.status = "FAILED"
                            if not self.last_error:
                                self.last_error = f"Process exited with code {ret}"

            return {
                "status": self.status,
                "session_id": self.session_id,
                "pid": self.process.pid if self.is_running() else None,
                "started_at": self.started_at.isoformat() if self.started_at else None,
                "last_error": self.last_error,
                "recent_logs": list(self.recent_logs)[-25:],
            }

    def _resolve_python(self) -> str:
        # 1. Check custom environment variable
        custom_exec = os.environ.get("PYTHON_EXEC_PATH")
        if custom_exec and Path(custom_exec).exists():
            return custom_exec

        # 2. Check current sys.executable
        if sys.executable and Path(sys.executable).exists():
            return sys.executable

        # 3. Check virtualenv in parent of project root
        venv_python = PROJECT_ROOT.parent / ".venv" / "Scripts" / "python.exe"
        if venv_python.exists():
            return str(venv_python)

        # 4. Fallback to generic python
        return "python"

    def start_tracker(self, session_id: int) -> dict:
        with self._lock:
            # Prevent multiple trackers for the same session
            if self.is_running():
                if self.session_id == session_id:
                    return {
                        "status": self.status,
                        "session_id": self.session_id,
                        "pid": self.process.pid,
                        "message": f"Tracker is already active for session #{session_id}.",
                    }
                else:
                    # Running for a previous session - stop it first
                    self._stop_process_locked()

            # Reset tracker state
            self.session_id = session_id
            self.status = "STARTING"
            self.started_at = datetime.utcnow()
            self.last_error = None
            self.recent_logs.clear()

            # Ensure storage directory exists and remove stale stop flag
            STORAGE_DIR.mkdir(parents=True, exist_ok=True)
            if STOP_FLAG.exists():
                try:
                    STOP_FLAG.unlink()
                except OSError:
                    pass

            # Validate script path
            if not TRACKER_SCRIPT.exists():
                self.status = "FAILED"
                self.last_error = f"AI tracking script not found at {TRACKER_SCRIPT}"
                return {
                    "status": "FAILED",
                    "session_id": session_id,
                    "error": self.last_error,
                }

            python_bin = self._resolve_python()

            # Build environment
            env = os.environ.copy()
            env["PYTHONPATH"] = f"{PROJECT_ROOT}{os.pathsep}{AI_DIR}{os.pathsep}{BACKEND_DIR}"
            env["PYTHONUNBUFFERED"] = "1"
            env["TRACKER_SESSION_ID"] = str(session_id)
            env["SMARTCLASSROOM_HEADLESS"] = "1"

            args = [
                python_bin,
                str(TRACKER_SCRIPT),
                "--session-id",
                str(session_id),
            ]

            try:
                creationflags = 0
                if sys.platform == "win32":
                    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

                self.process = subprocess.Popen(
                    args,
                    cwd=str(PROJECT_ROOT),
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    creationflags=creationflags,
                )

                # Launch log monitor thread
                self._reader_thread = threading.Thread(
                    target=self._log_monitor_worker,
                    args=(self.process, session_id),
                    daemon=True,
                )
                self._reader_thread.start()

                return {
                    "status": "STARTING",
                    "session_id": session_id,
                    "pid": self.process.pid,
                    "message": "AI Tracking process launched successfully.",
                }
            except Exception as e:
                self.status = "FAILED"
                self.last_error = str(e)
                return {
                    "status": "FAILED",
                    "session_id": session_id,
                    "error": str(e),
                }

    def _log_monitor_worker(self, proc: subprocess.Popen, session_id: int):
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as log_f:
                header = f"\n=== TRACKER PROCESS STARTED (Session #{session_id}, PID {proc.pid}) at {datetime.utcnow().isoformat()} ===\n"
                log_f.write(header)
                log_f.flush()

                for raw_line in iter(proc.stdout.readline, ''):
                    line = raw_line.strip()
                    if line:
                        self.recent_logs.append(line)
                        log_f.write(line + "\n")
                        log_f.flush()

                        # Detect readiness
                        if (
                            "LIVE ATTENDANCE STARTED" in line
                            or "Camera opened" in line
                            or "Session ID:" in line
                        ):
                            if self.status == "STARTING":
                                self.status = "RUNNING"

                        # Detect camera / runtime errors
                        if "Could not open camera" in line or "ERROR:" in line:
                            self.last_error = line
                            self.status = "FAILED"

            proc.stdout.close()
            ret = proc.wait()
            with self._lock:
                if self.status not in ("STOPPED",):
                    if ret == 0:
                        self.status = "STOPPED"
                    else:
                        self.status = "FAILED"
                        if not self.last_error:
                            self.last_error = f"Tracker process exited with code {ret}"
        except Exception as e:
            self.last_error = str(e)

    def stop_tracker(self, session_id: int | None = None) -> dict:
        with self._lock:
            return self._stop_process_locked()

    def _stop_process_locked(self) -> dict:
        if not self.is_running():
            self.status = "STOPPED"
            return {"status": "STOPPED", "message": "Tracker is not currently running."}

        self.status = "STOPPING"
        proc = self.process

        # 1. Signal graceful stop via stop flag file
        try:
            STORAGE_DIR.mkdir(parents=True, exist_ok=True)
            STOP_FLAG.write_text("stop", encoding="utf-8")
        except Exception:
            pass

        # 2. Send 'q' to stdin if open
        try:
            if proc.stdin and not proc.stdin.closed:
                proc.stdin.write("q\n")
                proc.stdin.flush()
        except Exception:
            pass

        # 3. Send CTRL_BREAK_EVENT on Windows
        if sys.platform == "win32":
            try:
                proc.send_signal(signal.CTRL_BREAK_EVENT)
            except Exception:
                pass

        # 4. Wait up to 8 seconds for child to finalize attendance and release camera
        try:
            proc.wait(timeout=8.0)
        except subprocess.TimeoutExpired:
            print("Tracker did not exit within 8s, terminating...")
            try:
                proc.terminate()
                proc.wait(timeout=2.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

        # Clean stop flag
        if STOP_FLAG.exists():
            try:
                STOP_FLAG.unlink()
            except OSError:
                pass

        self.status = "STOPPED"
        self.process = None
        return {"status": "STOPPED", "message": "Tracker process stopped and camera released."}


tracker_manager = TrackerManager()
