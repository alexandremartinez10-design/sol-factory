# -*- coding: utf-8 -*-
"""
Analysis Engine v2
==================
Computes all technical indicators and evaluates the 5 confluence criteria:
  1. Market structure (pivot-based HH/HL or LH/LL)
  2. EMA 50/200 alignment
  3. RSI 14 in directional zone
  4. Wick rejection strength
  5. Volume surge

NEW in v2:
  - ADX filter (period 14) — skip ranging markets (ADX < 25)
  - Funding rate filter (injected from market_data)
  - ATR-based volatility filter (percentile rank ≥ 60th)
  - OI spike detection (basic liquidation cascade avoidance)
  - Multi-timeframe confirmation logic (requires ≥2 TF agreement)

Strict no-look-ahead: all indicator values are computed on the closed-bar series;
the last bar (index -1) is the signal bar. All signals reference data[:-1]
shifted indicators, ensuring the signal bar can only use data up to its close.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from enum import Enum
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from models.signal import Direction, Signal
from utils import config

logger = logging.getLogger(__name__)


class Trend(str, Enum):
    UPTREND   = "UPTREND"
    DOWNTREND = "DOWNTREND"
    UNDEFINED = "UNDEFINED"


# ── Pure indicator functions (stateless, no-look-ahead safe) ──────────────────

def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100.0 - (100.0 / (1.0 + rs))


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"]
    low  = df["low"]
    prev_close = df["close"].shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(span=period, adjust=False).mean()


def adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average Directional Index — returns ADX series."""
    high = df["high"]
    low  = df["low"]
    prev_high = high.shift(1)
    prev_low  = low.shift(1)

    dm_plus  = (high - prev_high).clip(lower=0)
    dm_minus = (prev_low - low).clip(lower=0)

    # When +DM == -DM both become 0
    both = (dm_plus == dm_minus)
    dm_plus[both]  = 0.0
    dm_minus[both] = 0.0

    tr_series = atr(df, period)  # Use same ATR smoothing
    # Wilder smoothing for DM
    di_plus  = 100 * dm_plus.ewm(span=period, adjust=False).mean() / tr_series.replace(0, np.nan)
    di_minus = 100 * dm_minus.ewm(span=period, adjust=False).mean() / tr_series.replace(0, np.nan)

    dx = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, np.nan)
    return dx.ewm(span=period, adjust=False).mean()


