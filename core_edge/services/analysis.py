"""
Analysis Engine — Structure detection + indicator computation + confluence rules.

Flow:
  1. detect_pivots()     → label each candle as pivot_high / pivot_low
  2. classify_trend()    → Uptrend | Downtrend | Undefined
  3. compute indicators  → EMA50, EMA200, RSI14, volume_ratio, wick_ratio
  4. check confluence    → ALL conditions must pass (strict AND logic)
  5. build Signal        → with _analysis_data payload for ScoringEngine
"""

from __future__ import annotations

import logging
import uuid
from enum import Enum
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

import config
from models.signal import Direction, Signal, SignalStatus

logger = logging.getLogger(__name__)


class Trend(str, Enum):
    UPTREND = "UPTREND"
    DOWNTREND = "DOWNTREND"
    UNDEFINED = "UNDEFINED"


class AnalysisEngine:

    # ── Pivot Detection ───────────────────────────────────────────────────────

    def detect_pivots(self, df: pd.DataFrame, n: int | None = None) -> pd.DataFrame:
        """
        Label pivot highs and lows using N-candle confirmation.
        A pivot high at index i requires df['high'][i] to be the strict maximum
        over [i-N, i+N]. Same logic on lows for pivot lows.
        """
        n = n or config.PIVOT_N
        df = df.copy()
        df["pivot_high"] = False
        df["pivot_low"] = False

        highs = df["high"].values
        lows = df["low"].values

        for i in range(n, len(df) - n):
            window_h = highs[i - n : i + n + 1]
            if highs[i] == window_h.max() and np.sum(window_h == highs[i]) == 1:
                df.iat[i, df.columns.get_loc("pivot_high")] = True

            window_l = lows[i - n : i + n + 1]
            if lows[i] == window_l.min() and np.sum(window_l == lows[i]) == 1:
                df.iat[i, df.columns.get_loc("pivot_low")] = True

        return df

    def classify_trend(self, df: pd.DataFrame) -> Trend:
        """
        Classify market structure from the last two confirmed pivot highs/lows.
        Uptrend  → HH + HL   (both last pivots higher than their predecessors)
        Downtrend → LH + LL  (both last pivots lower than their predecessors)
        Undefined → anything else (mixed structure, or insufficient pivots)
        """
        ph = df.loc[df["pivot_high"], "high"].tolist()
        pl = df.loc[df["pivot_low"], "low"].tolist()

        if len(ph) < 2 or len(pl) < 2:
            return Trend.UNDEFINED

        hh = ph[-1] > ph[-2]   # Higher High
        hl = pl[-1] > pl[-2]   # Higher Low
        lh = ph[-1] < ph[-2]   # Lower High
        ll = pl[-1] < pl[-2]   # Lower Low

        if hh and hl:
            return Trend.UPTREND
        if lh and ll:
            return Trend.DOWNTREND
        return Trend.UNDEFINED

    # ── Indicators ───────────────────────────────────────────────────────────

    @staticmethod
    def _ema(series: pd.Series, period: int) -> pd.Series:
        return series.ewm(span=period, adjust=False).mean()

    @staticmethod
    def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
        avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        return 100 - (100 / (1 + rs))

    @staticmethod
    def _volume_ratio(df: pd.DataFrame) -> float:
        """Last candle volume vs. rolling 20-candle average (excluding last candle)."""
        if len(df) < config.VOLUME_MA_PERIOD + 1:
            return 0.0
        avg = df["volume"].iloc[-(config.VOLUME_MA_PERIOD + 1) : -1].mean()
        return float(df["volume"].iloc[-1] / avg) if avg > 0 else 0.0

    @staticmethod
    def _wick_ratio(candle: pd.Series, direction: Direction) -> float:
        """Ratio of the rejection wick to the total candle range."""
        total = candle["high"] - candle["low"]
        if total == 0:
            return 0.0
        body_top = max(candle["open"], candle["close"])
        body_bot = min(candle["open"], candle["close"])

        if direction == Direction.LONG:
            wick = body_bot - candle["low"]   # lower wick
        else:
            wick = candle["high"] - body_top  # upper wick

        return max(0.0, float(wick / total))

    # ── Core analysis for one (asset, timeframe) ─────────────────────────────

    def analyze(
        self, asset: str, timeframe: str, df: pd.DataFrame
    ) -> Optional[Signal]:
        """
        Full analysis pipeline.  Returns a Signal (without score) or None.
        """
        min_candles = config.EMA_LONG + config.PIVOT_N * 2 + 5
        if len(df) < min_candles:
            logger.debug(f"{asset} {timeframe}: insufficient data ({len(df)} candles, need {min_candles})")
            return None

        df = df.copy()

        # — Step 1: pivots + trend —
        df = self.detect_pivots(df)
        trend = self.classify_trend(df)

        if trend == Trend.UNDEFINED:
            logger.debug(f"{asset} {timeframe}: undefined trend — skip")
            return None

        # — Step 2: indicators —
        df["ema50"] = self._ema(df["close"], config.EMA_SHORT)
        df["ema200"] = self._ema(df["close"], config.EMA_LONG)
        df["rsi"] = self._rsi(df["close"], config.RSI_PERIOD)

        last = df.iloc[-1]
        price = float(last["close"])
        ema50 = float(last["ema50"])
        ema200 = float(last["ema200"])
        rsi = float(last["rsi"])
        vol_ratio = self._volume_ratio(df)

        # — Step 3: direction-specific confluence —
        direction = Direction.LONG if trend == Trend.UPTREND else Direction.SHORT
        wick = self._wick_ratio(last, direction)

        if direction == Direction.LONG:
            conditions = {
                "above_ema50": price > ema50,
                "above_ema200": price > ema200,
                "rsi_zone": config.LONG_RSI_MIN <= rsi <= config.LONG_RSI_MAX,
                "wick_ok": wick >= config.MIN_WICK_RATIO,
                "volume_ok": vol_ratio >= config.VOLUME_RATIO_MIN,
            }
        else:
            conditions = {
                "below_ema50": price < ema50,
                "below_ema200": price < ema200,
                "rsi_zone": config.SHORT_RSI_MIN <= rsi <= config.SHORT_RSI_MAX,
                "wick_ok": wick >= config.MIN_WICK_RATIO,
                "volume_ok": vol_ratio >= config.VOLUME_RATIO_MIN,
            }

        failed = [k for k, v in conditions.items() if not v]
        if failed:
            logger.debug(
                f"{asset} {timeframe} {direction.value}: confluence fail → {failed} "
                f"[rsi={rsi:.1f}, wick={wick:.2f}, vol={vol_ratio:.2f}, "
                f"ema50={ema50:.2f}, ema200={ema200:.2f}, price={price:.2f}]"
            )
            return None

        # — Step 4: compute SL / TP from last pivot —
        pivot_highs = df.loc[df["pivot_high"], "high"].tolist()
        pivot_lows = df.loc[df["pivot_low"], "low"].tolist()

        if direction == Direction.LONG:
            if not pivot_lows:
                logger.debug(f"{asset} {timeframe}: no pivot lows available for SL")
                return None
            sl = round(pivot_lows[-1] * 0.999, 6)   # small buffer below swing low
            if sl >= price:
                logger.debug(f"{asset} {timeframe}: SL above price — invalid setup")
                return None
            r = price - sl
            tp1 = round(price + config.TP1_R_MULTIPLE * r, 6)
            tp2 = round(price + config.TP2_R_MULTIPLE * r, 6)
        else:
            if not pivot_highs:
                logger.debug(f"{asset} {timeframe}: no pivot highs available for SL")
                return None
            sl = round(pivot_highs[-1] * 1.001, 6)  # small buffer above swing high
            if sl <= price:
                logger.debug(f"{asset} {timeframe}: SL below price — invalid setup")
                return None
            r = sl - price
            tp1 = round(price - config.TP1_R_MULTIPLE * r, 6)
            tp2 = round(price - config.TP2_R_MULTIPLE * r, 6)

        signal = Signal(
            asset=asset,
            direction=direction,
            timeframe=timeframe,
            entry=round(price, 6),
            stop_loss=sl,
            tp1=tp1,
            tp2=tp2,
        )
        # Attach raw data for ScoringEngine (internal, not serialised)
        signal._analysis_data = {
            "trend": trend,
            "ema50": ema50,
            "ema200": ema200,
            "rsi": rsi,
            "wick_ratio": wick,
            "volume_ratio": vol_ratio,
            "pivot_highs": pivot_highs,
            "pivot_lows": pivot_lows,
        }

        logger.info(
            f"Signal candidate: {asset} {timeframe} {direction.value} | "
            f"entry={signal.entry} SL={sl} TP1={tp1} TP2={tp2} | "
            f"rsi={rsi:.1f} wick={wick:.2f} vol={vol_ratio:.2f}"
        )
        return signal

    # ── Batch ─────────────────────────────────────────────────────────────────

    def analyze_all(
        self, data: Dict[str, Dict[str, pd.DataFrame]]
    ) -> List[Signal]:
        """Run analysis over all configured (asset, timeframe) pairs."""
        signals: List[Signal] = []
        for asset in config.ASSETS:
            if asset not in data:
                continue
            for tf in config.TIMEFRAMES:
                if tf not in data[asset]:
                    continue
                sig = self.analyze(asset, tf, data[asset][tf])
                if sig is not None:
                    signals.append(sig)
        return signals
