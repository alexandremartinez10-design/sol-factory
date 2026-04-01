# -*- coding: utf-8 -*-
"""
Logging setup — coloured console + rotating file handler.
Call setup_logging() once at application startup.
"""

from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

try:
    import colorlog
    _HAS_COLORLOG = True
except ImportError:
    _HAS_COLORLOG = False


def setup_logging(
    log_level: str | None = None,
    log_file: str | None = None,
) -> None:
    """
    Configure root logger.
    - Console handler: coloured if colorlog is installed, plain otherwise.
    - File handler: rotating, max 10 MB × 3 backups.
    """
    level_str = (log_level or os.getenv("LOG_LEVEL", "INFO")).upper()
    level = getattr(logging, level_str, logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    # Avoid duplicate handlers on re-initialisation
    if root.handlers:
        root.handlers.clear()

    fmt = "%(asctime)s [%(levelname)-8s] %(name)s — %(message)s"
    date_fmt = "%Y-%m-%d %H:%M:%S"

    # ── Console handler ───────────────────────────────────────────────────────
    if _HAS_COLORLOG:
        colour_fmt = (
            "%(log_color)s%(asctime)s [%(levelname)-8s]%(reset)s "
            "%(blue)s%(name)s%(reset)s — %(message)s"
        )
        console_handler = colorlog.StreamHandler(sys.stdout)
        console_handler.setFormatter(
            colorlog.ColoredFormatter(
                colour_fmt,
                datefmt=date_fmt,
                log_colors={
                    "DEBUG":    "cyan",
                    "INFO":     "green",
                    "WARNING":  "yellow",
                    "ERROR":    "red",
                    "CRITICAL": "bold_red",
                },
            )
        )
    else:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(logging.Formatter(fmt, datefmt=date_fmt))

    console_handler.setLevel(level)
    root.addHandler(console_handler)

    # ── File handler ──────────────────────────────────────────────────────────
    log_path = log_file or os.getenv("LOG_FILE", "core_edge_v2.log")
    file_handler = RotatingFileHandler(
        log_path, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(logging.Formatter(fmt, datefmt=date_fmt))
    file_handler.setLevel(level)
    root.addHandler(file_handler)

    # Silence noisy libraries
    for noisy in ("urllib3", "requests", "asyncio", "websockets"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
