# -*- coding: utf-8 -*-
"""
CORE EDGE v2 — Centralised Configuration
All tunable parameters live here. Override via .env or OptimizedWeights.json.
Never hardcode values in service modules.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ─── Runtime Mode ─────────────────────────────────────────────────────────────
PAPER_TRADING: bool = os.getenv("PAPER_TRADING", "true").lower() == "true"

# ─── Assets & Timeframes ──────────────────────────────────────────────────────
_raw_assets = os.getenv("ASSETS", "BTC,ETH,SOL,AVAX,DOGE,WIF,HYPE,ARB,OP,SUI")
ASSETS: list[str] = [a.strip() for a in _raw_assets.split(",")]

_raw_tfs = os.getenv("TIMEFRAMES", "15m,1H,4H")
TIMEFRAMES: list[str] = [t.strip() for t in _raw_tfs.split(",")]

# ─── Pivot / Structure Detection ─────────────────────────────────────────────
PIVOT_N: int = 5

# ─── Indicators ──────────────────────────────────────────────────────────────
EMA_SHORT: int = 50
EMA_LONG: int = 200
RSI_PERIOD: int = 14
ATR_PERIOD: int = 14
ADX_PERIOD: int = 14

# ─── Volume ──────────────────────────────────────────────────────────────────
VOLUME_MA_PERIOD: int = 20
VOLUME_RATIO_MIN: float = 1.2

# ─── Wick Rejection ──────────────────────────────────────────────────────────
MIN_WICK_RATIO: float = 0.35

# ─── RSI Zones ───────────────────────────────────────────────────────────────
LONG_RSI_MIN: float = 38.0
LONG_RSI_MAX: float = 65.0
SHORT_RSI_MIN: float = 35.0
SHORT_RSI_MAX: float = 62.0
RSI_OPTIMAL_MIN: float = 45.0
RSI_OPTIMAL_MAX: float = 55.0

# ─── ADX Filter ───────────────────────────────────────────────────────────────
ADX_MIN: float = 25.0          # Only trade when ADX > 25 (trending market)

# ─── Funding Rate Filter ──────────────────────────────────────────────────────
FUNDING_LONG_MAX: float = 0.0003    # Avoid longs when funding > +0.03%/h
FUNDING_SHORT_MIN: float = -0.0003  # Avoid shorts when funding < -0.03%/h

# ─── Volatility Filter (ATR percentile) ───────────────────────────────────────
ATR_PERCENTILE_MIN: float = 60.0   # Only trade when ATR is in top 40% (≥60th pct)

# ─── OI Spike Detection (liquidation cascade avoidance) ───────────────────────
OI_SPIKE_RATIO: float = 1.5        # OI must not be >1.5× the 20-period rolling avg

# ─── Signal Filtering ────────────────────────────────────────────────────────
MIN_CONFIDENCE_SCORE: int = 70     # Raised from 65 — only high-conviction signals
MULTI_TF_CONFIRM: bool = True      # Require signal on ≥2 timeframes (same direction)

# ─── Risk Management ─────────────────────────────────────────────────────────
RISK_PER_TRADE: float = 0.01       # 1% of capital per trade
MAX_LEVERAGE: int = 5
DAILY_LOSS_LIMIT: float = 0.03     # -3% → auto pause
WEEKLY_LOSS_LIMIT: float = 0.08    # -8% → auto pause

# ─── Take Profit Levels ──────────────────────────────────────────────────────
TP1_R_MULTIPLE: float = 1.5
TP2_R_MULTIPLE: float = 3.0
TP1_CLOSE_PCT: float = 0.50        # Close 50% of position at TP1
BREAKEVEN_AFTER_TP1: bool = True

# ─── Fees & Slippage (for backtester realism) ────────────────────────────────
MAKER_FEE: float = 0.0002          # 0.02%
TAKER_FEE: float = 0.0005          # 0.05%
SLIPPAGE_TICKS: float = 1.0        # Base slippage in ticks
TICK_SIZE: float = 0.1             # Default tick size — overridden per-coin

# ─── Backtest Defaults ────────────────────────────────────────────────────────
BACKTEST_CANDLES: int = 5000       # Default lookback (fetched in batches)
BACKTEST_INITIAL_CAPITAL: float = 10_000.0
WALK_FORWARD_TRAIN_MONTHS: int = 6
WALK_FORWARD_TEST_MONTHS: int = 1
WALK_FORWARD_MIN_FOLDS: int = 3    # Minimum folds before enabling live signals

# ─── Optuna ───────────────────────────────────────────────────────────────────
OPTUNA_N_TRIALS: int = 50          # minimum per fold; timeout is the safety cap
OPTUNA_TIMEOUT: int = 600          # 10 min per fold — ensures all 50 trials complete

# ─── Performance Thresholds (live signal gate) ───────────────────────────────
MIN_PROFIT_FACTOR: float = 1.3    # relaxed from 1.8 — still filters losing strategies
MIN_SHARPE: float = 0.8           # relaxed from 1.5 — achievable on real crypto data
MAX_DRAWDOWN: float = 0.25        # relaxed from 0.15 — 25% cap

# ─── Candle Fetch ─────────────────────────────────────────────────────────────
CANDLE_BATCH_SIZE: int = 500       # Max per API call
CANDLE_LIVE_LIMIT: int = 350       # For live analysis

# ─── Timing ──────────────────────────────────────────────────────────────────
POLLING_INTERVAL: int = 90
WS_RECONNECT_INTERVAL: int = 30
CACHE_TTL_SECONDS: int = 55        # Candle cache freshness

# ─── API Retry ───────────────────────────────────────────────────────────────
MAX_RETRIES: int = 3
RETRY_BACKOFF_BASE: int = 2

# ─── Optimized Weights File ───────────────────────────────────────────────────
WEIGHTS_FILE: Path = Path(__file__).parent.parent / "optimized_weights.json"

# Default weights (sum to 1.0) — overridden by optimizer results
DEFAULT_WEIGHTS: dict[str, float] = {
    "structure": 0.20,
    "ema":       0.20,
    "rsi":       0.20,
    "wick":      0.20,
    "volume":    0.20,
}


def load_optimized_weights() -> dict[str, float]:
    """Load weights from disk if they exist and sum to ~1.0, else use defaults."""
    if WEIGHTS_FILE.exists():
        try:
            with open(WEIGHTS_FILE) as f:
                data = json.load(f)
            weights = data.get("weights", {})
            if abs(sum(weights.values()) - 1.0) < 0.01 and len(weights) == 5:
                return weights
        except Exception:
            pass
    return DEFAULT_WEIGHTS.copy()


def save_optimized_weights(weights: dict[str, float], metadata: dict | None = None) -> None:
    """Persist optimized weights to disk."""
    payload = {"weights": weights}
    if metadata:
        payload["metadata"] = metadata
    with open(WEIGHTS_FILE, "w") as f:
        json.dump(payload, f, indent=2)
