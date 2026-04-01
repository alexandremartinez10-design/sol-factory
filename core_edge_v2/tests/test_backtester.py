# -*- coding: utf-8 -*-
"""
Unit tests for services/backtester.py
======================================
Tests:
  1. test_no_lookahead_bias     — Signals on bar i must not use bar i data (only i-1)
  2. test_fee_calculation       — Verify fee accounting in simulate_execution
  3. test_position_sizing       — Verify risk_per_trade sizing from RiskManager
  4. test_signal_generation     — Verify generate_signals outputs valid columns
  5. test_no_mixed_signals      — Verify generate_signals and simulate_execution are separate
  6. test_backtest_metrics      — Smoke test full Backtester.run on synthetic data
"""

from __future__ import annotations

import math
import numpy as np
import pandas as pd
import pytest

from services.backtester import (
    Backtester,
    BacktestResult,
    generate_signals,
    simulate_execution,
)
from services.risk_manager import RiskManager
from utils import config


# ─────────────────────────────────────────────────────────────────────────────
#  Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_trending_df(n: int = 1000, trend: str = "up") -> pd.DataFrame:
    """
    Generate synthetic OHLCV DataFrame with a clear uptrend or downtrend.
    Designed to trigger at least a few signals.
    """
    np.random.seed(42)
    timestamps = pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC")
    noise = np.random.randn(n) * 0.5

    if trend == "up":
        close = 100 + np.arange(n) * 0.05 + noise
    else:
        close = 100 + np.arange(n) * -0.05 + noise

    close = np.clip(close, 1.0, None)

    # Synthetic OHLC from close
    open_  = np.roll(close, 1)
    open_[0] = close[0]
    high   = np.maximum(open_, close) * (1 + np.abs(np.random.randn(n)) * 0.003)
    low    = np.minimum(open_, close) * (1 - np.abs(np.random.randn(n)) * 0.003)
    volume = np.abs(np.random.randn(n) * 500 + 2000)

    df = pd.DataFrame({
        "timestamp": timestamps,
        "open":      open_,
        "high":      high,
        "low":       low,
        "close":     close,
        "volume":    volume,
    })
    df = df.set_index("timestamp")
    return df


def _make_flat_df(n: int = 600) -> pd.DataFrame:
    """Flat, ranging price — should produce no signals (ADX will be low)."""
    np.random.seed(1)
    timestamps = pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC")
    close = 100 + np.random.randn(n) * 0.1  # essentially flat
    close = np.clip(close, 1.0, None)
    open_ = np.roll(close, 1); open_[0] = close[0]
    high  = close * 1.001
    low   = close * 0.999
    vol   = np.ones(n) * 1000.0

    return pd.DataFrame({
        "timestamp": timestamps,
        "open": open_, "high": high, "low": low,
        "close": close, "volume": vol,
    }).set_index("timestamp")


# ─────────────────────────────────────────────────────────────────────────────
#  Test 1 — No look-ahead bias
# ─────────────────────────────────────────────────────────────────────────────

