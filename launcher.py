"""
Traffic Violation System - Launcher
Starts PostgreSQL, Flask backend, and React frontend.
Convert to .exe with build_exe.bat
"""

import os
import sys
import time
import signal
import subprocess
import webbrowser

try:
    from colorama import Fore, Style, init as colorama_init
    colorama_init(autoreset=True)
    HAS_COLOR = True
except ImportError:
    HAS_COLOR = False

    class _Stub:
        def __getattr__(self, _):
            return ""

    Fore = Style = _Stub()

# ---------------------------------------------------------------------------
# Paths (relative to this script's location)
# ---------------------------------------------------------------------------
ROOT        = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")
PYTHON_EXE  = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
NPM_CMD     = "npm"

BACKEND_URL  = "http://localhost:5000"
FRONTEND_URL = "http://localhost:3000"
PG_SERVICE   = "postgresql-x64-18"

# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------
BANNER = r"""
  ╔══════════════════════════════════════════════════════════╗
  ║         TRAFFIC VIOLATION DETECTION SYSTEM               ║
  ║                    Launcher v1.0                         ║
  ╚══════════════════════════════════════════════════════════╝
"""


def banner():
    print(Fore.CYAN + BANNER + Style.RESET_ALL)


def step(n, total, msg):
    print(f"{Fore.YELLOW}[{n}/{total}]{Style.RESET_ALL} {msg}")


def ok(msg):
    print(f"      {Fore.GREEN}✓{Style.RESET_ALL} {msg}")


def warn(msg):
    print(f"      {Fore.YELLOW}!{Style.RESET_ALL} {msg}")


def fail(msg):
    print(f"\n{Fore.RED}[ERROR]{Style.RESET_ALL} {msg}\n")


def info(msg):
    print(f"      {msg}")


# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------
def is_pg_running() -> bool:
    result = subprocess.run(
        ["sc", "query", PG_SERVICE],
        capture_output=True, text=True
    )
    return "RUNNING" in result.stdout


def start_postgres() -> bool:
    result = subprocess.run(
        ["net", "start", PG_SERVICE],
        capture_output=True, text=True
    )
    return result.returncode == 0


def ensure_postgres() -> bool:
    if is_pg_running():
        ok("PostgreSQL is already running.")
        return True

    warn("PostgreSQL is not running. Trying to start it...")
    if start_postgres():
        info("Waiting 3 seconds for PostgreSQL to be ready...")
        time.sleep(3)
        ok("PostgreSQL started successfully.")
        return True
    else:
        fail(
            "Could not start PostgreSQL automatically.\n"
            "       Try running this launcher as Administrator,\n"
            "       or start PostgreSQL manually and relaunch."
        )
        return False


# ---------------------------------------------------------------------------
# Database migration
# ---------------------------------------------------------------------------
def run_migrations() -> bool:
    migrate_cmd = (
        "from app import app; from models import db; "
        "app.app_context().push(); db.create_all()"
    )
    result = subprocess.run(
        [PYTHON_EXE, "-c", migrate_cmd],
        cwd=BACKEND_DIR,
        capture_output=True, text=True
    )
    if result.returncode == 0:
        ok("Database tables verified / created.")
        return True
    fail(
        f"Database migration failed.\n"
        f"       Check backend/.env and PostgreSQL connection.\n"
        f"       Details: {result.stderr.strip()}"
    )
    return False


