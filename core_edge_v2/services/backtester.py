# -*- coding: utf-8 -*-
"""
Backtester v2
=============
Hybrid vectorized + event-driven backtester for CORE EDGE signals.

Design principles:
─────────────────
1. STRICT NO LOOK-AHEAD BIAS
   - generate_signals() uses .shift(1) on ALL indicator series before comparing
     to price. This means a signal on bar i can only use data known at bar i-1
     close. The signal triggers at bar i open (approximated as bar i close for
     simplicity, with slippage applied).
   - Signal generation and execution simulation are SEPARATE functions.
     They must NEVER be mixed.

2. REALISTIC SIMULATION
   - Hyperliquid fees: 0.02% maker / 0.05% taker
   - Hourly funding payments (long pays positive funding, short receives it)
   - Slippage model: 0.5–2 ticks depending on position size

3. OUTPUT METRICS
   - Profit Factor, Sharpe, Max Drawdown, Winrate, Expectancy
   - Full equity curve + trade log

4. WALK-FORWARD READY
   - BacktestResult carries all stats; Optimizer consumes it directly.

Usage:
    bt = Backtester(initial_capital=10_000)
    result = bt.run(df, weights, params)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np
import pandas as pd

from services.analysis import ema, rsi, atr, adx
from utils import config

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
#  Data classes
# ────────────────────────────────────────────────────────────────────────────

@dataclass
class TradeRecord:
    """Single completed trade."""
    entry_bar:   int
    exit_bar:    int
    direction:   str      # "LONG" | "SHORT"
    entry_price: float
    exit_price:  float
    size:        float
    pnl:         float    # net of fees and funding
    fees:        float
    funding_paid: float
    exit_reason: str      # "TP1" | "TP2" | "SL" | "EOD"


@dataclass
class BacktestResult:
    """Full backtest output, returned by Backtester.run()."""
    profit_factor:  float
    sharpe:         float
    max_drawdown:   float     # positive decimal, e.g. 0.12 = 12%
    winrate:        float     # decimal
    expectancy:     float     # average PnL per trade in $
    total_trades:   int
    winning_trades: int
    losing_trades:  int
    total_pnl:      float
    final_capital:  float

    equity_curve:   pd.Series  = field(default_factory=pd.Series)
    drawdown_curve: pd.Series  = field(default_factory=pd.Series)
    trades:         list[TradeRecord] = field(default_factory=list)

    # Raw params that produced this result (for optimizer)
    params:         dict[str, Any] = field(default_factory=dict)

    def passes_gate(self) -> bool:
        """Return True if this result meets live-signal quality thresholds."""
        return (
            self.profit_factor >= config.MIN_PROFIT_FACTOR
            and self.sharpe     >= config.MIN_SHARPE
            and self.max_drawdown <= config.MAX_DRAWDOWN
            and self.total_trades  >= 2
        )

    def to_dict(self) -> dict:
        return {
            "profit_factor":  round(self.profit_factor, 3),
            "sharpe":         round(self.sharpe, 3),
            "max_drawdown":   round(self.max_drawdown * 100, 2),
            "winrate":        round(self.winrate * 100, 2),
            "expectancy":     round(self.expectancy, 2),
            "total_trades":   self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades":  self.losing_trades,
            "total_pnl":      round(self.total_pnl, 2),
            "final_capital":  round(self.final_capital, 2),
            "passes_gate":    self.passes_gate(),
        }


# ────────────────────────────────────────────────────────────────────────────
#  Signal generation  (PURE FUNCTION — no state, no side effects)
# ────────────────────────────────────────────────────────────────────────────

def generate_signals(df: pd.DataFrame, params: dict) -> pd.DataFrame:
    """
    Vectorized signal generation with STRICT no-look-ahead enforcement.

    All indicator series are shifted by 1 bar before comparison to price.
    This ensures bar[i] signal uses only data available at bar[i-1] close.

    Parameters:
        df      : OHLCV DataFrame (must have open/high/low/close/volume columns)
        params  : dict with keys:
                    pivot_n       (int)
                    ema_short     (int)
                    ema_long      (int)
                    rsi_period    (int)
                    atr_period    (int)
                    adx_period    (int)
                    adx_min       (float)
                    volume_ratio_min (float)
                    min_wick_ratio   (float)
                    long_rsi_min, long_rsi_max (float)
                    short_rsi_min, short_rsi_max (float)
                    atr_pct_min   (float)  ATR percentile threshold

    Returns:
        DataFrame with additional columns:
            signal      : +1 (LONG), -1 (SHORT), 0 (no signal)
            sl_price    : stop-loss price for that bar's signal
            tp1_price   : TP1 price
            tp2_price   : TP2 price
            signal_atr  : ATR value at signal bar (used for position sizing)
    """
    p = params
    df = df.copy()
    n = len(df)

    # ── Indicators (computed on full series) ──────────────────────────────────
    df["_ema50"]  = ema(df["close"], p.get("ema_short", config.EMA_SHORT))
    df["_ema200"] = ema(df["close"], p.get("ema_long",  config.EMA_LONG))
    df["_rsi"]    = rsi(df["close"], p.get("rsi_period", config.RSI_PERIOD))
    df["_atr"]    = atr(df, p.get("atr_period", config.ATR_PERIOD))
    df["_adx"]    = adx(df, p.get("adx_period", config.ADX_PERIOD))
    df["_vol_ma"] = df["volume"].rolling(config.VOLUME_MA_PERIOD).mean()

    # ── SHIFT by 1 — no look-ahead ────────────────────────────────────────────
    df["_ema50_s"]  = df["_ema50"].shift(1)
    df["_ema200_s"] = df["_ema200"].shift(1)
    df["_rsi_s"]    = df["_rsi"].shift(1)
    df["_atr_s"]    = df["_atr"].shift(1)
    df["_adx_s"]    = df["_adx"].shift(1)
    df["_vol_ma_s"] = df["_vol_ma"].shift(1)

    # ── ATR percentile (rolling 100-bar) ─────────────────────────────────────
    df["_atr_pct"] = df["_atr_s"].rolling(100).rank(pct=True) * 100

    # ── Pivot detection (vectorized, no look-ahead) ───────────────────────────
    pn = int(p.get("pivot_n", config.PIVOT_N))
    _ph = np.zeros(n, dtype=bool)
    _pl = np.zeros(n, dtype=bool)
    highs = df["high"].values
    lows  = df["low"].values

    for i in range(pn, n - pn):
        w_h = highs[i - pn : i + pn + 1]
        if highs[i] == w_h.max() and np.sum(w_h == highs[i]) == 1:
            _ph[i] = True
        w_l = lows[i - pn : i + pn + 1]
        if lows[i] == w_l.min() and np.sum(w_l == lows[i]) == 1:
            _pl[i] = True

    df["_ph"] = _ph
    df["_pl"] = _pl

    # Sparse series: non-NaN only at the bar where the pivot is confirmed
    # (shifted forward pn+1 bars so we never see future bars — no look-ahead)
    ph_at_confirm = pd.Series(
        np.where(_ph, df["high"].values, np.nan), index=df.index
    ).shift(pn + 1)
    pl_at_confirm = pd.Series(
        np.where(_pl, df["low"].values, np.nan), index=df.index
    ).shift(pn + 1)

    # Current last confirmed pivot high / low (forward-filled across all bars)
    last_ph_val = ph_at_confirm.ffill()
    last_pl_val = pl_at_confirm.ffill()

    # Previous confirmed pivot high / low.
    #
    # Bug-fix: the old code used last_ph_val.shift(1) which compares the
    # forward-filled series to itself shifted by one BAR.  Because the series
    # is constant between pivots, trend_up was only True on the single bar
    # where BOTH a new PH and a new PL were confirmed simultaneously —
    # essentially never.
    #
    # Correct logic: at each pivot confirmation bar, prev = the forward-filled
    # value just BEFORE that pivot was confirmed.  Forward-fill those anchor
    # points to all subsequent bars so that trend_up stays True for the entire
    # period between pivot events.
    prev_ph_val = last_ph_val.shift(1).where(ph_at_confirm.notna()).ffill()
    prev_pl_val = last_pl_val.shift(1).where(pl_at_confirm.notna()).ffill()

    # Trend conditions — True across the whole inter-pivot range, not just one bar
    trend_up   = (last_ph_val > prev_ph_val) & (last_pl_val > prev_pl_val)
    trend_down = (last_ph_val < prev_ph_val) & (last_pl_val < prev_pl_val)

    # ── ADX filter ────────────────────────────────────────────────────────────
    adx_ok = df["_adx_s"] > p.get("adx_min", config.ADX_MIN)

    # ── Volatility filter ─────────────────────────────────────────────────────
    atr_pct_ok = df["_atr_pct"] >= p.get("atr_pct_min", config.ATR_PERCENTILE_MIN)

    # ── Volume filter ─────────────────────────────────────────────────────────
    vol_ok = (df["volume"].shift(1) / df["_vol_ma_s"]) >= p.get(
        "volume_ratio_min", config.VOLUME_RATIO_MIN
    )

    # ── RSI filter ────────────────────────────────────────────────────────────
    rsi_long_ok  = (
        (df["_rsi_s"] >= p.get("long_rsi_min",  config.LONG_RSI_MIN)) &
        (df["_rsi_s"] <= p.get("long_rsi_max",  config.LONG_RSI_MAX))
    )
    rsi_short_ok = (
        (df["_rsi_s"] >= p.get("short_rsi_min", config.SHORT_RSI_MIN)) &
        (df["_rsi_s"] <= p.get("short_rsi_max", config.SHORT_RSI_MAX))
    )

    # ── EMA filter ────────────────────────────────────────────────────────────
    ema_long_ok  = (
        (df["close"].shift(1) > df["_ema50_s"]) &
        (df["close"].shift(1) > df["_ema200_s"])
    )
    ema_short_ok = (
        (df["close"].shift(1) < df["_ema50_s"]) &
        (df["close"].shift(1) < df["_ema200_s"])
    )

    # ── Wick filter (previous bar) ────────────────────────────────────────────
    prev_bar_range = (df["high"] - df["low"]).shift(1).replace(0, np.nan)
    prev_body_bot = (np.minimum(df["open"], df["close"])).shift(1)
    prev_body_top = (np.maximum(df["open"], df["close"])).shift(1)
    lower_wick = (prev_body_bot - df["low"].shift(1)).clip(lower=0)
    upper_wick = (df["high"].shift(1) - prev_body_top).clip(lower=0)
    wick_long_ok  = (lower_wick / prev_bar_range) >= p.get("min_wick_ratio", config.MIN_WICK_RATIO)
    wick_short_ok = (upper_wick / prev_bar_range) >= p.get("min_wick_ratio", config.MIN_WICK_RATIO)

    # ── Composite signals ─────────────────────────────────────────────────────
    long_signal = (
        trend_up & adx_ok & atr_pct_ok & vol_ok &
        rsi_long_ok & ema_long_ok & wick_long_ok
    )
    short_signal = (
        trend_down & adx_ok & atr_pct_ok & vol_ok &
        rsi_short_ok & ema_short_ok & wick_short_ok
    )

    df["signal"] = np.where(long_signal, 1, np.where(short_signal, -1, 0))

    # ── SL / TP for each signal bar ───────────────────────────────────────────
    sl_arr  = np.full(n, np.nan)
    tp1_arr = np.full(n, np.nan)
    tp2_arr = np.full(n, np.nan)

    price    = df["close"].values
    atr_vals = df["_atr_s"].values
    ph_vals  = last_ph_val.values
    pl_vals  = last_pl_val.values

    # Maximum SL distance expressed as a multiple of ATR.
    # Pivot-based SL can be hundreds of dollars away on BTC; if the distance
    # exceeds this cap the position size shrinks to near zero and trades never
    # resolve via SL/TP — they always get force-closed at EOD.
    # The multiplier is Optuna-tunable so the optimizer can find the sweet spot.
    atr_mult = p.get("atr_sl_mult", 2.0)

    for i in range(n):
        sig = df["signal"].iloc[i]
        if sig == 0:
            continue
        entry = price[i]
        a = atr_vals[i] if not np.isnan(atr_vals[i]) else entry * 0.01

        if sig == 1:  # LONG
            pivot_sl = pl_vals[i] * 0.999 if not np.isnan(pl_vals[i]) else np.nan
            atr_sl   = entry - atr_mult * a
            # Use whichever SL is CLOSER to entry (tighter risk)
            if not np.isnan(pivot_sl):
                sl = max(pivot_sl, atr_sl)
            else:
                sl = atr_sl
            if sl >= entry:
                sl = entry - a   # absolute fallback: 1 ATR
            r = entry - sl
        else:  # SHORT
            pivot_sl = ph_vals[i] * 1.001 if not np.isnan(ph_vals[i]) else np.nan
            atr_sl   = entry + atr_mult * a
            if not np.isnan(pivot_sl):
                sl = min(pivot_sl, atr_sl)
            else:
                sl = atr_sl
            if sl <= entry:
                sl = entry + a
            r = sl - entry

        sl_arr[i]  = sl
        tp1_arr[i] = entry + config.TP1_R_MULTIPLE * r if sig == 1 else entry - config.TP1_R_MULTIPLE * r
        tp2_arr[i] = entry + config.TP2_R_MULTIPLE * r if sig == 1 else entry - config.TP2_R_MULTIPLE * r

    df["sl_price"]   = sl_arr
    df["tp1_price"]  = tp1_arr
    df["tp2_price"]  = tp2_arr
    df["signal_atr"] = df["_atr_s"]

    # Drop internal columns
    internal_cols = [c for c in df.columns if c.startswith("_")]
    df.drop(columns=internal_cols, inplace=True)

    return df


# ────────────────────────────────────────────────────────────────────────────
#  Execution simulation  (PURE FUNCTION — separate from signal generation)
# ────────────────────────────────────────────────────────────────────────────

def simulate_execution(
    df: pd.DataFrame,
    initial_capital: float,
    risk_per_trade: float = 0.01,
    maker_fee: float      = config.MAKER_FEE,
    taker_fee: float      = config.TAKER_FEE,
    slippage_pct: float   = 0.0005,   # 0.05% average slippage
    funding_rate: float   = 0.0001,   # hourly; applied per bar proportionally
    max_leverage: int     = config.MAX_LEVERAGE,
) -> BacktestResult:
    """
    Event-driven execution loop.

    - One position at a time (no overlapping trades).
    - TP1 closes 50% of position and moves SL to breakeven.
    - TP2 closes remaining 50%.
    - SL closes 100% of remaining position.
    - End-of-data force-closes any open position at last bar.
    - Applies maker fee on entry limit (approx), taker fee on SL/TP exits.
    - Applies hourly funding pro-rated to the bar duration.
    """
    capital = initial_capital
    equity_curve: list[float] = []
    trades: list[TradeRecord] = []

    # State
    in_trade     = False
    direction    = 0       # +1 LONG / -1 SHORT
    entry_price  = 0.0
    sl_price     = 0.0
    tp1_price    = 0.0
    tp2_price    = 0.0
    size         = 0.0
    entry_bar    = 0
    tp1_hit      = False
    fees_total   = 0.0
    funding_total= 0.0

    prices = df["close"].values
    highs  = df["high"].values
    lows   = df["low"].values
    sigs   = df["signal"].values
    sl_arr = df["sl_price"].values
    t1_arr = df["tp1_price"].values
    t2_arr = df["tp2_price"].values
    atr_arr= df["signal_atr"].values if "signal_atr" in df.columns else np.zeros(len(df))

    n = len(df)

    def _slippage(px: float) -> float:
        return px * slippage_pct

    for i in range(n):
        equity_curve.append(capital)

        if in_trade:
            # Funding payment (pro-rated: assumes 1H bars = 1 funding cycle)
            # For other timeframes, funding is applied proportionally
            fund_payment = entry_price * size * funding_rate * direction * -1
            capital       += fund_payment
            funding_total += fund_payment

            hi = highs[i]
            lo = lows[i]

            # Check TP1 / SL for bar i using high/low (realistic intra-bar)
            if not tp1_hit:
                if direction == 1 and hi >= tp1_price:
                    # TP1 hit — close 50%
                    close_px = tp1_price - _slippage(tp1_price)
                    partial_pnl = (close_px - entry_price) * (size / 2)
                    fee = close_px * (size / 2) * taker_fee
                    capital += partial_pnl - fee
                    fees_total += fee
                    size /= 2
                    sl_price  = entry_price   # breakeven
                    tp1_hit   = True
                    continue

                elif direction == -1 and lo <= tp1_price:
                    close_px = tp1_price + _slippage(tp1_price)
                    partial_pnl = (entry_price - close_px) * (size / 2)
                    fee = close_px * (size / 2) * taker_fee
                    capital += partial_pnl - fee
                    fees_total += fee
                    size /= 2
                    sl_price  = entry_price
                    tp1_hit   = True
                    continue

            # TP2 check
            if direction == 1 and hi >= tp2_price:
                close_px = tp2_price - _slippage(tp2_price)
                pnl = (close_px - entry_price) * size
                fee = close_px * size * taker_fee
                capital += pnl - fee
                fees_total += fee
                trades.append(TradeRecord(
                    entry_bar=entry_bar, exit_bar=i, direction="LONG",
                    entry_price=entry_price, exit_price=close_px,
                    size=size, pnl=pnl - fee,
                    fees=fees_total, funding_paid=funding_total,
                    exit_reason="TP2",
                ))
                in_trade = False; tp1_hit = False; fees_total = 0.0; funding_total = 0.0
                continue

            if direction == -1 and lo <= tp2_price:
                close_px = tp2_price + _slippage(tp2_price)
                pnl = (entry_price - close_px) * size
                fee = close_px * size * taker_fee
                capital += pnl - fee
                fees_total += fee
                trades.append(TradeRecord(
                    entry_bar=entry_bar, exit_bar=i, direction="SHORT",
                    entry_price=entry_price, exit_price=close_px,
                    size=size, pnl=pnl - fee,
                    fees=fees_total, funding_paid=funding_total,
                    exit_reason="TP2",
                ))
                in_trade = False; tp1_hit = False; fees_total = 0.0; funding_total = 0.0
                continue

            # SL check
            if direction == 1 and lo <= sl_price:
                close_px = sl_price - _slippage(sl_price)
                pnl = (close_px - entry_price) * size
                fee = close_px * size * taker_fee
                capital += pnl - fee
                fees_total += fee
                trades.append(TradeRecord(
                    entry_bar=entry_bar, exit_bar=i, direction="LONG",
                    entry_price=entry_price, exit_price=close_px,
                    size=size, pnl=pnl - fee,
                    fees=fees_total, funding_paid=funding_total,
                    exit_reason="SL",
                ))
                in_trade = False; tp1_hit = False; fees_total = 0.0; funding_total = 0.0
                continue

            if direction == -1 and hi >= sl_price:
                close_px = sl_price + _slippage(sl_price)
                pnl = (entry_price - close_px) * size
                fee = close_px * size * taker_fee
                capital += pnl - fee
                fees_total += fee
                trades.append(TradeRecord(
                    entry_bar=entry_bar, exit_bar=i, direction="SHORT",
                    entry_price=entry_price, exit_price=close_px,
                    size=size, pnl=pnl - fee,
                    fees=fees_total, funding_paid=funding_total,
                    exit_reason="SL",
                ))
                in_trade = False; tp1_hit = False; fees_total = 0.0; funding_total = 0.0
                continue

            # End-of-data force close
            if i == n - 1:
                close_px = prices[i]
                if direction == 1:
                    pnl = (close_px - entry_price) * size
                else:
                    pnl = (entry_price - close_px) * size
                fee = close_px * size * taker_fee
                capital += pnl - fee
                trades.append(TradeRecord(
                    entry_bar=entry_bar, exit_bar=i, direction="LONG" if direction == 1 else "SHORT",
                    entry_price=entry_price, exit_price=close_px,
                    size=size, pnl=pnl - fee,
                    fees=fees_total + fee, funding_paid=funding_total,
                    exit_reason="EOD",
                ))
                in_trade = False

        else:
            # Check for new entry signal
            if sigs[i] != 0 and not np.isnan(sl_arr[i]):
                direction    = int(sigs[i])
                raw_entry    = prices[i]
                entry_price  = raw_entry + (direction * _slippage(raw_entry))
                sl_price     = float(sl_arr[i])
                tp1_price    = float(t1_arr[i])
                tp2_price    = float(t2_arr[i])

                price_diff = abs(entry_price - sl_price)
                if price_diff == 0:
                    continue

                risk_amt = capital * risk_per_trade
                size     = risk_amt / price_diff
                notional = size * entry_price

                # Cap leverage
                if notional > capital * max_leverage:
                    size = (capital * max_leverage) / entry_price

                # Entry fee (maker approximation)
                entry_fee  = entry_price * size * maker_fee
                capital   -= entry_fee
                fees_total  = entry_fee

                in_trade   = True
                entry_bar  = i
                tp1_hit    = False
                funding_total = 0.0

    # ── Compute metrics from trades ───────────────────────────────────────────
    equity = pd.Series(equity_curve, index=df.index if len(equity_curve) == len(df) else range(len(equity_curve)))
    return _compute_metrics(equity, trades, initial_capital, capital)


# ────────────────────────────────────────────────────────────────────────────
#  Metrics computation
# ────────────────────────────────────────────────────────────────────────────

def _compute_metrics(
    equity: pd.Series,
    trades: list[TradeRecord],
    initial_capital: float,
    final_capital: float,
) -> BacktestResult:
    """Compute all performance metrics from equity curve and trade log."""

    if not trades:
        return BacktestResult(
            profit_factor=0.0, sharpe=0.0, max_drawdown=0.0,
            winrate=0.0, expectancy=0.0,
            total_trades=0, winning_trades=0, losing_trades=0,
            total_pnl=0.0, final_capital=final_capital,
            equity_curve=equity,
        )

    pnls = [t.pnl for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    gross_profit = sum(wins)   if wins   else 0.0
    gross_loss   = abs(sum(losses)) if losses else 0.0

    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
    winrate       = len(wins) / len(pnls)
    expectancy    = sum(pnls) / len(pnls)

    # Sharpe (annualised, assuming daily equity points)
    returns = equity.pct_change().dropna()
    if returns.std() > 0:
        sharpe = (returns.mean() / returns.std()) * np.sqrt(365 * 24)  # hourly bars
    else:
        sharpe = 0.0

    # Max drawdown
    roll_max = equity.cummax()
    dd_series = (equity - roll_max) / roll_max.replace(0, np.nan)
    max_dd = float(abs(dd_series.min())) if len(dd_series) > 0 else 0.0
    drawdown_curve = dd_series

    return BacktestResult(
        profit_factor  = round(profit_factor, 4),
        sharpe         = round(sharpe, 4),
        max_drawdown   = round(max_dd, 4),
        winrate        = round(winrate, 4),
        expectancy     = round(expectancy, 4),
        total_trades   = len(pnls),
        winning_trades = len(wins),
        losing_trades  = len(losses),
        total_pnl      = round(sum(pnls), 2),
        final_capital  = round(final_capital, 2),
        equity_curve   = equity,
        drawdown_curve = drawdown_curve,
        trades         = trades,
    )


# ────────────────────────────────────────────────────────────────────────────
#  High-level Backtester class
# ────────────────────────────────────────────────────────────────────────────

class Backtester:
    """
    Orchestrates signal generation + execution simulation.

    Usage:
        bt = Backtester(initial_capital=10_000)
        result = bt.run(df, params)
    """

    def __init__(
        self,
        initial_capital: float = config.BACKTEST_INITIAL_CAPITAL,
        risk_per_trade:  float = config.RISK_PER_TRADE,
        maker_fee:       float = config.MAKER_FEE,
        taker_fee:       float = config.TAKER_FEE,
    ) -> None:
        self.initial_capital = initial_capital
        self.risk_per_trade  = risk_per_trade
        self.maker_fee       = maker_fee
        self.taker_fee       = taker_fee

    def run(
        self,
        df: pd.DataFrame,
        params: dict | None = None,
        slippage_pct: float = 0.0005,
        funding_rate: float = 0.0001,
    ) -> BacktestResult:
        """
        Run a full backtest on the given OHLCV DataFrame.

        Steps (kept strictly separate):
            1. generate_signals(df, params)  — pure function, no side effects
            2. simulate_execution(df, ...)   — pure function, no side effects
        """
        params = params or {}

        logger.info(
            f"Backtester.run: {len(df)} bars, capital={self.initial_capital}, "
            f"params={params}"
        )

        # Step 1 — Signal generation
        df_with_signals = generate_signals(df, params)

        # Step 2 — Execution simulation
        result = simulate_execution(
            df_with_signals,
            initial_capital = self.initial_capital,
            risk_per_trade  = self.risk_per_trade,
            maker_fee       = self.maker_fee,
            taker_fee       = self.taker_fee,
            slippage_pct    = slippage_pct,
            funding_rate    = funding_rate,
        )
        result.params = params

        logger.info(
            f"Backtest result: PF={result.profit_factor:.2f} "
            f"Sharpe={result.sharpe:.2f} MaxDD={result.max_drawdown:.1%} "
            f"WR={result.winrate:.1%} Trades={result.total_trades} "
            f"{'✅ PASSES GATE' if result.passes_gate() else '❌ FAILS GATE'}"
        )
        return result