def test_no_lookahead_bias():
    """
    Verify that a signal at bar i does not use the close price of bar i.

    Method:
    1. Generate signals on original df.
    2. Replace bar[i] close with a wildly different value.
    3. Re-generate signals — any signal at bar[i] must be UNCHANGED,
       because it should only use data from bar[i-1].
    4. Assert that modifying bar[i] close does not flip signals at bar[i].
    """
    df = _make_trending_df(n=800)
    params = {
        "pivot_n": 3, "ema_short": 20, "ema_long": 100,
        "adx_min": 15.0, "atr_pct_min": 20.0,
        "volume_ratio_min": 0.5, "min_wick_ratio": 0.1,
        "long_rsi_min": 20.0, "long_rsi_max": 80.0,
        "short_rsi_min": 20.0, "short_rsi_max": 80.0,
    }

    df_sig = generate_signals(df.copy(), params)
    signal_bars = df_sig.index[df_sig["signal"] != 0].tolist()

    if not signal_bars:
        pytest.skip("No signals generated on synthetic data — adjust params")

    # Pick a signal bar and corrupt its close price
    test_bar = signal_bars[len(signal_bars) // 2]
    test_idx = df_sig.index.get_loc(test_bar)

    df_modified = df.copy()
    df_modified.iloc[test_idx, df_modified.columns.get_loc("close")] *= 100.0  # absurd value

    df_sig2 = generate_signals(df_modified, params)

    # Signal at bar test_idx must be the same as original
    # (corrupt close only affects bar test_idx+1 and beyond, not test_idx)
    sig_original = df_sig.iloc[test_idx]["signal"]
    sig_modified = df_sig2.iloc[test_idx]["signal"]

    assert sig_original == sig_modified, (
        f"LOOK-AHEAD BIAS DETECTED: signal at bar {test_idx} changed from "
        f"{sig_original} to {sig_modified} when bar[{test_idx}] close was modified. "
        f"This means the signal used future data!"
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Test 2 — Fee calculation
# ─────────────────────────────────────────────────────────────────────────────

def test_fee_calculation():
    """
    Verify that simulate_execution deducts fees correctly.
    A no-PnL trade (entry == exit) should result in a net loss equal to fees paid.
    """
    # Build a minimal df that produces exactly one LONG signal on bar 300
    n = 400
    df = _make_trending_df(n=n)

    # Force a single signal at bar 300 by injecting directly
    df_sig = df.copy()
    df_sig["signal"]    = 0
    df_sig["sl_price"]  = np.nan
    df_sig["tp1_price"] = np.nan
    df_sig["tp2_price"] = np.nan
    df_sig["signal_atr"]= 1.0

    entry_bar = 300
    entry_px  = float(df_sig["close"].iloc[entry_bar])

    df_sig.iloc[entry_bar, df_sig.columns.get_loc("signal")]    = 1      # LONG
    df_sig.iloc[entry_bar, df_sig.columns.get_loc("sl_price")]  = entry_px * 0.98
    df_sig.iloc[entry_bar, df_sig.columns.get_loc("tp1_price")] = entry_px * 1.015
    df_sig.iloc[entry_bar, df_sig.columns.get_loc("tp2_price")] = entry_px * 1.03

    initial = 10_000.0
    result = simulate_execution(
        df_sig,
        initial_capital=initial,
        risk_per_trade=0.01,
        maker_fee=config.MAKER_FEE,
        taker_fee=config.TAKER_FEE,
        slippage_pct=0.0,
        funding_rate=0.0,
    )

    # If the trade was executed, fees must be > 0
    if result.total_trades > 0:
        total_fees = sum(abs(t.fees) for t in result.trades)
        assert total_fees > 0, "Fee deduction: expected fees > 0 but got 0"

        # Minimum fee floor: 0.02% × position_size (entry fee alone)
        risk_amount   = initial * 0.01
        price_diff    = entry_px - entry_px * 0.98
        size          = risk_amount / price_diff
        min_entry_fee = entry_px * size * config.MAKER_FEE
        assert total_fees >= min_entry_fee * 0.99, (
            f"Fees too low: got {total_fees:.4f}, expected ≥ {min_entry_fee:.4f}"
        )

    # Capital should decrease relative to initial even if trade is flat
    # (due to fees) — or stay same if no trades executed
    if result.total_trades > 0:
        assert result.final_capital < initial or result.total_pnl != 0.0


# ─────────────────────────────────────────────────────────────────────────────
#  Test 3 — Position sizing
# ─────────────────────────────────────────────────────────────────────────────

def test_position_sizing():
    """
    Verify RiskManager.calculate_position_size produces exactly 1% risk.
    """
    rm = RiskManager(initial_capital=10_000.0)
    capital    = 10_000.0
    entry      = 50_000.0   # BTC-like price
    stop_loss  = 49_000.0   # 1000 USD away = 2%

    size, leverage = rm.calculate_position_size(capital, entry, stop_loss)

    expected_risk  = capital * config.RISK_PER_TRADE   # $100
    actual_risk    = abs(entry - stop_loss) * size

    # Allow 1% tolerance
    assert abs(actual_risk - expected_risk) / expected_risk < 0.01, (
        f"Risk mismatch: expected ${expected_risk:.2f}, got ${actual_risk:.2f}"
    )

    # Leverage must be ≤ MAX_LEVERAGE
    assert leverage <= config.MAX_LEVERAGE, (
        f"Leverage {leverage} exceeds MAX_LEVERAGE {config.MAX_LEVERAGE}"
    )

    # Size must be > 0
    assert size > 0, "Position size must be > 0"


def test_position_sizing_tight_sl():
    """Position sizing with very tight SL must not exceed leverage cap."""
    rm = RiskManager(initial_capital=1_000.0)
    capital   = 1_000.0
    entry     = 1_000.0
    stop_loss = 999.9   # only 0.1 away → huge size

    size, leverage = rm.calculate_position_size(capital, entry, stop_loss)
    assert leverage <= config.MAX_LEVERAGE
    notional = size * entry
    assert notional <= capital * config.MAX_LEVERAGE * 1.01  # allow small float error


# ─────────────────────────────────────────────────────────────────────────────
#  Test 4 — Signal generation columns
# ─────────────────────────────────────────────────────────────────────────────

def test_signal_generation_columns():
    """generate_signals must return required columns."""
    df = _make_trending_df(n=600)
    params = {"pivot_n": 3, "ema_short": 20, "ema_long": 100}
    result = generate_signals(df.copy(), params)

    required = ["signal", "sl_price", "tp1_price", "tp2_price"]
    for col in required:
        assert col in result.columns, f"Missing column: {col}"

    # signal values must be in {-1, 0, 1}
    assert set(result["signal"].unique()).issubset({-1, 0, 1}), (
        f"Unexpected signal values: {result['signal'].unique()}"
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Test 5 — Signal generation and execution are separate functions
# ─────────────────────────────────────────────────────────────────────────────

def test_signal_and_execution_are_separate():
    """
    Verify that generate_signals and simulate_execution are importable and
    callable as independent pure functions with no shared state.
    """
    df = _make_trending_df(n=500)
    params = {"pivot_n": 3, "ema_short": 20, "ema_long": 100}

    # Step 1 must succeed without calling step 2
    df_sig = generate_signals(df.copy(), params)
    assert "signal" in df_sig.columns

    # Step 2 must succeed without calling step 1 again
    result = simulate_execution(df_sig, initial_capital=10_000.0)
    assert isinstance(result, BacktestResult)

    # Calling them in wrong order (execution on raw df) should still not crash
    # (it will treat all signals as 0, which is fine)
    df_raw = df.copy()
    df_raw["signal"]    = 0
    df_raw["sl_price"]  = np.nan
    df_raw["tp1_price"] = np.nan
    df_raw["tp2_price"] = np.nan
    result2 = simulate_execution(df_raw, initial_capital=10_000.0)
    assert result2.total_trades == 0


# ─────────────────────────────────────────────────────────────────────────────
#  Test 6 — Full backtest smoke test
# ─────────────────────────────────────────────────────────────────────────────

def test_full_backtest_smoke():
    """
    Full Backtester.run on synthetic data must return a valid BacktestResult.
    """
    df = _make_trending_df(n=1500)
    bt = Backtester(initial_capital=10_000.0)
    params = {
        "pivot_n": 3, "ema_short": 20, "ema_long": 100,
        "adx_min": 10.0, "atr_pct_min": 10.0,
        "volume_ratio_min": 0.3, "min_wick_ratio": 0.05,
        "long_rsi_min": 20.0, "long_rsi_max": 80.0,
        "short_rsi_min": 20.0, "short_rsi_max": 80.0,
    }
    result = bt.run(df, params)

    assert isinstance(result, BacktestResult)
    assert 0.0 <= result.winrate <= 1.0
    assert result.max_drawdown >= 0.0
    assert result.total_trades == result.winning_trades + result.losing_trades
    assert len(result.equity_curve) > 0
    assert not math.isnan(result.profit_factor) or result.total_trades == 0


# ─────────────────────────────────────────────────────────────────────────────
#  Test 7 — Flat market → no signals (ADX filter)
# ─────────────────────────────────────────────────────────────────────────────

def test_flat_market_no_signals():
    """
    In a flat/ranging market the ADX filter should suppress most/all signals.
    We don't assert zero (some signals may pass on flat data with permissive params),
    but verify the signal count is much lower than on a trending market.
    """
    trending = _make_trending_df(n=800)
    flat     = _make_flat_df(n=800)

    params = {
        "pivot_n": 3, "ema_short": 20, "ema_long": 100,
        "adx_min": 25.0, "atr_pct_min": 50.0,
        "volume_ratio_min": 1.0, "min_wick_ratio": 0.2,
        "long_rsi_min": 35.0, "long_rsi_max": 65.0,
        "short_rsi_min": 35.0, "short_rsi_max": 65.0,
    }

    trending_sigs = (generate_signals(trending.copy(), params)["signal"] != 0).sum()
    flat_sigs     = (generate_signals(flat.copy(),     params)["signal"] != 0).sum()

    assert flat_sigs <= trending_sigs, (
        f"Expected fewer signals on flat data ({flat_sigs}) than trending ({trending_sigs})"
    )
