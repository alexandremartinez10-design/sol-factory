# -*- coding: utf-8 -*-
"""
Risk Manager v2
===============
Enforces all money management rules in one place:

- Max 1% risk per trade (ATR-based dynamic sizing)
- Max x5 leverage
- Daily loss limit (-3% of starting capital) → sets PAUSED state
- Weekly loss limit (-8% of starting capital) → sets PAUSED state
- Tracks session PnL (daily + weekly)
- Provides position sizing with partial-close support (50% at TP1, 50% at TP2)
- Provides SL placement recommendation (1 ATR buffer beyond pivot)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from models.signal import Direction, Signal
from utils import config

logger = logging.getLogger(__name__)


class RiskManager:

    def __init__(self, initial_capital: float = 10_000.0) -> None:
        self.initial_capital = initial_capital
        self.session_capital = initial_capital

        # PnL tracking
        self._day_start_capital = initial_capital
        self._week_start_capital = initial_capital
        self._day_pnl:  float = 0.0
        self._week_pnl: float = 0.0
        self._trade_count: int = 0
        self._paused: bool = False
        self._pause_reason: str = ""

        # Reset tracking
        self._last_day: int = datetime.now(timezone.utc).timetuple().tm_yday
        self._last_week: int = datetime.now(timezone.utc).isocalendar().week

    # ── State ─────────────────────────────────────────────────────────────────

    @property
    def is_paused(self) -> bool:
        return self._paused

    @property
    def pause_reason(self) -> str:
        return self._pause_reason

    def resume(self) -> None:
        """Manually resume after auto-pause."""
        self._paused = False
        self._pause_reason = ""
        logger.info("Risk manager: trading resumed manually")

    # ── Daily / Weekly reset ──────────────────────────────────────────────────

    def _check_period_reset(self) -> None:
        now = datetime.now(timezone.utc)
        day  = now.timetuple().tm_yday
        week = now.isocalendar().week

        if day != self._last_day:
            logger.info(f"Daily reset: day PnL was {self._day_pnl:+.2f}")
            self._day_start_capital = self.session_capital
            self._day_pnl = 0.0
            self._last_day = day

        if week != self._last_week:
            logger.info(f"Weekly reset: week PnL was {self._week_pnl:+.2f}")
            self._week_start_capital = self.session_capital
            self._week_pnl = 0.0
            self._last_week = week

    # ── Record trade outcome ──────────────────────────────────────────────────

    def record_trade(self, pnl: float) -> None:
        """
        Call this when a trade closes.
        Updates capital and checks loss limits.
        """
        self._check_period_reset()
        self.session_capital += pnl
        self._day_pnl  += pnl
        self._week_pnl += pnl
        self._trade_count += 1

        logger.info(
            f"Trade closed: PnL={pnl:+.2f} | Session={self.session_capital:.2f} "
            f"| Day={self._day_pnl:+.2f} | Week={self._week_pnl:+.2f}"
        )

        # Check limits
        day_loss_pct  = -self._day_pnl  / self._day_start_capital  if self._day_pnl  < 0 else 0.0
        week_loss_pct = -self._week_pnl / self._week_start_capital if self._week_pnl < 0 else 0.0

        if day_loss_pct >= config.DAILY_LOSS_LIMIT:
            self._paused = True
            self._pause_reason = (
                f"Daily loss limit reached: {day_loss_pct:.1%} "
                f"(limit {config.DAILY_LOSS_LIMIT:.1%})"
            )
            logger.warning(f"BOT PAUSED — {self._pause_reason}")

        elif week_loss_pct >= config.WEEKLY_LOSS_LIMIT:
            self._paused = True
            self._pause_reason = (
                f"Weekly loss limit reached: {week_loss_pct:.1%} "
                f"(limit {config.WEEKLY_LOSS_LIMIT:.1%})"
            )
            logger.warning(f"BOT PAUSED — {self._pause_reason}")

    # ── Position Sizing ───────────────────────────────────────────────────────

    def calculate_position_size(
        self,
        capital: float,
        entry_price: float,
        stop_loss: float,
        atr: Optional[float] = None,
    ) -> tuple[float, int]:
        """
        Risk exactly RISK_PER_TRADE of capital per trade.
        When ATR is provided, SL distance is validated against ATR (must be ≥ 0.5 ATR).

        Returns:
            (size_in_base_currency, leverage_used)
        """
        if entry_price == stop_loss:
            raise ValueError("Entry == stop-loss, invalid setup")

        price_diff = abs(entry_price - stop_loss)

        # Sanity check: SL must be at least 0.5× ATR away to avoid noise stops
        if atr and atr > 0 and price_diff < 0.5 * atr:
            logger.warning(
                f"SL distance ({price_diff:.4f}) < 0.5 ATR ({0.5 * atr:.4f}) — "
                f"widening to 0.5 ATR"
            )
            price_diff = 0.5 * atr

        risk_amount = capital * config.RISK_PER_TRADE
        raw_size    = risk_amount / price_diff
        notional    = raw_size * entry_price

        # Minimum leverage needed to open this position
        leverage = 1
        if notional > capital:
            leverage = min(config.MAX_LEVERAGE, int(notional / capital) + 1)

        logger.debug(
            f"Sizing: capital={capital:.2f} risk_amt={risk_amount:.2f} "
            f"Δ={price_diff:.4f} size={raw_size:.4f} notional={notional:.2f} x{leverage}"
        )
        return round(raw_size, 4), leverage

    def can_trade(self) -> bool:
        """Return True if risk limits allow a new trade."""
        self._check_period_reset()
        if self._paused:
            logger.info(f"Trade blocked — bot paused: {self._pause_reason}")
            return False
        return True

    # ── TP / SL recommendations ───────────────────────────────────────────────

    @staticmethod
    def compute_sl_tp(
        direction: Direction,
        entry: float,
        pivot_sl: float,
        atr: float,
        atr_buffer: float = 0.5,
    ) -> tuple[float, float, float]:
        """
        Compute SL (pivot + ATR buffer), TP1 (1.5R), TP2 (3R).
        Returns: (stop_loss, tp1, tp2)
        """
        if direction == Direction.LONG:
            sl = pivot_sl - atr_buffer * atr
            sl = min(sl, pivot_sl * 0.999)
            r  = entry - sl
            if r <= 0:
                sl = entry - atr
                r  = atr
            tp1 = entry + config.TP1_R_MULTIPLE * r
            tp2 = entry + config.TP2_R_MULTIPLE * r
        else:
            sl = pivot_sl + atr_buffer * atr
            sl = max(sl, pivot_sl * 1.001)
            r  = sl - entry
            if r <= 0:
                sl = entry + atr
                r  = atr
            tp1 = entry - config.TP1_R_MULTIPLE * r
            tp2 = entry - config.TP2_R_MULTIPLE * r

        return round(sl, 6), round(tp1, 6), round(tp2, 6)

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        self._check_period_reset()
        day_pct  = self._day_pnl  / self._day_start_capital  if self._day_start_capital  else 0.0
        week_pct = self._week_pnl / self._week_start_capital if self._week_start_capital else 0.0
        return {
            "session_capital":   round(self.session_capital, 2),
            "initial_capital":   round(self.initial_capital, 2),
            "total_pnl":         round(self.session_capital - self.initial_capital, 2),
            "day_pnl":           round(self._day_pnl, 2),
            "week_pnl":          round(self._week_pnl, 2),
            "day_pnl_pct":       round(day_pct * 100, 2),
            "week_pnl_pct":      round(week_pct * 100, 2),
            "daily_limit_pct":   round(config.DAILY_LOSS_LIMIT * 100, 1),
            "weekly_limit_pct":  round(config.WEEKLY_LOSS_LIMIT * 100, 1),
            "trade_count":       self._trade_count,
            "is_paused":         self._paused,
            "pause_reason":      self._pause_reason,
        }