# ---------------------------------------------------------------------------
# Process launchers
# ---------------------------------------------------------------------------
def start_backend() -> subprocess.Popen | None:
    try:
        proc = subprocess.Popen(
            [PYTHON_EXE, "app.py"],
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        ok(f"Flask backend started  (PID {proc.pid})  → {BACKEND_URL}")
        return proc
    except FileNotFoundError:
        fail(
            f"Python venv not found at:\n"
            f"       {PYTHON_EXE}\n"
            f"       Run setup_first_time.bat first."
        )
        return None


def start_frontend() -> subprocess.Popen | None:
    node_modules = os.path.join(FRONTEND_DIR, "node_modules")
    if not os.path.isdir(node_modules):
        warn("node_modules not found. Running npm install - please wait...")
        result = subprocess.run(
            [NPM_CMD, "install"],
            cwd=FRONTEND_DIR,
            shell=True
        )
        if result.returncode != 0:
            fail("npm install failed. Make sure Node.js is installed.")
            return None
        ok("npm install complete.")

    try:
        proc = subprocess.Popen(
            [NPM_CMD, "run", "dev"],
            cwd=FRONTEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        ok(f"React frontend started (PID {proc.pid})  → {FRONTEND_URL}")
        return proc
    except Exception as e:
        fail(f"Could not start frontend: {e}")
        return None


# ---------------------------------------------------------------------------
# Health polling
# ---------------------------------------------------------------------------
def wait_for_backend(timeout: int = 30) -> bool:
    import urllib.request
    import urllib.error

    info(f"Waiting for backend to be ready (up to {timeout}s)...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"{BACKEND_URL}/health", timeout=2)
            return True
        except Exception:
            time.sleep(1)
    return False


# ---------------------------------------------------------------------------
# Shutdown
# ---------------------------------------------------------------------------
def kill_proc(proc: subprocess.Popen, name: str):
    if proc and proc.poll() is None:
        try:
            proc.send_signal(signal.CTRL_BREAK_EVENT)
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        info(f"{name} stopped.")


def shutdown(backend_proc, frontend_proc):
    print(f"\n{Fore.YELLOW}Shutting down services...{Style.RESET_ALL}")
    kill_proc(frontend_proc, "React frontend")
    kill_proc(backend_proc,  "Flask backend")
    print(f"{Fore.GREEN}All services stopped. Goodbye!{Style.RESET_ALL}\n")


# ---------------------------------------------------------------------------
# Status monitor
# ---------------------------------------------------------------------------
def monitor(backend_proc: subprocess.Popen, frontend_proc: subprocess.Popen):
    print(f"\n{Fore.CYAN}{'─' * 60}{Style.RESET_ALL}")
    print(f"  {Fore.GREEN}System is ready!{Style.RESET_ALL}")
    print(f"  Frontend : {Fore.CYAN}{FRONTEND_URL}{Style.RESET_ALL}")
    print(f"  Backend  : {Fore.CYAN}{BACKEND_URL}{Style.RESET_ALL}")
    print(f"  Admin    : {Fore.YELLOW}admin / admin123{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'─' * 60}{Style.RESET_ALL}")
    print(f"  Press {Fore.RED}Ctrl+C{Style.RESET_ALL} to stop all services.\n")

    try:
        while True:
            time.sleep(5)

            backend_alive  = backend_proc  and backend_proc.poll()  is None
            frontend_alive = frontend_proc and frontend_proc.poll() is None

            status_b = f"{Fore.GREEN}running{Style.RESET_ALL}" if backend_alive  else f"{Fore.RED}STOPPED{Style.RESET_ALL}"
            status_f = f"{Fore.GREEN}running{Style.RESET_ALL}" if frontend_alive else f"{Fore.RED}STOPPED{Style.RESET_ALL}"
            ts = time.strftime("%H:%M:%S")
            print(f"  [{ts}]  Backend: {status_b}   Frontend: {status_f}", end="\r")

            if not backend_alive:
                warn("Flask backend has stopped unexpectedly!")
            if not frontend_alive:
                warn("React frontend has stopped unexpectedly!")

    except KeyboardInterrupt:
        pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    banner()

    TOTAL = 5
    backend_proc  = None
    frontend_proc = None

    try:
        # 1. PostgreSQL
        step(1, TOTAL, "Checking PostgreSQL...")
        if not ensure_postgres():
            sys.exit(1)

        # 2. DB migrations
        step(2, TOTAL, "Running database migrations...")
        if not run_migrations():
            sys.exit(1)

        # 3. Flask backend
        step(3, TOTAL, "Starting Flask backend...")
        backend_proc = start_backend()
        if not backend_proc:
            sys.exit(1)

        # 4. React frontend
        step(4, TOTAL, "Starting React frontend...")
        frontend_proc = start_frontend()
        if not frontend_proc:
            shutdown(backend_proc, None)
            sys.exit(1)

        # 5. Open browser
        step(5, TOTAL, "Waiting for backend health check...")
        if wait_for_backend():
            ok("Backend is healthy.")
        else:
            warn("Backend health check timed out — it may still be starting.")

        info(f"Opening browser at {FRONTEND_URL}...")
        webbrowser.open(FRONTEND_URL)

        # Monitor until Ctrl+C
        monitor(backend_proc, frontend_proc)

    finally:
        shutdown(backend_proc, frontend_proc)


if __name__ == "__main__":
    main()
