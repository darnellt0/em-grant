#!/usr/bin/env python3
"""
Project Doctor: Comprehensive project health checks and optional fixes.
Runs on Windows, macOS, Linux. No external dependencies beyond stdlib.

Usage:
  python project_doctor.py              # Read-only checks
  python project_doctor.py --fix        # Perform safe fixes
  python project_doctor.py --json OUT   # Emit JSON report

Exit codes: 0 (all good), 1 (warnings), 2 (failures)
"""

import argparse
import json
import os
import platform
import re
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ============================================================================
# TERMINAL UTILITIES
# ============================================================================

def supports_color() -> bool:
    """Detect if terminal supports ANSI colors."""
    if sys.platform == "win32":
        # Try to enable Windows ANSI support
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
            mode = ctypes.c_ulong()
            kernel32.GetConsoleMode(handle, ctypes.byref(mode))
            mode.value |= 0x0004  # ENABLE_VIRTUAL_TERMINAL_PROCESSING
            kernel32.SetConsoleMode(handle, mode)
            return True
        except Exception:
            return False
    return sys.stdout.isatty()


COLOR_ENABLED = supports_color()


def color_text(text: str, level: str) -> str:
    """Apply ANSI color codes or return plain text."""
    if not COLOR_ENABLED:
        return text
    colors = {
        "good": "\033[92m",      # Green
        "warn": "\033[93m",      # Yellow
        "fail": "\033[91m",      # Red
        "info": "\033[94m",      # Blue
        "reset": "\033[0m",
    }
    return f"{colors.get(level, '')}{text}{colors['reset']}"


def emoji(name: str) -> str:
    """Return emoji or fallback ASCII symbol."""
    emojis = {
        "good": "[OK]",
        "warn": "[!]",
        "fail": "[X]",
        "info": "[i]",
        "gear": "[*]",
        "rocket": "[>]",
        "lock": "[L]",
        "pkg": "[P]",
    }
    return emojis.get(name, "[-]")


# ============================================================================
# COMMAND UTILITIES
# ============================================================================

