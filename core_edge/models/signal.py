"""
Signal model — represents a detected trading opportunity before execution.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class Direction(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class SignalStatus(str, Enum):
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    IGNORED = "IGNORED"


@dataclass
class Signal:
    asset: str
    direction: Direction
    timeframe: str
    entry: float
    stop_loss: float
    tp1: float
    tp2: float
    score: int = 0
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    status: SignalStatus = SignalStatus.PENDING

    # Internal — populated by AnalysisEngine, consumed by ScoringEngine.
    # Not part of the public interface; prefixed with underscore to signal intent.
    _analysis_data: dict[str, Any] = field(default_factory=dict, repr=False, compare=False)

    # ── Derived ──────────────────────────────────────────────────────────────
    @property
    def r_value(self) -> float:
        """Risk in price units (|entry − stop_loss|)."""
        return abs(self.entry - self.stop_loss)

    # ── Serialisation ────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "asset": self.asset,
            "direction": self.direction.value,
            "timeframe": self.timeframe,
            "entry": self.entry,
            "stop_loss": self.stop_loss,
            "tp1": self.tp1,
            "tp2": self.tp2,
            "score": self.score,
            "timestamp": self.timestamp.isoformat(),
            "status": self.status.value,
        }
