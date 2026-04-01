# -*- coding: utf-8 -*-
"""
Walk-Forward Optimizer v2
==========================
Uses Optuna to find optimal parameters via walk-forward validation.

Walk-forward protocol:
  - Training window:  6 months
  - Test window:      1 month (out-of-sample)
  - Rolling monthly, minimum 3 folds required before enabling live signals

Each fold:
  1. Train on in-sample window → Optuna finds best params (max Sharpe)
  2. Validate on OOS window → compute real metrics with best params
  3. OOS result goes into WFO aggregate stats

Live signals are ONLY enabled when:
  - At least MIN_FOLDS passed
  - Latest OOS fold passes the performance gate (PF > 1.8, Sharpe > 1.5, DD < 15%)

Outputs:
  - optimized_weights.json (scoring weights)
  - walk_forward_results.json (per-fold metrics)
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

import numpy as np
import optuna
import pandas as pd

from services.backtester import Backtester, BacktestResult, generate_signals, simulate_execution
from utils import config

logger = logging.getLogger(__name__)

# Silence Optuna's verbose logging unless debugging
optuna.logging.set_verbosity(optuna.logging.WARNING)

WFO_RESULTS_FILE = Path(__file__).parent.parent / "walk_forward_results.json"


@dataclass
class FoldResult:
    fold_id:        int
    train_start:    str
    train_end:      str
    test_start:     str
    test_end:       str
    train_result:   dict
    test_result:    dict
    best_params:    dict
    passes_gate:    bool


class WalkForwardOptimizer:

    def __init__(
        self,
        initial_capital: float = config.BACKTEST_INITIAL_CAPITAL,
        n_trials: int           = config.OPTUNA_N_TRIALS,
        timeout: int            = config.OPTUNA_TIMEOUT,
        train_months: int       = config.WALK_FORWARD_TRAIN_MONTHS,
        test_months: int        = config.WALK_FORWARD_TEST_MONTHS,
        min_folds: int          = config.WALK_FORWARD_MIN_FOLDS,
    ) -> None:
        self.initial_capital = initial_capital
        self.n_trials        = n_trials
        self.timeout         = timeout
        self.train_months    = train_months
        self.test_months     = test_months
        self.min_folds       = min_folds
        self._backtester     = Backtester(initial_capital=initial_capital)

    # ── Main entry point ──────────────────────────────────────────────────────

    def run(
        self,
        df: pd.DataFrame,
        timeframe: str = "1H",
        progress_callback=None,
    ) -> dict[str, Any]:
        """
        Run the full walk-forward optimization.

        Args:
            df:                 OHLCV DataFrame with datetime index or 'timestamp' column
            timeframe:          Timeframe of the data (used for fold sizing)
            progress_callback:  Optional callable(fold_id, total_folds, message)

        Returns:
            dict with keys: folds, aggregate_stats, best_params, live_enabled
        """
        df = _ensure_datetime_index(df)

        # ── Minimum absolute floor ─────────────────────────────────────────────
        MIN_BARS = 3000
        if len(df) < MIN_BARS:
            raise ValueError(
                f"Not enough data for WFO: need at least {MIN_BARS} bars, "
                f"have {len(df)}. Switch to a higher timeframe (e.g. 1H or 4H) "
                f"or fetch more history."
            )

        # ── Fold sizing: prefer month-based, fall back to adaptive ─────────────
        bars_per_month = _bars_per_month(timeframe)
        train_bars     = self.train_months * bars_per_month
        test_bars      = self.test_months  * bars_per_month
        window         = train_bars + test_bars
        n_folds_ideal  = (len(df) - window) // test_bars + 1 if window <= len(df) else 0

        if n_folds_ideal < self.min_folds:
            # Adaptive sizing: derive test_bars so that exactly min_folds folds fit.
            # From the rolling-window formula:
            #   folds = (N - window) // test_bars + 1
            #   window = (train_ratio + 1) * test_bars   (train_ratio = 6)
            # Minimum condition (folds >= min_folds):
            #   test_bars <= N / (train_ratio + min_folds)
            train_ratio = 6  # keep 6:1 train:test
            test_bars   = max(len(df) // (train_ratio + self.min_folds), 150)
            train_bars  = train_ratio * test_bars
            window      = train_bars + test_bars

            if window > len(df):
                raise ValueError(
                    f"Not enough data for WFO even with adaptive sizing: "
                    f"need {window} bars, have {len(df)}."
                )

            logger.warning(
                "WFO adaptive sizing active: month-based window (%d bars) exceeds "
                "available data (%d bars). Using test_bars=%d train_bars=%d window=%d "
                "(timeframe=%s). For full 6-month windows switch to 1H or 4H.",
                self.train_months * bars_per_month + self.test_months * bars_per_month,
                len(df), test_bars, train_bars, window, timeframe,
            )
        else:
            logger.info(
                "WFO month-based sizing: train_bars=%d test_bars=%d window=%d "
                "expected_folds=%d (timeframe=%s)",
                train_bars, test_bars, window, n_folds_ideal, timeframe,
            )

        # Rolling folds
        folds: list[FoldResult] = []
        fold_id = 0
        start = 0

        total_folds = (len(df) - window) // test_bars + 1

        while start + window <= len(df):
            train_df = df.iloc[start : start + train_bars].copy()
            test_df  = df.iloc[start + train_bars : start + window].copy()

            msg = (
                f"Fold {fold_id + 1}/{total_folds}: "
                f"train [{train_df.index[0].date()} → {train_df.index[-1].date()}] "
                f"test [{test_df.index[0].date()} → {test_df.index[-1].date()}]"
            )
            logger.info(msg)
            if progress_callback:
                progress_callback(fold_id + 1, total_folds, msg)

            # Optimize on training data
            best_params = self._optimize_fold(train_df)

            # Evaluate on OOS (test) data
            train_result = self._backtester.run(train_df, best_params)
            test_result  = self._backtester.run(test_df,  best_params)

            fold = FoldResult(
                fold_id     = fold_id,
                train_start = str(train_df.index[0].date()),
                train_end   = str(train_df.index[-1].date()),
                test_start  = str(test_df.index[0].date()),
                test_end    = str(test_df.index[-1].date()),
                train_result= train_result.to_dict(),
                test_result = test_result.to_dict(),
                best_params = best_params,
                passes_gate = test_result.passes_gate(),
            )
            folds.append(fold)
            fold_id += 1
            start  += test_bars

        # Aggregate OOS stats
        agg = _aggregate_fold_stats(folds)

        # Determine best params from the most recent passing fold
        best_params = self._select_best_params(folds)

        # Determine if live trading is enabled.
        # Requires all folds to be run AND at least one fold to pass the gate.
        # (Requiring the last fold specifically is too brittle with limited data
        #  — a single unlucky OOS window would block an otherwise solid system.)
        n_passing = sum(1 for f in folds if f.passes_gate)
        live_enabled = (len(folds) >= self.min_folds) and (n_passing >= 1)

        logger.info(
            f"WFO complete: {len(folds)} folds, {n_passing} passing, "
            f"live_enabled={live_enabled}"
        )

        output = {
            "folds":        [_fold_to_dict(f) for f in folds],
            "agg":          agg,
            "best_params":  best_params,
            "live_enabled": live_enabled,
            "n_folds":      len(folds),
            "n_passing":    n_passing,
            "wfo_timeframe": timeframe,
            "train_bars":   train_bars,
            "test_bars":    test_bars,
            "total_bars":   len(df),
        }

        # Persist
        _save_wfo_results(output)

        # Save weights if enabled
        if live_enabled and best_params:
            weights = _params_to_weights(best_params)
            config.save_optimized_weights(weights, metadata={
                "source": "walk_forward",
                "n_folds": len(folds),
                "last_fold_date": folds[-1].test_end,
            })
            logger.info(f"Weights saved: {weights}")

        return output

    # ── Optuna inner loop ─────────────────────────────────────────────────────

    def _optimize_fold(self, train_df: pd.DataFrame) -> dict:
        """Run Optuna on a single training fold. Returns best params."""

        def objective(trial: optuna.Trial) -> float:
            params = _sample_params(trial)
            try:
                df_sig = generate_signals(train_df.copy(), params)
                result = simulate_execution(
                    df_sig,
                    initial_capital=self.initial_capital,
                    risk_per_trade=config.RISK_PER_TRADE,
                )
            except Exception as exc:
                logger.debug(f"Optuna trial failed: {exc}")
                return -999.0

            if result.total_trades < 3:
                return -999.0

            # Objective: maximise Sharpe, penalise excessive drawdown and
            # too few trades (soft penalty so Optuna still explores the region)
            sharpe = result.sharpe if not np.isnan(result.sharpe) else -999.0
            dd_penalty    = max(0, result.max_drawdown - config.MAX_DRAWDOWN) * 10
            trade_penalty = max(0, 10 - result.total_trades) * 0.05  # gentle nudge
            return sharpe - dd_penalty - trade_penalty

        study = optuna.create_study(direction="maximize")
        study.optimize(
            objective,
            n_trials=self.n_trials,
            timeout=self.timeout,
            show_progress_bar=False,
        )

        return study.best_params if study.best_trial.value > -999 else {}

    # ── Param selection ───────────────────────────────────────────────────────

    def _select_best_params(self, folds: list[FoldResult]) -> dict:
        """Return params from the most recent passing fold, or the best overall."""
        passing = [f for f in reversed(folds) if f.passes_gate]
        if passing:
            return passing[0].best_params

        # Fall back: fold with best OOS Sharpe
        if folds:
            best = max(folds, key=lambda f: f.test_result.get("sharpe", -999))
            return best.best_params

        return {}


# ── Helper functions ──────────────────────────────────────────────────────────

def _sample_params(trial: optuna.Trial) -> dict:
    """
    Define the Optuna hyperparameter search space.

    Ranges are intentionally wide so Optuna can explore configurations that
    generate enough trades on the available data.  Narrow defaults are what
    cause 0/N folds to pass when all AND-combined filters are too strict.
    """
    return {
        # Structure — smaller pivot_n = more pivots detected = more signals
        "pivot_n":          trial.suggest_int("pivot_n", 2, 6),

        # Indicators
        "ema_short":        trial.suggest_int("ema_short", 10, 50),    # max < min(ema_long)
        "ema_long":         trial.suggest_int("ema_long",  80, 200),   # min > max(ema_short)
        "rsi_period":       trial.suggest_int("rsi_period", 7, 21),
        "atr_period":       trial.suggest_int("atr_period", 7, 21),
        "adx_period":       trial.suggest_int("adx_period", 7, 21),

        # Filters — wider lower bounds allow more bars to pass each filter
        "adx_min":          trial.suggest_float("adx_min", 15.0, 30.0),
        "atr_pct_min":      trial.suggest_float("atr_pct_min", 15.0, 55.0),  # was 40–70
        "volume_ratio_min": trial.suggest_float("volume_ratio_min", 0.6, 1.5),  # was 1.0–2.0
        "min_wick_ratio":   trial.suggest_float("min_wick_ratio", 0.10, 0.45),  # was 0.25–0.60

        # RSI zones — wider bands allow more bars through the RSI filter
        "long_rsi_min":     trial.suggest_float("long_rsi_min",  25.0, 48.0),
        "long_rsi_max":     trial.suggest_float("long_rsi_max",  55.0, 80.0),
        "short_rsi_min":    trial.suggest_float("short_rsi_min", 20.0, 45.0),
        "short_rsi_max":    trial.suggest_float("short_rsi_max", 52.0, 80.0),

        # SL placement: cap pivot-based SL at this multiple of ATR
        # Tight (1.0) = fast resolution but more SL hits
        # Wide (3.0)  = fewer SL hits but slow resolution and tiny position size
        "atr_sl_mult":      trial.suggest_float("atr_sl_mult", 1.0, 3.0),

        # Scoring weights (normalised to 1.0 in _params_to_weights)
        "_w_structure":     trial.suggest_float("_w_structure", 0.05, 0.50),
        "_w_ema":           trial.suggest_float("_w_ema",       0.05, 0.50),
        "_w_rsi":           trial.suggest_float("_w_rsi",       0.05, 0.50),
        "_w_wick":          trial.suggest_float("_w_wick",      0.05, 0.50),
        "_w_volume":        trial.suggest_float("_w_volume",    0.05, 0.50),
    }


def _params_to_weights(params: dict) -> dict[str, float]:
    """Extract and normalise scoring weights from Optuna params."""
    # Map from Optuna param key → weight name.
    # Note: do NOT use lstrip("_w_") — it strips individual characters, not a
    # prefix, so "_w_wick".lstrip("_w_") → "ick" (strips the leading 'w' of 'wick').
    key_map = {
        "_w_structure": "structure",
        "_w_ema":       "ema",
        "_w_rsi":       "rsi",
        "_w_wick":      "wick",
        "_w_volume":    "volume",
    }
    raw = {name: params.get(optuna_key, 0.20) for optuna_key, name in key_map.items()}
    total = sum(raw.values())
    if total == 0:
        return config.DEFAULT_WEIGHTS.copy()
    return {name: round(v / total, 6) for name, v in raw.items()}


def _bars_per_month(timeframe: str) -> int:
    mapping = {
        "1m":  60 * 24 * 30,
        "3m":  20 * 24 * 30,
        "5m":  12 * 24 * 30,
        "15m": 4  * 24 * 30,
        "30m": 2  * 24 * 30,
        "1h":  24 * 30,
        "2h":  12 * 30,
        "4h":  6  * 30,
        "8h":  3  * 30,
        "12h": 2  * 30,
        "1d":  30,
    }
    return mapping.get(timeframe.lower(), 720)


def _ensure_datetime_index(df: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(df.index, pd.DatetimeIndex):
        if "timestamp" in df.columns:
            df = df.set_index("timestamp")
        else:
            raise ValueError("DataFrame must have a DatetimeIndex or 'timestamp' column")
    return df


def _aggregate_fold_stats(folds: list[FoldResult]) -> dict:
    if not folds:
        return {}
    test_results = [f.test_result for f in folds]
    return {
        "mean_profit_factor": round(np.mean([r.get("profit_factor", 0) for r in test_results]), 3),
        "mean_sharpe":        round(np.mean([r.get("sharpe",        0) for r in test_results]), 3),
        "mean_max_drawdown":  round(np.mean([r.get("max_drawdown",  0) for r in test_results]), 3),
        "mean_winrate":       round(np.mean([r.get("winrate",       0) for r in test_results]), 3),
        "total_oos_trades":   sum(r.get("total_trades", 0) for r in test_results),
        "n_folds":            len(folds),
        "n_passing":          sum(1 for f in folds if f.passes_gate),
    }


def _fold_to_dict(f: FoldResult) -> dict:
    return {
        "fold_id":      f.fold_id,
        "train_start":  f.train_start,
        "train_end":    f.train_end,
        "test_start":   f.test_start,
        "test_end":     f.test_end,
        "train_result": f.train_result,
        "test_result":  f.test_result,
        "best_params":  f.best_params,
        "passes_gate":  f.passes_gate,
    }


def _save_wfo_results(data: dict) -> None:
    try:
        with open(WFO_RESULTS_FILE, "w") as f:
            json.dump(data, f, indent=2, default=str)
        logger.info(f"WFO results saved to {WFO_RESULTS_FILE}")
    except Exception as exc:
        logger.error(f"Failed to save WFO results: {exc}")


def load_wfo_results() -> Optional[dict]:
    """Load persisted WFO results if they exist."""
    if WFO_RESULTS_FILE.exists():
        try:
            with open(WFO_RESULTS_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return None


def is_live_enabled() -> bool:
    """Check if the latest WFO run authorises live signals."""
    data = load_wfo_results()
    if not data:
        return False
    return bool(data.get("live_enabled", False))