def has_cmd(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    try:
        result = subprocess.run(
            ["where" if sys.platform == "win32" else "which", cmd],
            capture_output=True,
            timeout=2,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


def get_cmd_version(cmd: str, args: List[str] = None) -> Optional[str]:
    """Get version string of a command."""
    if args is None:
        args = ["--version"]
    try:
        result = subprocess.run(
            [cmd] + args,
            capture_output=True,
            timeout=5,
            check=False,
            text=True,
        )
        out = (result.stdout + result.stderr).strip().split("\n")[0]
        return out if out else None
    except Exception:
        return None


def run(cmd: List[str], timeout: int = 120, cwd: Optional[str] = None) -> Tuple[int, str, str]:
    """Run command and return (exit_code, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout,
            text=True,
            cwd=cwd,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "Command timed out"
    except Exception as e:
        return 127, "", str(e)


def tcp_probe(port: int, host: str = "127.0.0.1", timeout: float = 0.2) -> bool:
    """Check if TCP port is open."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False


# ============================================================================
# PROJECT DETECTION & SCANNING
# ============================================================================

def detect_package_manager() -> Tuple[str, bool]:
    """Return (package_manager, is_global). Check for pnpm > yarn > npm."""
    if Path("pnpm-lock.yaml").exists():
        return "pnpm", has_cmd("pnpm")
    if Path("yarn.lock").exists():
        return "yarn", has_cmd("yarn")
    return "npm", has_cmd("npm")


def get_python_version() -> str:
    """Return Python version string."""
    return f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"


def scan_files(patterns: List[str], extensions: List[str] = None) -> List[str]:
    """Recursively scan files matching extensions for regex patterns."""
    matches = []
    if extensions is None:
        extensions = ["*"]

    for ext in extensions:
        for fpath in Path(".").rglob(f"*{ext}"):
            if any(skip in str(fpath) for skip in ["node_modules", ".git", "dist", "build", "__pycache__"]):
                continue
            try:
                content = fpath.read_text(errors="ignore")
                for pattern in patterns:
                    if re.search(pattern, content):
                        matches.append(str(fpath))
                        break
            except Exception:
                pass

    return list(set(matches))


def find_symbols(symbols: List[str], extensions: List[str]) -> Dict[str, bool]:
    """Check for presence of symbols in files."""
    found = {sym: False for sym in symbols}

    for ext in extensions:
        for fpath in Path(".").rglob(f"*{ext}"):
            if any(skip in str(fpath) for skip in ["node_modules", ".git", "dist", "build"]):
                continue
            try:
                content = fpath.read_text(errors="ignore")
                for sym in symbols:
                    if sym in content:
                        found[sym] = True
            except Exception:
                pass

    return found


def git_get_branch() -> Optional[str]:
    """Get current git branch."""
    code, out, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    return out.strip() if code == 0 else None


def git_is_dirty() -> bool:
    """Check if git working tree is dirty."""
    code, _, _ = run(["git", "status", "--porcelain"])
    return code == 0


def git_scan_secrets() -> List[Tuple[str, str, str]]:
    """Scan last 50 commits for secret patterns. Return (commit, file, pattern)."""
    findings = []
    patterns = [
        (r"AKIA[0-9A-Z]{16}", "AWS Access Key"),
        (r"aws_secret_access_key\s*=\s*[^\s]+", "AWS Secret Key"),
        (r"ghp_[a-zA-Z0-9_]{36,}", "GitHub Personal Access Token"),
        (r"-----BEGIN PRIVATE KEY-----", "Private Key"),
        (r"xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9_]{24}", "Slack Bot Token"),
        (r"xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9_]{32}", "Slack Token"),
    ]

    code, out, _ = run(["git", "log", "-50", "--oneline", "--format=%h %s"])
    if code != 0:
        return findings

    commits = [line.split()[0] for line in out.strip().split("\n") if line]

    for commit in commits:
        code, diff, _ = run(["git", "show", commit])
        if code != 0:
            continue

        for line in diff.split("\n"):
            if not line.startswith("+"):
                continue
            for pattern, name in patterns:
                if re.search(pattern, line):
                    findings.append((commit, name, line[:80]))
                    break

    return findings


def check_env_files() -> Dict[str, List[str]]:
    """Check for missing env keys. Return {env_file: [missing_keys]}."""
    missing = {}

    if not Path(".env.example").exists():
        return missing

    try:
        example_keys = set()
        with open(".env.example") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    key = line.split("=")[0].strip()
                    if key:
                        example_keys.add(key)

        for env_file in Path(".").glob(".env*"):
            if env_file.name == ".env.example":
                continue

            try:
                env_keys = set()
                with open(env_file) as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            key = line.split("=")[0].strip()
                            if key:
                                env_keys.add(key)

                missing_keys = sorted(example_keys - env_keys)
                if missing_keys:
                    missing[env_file.name] = missing_keys
            except Exception:
                pass
    except Exception:
        pass

    return missing


# ============================================================================
# HEALTH CHECK FUNCTIONS
# ============================================================================

class HealthChecker:
    """Orchestrate all health checks."""

    def __init__(self, fix: bool = False, json_output: Optional[str] = None):
        self.fix = fix
        self.json_output = json_output
        self.checks = []
        self.warnings = []
        self.failures = []
        self.info = []

    def add_check(self, name: str, status: str, message: str, details: Optional[str] = None):
        """Record a check result."""
        self.checks.append({
            "name": name,
            "status": status,
            "message": message,
            "details": details,
        })

        if status == "WARN":
            self.warnings.append(message)
        elif status == "FAIL":
            self.failures.append(message)
        elif status == "INFO":
            self.info.append(message)

    def print_check(self, name: str, status: str, message: str, details: Optional[str] = None):
        """Print check result to console."""
        icon = emoji(status.lower())
        color = "good" if status == "PASS" else ("warn" if status == "WARN" else ("fail" if status == "FAIL" else "info"))

        status_colored = color_text(f"[{status}]", color)
        print(f"{icon} {status_colored} {name}")
        if message:
            print(f"   {message}")
        if details:
            for line in details.strip().split("\n"):
                print(f"   {line}")

    def check_environment(self):
        """Check OS, Python, and tooling versions."""
        self.print_check("Environment", "PASS", "")

        os_name = platform.system()
        py_ver = get_python_version()
        print(f"   OS: {os_name} | Python: {py_ver}")

        tools = {
            "git": None,
            "node": None,
            "npm": None,
            "yarn": None,
            "pnpm": None,
            "docker": None,
            "docker compose": None,
            "clasp": None,
            "pytest": None,
        }

        for tool in tools:
            if tool == "docker compose":
                if has_cmd("docker"):
                    ver = get_cmd_version("docker", ["compose", "version"])
                    tools[tool] = ver
            else:
                if has_cmd(tool):
                    tools[tool] = get_cmd_version(tool)

        details = "\n".join(
            f"{tool}: {ver or 'not installed'}"
            for tool, ver in sorted(tools.items())
            if ver or has_cmd(tool.split()[0])
        )
        self.add_check("Tooling Versions", "PASS", "", details)

    def check_git_safety(self):
        """Check git branch, dirty state, and scan for secrets."""
        if not has_cmd("git"):
            self.add_check("Git Safety", "INFO", "Git not installed, skipping")
            return

        branch = git_get_branch()
        is_dirty = git_is_dirty()

        dirty_msg = " (dirty)" if is_dirty else ""
        self.print_check("Git Branch", "PASS", f"{branch}{dirty_msg}")
        self.add_check("Git Branch", "PASS", f"{branch}{dirty_msg}")

        secrets = git_scan_secrets()
        if secrets:
            msg = f"Found {len(secrets)} potential secret(s) in history"
            details = "\n".join(f"{c}: {name}" for c, name, _ in secrets[:5])
            self.print_check("Git Secrets Scan", "WARN", msg, details)
            self.add_check("Git Secrets Scan", "WARN", msg, details)
        else:
            self.print_check("Git Secrets Scan", "PASS", "No secrets detected")
            self.add_check("Git Secrets Scan", "PASS", "No secrets detected")

    def check_required_files(self):
        """Check for README.md and .env.example."""
        readme_exists = Path("README.md").exists()
        env_example_exists = Path(".env.example").exists()

        if not readme_exists:
            msg = "README.md missing (FAIL)"
            self.print_check("README.md", "FAIL", msg)
            self.add_check("README.md", "FAIL", msg)
        else:
            self.print_check("README.md", "PASS", "Found")
            self.add_check("README.md", "PASS", "Found")

        if not env_example_exists and Path(".env").exists():
            msg = ".env.example missing but .env exists (FAIL)"
            self.print_check(".env.example", "FAIL", msg)
            self.add_check(".env.example", "FAIL", msg)
        elif not env_example_exists:
            self.print_check(".env.example", "INFO", "Not found")
            self.add_check(".env.example", "INFO", "Not found")
        else:
            self.print_check(".env.example", "PASS", "Found")
            self.add_check(".env.example", "PASS", "Found")

        optional_files = [
            ".env", ".env.local", ".env.production",
            "package.json", "requirements.txt", "pyproject.toml",
            "docker-compose.yml", "compose.yaml", "Dockerfile",
            ".clasp.json", "appsscript.json"
        ]

        found = [f for f in optional_files if Path(f).exists()]
        if found:
            self.print_check("Optional Files", "PASS", ", ".join(found))
            self.add_check("Optional Files", "PASS", ", ".join(found))

    def check_nodejs_app(self):
        """Check Node.js app health: lint, test, build."""
        if not Path("package.json").exists():
            self.add_check("Node.js App", "INFO", "package.json not found, skipping")
            return

        self.print_check("Node.js App", "PASS", "package.json found")

        try:
            pkg_data = json.loads(Path("package.json").read_text())
        except Exception as e:
            self.print_check("package.json", "FAIL", f"Invalid JSON: {e}")
            self.add_check("package.json", "FAIL", f"Invalid JSON: {e}")
            return

        pm, pm_exists = detect_package_manager()
        self.print_check("Package Manager", "PASS" if pm_exists else "WARN", f"{pm} detected")
        self.add_check("Package Manager", "PASS" if pm_exists else "WARN", f"{pm} detected")

        if self.fix and pm_exists:
            if pm == "pnpm":
                code, out, err = run(["pnpm", "install", "--frozen-lockfile"])
            elif pm == "yarn":
                code, out, err = run(["yarn", "install", "--frozen-lockfile"])
            else:
                code, out, err = run(["npm", "ci"])

            if code == 0:
                self.print_check("Install Dependencies", "PASS", "Done")
                self.add_check("Install Dependencies", "PASS", "Done")
            else:
                self.print_check("Install Dependencies", "WARN", f"Exit code {code}")
                self.add_check("Install Dependencies", "WARN", f"Exit code {code}")

        scripts = pkg_data.get("scripts", {})

        if "lint" in scripts:
            code, out, err = run([pm, "run", "lint"], timeout=60)
            if code == 0:
                self.print_check("Lint", "PASS", "Passed")
                self.add_check("Lint", "PASS", "Passed")
            else:
                self.print_check("Lint", "WARN", f"Failed (exit {code})")
                self.add_check("Lint", "WARN", f"Failed (exit {code})")

        if "test" in scripts:
            code, out, err = run([pm, "run", "test"], timeout=60)
            if code == 0:
                self.print_check("Test", "PASS", "Passed")
                self.add_check("Test", "PASS", "Passed")
            else:
                self.print_check("Test", "WARN", f"Failed (exit {code})")
                self.add_check("Test", "WARN", f"Failed (exit {code})")

        if "build" in scripts:
            code, out, err = run([pm, "run", "build"], timeout=120)
            if code == 0:
                self.print_check("Build", "PASS", "Passed")
                self.add_check("Build", "PASS", "Passed")
            else:
                msg = f"Failed (exit {code})"
                details = (out + "\n" + err)[-200:] if out or err else ""
                self.print_check("Build", "FAIL", msg, details)
                self.add_check("Build", "FAIL", msg, details)

    def check_python_app(self):
        """Check Python app: install deps and run pytest."""
        req_file = None
        if Path("requirements.txt").exists():
            req_file = "requirements.txt"
        elif Path("pyproject.toml").exists():
            req_file = "pyproject.toml"

        if not req_file:
            self.add_check("Python App", "INFO", "No requirements.txt/pyproject.toml found")
            return

        self.print_check("Python App", "PASS", f"{req_file} found")

        if self.fix:
            code, _, _ = run(["pip", "install", "--upgrade", "pip", "wheel"])

            if req_file == "requirements.txt":
                code, out, err = run(["pip", "install", "-r", "requirements.txt"])
            else:
                code, out, err = run(["pip", "install", "."])

            if code == 0:
                self.print_check("Install Dependencies", "PASS", "Done")
                self.add_check("Install Dependencies", "PASS", "Done")
            else:
                self.print_check("Install Dependencies", "WARN", f"Exit code {code}")
                self.add_check("Install Dependencies", "WARN", f"Exit code {code}")

        # Check for pytest
        has_pytest = has_cmd("pytest") or Path("pytest.ini").exists() or Path("pyproject.toml").exists()
        test_files = list(Path(".").rglob("*_test.py")) or list(Path(".").rglob("test_*.py"))

        if has_pytest or test_files:
            code, out, err = run(["pytest", "-q"], timeout=60)
            if code == 0:
                self.print_check("PyTest", "PASS", "Passed")
                self.add_check("PyTest", "PASS", "Passed")
            elif code == 5:
                self.print_check("PyTest", "INFO", "No tests found")
                self.add_check("PyTest", "INFO", "No tests found")
            else:
                self.print_check("PyTest", "WARN", f"Failed (exit {code})")
                self.add_check("PyTest", "WARN", f"Failed (exit {code})")

    def check_docker_stack(self):
        """Check Docker Compose configuration."""
        if not Path("docker-compose.yml").exists() and not Path("compose.yaml").exists():
            self.add_check("Docker Stack", "INFO", "No docker-compose.yml/compose.yaml found")
            return

        if not has_cmd("docker"):
            self.print_check("Docker Stack", "WARN", "Docker not installed")
            self.add_check("Docker Stack", "WARN", "Docker not installed")
            return

        # Validate config
        code, out, err = run(["docker", "compose", "config"], timeout=10)
        if code != 0:
            code, out, err = run(["docker-compose", "config"], timeout=10)

        if code == 0:
            self.print_check("Docker Compose Config", "PASS", "Valid")
            self.add_check("Docker Compose Config", "PASS", "Valid")
        else:
            self.print_check("Docker Compose Config", "FAIL", f"Invalid: {err[:80]}")
            self.add_check("Docker Compose Config", "FAIL", f"Invalid: {err[:80]}")
            return

        if self.fix:
            code, out, err = run(["docker", "compose", "up", "-d"], timeout=60)
            if code != 0:
                code, out, err = run(["docker-compose", "up", "-d"], timeout=60)

            if code == 0:
                self.print_check("Docker Compose Up", "PASS", "Started")
                self.add_check("Docker Compose Up", "PASS", "Started")

                # List containers and ports
                code, out, _ = run(["docker", "compose", "ps"])
                if code == 0:
                    self.print_check("Docker Containers", "PASS", "Running")
                    self.add_check("Docker Containers", "PASS", "Running")
            else:
                self.print_check("Docker Compose Up", "WARN", f"Exit {code}")
                self.add_check("Docker Compose Up", "WARN", f"Exit {code}")

    def check_google_apps_script(self):
        """Check Google Apps Script project."""
        if not Path(".clasp.json").exists() and not Path("appsscript.json").exists():
            self.add_check("Google Apps Script", "INFO", "Not a GAS project")
            return

        if not has_cmd("clasp"):
            self.print_check("Google Apps Script", "WARN", "clasp not installed")
            self.add_check("Google Apps Script", "WARN", "clasp not installed")
            return

        self.print_check("Google Apps Script", "PASS", "clasp installed")

        code, out, err = run(["clasp", "status"], timeout=10)
        if code == 0:
            self.print_check("clasp Status", "PASS", "Authenticated")
            self.add_check("clasp Status", "PASS", "Authenticated")
        else:
            self.print_check("clasp Status", "WARN", "Not authenticated. Run: clasp login")
            self.add_check("clasp Status", "WARN", "Not authenticated")

    def check_symbols(self):
        """Check for project-specific symbols."""
        symbols = [
            "findLLCQuickWins",
            "JSONUtils",
            "generateLLCPipeline",
            "generatePitch",
        ]
        extensions = [".js", ".ts", ".gs"]

        files = scan_files([], extensions)
        if not files:
            self.add_check("Project Symbols", "INFO", "No .js/.ts/.gs files found")
            return

        found = find_symbols(symbols, extensions)
        found_count = sum(1 for v in found.values() if v)

        if found_count == 0:
            msg = "None of the expected symbols found"
            self.print_check("Project Symbols", "WARN", msg)
            self.add_check("Project Symbols", "WARN", msg)
        elif found_count == len(symbols):
            msg = "All expected symbols found"
            self.print_check("Project Symbols", "PASS", msg)
            self.add_check("Project Symbols", "PASS", msg)
        else:
            msg = f"{found_count}/{len(symbols)} symbols found"
            details = "\n".join(f"{s}: {'✓' if found[s] else '✗'}" for s in symbols)
            self.print_check("Project Symbols", "INFO", msg, details)
            self.add_check("Project Symbols", "INFO", msg, details)

    def check_runtime_ports(self):
        """Check if dev servers are running on common ports."""
        ports = {3000: "React", 4000: "Common", 5173: "Vite", 8000: "Python", 8080: "Docker"}

        open_ports = {}
        for port, name in ports.items():
            if tcp_probe(port):
                open_ports[port] = name

        if open_ports:
            details = "\n".join(f":{port} ({name})" for port, name in sorted(open_ports.items()))
            self.print_check("Running Servers", "PASS", "Found", details)
            self.add_check("Running Servers", "PASS", "Found", details)
        else:
            self.print_check("Running Servers", "INFO", "None detected on common ports")
            self.add_check("Running Servers", "INFO", "None detected on common ports")

    def check_env_validation(self):
        """Check for missing env keys."""
        missing = check_env_files()

        if not missing:
            if Path(".env.example").exists():
                self.print_check(".env Keys", "PASS", "All keys present")
                self.add_check(".env Keys", "PASS", "All keys present")
            return

        for env_file, keys in missing.items():
            msg = f"{env_file}: missing {len(keys)} key(s)"
            details = ", ".join(keys[:5]) + ("..." if len(keys) > 5 else "")
            self.print_check(".env Keys", "WARN", msg, details)
            self.add_check(".env Keys", "WARN", msg, details)

    def check_production_footguns(self):
        """Scan for console.log, TODO, FIXME, and GAS alerts."""
        patterns = [
            (r"console\.log\s*\(", "console.log()"),
            (r"//\s*TODO", "TODO"),
            (r"//\s*FIXME", "FIXME"),
            (r"SpreadsheetApp\.getUi\(\)\.alert", "SpreadsheetApp.alert"),
        ]

        for pattern, name in patterns:
            files = scan_files([pattern])
            if files:
                msg = f"Found in {len(files)} file(s)"
                details = "\n".join(files[:3]) + ("\n..." if len(files) > 3 else "")
                self.print_check(f"Footgun: {name}", "WARN", msg, details)
                self.add_check(f"Footgun: {name}", "WARN", msg, details)

    def check_security(self):
        """Check .env committed, Dockerfile latest tags, npm audit."""
        # Check if .env is tracked in git
        if has_cmd("git"):
            code, out, _ = run(["git", "ls-files", "--error-unmatch", ".env"])
            if code == 0:
                self.print_check("Git: .env Tracked", "FAIL", ".env should not be in git")
                self.add_check("Git: .env Tracked", "FAIL", ".env should not be in git")
            else:
                self.print_check("Git: .env Tracked", "PASS", "Not tracked")
                self.add_check("Git: .env Tracked", "PASS", "Not tracked")

        # Check Dockerfile for latest tags
        if Path("Dockerfile").exists():
            content = Path("Dockerfile").read_text(errors="ignore")
            if "FROM" in content and ":latest" in content:
                self.print_check("Dockerfile: Latest Tag", "WARN", "Using 'latest' tag")
                self.add_check("Dockerfile: Latest Tag", "WARN", "Using 'latest' tag")
            else:
                self.print_check("Dockerfile: Latest Tag", "PASS", "No 'latest' tags")
                self.add_check("Dockerfile: Latest Tag", "PASS", "No 'latest' tags")

        # npm audit
        if Path("package.json").exists() and has_cmd("npm"):
            pm, _ = detect_package_manager()

            if pm == "npm":
                code, out, err = run(["npm", "audit", "--audit-level=high"], timeout=30)
            elif pm == "yarn":
                code, out, err = run(["yarn", "audit", "--level", "moderate"], timeout=30)
            elif pm == "pnpm":
                code, out, err = run(["pnpm", "audit", "--audit-level=high"], timeout=30)
            else:
                code = -1

            if code != 0 and code != -1:
                # Extract counts from audit output
                msg = "Vulnerabilities found; run 'npm audit' for details"
                self.print_check("npm Audit", "WARN", msg)
                self.add_check("npm Audit", "WARN", msg)
            elif code == 0:
                self.print_check("npm Audit", "PASS", "No high vulnerabilities")
                self.add_check("npm Audit", "PASS", "No high vulnerabilities")

    def print_summary(self):
        """Print final summary table and next steps."""
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)

        good = sum(1 for c in self.checks if c["status"] == "PASS")
        warn = sum(1 for c in self.checks if c["status"] == "WARN")
        fail = sum(1 for c in self.checks if c["status"] == "FAIL")

        print(f"Good: {color_text(str(good), 'good')}  |  "
              f"Warnings: {color_text(str(warn), 'warn')}  |  "
              f"Failures: {color_text(str(fail), 'fail')}")

        if fail == 0 and warn == 0:
            print(color_text("\nProject is ready! 🚀", "good"))
        elif fail == 0:
            print(color_text(f"\nProject has {warn} warning(s). Review recommended.", "warn"))
        else:
            print(color_text(f"\nProject has {fail} failure(s). Action required!", "fail"))

        # Next steps
        if fail > 0 or warn > 0:
            print("\nNext Steps:")
            steps = []

            if any(c["status"] == "FAIL" for c in self.checks if "README" in c["name"]):
                steps.append("1) Create README.md")
            if any(c["status"] == "FAIL" for c in self.checks if ".env" in c["name"]):
                steps.append("2) Create .env.example or .env file")
            if any("Build" in c["name"] and c["status"] == "FAIL" for c in self.checks):
                steps.append("3) Debug and fix build errors")
            if self.warnings:
                steps.append(f"4) Review and address {len(self.warnings)} warning(s)")

            for step in steps[:5]:
                print(f"  {step}")

        return (2 if fail > 0 else (1 if warn > 0 else 0))

    def save_json(self, filename: str):
        """Save report to JSON file."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "environment": {
                "os": platform.system(),
                "python_version": get_python_version(),
            },
            "checks": self.checks,
            "summary": {
                "good": sum(1 for c in self.checks if c["status"] == "PASS"),
                "warnings": sum(1 for c in self.checks if c["status"] == "WARN"),
                "failures": sum(1 for c in self.checks if c["status"] == "FAIL"),
            },
        }

        try:
            Path(filename).write_text(json.dumps(report, indent=2))
            print(f"\nJSON report saved to {filename}")
        except Exception as e:
            print(f"Failed to save JSON report: {e}")

    def run_all_checks(self):
        """Execute all checks."""
        print("=" * 70)
        print("PROJECT DOCTOR - Comprehensive Health Check")
        print("=" * 70 + "\n")

        self.check_environment()
        print()

        self.check_git_safety()
        print()

        self.check_required_files()
        print()

        self.check_nodejs_app()
        print()

        self.check_python_app()
        print()

        self.check_docker_stack()
        print()

        self.check_google_apps_script()
        print()

        self.check_symbols()
        print()

        self.check_runtime_ports()
        print()

        self.check_env_validation()
        print()

        self.check_production_footguns()
        print()

        self.check_security()
        print()

        exit_code = self.print_summary()

        if self.json_output:
            self.save_json(self.json_output)

        return exit_code


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Parse args and run health checks."""
    parser = argparse.ArgumentParser(
        description="Project Doctor: Comprehensive project health checks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python project_doctor.py              # Read-only checks
  python project_doctor.py --fix        # Perform safe fixes
  python project_doctor.py --json report.json  # Save JSON report

Exit codes:
  0 = all good
  1 = warnings only
  2 = failures found
        """,
    )

    parser.add_argument(
        "--fix",
        action="store_true",
        help="Perform safe fixes (install deps, start services, etc.)",
    )
    parser.add_argument(
        "--json",
        metavar="FILE",
        help="Save machine-readable JSON report to FILE",
    )

    args = parser.parse_args()

    checker = HealthChecker(fix=args.fix, json_output=args.json)
    exit_code = checker.run_all_checks()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
