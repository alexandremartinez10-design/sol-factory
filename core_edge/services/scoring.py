"""
Scoring Engine — Computes a Confidence Score (0-100) for each Signal.

Weights (must sum to 1.0):
  Structure clarity (pivots)  25 %
  EMA 50/200 alignment        25 %
  RSI in optimal zone         20 %
  Wick rejection strength     15 %
  Volume / average ratio      15 %

Only signals with score ≥ config.MIN_CONFIDENCE_SCORE are returned.
"""

from __future__ import annotations

import logging
from typing import List

import config
from models.signal import Direction, Signal
from services.analysis import Trend

logger = logging.getLogger(__name__)


class ScoringEngine:

    _WEIGHTS = {
        "structure":    0.25,
        "ema":          0.25,
        "rsi":          0.20,
        "wick":         0.15,
        "volume":       0.15,
    }

    # ── Sub-scores (each returns 0–100) ───────────────────────────────────────

    def _score_structure(self, data: dict) -> float:
        """
        Score based on number and quality of confirmed pivots.
        More pivots + consistent swing magnitudes → higher score.
        """
        ph: list = data.get("pivot_highs", [])
        pl: list = data.get("pivot_lows", [])
        n = min(len(ph), len(pl))

        # Base score from pivot count
        if n >= 4:
            base = 90.0
        elif n == 3:
            base = 70.0
        elif n == 2:
            base = 50.0
        else:
            return 20.0

        trend: Trend = data.get("trend", Trend.UNDEFINED)

        # Bonus for strong swing magnitude (≥ 1 % move between pivots)
        bonus = 0.0
        if trend == Trend.UPTREND and len(ph) >= 2 and len(pl) >= 2:
            if ph[-2] > 0 and (ph[-1] - ph[-2]) / ph[-2] >= 0.01:
                bonus += 5.0
            if pl[-2] > 0 and (pl[-1] - pl[-2]) / pl[-2] >= 0.01:
                bonus += 5.0
        elif trend == Trend.DOWNTREND and len(ph) >= 2 and len(pl) >= 2:
            if ph[-2] > 0 and (ph[-2] - ph[-1]) / ph[-2] >= 0.01:
                bonus += 5.0
            if pl[-2] > 0 and (pl[-2] - pl[-1]) / pl[-2] >= 0.01:
                bonus += 5.0

        return min(100.0, base + bonus)

    def _score_ema(self, data: dict, direction: Direction) -> float:
        """
        Score based on EMA50 / EMA200 alignment strength.
        A wide bullish spread (ema50 >> ema200) scores max for LONG, and vice versa.
        """
        ema50: float = data.get("ema50", 0.0)
        ema200: float = data.get("ema200", 0.0)
        if ema50 == 0 or ema200 == 0:
            return 0.0

        if direction == Direction.LONG:
            if ema50 <= ema200:
                return 20.0   # Price above both but EMAs not yet aligned
            spread = (ema50 - ema200) / ema200
        else:
            if ema50 >= ema200:
                return 20.0
            spread = (ema200 - ema50) / ema200

        # 0 %  spread → 60 pts   |   ≥ 3 % spread → 100 pts
        if spread >= 0.03:
            return 100.0
        elif spread >= 0.02:
            return 85.0
        elif spread >= 0.01:
            return 72.0
        else:
            return 60.0

    def _score_rsi(self, rsi: float) -> float:
        """
        Score how close RSI is to the optimal zone (45–55).
        45–55 → 80–100 pts (peaks at 50)
        Outside optimal zone → score decreases linearly
        """
        center = (config.RSI_OPTIMAL_MIN + config.RSI_OPTIMAL_MAX) / 2.0  # 50

        if config.RSI_OPTIMAL_MIN <= rsi <= config.RSI_OPTIMAL_MAX:
            half_width = (config.RSI_OPTIMAL_MAX - config.RSI_OPTIMAL_MIN) / 2.0
            proximity = 1.0 - abs(rsi - center) / half_width
            return 80.0 + 20.0 * proximity   # 80–100

        # Outside optimal zone: penalise by 4 pts per unit away from zone
        if rsi < config.RSI_OPTIMAL_MIN:
            dist = config.RSI_OPTIMAL_MIN - rsi
        else:
            dist = rsi - config.RSI_OPTIMAL_MAX
        return max(0.0, 80.0 - dist * 4.0)

    def _score_wick(self, wick_ratio: float) -> float:
        """
        Score the rejection wick strength.
        ≥ 70 % → 100   |   ≥ 55 % → 85   |   ≥ 40 % → 65   |   < 40 % → 0
        (Below 40 % never reaches here due to analysis filter, but guard anyway.)
        """
        if wick_ratio >= 0.70:
            return 100.0
        elif wick_ratio >= 0.55:
            return 85.0
        elif wick_ratio >= 0.40:
            # Linear scale between 40 % and 55 %
            return 65.0 + (wick_ratio - 0.40) / 0.15 * 20.0
        return 0.0

    def _score_volume(self, vol_ratio: float) -> float:
        """
        Score volume surge relative to 20-period average.
        ≥ 2.0× → 100   |   ≥ 1.5× → 85   |   ≥ 1.2× → 65   |   < 1.2× → 0
        """
        if vol_ratio >= 2.0:
            return 100.0
        elif vol_ratio >= 1.5:
            return 85.0
        elif vol_ratio >= 1.2:
            return 65.0 + (vol_ratio - 1.2) / 0.3 * 20.0
        return 0.0

    # ── Public API ────────────────────────────────────────────────────────────

    def calculate(self, signal: Signal) -> int:
        """Compute the confidence score (0–100) for a single signal."""
        data = getattr(signal, "_analysis_data", {})
        if not data:
            logger.warning(f"No analysis data on signal {signal.id} — score=0")
            return 0

        s_struct = self._score_structure(data)
        s_ema    = self._score_ema(data, signal.direction)
        s_rsi    = self._score_rsi(data.get("rsi", 50.0))
        s_wick   = self._score_wick(data.get("wick_ratio", 0.0))
        s_vol    = self._score_volume(data.get("volume_ratio", 0.0))

        w = self._WEIGHTS
        total = (
            s_struct * w["structure"]
            + s_ema  * w["ema"]
            + s_rsi  * w["rsi"]
            + s_wick * w["wick"]
            + s_vol  * w["volume"]
        )
        score = int(round(total))

        logger.debug(
            f"  Score {signal.asset} {signal.timeframe} {signal.direction.value}: "
            f"struct={s_struct:.0f} ema={s_ema:.0f} rsi={s_rsi:.0f} "
            f"wick={s_wick:.0f} vol={s_vol:.0f} → {score}/100"
        )
        return score

    def score_signals(self, signals: List[Signal]) -> List[Signal]:
        """
        Score every signal, attach the score, filter by MIN_CONFIDENCE_SCORE,
        and return sorted by score descending.
        """
        scored: List[Signal] = []
        for sig in signals:
            sig.score = self.calculate(sig)
            if sig.score >= config.MIN_CONFIDENCE_SCORE:
                scored.append(sig)
                logger.info(
                    f"✅ Signal accepted  — {sig.asset} {sig.timeframe} "
                    f"{sig.direction.value} [{sig.score}/100]"
                )
            else:
                logger.debug(
                    f"❌ Signal rejected  — {sig.asset} {sig.timeframe} "
                    f"{sig.direction.value} [{sig.score}/100] (min={config.MIN_CONFIDENCE_SCORE})"
                )

        scored.sort(key=lambda s: s.score, reverse=True)
        return scored
