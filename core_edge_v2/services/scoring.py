# -*- coding: utf-8 -*-
"""
Scoring Engine v2
=================
Computes a Confidence Score (0–100) for each Signal candidate.

- Weights are loaded from optimized_weights.json (if available) at startup,
  falling back to equal-weight defaults (20/20/20/20/20).
- The optimizer writes new weights after each walk-forward fold;
  the scoring engine hot-reloads them between scans without restart.
- Only signals with score ≥ MIN_CONFIDENCE_SCORE (70) pass through.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from models.signal import Direction, Signal
from services.analysis import Trend
from utils import config
from utils.helpers import safe_div

logger = logging.getLogger(__name__)


class ScoringEngine:

    def __init__(self) -> None:
        self._weights = config.load_optimized_weights()
        logger.info(f"ScoringEngine weights: {self._weights}")

    def reload_weights(self) -> None:
        """Hot-reload weights from disk (called after optimizer finishes)."""
        self._weights = config.load_optimized_weights()
        logger.info(f"Weights reloaded: {self._weights}")

    # ── Sub-scores (each returns 0–100) ───────────────────────────────────────

    def _score_structure(self, data: dict) -> float:
        """
        Score based on pivot count and swing quality.
        More pivots + consistent swing size → higher score.
        """
        ph: list = data.get("pivot_highs", [])
        pl: list = data.get("pivot_lows",  [])
        n = min(len(ph), len(pl))

        if n >= 5:
            base = 95.0
        elif n == 4:
            base = 85.0
        elif n == 3:
            base = 70.0
        elif n == 2:
            base = 50.0
        else:
            return 20.0

        trend: Trend = data.get("trend", Trend.UNDEFINED)
        bonus = 0.0

        def swing_mag(arr: list, i: int = -1) -> float:
            if len(arr) < 2:
                return 0.0
            ref = arr[i - 1] if i == -1 else arr[i - 1]
            return abs(arr[i] - ref) / ref if ref > 0 else 0.0

        if trend == Trend.UPTREND:
            if swing_mag(ph) >= 0.01: bonus += 2.5
            if swing_mag(pl) >= 0.01: bonus += 2.5
        elif trend == Trend.DOWNTREND:
            if swing_mag(ph) >= 0.01: bonus += 2.5
            if swing_mag(pl) >= 0.01: bonus += 2.5

        return min(100.0, base + bonus)

    def _score_ema(self, data: dict, direction: Direction) -> float:
        """
        EMA 50/200 spread as percentage → score.
        Bullish spread (ema50 > ema200) scores max for LONG; bearish for SHORT.
        """
        ema50  = data.get("ema50",  0.0)
        ema200 = data.get("ema200", 0.0)
        if ema50 == 0 or ema200 == 0:
            return 0.0

        if direction == Direction.LONG:
            if ema50 <= ema200:
                return 15.0
            spread = (ema50 - ema200) / ema200
        else:
            if ema50 >= ema200:
                return 15.0
            spread = (ema200 - ema50) / ema200

        # Sigmoid-like mapping: 0% → 55, 1% → 70, 2% → 85, ≥3% → 100
        if spread >= 0.03:   return 100.0
        elif spread >= 0.02: return 85.0
        elif spread >= 0.01: return 70.0
        else:                return 55.0

    def _score_rsi(self, rsi: float, direction: Direction) -> float:
        """
        Directional RSI scoring:
        LONG:  Best zone 45–55; 50→100, 45/55→80, toward extremes decreases
        SHORT: Mirror logic
        """
        if direction == Direction.LONG:
            center = 50.0
            optimal_lo, optimal_hi = 45.0, 58.0
        else:
            center = 50.0
            optimal_lo, optimal_hi = 42.0, 55.0

        if optimal_lo <= rsi <= optimal_hi:
            half = (optimal_hi - optimal_lo) / 2.0
            prox = 1.0 - abs(rsi - (optimal_lo + half)) / half
            return 80.0 + 20.0 * prox

        dist = min(abs(rsi - optimal_lo), abs(rsi - optimal_hi))
        return max(0.0, 80.0 - dist * 5.0)

    def _score_wick(self, wick_ratio: float) -> float:
        """Rejection wick strength → score."""
        if wick_ratio >= 0.70: return 100.0
        if wick_ratio >= 0.55: return 85.0
        if wick_ratio >= 0.40: return 65.0 + (wick_ratio - 0.40) / 0.15 * 20.0
        if wick_ratio >= 0.30: return 40.0
        return 0.0

    def _score_volume(self, vol_ratio: float) -> float:
        """Volume surge relative to 20-period average → score."""
        if vol_ratio >= 2.5: return 100.0
        if vol_ratio >= 2.0: return 90.0
        if vol_ratio >= 1.5: return 80.0
        if vol_ratio >= 1.2: return 60.0 + (vol_ratio - 1.2) / 0.3 * 20.0
        return 0.0

    def _score_adx(self, adx_v: float) -> float:
        """Bonus/penalty for ADX strength (already filtered, so always >25)."""
        if adx_v >= 50: return 100.0
        if adx_v >= 35: return 85.0
        if adx_v >= 25: return 65.0
        return 0.0

    # ── Public API ────────────────────────────────────────────────────────────

    def calculate(self, signal: Signal) -> int:
        """Compute confidence score (0–100) for a single signal."""
        data = getattr(signal, "_analysis_data", {})
        if not data:
            logger.warning(f"No analysis data on {signal.id} — score=0")
            return 0

        w = self._weights

        s_struct = self._score_structure(data)
        s_ema    = self._score_ema(data, signal.direction)
        s_rsi    = self._score_rsi(data.get("rsi", 50.0), signal.direction)
        s_wick   = self._score_wick(data.get("wick_ratio", 0.0))
        s_vol    = self._score_volume(data.get("volume_ratio", 0.0))

        total = (
            s_struct * w.get("structure", 0.20)
            + s_ema  * w.get("ema",       0.20)
            + s_rsi  * w.get("rsi",       0.20)
            + s_wick * w.get("wick",      0.20)
            + s_vol  * w.get("volume",    0.20)
        )
        score = int(round(total))

        # Bonus for ADX strength (up to +5 pts, does not affect weights)
        adx_v = data.get("adx", 0.0)
        adx_bonus = min(5, int((adx_v - 25) / 5)) if adx_v > 25 else 0
        score = min(100, score + adx_bonus)

        logger.debug(
            f"  Score {signal.asset} {signal.timeframe} {signal.direction.value}: "
            f"struct={s_struct:.0f} ema={s_ema:.0f} rsi={s_rsi:.0f} "
            f"wick={s_wick:.0f} vol={s_vol:.0f} adx_bonus={adx_bonus} → {score}/100"
        )
        return score

    def score_signals(
        self,
        signals: List[Signal],
        min_score: Optional[int] = None,
    ) -> List[Signal]:
        """
        Score all signals, filter by threshold, sort by score descending.

        Args:
            signals:   raw Signal candidates (unscored)
            min_score: override config.MIN_CONFIDENCE_SCORE.
                       Pass a lower value (e.g. 55) for the multi-asset live
                       scanner so more candidates surface across altcoins.
        """
        threshold = config.MIN_CONFIDENCE_SCORE if min_score is None else min_score
        scored: List[Signal] = []
        for sig in signals:
            sig.score = self.calculate(sig)
            if sig.score >= threshold:
                scored.append(sig)
                logger.info(
                    f"ACCEPTED {sig.asset} {sig.timeframe} {sig.direction.value} "
                    f"[{sig.score}/100]"
                )
            else:
                logger.debug(
                    f"REJECTED {sig.asset} {sig.timeframe} {sig.direction.value} "
                    f"[{sig.score}/100] (min={threshold})"
                )

        scored.sort(key=lambda s: s.score, reverse=True)
        return scored
