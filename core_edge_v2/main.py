# -*- coding: utf-8 -*-
"""
CORE EDGE v2 -- Entry Point
============================
Starts the Streamlit dashboard.

Usage:
    streamlit run main.py          (recommended - direct)
    python main.py                 (auto-launches streamlit)
"""

from __future__ import annotations

import socket
import subprocess
import sys
from pathlib import Path


def _is_port_free(port: int) -> bool:
    """Return True if the given TCP port is available on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # connect_ex returns 0 if something IS listening → port is taken
        result = s.connect_ex(("127.0.0.1", port))
        return result != 0


def _find_free_port(start: int = 8501, end: int = 8520) -> int:
    """Scan [start, end) for the first free port. Raises RuntimeError if none found."""
    for port in range(start, end):
        if _is_port_free(port):
            return port
    raise RuntimeError(
        f"No free port found in range {start}-{end}. "
        "Close other Streamlit instances and try again."
    )


def _ensure_streamlit_config() -> None:
    """
    Write .streamlit/config.toml so theme settings are picked up regardless
    of how the app is launched (python main.py OR streamlit run directly).
    This is more reliable than passing --theme.* CLI flags.
    """
    config_dir = Path(__file__).parent / ".streamlit"
    config_dir.mkdir(exist_ok=True)
    config_file = config_dir / "config.toml"
    if not config_file.exists():
        config_file.write_text(
            '[theme]\n'
            'base = "dark"\n'
            'primaryColor = "#58a6ff"\n'
            'backgroundColor = "#0d1117"\n'
            'secondaryBackgroundColor = "#161b22"\n'
            'textColor = "#c9d1d9"\n',
            encoding="utf-8",
        )


def main() -> None:
    from utils.logger import setup_logging
    setup_logging()

    _ensure_streamlit_config()

    port = _find_free_port()
    dashboard = Path(__file__).parent / "ui" / "dashboard.py"

    cmd = [
        sys.executable, "-m", "streamlit", "run",
        str(dashboard),
        "--server.port", str(port),
        "--server.headless", "false",
    ]

    print(f"Starting CORE EDGE v2 on http://localhost:{port}")

    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(
            f"\nStreamlit exited with code {result.returncode}.\n"
            "You can also launch directly with:\n"
            f"    streamlit run ui/dashboard.py --server.port {port}"
        )
        sys.exit(result.returncode)


if __name__ == "__main__":
    main()
