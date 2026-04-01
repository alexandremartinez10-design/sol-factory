# -*- coding: utf-8 -*-
"""
Position model — represents a live or closed trade.
Enhanced v2: tracks partial closes, breakeven, daily/weekly PnL.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from models.signal import Direction


class PositionStatus(str, Enum):
    OPEN     = "OPEN"
    TP1_HIT  = "TP1_HIT"
    TP2_HIT  = "TP2_HIT"
    SL_HIT   = "SL_HIT"
    CLOSED   = "CLOSED"   # Manual close or liquidation


@dataclass
class Position:
    asset:       str
    direction:   Direction
    entry_price: float
    initial_sl:  float
    current_sl:  float
    tp1:         float
    tp2:         float
    size:        float   # Initial size in base currency
    leverage:    int

    id:          str            = field(default_factory=lambda: str(uuid.uuid4()))
    status:      PositionStatus = PositionStatus.OPEN
    breakeven:   bool           = False
    opened_at:   datetime       = field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at:   Optional[datetime] = None

    # Size tracking for partial closes
    remaining_size: float = 0.0
    tp1_closed_size: float = 0.0

    # PnL (realised and unrealised)
    realised_pnl:   float = 0.0
    unrealised_pnl: float = 0.0

    # Fees paid
    total_fees: float = 0.0

    def __post_init__(self) -> None:
        if self.remaining_size == 0.0:
            self.remaining_size = self.size

    # ── Derived ──────────────────────────────────────────────────────────────
    @property
    def r_value(self) -> float:
        return abs(self.entry_price - self.initial_sl)

    @property
    def is_active(self) -> bool:
        return self.status in (PositionStatus.OPEN, PositionStatus.TP1_HIT)

    @property
    def net_pnl(self) -> float:
        return self.realised_pnl + self.unrealised_pnl - self.total_fees

    def update_unrealised(self, mark_price: float) -> None:
        """Recalculate unrealised PnL based on current mark price."""
        if not self.is_active:
            return
        if self.direction == Direction.LONG:
            self.unrealised_pnl = (mark_price - self.entry_price) * self.remaining_size
        else:
            self.unrealised_pnl = (self.entry_price - mark_price) * self.remaining_size

    # ── Serialisation ────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "id":              self.id,
            "asset":           self.asset,
            "direction":       self.direction.value,
            "entry_price":     self.entry_price,
            "initial_sl":      self.initial_sl,
            "current_sl":      self.current_sl,
            "tp1":             self.tp1,
            "tp2":             self.tp2,
            "size":            self.size,
            "remaining_size":  self.remaining_size,
            "leverage":        self.leverage,
            "status":          self.status.value,
            "breakeven":       self.breakeven,
            "opened_at":       self.opened_at.isoformat(),
            "closed_at":       self.closed_at.isoformat() if self.closed_at else None,
            "realised_pnl":    round(self.realised_pnl, 4),
            "unrealised_pnl":  round(self.unrealised_pnl, 4),
            "total_fees":      round(self.total_fees, 4),
            "net_pnl":         round(self.net_pnl, 4),
        }
