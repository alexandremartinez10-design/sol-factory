# -*- coding: utf-8 -*-
"""
Signal model — represents a detected trading opportunity (pre-execution).
Enhanced v2: stores filter metadata and multi-timeframe confirmation flag.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class Direction(str, Enum):
    LONG  = "LONG"
    SHORT = "SHORT"


class SignalStatus(str, Enum):
    PENDING  = "PENDING"
    EXECUTED = "EXECUTED"
    IGNORED  = "IGNORED"
    EXPIRED  = "EXPIRED"


@dataclass
class Signal:
    asset:      str
    direction:  Direction
    timeframe:  str
    entry:      float
    stop_loss:  float
    tp1:        float
    tp2:        float

    score:              int           = 0
    id:                 str           = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp:          datetime      = field(default_factory=lambda: datetime.now(timezone.utc))
    status:             SignalStatus  = SignalStatus.PENDING

    # Multi-timeframe confirmation
    confirmed_timeframes: list[str]   = field(default_factory=list)
    multi_tf_confirmed:   bool        = False

    # Filter outcomes (for dashboard transparency)
    funding_rate:     Optional[float] = None
    atr_percentile:   Optional[float] = None
    adx_value:        Optional[float] = None
    oi_spike_flag:    bool            = False

    # Internal — populated by AnalysisEngine, consumed by ScoringEngine
    _analysis_data: dict[str, Any] = field(default_factory=dict, repr=False, compare=False)

    # ── Derived ──────────────────────────────────────────────────────────────
    @property
    def r_value(self) -> float:
        """Risk in price units (|entry − stop_loss|)."""
        return abs(self.entry - self.stop_loss)

    @property
    def rr_ratio(self) -> float:
        """Risk/reward to TP2."""
        if self.r_value == 0:
            return 0.0
        return abs(self.tp2 - self.entry) / self.r_value

    # ── Serialisation ────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "id":                   self.id,
            "asset":                self.asset,
            "direction":            self.direction.value,
            "timeframe":            self.timeframe,
            "entry":                self.entry,
            "stop_loss":            self.stop_loss,
            "tp1":                  self.tp1,
            "tp2":                  self.tp2,
            "score":                self.score,
            "r_value":              round(self.r_value, 6),
            "rr_ratio":             round(self.rr_ratio, 2),
            "timestamp":            self.timestamp.isoformat(),
            "status":               self.status.value,
            "confirmed_timeframes": self.confirmed_timeframes,
            "multi_tf_confirmed":   self.multi_tf_confirmed,
            "funding_rate":         self.funding_rate,
            "atr_percentile":       self.atr_percentile,
            "adx_value":            self.adx_value,
            "oi_spike_flag":        self.oi_spike_flag,
        }
