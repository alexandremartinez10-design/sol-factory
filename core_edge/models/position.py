"""
Position model — represents a live or closed trade.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

from models.signal import Direction


class PositionStatus(str, Enum):
    OPEN = "OPEN"
    TP1_HIT = "TP1_HIT"
    TP2_HIT = "TP2_HIT"
    SL_HIT = "SL_HIT"
    CLOSED = "CLOSED"  # Manually closed or liquidated


@dataclass
class Position:
    asset: str
    direction: Direction
    entry_price: float
    initial_sl: float
    current_sl: float
    tp1: float
    tp2: float
    size: float          # Quantity in base currency (e.g. BTC)
    leverage: int
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: PositionStatus = PositionStatus.OPEN
    breakeven: bool = False
    opened_at: datetime = field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None
    pnl: float = 0.0

    # ── Derived ──────────────────────────────────────────────────────────────
    @property
    def r_value(self) -> float:
        return abs(self.entry_price - self.initial_sl)

    @property
    def is_active(self) -> bool:
        return self.status in (PositionStatus.OPEN, PositionStatus.TP1_HIT)

    # ── Serialisation ────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "asset": self.asset,
            "direction": self.direction.value,
            "entry_price": self.entry_price,
            "initial_sl": self.initial_sl,
            "current_sl": self.current_sl,
            "tp1": self.tp1,
            "tp2": self.tp2,
            "size": self.size,
            "leverage": self.leverage,
            "status": self.status.value,
            "breakeven": self.breakeven,
            "opened_at": self.opened_at.isoformat(),
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "pnl": self.pnl,
        }