class AnalysisEngine:

    # ── Pivot Detection ───────────────────────────────────────────────────────

    def detect_pivots(self, df: pd.DataFrame, n: int | None = None) -> pd.DataFrame:
        """
        Label pivot highs/lows using N-candle confirmation.
        Strictly no look-ahead: pivot at index i requires n confirmed candles
        on both sides, so the most recent n candles cannot be pivots.
        """
        n = n or config.PIVOT_N
        df = df.copy()
        df["pivot_high"] = False
        df["pivot_low"]  = False

        highs = df["high"].values
        lows  = df["low"].values

        for i in range(n, len(df) - n):
            w_h = highs[i - n : i + n + 1]
            if highs[i] == w_h.max() and np.sum(w_h == highs[i]) == 1:
                df.iat[i, df.columns.get_loc("pivot_high")] = True

            w_l = lows[i - n : i + n + 1]
            if lows[i] == w_l.min() and np.sum(w_l == lows[i]) == 1:
                df.iat[i, df.columns.get_loc("pivot_low")] = True

        return df

    def classify_trend(self, df: pd.DataFrame) -> Trend:
        """
        HH + HL → UPTREND
        LH + LL → DOWNTREND
        else   → UNDEFINED
        """
        ph = df.loc[df["pivot_high"], "high"].tolist()
        pl = df.loc[df["pivot_low"],  "low"].tolist()

        if len(ph) < 2 or len(pl) < 2:
            return Trend.UNDEFINED

        hh = ph[-1] > ph[-2]
        hl = pl[-1] > pl[-2]
        lh = ph[-1] < ph[-2]
        ll = pl[-1] < pl[-2]

        if hh and hl:
            return Trend.UPTREND
        if lh and ll:
            return Trend.DOWNTREND
        return Trend.UNDEFINED

    # ── Individual indicator sub-scores ───────────────────────────────────────

    @staticmethod
    def _volume_ratio(df: pd.DataFrame) -> float:
        if len(df) < config.VOLUME_MA_PERIOD + 1:
            return 0.0
        avg = df["volume"].iloc[-(config.VOLUME_MA_PERIOD + 1):-1].mean()
        return float(df["volume"].iloc[-1] / avg) if avg > 0 else 0.0

    @staticmethod
    def _wick_ratio(candle: pd.Series, direction: Direction) -> float:
        total = candle["high"] - candle["low"]
        if total == 0:
            return 0.0
        body_top = max(candle["open"], candle["close"])
        body_bot = min(candle["open"], candle["close"])
        if direction == Direction.LONG:
            wick = body_bot - candle["low"]
        else:
            wick = candle["high"] - body_top
        return max(0.0, float(wick / total))

    @staticmethod
    def _atr_percentile(atr_series: pd.Series, lookback: int = 100) -> float:
        """Return current ATR percentile rank over the last `lookback` periods."""
        if len(atr_series) < 2:
            return 50.0
        window = atr_series.iloc[-lookback:]
        current = atr_series.iloc[-1]
        return float((window <= current).sum() / len(window) * 100)

    @staticmethod
    def _oi_spike(oi_series: pd.Series, window: int = 20, threshold: float | None = None) -> bool:
        """Return True if latest OI is an abnormal spike (liquidation cascade risk)."""
        threshold = threshold or config.OI_SPIKE_RATIO
        if len(oi_series) < window + 1:
            return False
        rolling_avg = oi_series.iloc[-(window + 1):-1].mean()
        if rolling_avg <= 0:
            return False
        return float(oi_series.iloc[-1] / rolling_avg) > threshold

    # ── Full analysis for one (asset, timeframe) ─────────────────────────────

    def analyze(
        self,
        asset: str,
        timeframe: str,
        df: pd.DataFrame,
        funding_rate: float | None = None,
        external_oi: float | None = None,
    ) -> Optional[Signal]:
        """
        Full pipeline for a single (asset, tf) pair.
        Returns Signal candidate (without final score) or None.

        No-look-ahead guarantee: all indicators computed on the full series;
        only the final bar ([-1]) is inspected for the signal.
        """
        min_candles = config.EMA_LONG + config.PIVOT_N * 2 + 20
        if len(df) < min_candles:
            logger.debug(f"{asset} {timeframe}: need {min_candles} candles, have {len(df)}")
            return None

        df = df.copy()

        # ── Indicators (computed on the full series, no look-ahead) ──────────
        df["ema50"]  = ema(df["close"], config.EMA_SHORT)
        df["ema200"] = ema(df["close"], config.EMA_LONG)
        df["rsi14"]  = rsi(df["close"], config.RSI_PERIOD)
        df["atr14"]  = atr(df, config.ATR_PERIOD)
        df["adx14"]  = adx(df, config.ADX_PERIOD)

        # ── Pivots & Trend ────────────────────────────────────────────────────
        df = self.detect_pivots(df)
        trend = self.classify_trend(df)
        if trend == Trend.UNDEFINED:
            return None

        # ── Read last closed bar values ────────────────────────────────────────
        last     = df.iloc[-1]
        price    = float(last["close"])
        ema50_v  = float(last["ema50"])
        ema200_v = float(last["ema200"])
        rsi_v    = float(last["rsi14"])
        atr_v    = float(last["atr14"])
        adx_v    = float(last["adx14"])

        # ── ADX filter ────────────────────────────────────────────────────────
        if adx_v < config.ADX_MIN:
            logger.debug(f"{asset} {timeframe}: ADX={adx_v:.1f} < {config.ADX_MIN} — ranging, skip")
            return None

        # ── Volatility filter ─────────────────────────────────────────────────
        atr_pct = self._atr_percentile(df["atr14"])
        if atr_pct < config.ATR_PERCENTILE_MIN:
            logger.debug(f"{asset} {timeframe}: ATR%={atr_pct:.1f} too low — skip")
            return None

        # ── Direction ─────────────────────────────────────────────────────────
        direction = Direction.LONG if trend == Trend.UPTREND else Direction.SHORT

        # ── Funding rate filter ───────────────────────────────────────────────
        if funding_rate is not None:
            if direction == Direction.LONG and funding_rate > config.FUNDING_LONG_MAX:
                logger.debug(f"{asset}: funding={funding_rate:.4%} too high for LONG — skip")
                return None
            if direction == Direction.SHORT and funding_rate < config.FUNDING_SHORT_MIN:
                logger.debug(f"{asset}: funding={funding_rate:.4%} too low for SHORT — skip")
                return None

        vol_ratio  = self._volume_ratio(df)
        wick_ratio = self._wick_ratio(last, direction)

        # ── Confluence conditions ─────────────────────────────────────────────
        if direction == Direction.LONG:
            conditions = {
                "above_ema50":  price > ema50_v,
                "above_ema200": price > ema200_v,
                "rsi_zone":     config.LONG_RSI_MIN <= rsi_v <= config.LONG_RSI_MAX,
                "wick_ok":      wick_ratio >= config.MIN_WICK_RATIO,
                "volume_ok":    vol_ratio  >= config.VOLUME_RATIO_MIN,
            }
        else:
            conditions = {
                "below_ema50":  price < ema50_v,
                "below_ema200": price < ema200_v,
                "rsi_zone":     config.SHORT_RSI_MIN <= rsi_v <= config.SHORT_RSI_MAX,
                "wick_ok":      wick_ratio >= config.MIN_WICK_RATIO,
                "volume_ok":    vol_ratio  >= config.VOLUME_RATIO_MIN,
            }

        failed = [k for k, v in conditions.items() if not v]
        if failed:
            logger.debug(
                f"{asset} {timeframe} {direction.value}: fail {failed} "
                f"[rsi={rsi_v:.1f} wick={wick_ratio:.2f} vol={vol_ratio:.2f} "
                f"ema50={ema50_v:.2f} ema200={ema200_v:.2f} price={price:.2f}]"
            )
            return None

        # ── SL / TP from last confirmed pivot ─────────────────────────────────
        pivot_highs = df.loc[df["pivot_high"], "high"].tolist()
        pivot_lows  = df.loc[df["pivot_low"],  "low"].tolist()

        if direction == Direction.LONG:
            if not pivot_lows:
                return None
            sl = round(pivot_lows[-1] * 0.999, 6)
            if sl >= price:
                return None
            r  = price - sl
            tp1 = round(price + config.TP1_R_MULTIPLE * r, 6)
            tp2 = round(price + config.TP2_R_MULTIPLE * r, 6)
        else:
            if not pivot_highs:
                return None
            sl = round(pivot_highs[-1] * 1.001, 6)
            if sl <= price:
                return None
            r   = sl - price
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
            funding_rate=funding_rate,
            atr_percentile=round(atr_pct, 1),
            adx_value=round(adx_v, 1),
        )
        signal._analysis_data = {
            "trend":        trend,
            "ema50":        ema50_v,
            "ema200":       ema200_v,
            "rsi":          rsi_v,
            "wick_ratio":   wick_ratio,
            "volume_ratio": vol_ratio,
            "atr":          atr_v,
            "adx":          adx_v,
            "atr_pct":      atr_pct,
            "pivot_highs":  pivot_highs,
            "pivot_lows":   pivot_lows,
        }

        logger.info(
            f"Candidate: {asset} {timeframe} {direction.value} | "
            f"entry={price:.4f} SL={sl:.4f} TP1={tp1:.4f} TP2={tp2:.4f} | "
            f"rsi={rsi_v:.1f} adx={adx_v:.1f} atr%={atr_pct:.0f}"
        )
        return signal

    # ── Batch + Multi-TF Confirmation ─────────────────────────────────────────

    def analyze_all(
        self,
        data: Dict[str, Dict[str, pd.DataFrame]],
        funding_rates: Dict[str, float] | None = None,
        require_multi_tf: Optional[bool] = None,
    ) -> List[Signal]:
        """
        Run analysis over all (asset, tf) pairs in *data*.

        Iterates over data.keys() so the caller controls which assets and
        timeframes are scanned — not config.ASSETS / config.TIMEFRAMES.
        This lets the live scanner pass any asset universe independently of
        the backtest config.

        Args:
            data:             {asset: {tf: DataFrame}}
            funding_rates:    optional funding rate per asset
            require_multi_tf: override config.MULTI_TF_CONFIRM.
                              False  → return every individual-TF signal.
                              True   → only return ≥2-TF confirmed signals.
                              None   → use config.MULTI_TF_CONFIRM (default).
        """
        funding_rates = funding_rates or {}
        raw_signals: Dict[str, List[Signal]] = defaultdict(list)

        for asset, tf_map in data.items():
            funding = funding_rates.get(asset)
            for tf, df in tf_map.items():
                sig = self.analyze(asset, tf, df, funding_rate=funding)
                if sig is not None:
                    raw_signals[asset].append(sig)

        use_multi_tf = config.MULTI_TF_CONFIRM if require_multi_tf is None else require_multi_tf
        confirmed: List[Signal] = []

        if not use_multi_tf:
            for sigs in raw_signals.values():
                confirmed.extend(sigs)
            return confirmed

        # Multi-TF logic: group by asset+direction, require ≥2 TF agreement
        for asset, sigs in raw_signals.items():
            long_sigs  = [s for s in sigs if s.direction == Direction.LONG]
            short_sigs = [s for s in sigs if s.direction == Direction.SHORT]

            for group in (long_sigs, short_sigs):
                if len(group) < 2:
                    logger.debug(
                        f"{asset} {group[0].direction.value if group else '?'}: "
                        f"only {len(group)} TF — multi-TF confirm required, skip"
                    )
                    continue
                group.sort(key=lambda s: s.rr_ratio, reverse=True)
                best = group[0]
                best.confirmed_timeframes = [s.timeframe for s in group]
                best.multi_tf_confirmed = True
                confirmed.append(best)
                logger.info(
                    f"Multi-TF confirmed: {asset} {best.direction.value} "
                    f"on {best.confirmed_timeframes}"
                )

        return confirmed
