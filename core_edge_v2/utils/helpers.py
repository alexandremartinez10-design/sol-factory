# -*- coding: utf-8 -*-
"""
Shared helper utilities used across services.
"""

from __future__ import annotations

import math
import time
from datetime import datetime, timezone
from typing import Any


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ts_ms() -> int:
    """Current UTC time in milliseconds."""
    return int(time.time() * 1_000)


def ms_to_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1_000, tz=timezone.utc)


def timeframe_to_ms(tf: str) -> int:
    """
    Convert a timeframe string to milliseconds.
    Accepts both uppercase config-style ("1H", "4H") and
    lowercase API-style ("1h", "4h") — normalises to lowercase internally.
    Raises ValueError for unknown timeframes so bugs surface immediately.
    """
    mapping = {
        "1m":  60_000,
        "3m":  3 * 60_000,
        "5m":  5 * 60_000,
        "15m": 15 * 60_000,
        "30m": 30 * 60_000,
        "1h":  3_600_000,
        "2h":  2 * 3_600_000,
        "4h":  4 * 3_600_000,
        "8h":  8 * 3_600_000,
        "12h": 12 * 3_600_000,
        "1d":  86_400_000,
        "3d":  3 * 86_400_000,
        "1w":  7 * 86_400_000,
    }
    key = tf.lower()
    if key not in mapping:
        raise ValueError(
            f"Unknown timeframe '{tf}'. "
            f"Valid values: {sorted(mapping.keys())}"
        )
    return mapping[key]


def timeframe_to_hl(tf: str) -> str:
    """
    Convert any timeframe string to the lowercase interval string the
    Hyperliquid API accepts.  Hyperliquid rejects uppercase — it returns
    HTTP 422 for '1H', '4H', '1D'.
    Raises ValueError for unknown timeframes.
    """
    mapping = {
        "1m":  "1m",
        "3m":  "3m",
        "5m":  "5m",
        "15m": "15m",
        "30m": "30m",
        "1h":  "1h",
        "2h":  "2h",
        "4h":  "4h",
        "8h":  "8h",
        "12h": "12h",
        "1d":  "1d",
        "3d":  "3d",
        "1w":  "1w",
    }
    key = tf.lower()
    if key not in mapping:
        raise ValueError(
            f"Unknown timeframe '{tf}'. "
            f"Valid Hyperliquid intervals: {sorted(mapping.keys())}"
        )
    return mapping[key]


def round_to_tick(price: float, tick: float) -> float:
    """Round price to the nearest tick size."""
    if tick <= 0:
        return price
    return round(round(price / tick) * tick, _decimal_places(tick))


def _decimal_places(tick: float) -> int:
    s = f"{tick:.10f}".rstrip("0")
    if "." in s:
        return len(s.split(".")[1])
    return 0


def pct_change(a: float, b: float) -> float:
    """Percentage change from a to b."""
    if a == 0:
        return 0.0
    return (b - a) / a


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def safe_div(num: float, denom: float, default: float = 0.0) -> float:
    return num / denom if denom != 0 else default


def format_pct(value: float, decimals: int = 2) -> str:
    return f"{value * 100:.{decimals}f}%"


def flatten_dict(d: dict[str, Any], sep: str = ".") -> dict[str, Any]:
    """Flatten nested dict for display/export."""
    result = {}
    def _flatten(obj: Any, prefix: str = "") -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                _flatten(v, f"{prefix}{k}{sep}" if prefix else f"{k}{sep}")
        else:
            result[prefix.rstrip(sep)] = obj
    _flatten(d)
    return result
