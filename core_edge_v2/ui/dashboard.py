# -*- coding: utf-8 -*-
"""
CORE EDGE v2 — Streamlit Dashboard
====================================
Five tabs:
  1. Live Dashboard   — signals, open positions, PnL, funding
  2. Backtest & Opt   — run backtest, Optuna optimisation, full metrics + charts
  3. Strategy Config  — edit parameters, optimise weights
  4. Performance      — equity curve, monthly returns, trade log
  5. Paper Trading    — toggle + paper position tracker

Dark mode + professional CSS applied globally.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

# ── Page config (MUST be first Streamlit call) ────────────────────────────────
st.set_page_config(
    page_title="CORE EDGE v2",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Imports after page config ─────────────────────────────────────────────────
from services.analysis import AnalysisEngine
from services.backtester import Backtester
from services.execution import ExecutionService
from services.market_data import MarketDataService
from services.optimizer import WalkForwardOptimizer, load_wfo_results, is_live_enabled
from services.risk_manager import RiskManager
from services.scoring import ScoringEngine
from utils import config

logger = logging.getLogger(__name__)

# Assets scanned every cycle — independent of backtest config so it's always
# explicit. Add / remove coins here without touching any other file.
SCANNER_ASSETS = [
    "BTC", "ETH", "SOL", "AVAX", "DOGE",
    "WIF", "HYPE", "ARB", "OP", "SUI",
]

# ─────────────────────────────────────────────────────────────────────────────
#  Custom CSS — dark professional theme
# ─────────────────────────────────────────────────────────────────────────────

DARK_CSS = """
<style>
/* Global dark background */
[data-testid="stAppViewContainer"] { background-color: #0d1117; }
[data-testid="stSidebar"]          { background-color: #161b22; }
[data-testid="stHeader"]           { background-color: #0d1117; }

/* Typography */
html, body, [class*="css"] { color: #c9d1d9; font-family: 'Inter', sans-serif; }
h1, h2, h3 { color: #f0f6fc; }

/* Metric cards */
[data-testid="metric-container"] {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 12px;
}
[data-testid="stMetricValue"] { color: #58a6ff; font-size: 1.4rem; }
[data-testid="stMetricLabel"] { color: #8b949e; }

/* Buttons */
.stButton > button {
    background: linear-gradient(135deg, #1f6feb, #388bfd);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    padding: 0.5rem 1.2rem;
    transition: all 0.2s;
}
.stButton > button:hover { opacity: 0.85; transform: translateY(-1px); }

/* Danger button */
.danger-btn > button { background: linear-gradient(135deg, #b91c1c, #dc2626) !important; }

/* Tabs */
.stTabs [data-baseweb="tab-list"] { border-bottom: 2px solid #21262d; }
.stTabs [data-baseweb="tab"] {
    background: transparent;
    color: #8b949e;
    font-weight: 500;
    border-radius: 6px 6px 0 0;
}
.stTabs [aria-selected="true"] { color: #58a6ff !important; border-bottom: 2px solid #58a6ff; }

/* DataFrames */
[data-testid="stDataFrame"] { border: 1px solid #30363d; border-radius: 6px; }

/* Info boxes */
.info-box {
    background: #161b22;
    border: 1px solid #30363d;
    border-left: 4px solid #58a6ff;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 8px 0;
}
.warning-box {
    border-left-color: #d29922 !important;
}
.success-box {
    border-left-color: #3fb950 !important;
}
.danger-box {
    border-left-color: #f85149 !important;
}

/* Signal cards */
.signal-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 16px;
    margin: 8px 0;
}
.signal-long  { border-left: 4px solid #3fb950; }
.signal-short { border-left: 4px solid #f85149; }

/* Score badge */
.score-high   { color: #3fb950; font-weight: 700; font-size: 1.1rem; }
.score-medium { color: #d29922; font-weight: 700; font-size: 1.1rem; }
.score-low    { color: #f85149; font-weight: 700; font-size: 1.1rem; }

/* Mode badge */
.paper-badge { background: #d2992230; color: #d29922; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
.live-badge  { background: #f8514930; color: #f85149; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
</style>
"""

st.markdown(DARK_CSS, unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
#  Shared session state initialisation
# ─────────────────────────────────────────────────────────────────────────────

def _init_state() -> None:
    defaults = {
        "paper_mode":       config.PAPER_TRADING,
        "signals":          [],
        "last_scan":        None,
        "backtest_result":  None,
        "wfo_result":       None,
        "exec_service":     None,
        "scan_running":     False,
        "bt_running":       False,
        "opt_running":      False,
        # Gate status kept in session_state so it survives client-side tab switches
        # (tab switching does not trigger a Python rerun in Streamlit).
        "live_gate":        is_live_enabled(),
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


def _get_exec_service() -> ExecutionService:
    """Lazily initialise ExecutionService (singleton per session)."""
    if st.session_state.exec_service is None:
        st.session_state.exec_service = ExecutionService(
            paper_mode=st.session_state.paper_mode
        )
    return st.session_state.exec_service


# ─────────────────────────────────────────────────────────────────────────────
#  Sidebar
# ─────────────────────────────────────────────────────────────────────────────

def _render_sidebar() -> None:
    with st.sidebar:
        st.markdown("## ⚡ CORE EDGE v2")

        mode = st.session_state.paper_mode
        badge = '<span class="paper-badge">PAPER</span>' if mode else '<span class="live-badge">LIVE</span>'
        st.markdown(f"**Mode:** {badge}", unsafe_allow_html=True)

        st.divider()
        st.markdown("### Trading Mode")

        if st.toggle("Paper Trading", value=mode, key="paper_toggle"):
            if not st.session_state.paper_mode:
                st.session_state.paper_mode = True
                st.session_state.exec_service = None
                st.rerun()
        else:
            if st.session_state.paper_mode:
                st.warning(
                    "**WARNING**: Switching to live mode will place REAL orders "
                    "using your Hyperliquid credentials."
                )
                if st.button("Confirm Live Mode", type="primary"):
                    st.session_state.paper_mode = False
                    st.session_state.exec_service = None
                    st.rerun()

        st.divider()

        # Live signal gate status — read from session_state, not directly from
        # disk, because Streamlit tab switches are client-side and do not
        # trigger a Python rerun (so is_live_enabled() would return stale data).
        live_ok = st.session_state.get("live_gate", False)
        if live_ok:
            st.success("Signal gate: OPEN (WFO passed)")
        else:
            st.warning("Signal gate: CLOSED (Run backtest first)")

        st.divider()

        st.markdown("### Assets")
        for a in config.ASSETS:
            st.text(f"• {a}")

        st.markdown("### Timeframes")
        for tf in config.TIMEFRAMES:
            st.text(f"• {tf}")

        st.divider()
        st.caption("v2.0 | Hyperliquid Perps | 2026")


# ─────────────────────────────────────────────────────────────────────────────
#  Tab 1: Live Dashboard
# ─────────────────────────────────────────────────────────────────────────────

def _tab_live() -> None:
    st.markdown("## Live Dashboard")

    exec_svc = _get_exec_service()

    # ── Risk stats row ────────────────────────────────────────────────────────
    stats = exec_svc.get_risk_stats()

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Capital",     f"${stats['session_capital']:,.2f}")
    c2.metric("Total PnL",   f"${stats['total_pnl']:+,.2f}")
    c3.metric("Day PnL",     f"{stats['day_pnl_pct']:+.2f}%",  delta_color="normal")
    c4.metric("Week PnL",    f"{stats['week_pnl_pct']:+.2f}%", delta_color="normal")
    c5.metric("Trades",      str(stats["trade_count"]))

    if stats["is_paused"]:
        st.markdown(
            f'<div class="info-box danger-box">🛑 <b>Bot Paused</b>: {stats["pause_reason"]}</div>',
            unsafe_allow_html=True,
        )
        if st.button("Resume Trading"):
            exec_svc._risk_manager.resume()
            st.rerun()

    st.divider()

    # ── Scan controls ─────────────────────────────────────────────────────────
    col_a, col_b, col_c = st.columns([2, 2, 6])
    with col_a:
        if st.button("Scan Markets", type="primary"):
            _run_market_scan(exec_svc)
    with col_b:
        auto = st.toggle("Auto-scan (60s)", value=False, key="autoscan")

    if st.session_state.last_scan:
        st.caption(f"Last scan: {st.session_state.last_scan}")

    # Auto-scan
    if auto:
        time.sleep(config.POLLING_INTERVAL)
        _run_market_scan(exec_svc)
        st.rerun()

    # ── Signals ───────────────────────────────────────────────────────────────
    signals = st.session_state.signals
    st.markdown(f"### Signals ({len(signals)})")

    if not signals:
        st.info("No signals yet — click **Scan Markets** to detect setups.")
    else:
        # ── Compact summary table ─────────────────────────────────────────
        rows = []
        for s in signals:
            direction_arrow = "▲ LONG" if s.direction.value == "LONG" else "▼ SHORT"
            tfs_str = ", ".join(s.confirmed_timeframes) if s.confirmed_timeframes else s.timeframe
            rows.append({
                "Asset":     s.asset,
                "Direction": direction_arrow,
                "TF":        tfs_str,
                "Score":     s.score,
                "Entry":     f"{s.entry:.4f}",
                "SL":        f"{s.stop_loss:.4f}",
                "TP1":       f"{s.tp1:.4f}",
                "TP2":       f"{s.tp2:.4f}",
                "R/R":       f"{s.rr_ratio:.1f}x",
                "ADX":       f"{s.adx_value:.0f}" if s.adx_value else "—",
                "Multi-TF":  "✅" if s.multi_tf_confirmed else "—",
            })
        st.dataframe(
            pd.DataFrame(rows),
            use_container_width=True,
            hide_index=True,
        )

        # ── Detailed cards with execute buttons ───────────────────────────
        st.markdown("#### Execute")
        for sig in signals:
            _render_signal_card(sig, exec_svc)

    st.divider()

    # ── Open positions ────────────────────────────────────────────────────────
    st.markdown("### Open Positions")
    positions_df = exec_svc.get_positions_df()

    if positions_df.empty:
        st.info("No open positions.")
    else:
        active = positions_df[positions_df["status"].isin(["OPEN", "TP1_HIT"])]
        if active.empty:
            st.info("No active positions.")
        else:
            display_cols = [
                "asset", "direction", "entry_price", "current_sl",
                "tp1", "tp2", "remaining_size", "status",
                "realised_pnl", "unrealised_pnl", "breakeven",
            ]
            available = [c for c in display_cols if c in active.columns]
            st.dataframe(active[available], use_container_width=True)

            with st.expander("Emergency Controls"):
                st.error("These actions cannot be undone.")
                if st.button("Close ALL Positions", key="close_all"):
                    exec_svc.close_all_positions()
                    st.success("All positions closed.")
                    st.rerun()

    # ── Funding rates ─────────────────────────────────────────────────────────
    st.divider()
    st.markdown("### Funding Rates")
    mds = MarketDataService()

    fund_data = []
    for asset in config.ASSETS:
        rate = mds.get_funding_rate(asset)
        if rate is not None:
            flag = ""
            if rate > config.FUNDING_LONG_MAX:
                flag = "⚠️ High (avoid longs)"
            elif rate < config.FUNDING_SHORT_MIN:
                flag = "⚠️ Low (avoid shorts)"
            fund_data.append({"Asset": asset, "Rate/h": f"{rate:.4%}", "Note": flag})

    if fund_data:
        st.dataframe(pd.DataFrame(fund_data), use_container_width=True, hide_index=True)


def _run_market_scan(exec_svc: ExecutionService) -> None:
    """
    Sequential multi-asset scanner.

    Uses a single shared MarketDataService for all assets (shared connection
    + cache).  Assets are fetched one at a time with a 0.5 s inter-asset
    delay to stay within Hyperliquid's rate limits.  429 responses are caught
    in MarketDataService._fetch_candles with exponential backoff (5 s, 10 s,
    20 s) before the next attempt.
    """
    with st.spinner(f"Scanning {len(SCANNER_ASSETS)} assets across {len(config.TIMEFRAMES)} timeframes..."):
        tfs   = config.TIMEFRAMES
        limit = config.CANDLE_LIVE_LIMIT

        # ── 1. Single shared MDS — sequential fetch with inter-asset delay ────
        mds  = MarketDataService()
        data: dict = {}

        for asset in SCANNER_ASSETS:
            asset_data: dict = {}
            for tf in tfs:
                try:
                    df = mds._fetch_candles(asset, tf, limit)
                    if df is not None and len(df) >= 50:
                        asset_data[tf] = df
                except Exception as exc:
                    logger.warning("scan fetch %s %s: %s", asset, tf, exc)
            if asset_data:
                data[asset] = asset_data
            time.sleep(0.5)   # 0.5 s between assets to avoid 429s

        if not data:
            st.error("No market data returned — check API connectivity.")
            return

        # ── 2. Funding rates ──────────────────────────────────────────────────
        funding = {a: mds.get_funding_rate(a) or 0.0 for a in SCANNER_ASSETS}

        # ── 3. Analysis — all TF signals, no multi-TF gate ───────────────────
        engine = AnalysisEngine()
        scorer = ScoringEngine()

        raw     = engine.analyze_all(data, funding_rates=funding, require_multi_tf=False)
        signals = scorer.score_signals(raw, min_score=60)

        # ── 4. Gate check ─────────────────────────────────────────────────────
        if not st.session_state.paper_mode and not st.session_state.get("live_gate", False):
            signals = []
            st.warning("Live signals blocked: run and pass walk-forward optimisation first.")

        st.session_state.signals   = signals
        st.session_state.last_scan = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")

    n_assets_hit = len({s.asset for s in signals})
    st.success(
        f"Scan complete — **{len(signals)} signal(s)** across "
        f"**{n_assets_hit}/{len(data)} assets** "
        f"({len(data)} fetched successfully)"
    )


def _render_signal_card(sig: Any, exec_svc: ExecutionService) -> None:
    """Render a single signal card with execute button."""
    direction_class = "signal-long" if sig.direction.value == "LONG" else "signal-short"
    color = "#3fb950" if sig.direction.value == "LONG" else "#f85149"
    score_class = "score-high" if sig.score >= 80 else ("score-medium" if sig.score >= 70 else "score-low")

    tf_str = ", ".join(sig.confirmed_timeframes) if sig.confirmed_timeframes else sig.timeframe
    multi_badge = "✅ Multi-TF" if sig.multi_tf_confirmed else "⚠️ Single TF"

    with st.container():
        st.markdown(
            f"""
            <div class="signal-card {direction_class}">
            <b style="color:{color}; font-size:1.1rem">
                {sig.direction.value} {sig.asset}
            </b>
            &nbsp;&nbsp;
            <span class="{score_class}">{sig.score}/100</span>
            &nbsp;&nbsp;{multi_badge}
            &nbsp;&nbsp;<span style="color:#8b949e">{tf_str}</span>
            <br>
            <span style="color:#8b949e; font-size:0.85rem">
                Entry: <b style="color:#c9d1d9">{sig.entry:.4f}</b>
                &nbsp; SL: <b style="color:#f85149">{sig.stop_loss:.4f}</b>
                &nbsp; TP1: <b style="color:#d29922">{sig.tp1:.4f}</b>
                &nbsp; TP2: <b style="color:#3fb950">{sig.tp2:.4f}</b>
                &nbsp; R/R: {sig.rr_ratio:.1f}
            </span>
            <br>
            <span style="color:#8b949e; font-size:0.8rem">
                ADX: {sig.adx_value or 'N/A'}
                &nbsp; ATR%: {sig.atr_percentile or 'N/A'}
                &nbsp; Funding: {f"{sig.funding_rate:.4%}" if sig.funding_rate is not None else 'N/A'}
            </span>
            </div>
            """,
            unsafe_allow_html=True,
        )

        col1, col2 = st.columns([1, 8])
        with col1:
            if st.button(
                "Execute",
                key=f"exec_{sig.id}",
                type="primary",
                disabled=exec_svc._risk_manager.is_paused,
            ):
                with st.spinner(f"Executing {sig.asset}..."):
                    pos = exec_svc.execute_signal(sig)
                if pos:
                    st.success(
                        f"Position opened: {pos.asset} {pos.direction.value} "
                        f"size={pos.size:.4f} x{pos.leverage}"
                    )
                else:
                    st.error("Trade blocked by risk manager.")
                st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
#  Tab 2: Backtest & Optimisation
# ─────────────────────────────────────────────────────────────────────────────

def _tab_backtest() -> None:
    st.markdown("## Backtest & Optimisation")

    # Show WFO completion message that was stored before st.rerun()
    if "_wfo_msg" in st.session_state:
        msg_type, msg_text = st.session_state.pop("_wfo_msg")
        if msg_type == "success":
            st.success(msg_text)
        else:
            st.warning(msg_text)

    st.markdown(
        '<div class="info-box warning-box">⚠️ <b>Always run a backtest and pass the walk-forward '
        'optimisation before enabling live trading.</b></div>',
        unsafe_allow_html=True,
    )

    # ── Config ────────────────────────────────────────────────────────────────
    col1, col2, col3 = st.columns(3)
    with col1:
        bt_asset = st.selectbox("Asset", config.ASSETS, key="bt_asset")
    with col2:
        bt_tf = st.selectbox("Timeframe", config.TIMEFRAMES, key="bt_tf")
    with col3:
        bt_candles = st.number_input(
            "Candles", min_value=1000, max_value=20000,
            value=config.BACKTEST_CANDLES, step=500, key="bt_candles"
        )

    col4, col5, col6 = st.columns(3)
    with col4:
        bt_capital = st.number_input(
            "Initial Capital ($)", min_value=100.0,
            value=config.BACKTEST_INITIAL_CAPITAL, step=1000.0, key="bt_capital"
        )
    with col5:
        bt_slippage = st.slider(
            "Slippage (%)", min_value=0.0, max_value=0.20,
            value=0.05, step=0.01, key="bt_slippage"
        )
    with col6:
        _wfo_tf_options = ["1H", "4H", "1D"] + [t for t in config.TIMEFRAMES if t not in ("1H", "4H", "1D")]
        wfo_tf = st.selectbox(
            "WFO Timeframe",
            _wfo_tf_options,
            index=0,
            key="wfo_tf",
            help="Higher timeframes give more history per candle — 1H is recommended for WFO",
        )

    col_a, col_b, col_c = st.columns(3)

    with col_a:
        run_bt = st.button("Run Backtest", type="primary", key="run_bt_btn")
    with col_b:
        run_wfo = st.button("Walk-Forward Optimise", key="run_wfo_btn")
    with col_c:
        load_prev = st.button("Load Previous Results", key="load_prev_btn")

    if load_prev:
        wfo = load_wfo_results()
        if wfo:
            st.session_state.wfo_result = wfo
            st.success("Previous WFO results loaded.")
        else:
            st.info("No previous WFO results found.")

    # ── Run backtest ──────────────────────────────────────────────────────────
    if run_bt:
        fetch_log_capture: list[str] = []
        with st.spinner(f"Fetching {bt_candles} candles for {bt_asset} {bt_tf}..."):
            mds = MarketDataService()
            df = mds.fetch_bulk_candles(bt_asset, bt_tf, bt_candles)

        if df is None or len(df) < 500:
            got = len(df) if df is not None else 0
            st.error(
                f"Not enough candle data — got {got} candles, need at least 500.\n\n"
                f"**What was attempted:** `{bt_asset}` / `{bt_tf}` / "
                f"interval=`{__import__('utils.helpers', fromlist=['timeframe_to_hl']).timeframe_to_hl(bt_tf)}` / "
                f"requested={bt_candles} candles\n\n"
                f"**Common causes:**\n"
                f"- Symbol `{bt_asset}` is not listed on Hyperliquid perps\n"
                f"- No internet / API unreachable\n"
                f"- Timeframe `{bt_tf}` has no history yet\n\n"
                f"Check the terminal / log file for the full fetch trace "
                f"(search for `fetch_bulk_candles`)."
            )
        else:
            st.info(f"Fetched {len(df)} candles for {bt_asset} {bt_tf}. Running backtest...")
            with st.spinner("Running backtest..."):
                bt = Backtester(
                    initial_capital=bt_capital,
                    risk_per_trade=config.RISK_PER_TRADE,
                )
                result = bt.run(df, slippage_pct=bt_slippage / 100)
                st.session_state.backtest_result = result

    # ── Run WFO ───────────────────────────────────────────────────────────────
    if run_wfo:
        _MIN_WFO_BARS = 3000
        _WFO_FETCH    = 5000   # always fetch max available

        mds = MarketDataService()
        actual_wfo_tf = wfo_tf
        df = None

        with st.spinner(f"Fetching {_WFO_FETCH} candles for WFO ({bt_asset} {actual_wfo_tf})..."):
            df = mds.fetch_bulk_candles(bt_asset, actual_wfo_tf, _WFO_FETCH)

        # Fallback to 1H if selected TF didn't return enough bars
        if (df is None or len(df) < _MIN_WFO_BARS) and actual_wfo_tf != "1H":
            got = len(df) if df is not None else 0
            st.warning(
                f"Only {got} candles returned for `{actual_wfo_tf}` "
                f"(need {_MIN_WFO_BARS}+). Falling back to **1H** for WFO."
            )
            actual_wfo_tf = "1H"
            with st.spinner(f"Fetching {_WFO_FETCH} candles for WFO ({bt_asset} 1H — fallback)..."):
                df = mds.fetch_bulk_candles(bt_asset, "1H", _WFO_FETCH)

        if df is None or len(df) < _MIN_WFO_BARS:
            got = len(df) if df is not None else 0
            st.error(
                f"Not enough candle data for walk-forward — got {got} candles, "
                f"need {_MIN_WFO_BARS}+.\n\n"
                f"**What was attempted:** `{bt_asset}` / `{actual_wfo_tf}` / "
                f"requested={_WFO_FETCH} candles\n\n"
                f"Check the terminal log for `fetch_bulk_candles` lines to see the exact failure."
            )
        else:
            st.info(
                f"Fetched **{len(df)}** candles for `{bt_asset}` `{actual_wfo_tf}`. "
                f"Running walk-forward optimisation..."
            )
            progress_bar = st.progress(0)
            status_text  = st.empty()

            def _cb(fold, total, msg):
                progress_bar.progress(fold / total)
                status_text.text(msg)

            with st.spinner("Running walk-forward optimisation (this may take several minutes)..."):
                optimizer = WalkForwardOptimizer(
                    initial_capital=bt_capital,
                    n_trials=config.OPTUNA_N_TRIALS,
                    timeout=config.OPTUNA_TIMEOUT,
                )
                try:
                    wfo_out = optimizer.run(df, timeframe=actual_wfo_tf, progress_callback=_cb)
                    st.session_state.wfo_result = wfo_out
                    # Update gate status in session_state immediately so the
                    # sidebar reflects the new result after st.rerun() below.
                    st.session_state.live_gate = bool(wfo_out.get("live_enabled", False))
                    progress_bar.progress(1.0)
                    tb = wfo_out.get("train_bars", "?")
                    ob = wfo_out.get("test_bars",  "?")
                    # Store completion message for display after rerun
                    if wfo_out.get("live_enabled"):
                        st.session_state["_wfo_msg"] = (
                            "success",
                            f"WFO complete — LIVE signals ENABLED  "
                            f"({wfo_out.get('n_folds', 0)} folds, "
                            f"train={tb} bars, OOS={ob} bars, tf={actual_wfo_tf})",
                        )
                    else:
                        st.session_state["_wfo_msg"] = (
                            "warning",
                            f"WFO complete — live signals NOT enabled. "
                            f"{wfo_out.get('n_passing', 0)}/{wfo_out.get('n_folds', 0)} folds passed "
                            f"(train={tb} bars, OOS={ob} bars, tf={actual_wfo_tf}).",
                        )
                    # Force a full rerun so the sidebar re-renders with the
                    # updated live_gate value.
                    st.rerun()
                except Exception as exc:
                    st.session_state.live_gate = False
                    st.error(f"WFO failed: {exc}")

    # ── Display backtest result ───────────────────────────────────────────────
    result = st.session_state.backtest_result
    if result is not None:
        _render_backtest_metrics(result)
        _render_equity_chart(result)
        _render_trade_log(result, bt_asset, bt_tf)

    # ── Display WFO result ────────────────────────────────────────────────────
    wfo_result = st.session_state.wfo_result
    if wfo_result is not None:
        _render_wfo_results(wfo_result)


def _bars_per_month_ui(tf: str) -> int:
    return {
        "1m": 43200, "5m": 8640, "15m": 2880, "30m": 1440,
        "1h": 720, "2h": 360, "4h": 180, "8h": 90, "12h": 60, "1d": 30,
    }.get(tf.lower(), 720)


def _render_backtest_metrics(result) -> None:
    st.markdown("### Backtest Results")
    d = result.to_dict()

    gate = d.get("passes_gate", False)
    if gate:
        st.markdown('<div class="info-box success-box">✅ <b>Passes performance gate</b> — meets PF, Sharpe, and DD thresholds</div>', unsafe_allow_html=True)
    else:
        st.markdown('<div class="info-box danger-box">❌ <b>Fails performance gate</b> — do not trade live with these parameters</div>', unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Profit Factor", f"{d['profit_factor']:.2f}", delta=f"≥{config.MIN_PROFIT_FACTOR}")
    c2.metric("Sharpe Ratio",  f"{d['sharpe']:.2f}",        delta=f"≥{config.MIN_SHARPE}")
    c3.metric("Max Drawdown",  f"{d['max_drawdown']:.1f}%", delta=f"≤{config.MAX_DRAWDOWN*100:.0f}%")
    c4.metric("Win Rate",      f"{d['winrate']:.1f}%")

    c5, c6, c7, c8 = st.columns(4)
    c5.metric("Total Trades",    str(d["total_trades"]))
    c6.metric("Expectancy",      f"${d['expectancy']:+.2f}")
    c7.metric("Total PnL",       f"${d['total_pnl']:+,.2f}")
    c8.metric("Final Capital",   f"${d['final_capital']:,.2f}")


def _render_equity_chart(result) -> None:
    st.markdown("### Equity Curve & Drawdown")

    equity = result.equity_curve
    dd     = result.drawdown_curve if hasattr(result, "drawdown_curve") else None

    if equity is None or len(equity) == 0:
        st.info("No equity data.")
        return

    fig = make_subplots(
        rows=2, cols=1, shared_xaxes=True,
        row_heights=[0.7, 0.3],
        subplot_titles=("Equity Curve", "Drawdown"),
        vertical_spacing=0.05,
    )

    fig.add_trace(
        go.Scatter(
            y=equity.values,
            mode="lines", name="Equity",
            line=dict(color="#58a6ff", width=2),
            fill="tozeroy", fillcolor="rgba(88,166,255,0.08)",
        ),
        row=1, col=1,
    )

    if dd is not None:
        fig.add_trace(
            go.Scatter(
                y=(dd * 100).values,
                mode="lines", name="Drawdown %",
                line=dict(color="#f85149", width=1.5),
                fill="tozeroy", fillcolor="rgba(248,81,73,0.12)",
            ),
            row=2, col=1,
        )

    fig.update_layout(
        height=500,
        paper_bgcolor="#0d1117",
        plot_bgcolor="#0d1117",
        font=dict(color="#c9d1d9"),
        showlegend=False,
        margin=dict(l=40, r=20, t=30, b=20),
        xaxis=dict(gridcolor="#21262d"),
        yaxis=dict(gridcolor="#21262d"),
        xaxis2=dict(gridcolor="#21262d"),
        yaxis2=dict(gridcolor="#21262d", ticksuffix="%"),
    )
    st.plotly_chart(fig, use_container_width=True)


def _render_trade_log(result, asset: str, tf: str) -> None:
    if not result.trades:
        return

    st.markdown("### Trade Log")

    trades_data = [
        {
            "Bar In":    t.entry_bar,
            "Bar Out":   t.exit_bar,
            "Dir":       t.direction,
            "Entry":     f"{t.entry_price:.4f}",
            "Exit":      f"{t.exit_price:.4f}",
            "PnL ($)":   f"{t.pnl:+.2f}",
            "Fees ($)":  f"{t.fees:.2f}",
            "Reason":    t.exit_reason,
        }
        for t in result.trades
    ]
    df_trades = pd.DataFrame(trades_data)

    def _color_pnl(val):
        try:
            v = float(val.replace("+", "").replace("$", ""))
            color = "#3fb950" if v > 0 else "#f85149"
            return f"color: {color}"
        except Exception:
            return ""

    styled = df_trades.style.applymap(_color_pnl, subset=["PnL ($)"])
    st.dataframe(styled, use_container_width=True)

    col1, col2 = st.columns(2)
    with col1:
        if st.button("Export Trades to CSV"):
            csv = df_trades.to_csv(index=False)
            st.download_button(
                "Download CSV", csv,
                file_name=f"backtest_{asset}_{tf}.csv",
                mime="text/csv",
            )
    with col2:
        try:
            import io
            import openpyxl
            buf = io.BytesIO()
            df_trades.to_excel(buf, index=False, engine="openpyxl")
            buf.seek(0)
            if st.button("Export Trades to Excel"):
                st.download_button(
                    "Download XLSX", buf,
                    file_name=f"backtest_{asset}_{tf}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
        except ImportError:
            pass


def _render_wfo_results(wfo: dict) -> None:
    st.markdown("### Walk-Forward Optimisation Results")

    # Show fold sizing info
    wfo_tf      = wfo.get("wfo_timeframe", "?")
    train_bars  = wfo.get("train_bars", "?")
    test_bars   = wfo.get("test_bars",  "?")
    total_bars  = wfo.get("total_bars", "?")
    st.caption(
        f"Timeframe: **{wfo_tf}** | Total bars: **{total_bars}** | "
        f"Train window: **{train_bars}** bars | OOS window: **{test_bars}** bars per fold"
    )

    agg = wfo.get("agg", {})
    if agg:
        c1, c2, c3, c4, c5 = st.columns(5)
        c1.metric("Mean PF",     f"{agg.get('mean_profit_factor', 0):.2f}")
        c2.metric("Mean Sharpe", f"{agg.get('mean_sharpe', 0):.2f}")
        c3.metric("Mean MaxDD",  f"{agg.get('mean_max_drawdown', 0):.1f}%")
        c4.metric("Mean WR",     f"{agg.get('mean_winrate', 0):.1f}%")
        c5.metric("Folds Pass",  f"{agg.get('n_passing', 0)}/{agg.get('n_folds', 0)}")

    live_enabled = wfo.get("live_enabled", False)
    if live_enabled:
        st.success("Live signals are ENABLED based on WFO results.")
    else:
        st.error("Live signals are DISABLED — not enough passing folds.")

    folds = wfo.get("folds", [])
    if folds:
        st.markdown("**Per-fold OOS Results:**")
        fold_rows = []
        for f in folds:
            tr = f.get("test_result", {})
            fold_rows.append({
                "Fold":     f["fold_id"],
                "Test Period": f"{f['test_start']} → {f['test_end']}",
                "PF":       f"{tr.get('profit_factor', 0):.2f}",
                "Sharpe":   f"{tr.get('sharpe', 0):.2f}",
                "MaxDD%":   f"{tr.get('max_drawdown', 0):.1f}",
                "WR%":      f"{tr.get('winrate', 0):.1f}",
                "Trades":   tr.get("total_trades", 0),
                "Passes":   "✅" if f.get("passes_gate") else "❌",
            })
        st.dataframe(pd.DataFrame(fold_rows), use_container_width=True, hide_index=True)


# ─────────────────────────────────────────────────────────────────────────────
#  Tab 3: Strategy Settings
# ─────────────────────────────────────────────────────────────────────────────

def _tab_settings() -> None:
    st.markdown("## Strategy Settings")

    st.markdown(
        '<div class="info-box">ℹ️ Changes here affect the live scanner only. '
        'To make permanent changes, edit <code>utils/config.py</code>.</div>',
        unsafe_allow_html=True,
    )

    # ── Scoring weights ───────────────────────────────────────────────────────
    st.markdown("### Scoring Weights")
    weights = config.load_optimized_weights()

    col1, col2, col3, col4, col5 = st.columns(5)
    w_struct = col1.slider("Structure", 0.0, 1.0, weights.get("structure", 0.20), 0.01)
    w_ema    = col2.slider("EMA",       0.0, 1.0, weights.get("ema",       0.20), 0.01)
    w_rsi    = col3.slider("RSI",       0.0, 1.0, weights.get("rsi",       0.20), 0.01)
    w_wick   = col4.slider("Wick",      0.0, 1.0, weights.get("wick",      0.20), 0.01)
    w_vol    = col5.slider("Volume",    0.0, 1.0, weights.get("volume",    0.20), 0.01)

    total = w_struct + w_ema + w_rsi + w_wick + w_vol
    if abs(total - 1.0) > 0.01:
        st.warning(f"Weights sum to {total:.2f} — they should sum to 1.0")

    if st.button("Save Weights", type="primary"):
        if abs(total - 1.0) > 0.05:
            st.error("Weights must approximately sum to 1.0")
        else:
            # Normalise
            norm_weights = {
                "structure": w_struct / total,
                "ema":       w_ema    / total,
                "rsi":       w_rsi    / total,
                "wick":      w_wick   / total,
                "volume":    w_vol    / total,
            }
            config.save_optimized_weights(norm_weights, metadata={"source": "manual"})
            st.success("Weights saved!")

    st.divider()

    # ── Filter parameters ─────────────────────────────────────────────────────
    st.markdown("### Filter Parameters (read-only overview)")
    params = {
        "Min Confidence Score": config.MIN_CONFIDENCE_SCORE,
        "ADX Minimum":          config.ADX_MIN,
        "ATR Percentile Min":   f"{config.ATR_PERCENTILE_MIN:.0f}th",
        "Volume Ratio Min":     config.VOLUME_RATIO_MIN,
        "Min Wick Ratio":       config.MIN_WICK_RATIO,
        "Funding Long Max":     f"{config.FUNDING_LONG_MAX:.4%}",
        "Funding Short Min":    f"{config.FUNDING_SHORT_MIN:.4%}",
        "OI Spike Ratio":       config.OI_SPIKE_RATIO,
    }
    st.table(pd.DataFrame(list(params.items()), columns=["Parameter", "Value"]))

    st.divider()

    # ── Risk parameters ────────────────────────────────────────────────────────
    st.markdown("### Risk Management (read-only overview)")
    risk = {
        "Risk Per Trade":    f"{config.RISK_PER_TRADE:.1%}",
        "Max Leverage":      f"x{config.MAX_LEVERAGE}",
        "Daily Loss Limit":  f"{config.DAILY_LOSS_LIMIT:.1%}",
        "Weekly Loss Limit": f"{config.WEEKLY_LOSS_LIMIT:.1%}",
        "TP1 Multiple":      f"{config.TP1_R_MULTIPLE}R",
        "TP2 Multiple":      f"{config.TP2_R_MULTIPLE}R",
        "TP1 Close Size":    f"{config.TP1_CLOSE_PCT:.0%}",
    }
    st.table(pd.DataFrame(list(risk.items()), columns=["Parameter", "Value"]))


# ─────────────────────────────────────────────────────────────────────────────
#  Tab 4: Performance
# ─────────────────────────────────────────────────────────────────────────────

def _tab_performance() -> None:
    st.markdown("## Performance Analytics")

    exec_svc = _get_exec_service()
    df_pos   = exec_svc.get_positions_df()

    if df_pos.empty:
        st.info("No trade history yet.")
        return

    closed = df_pos[df_pos["status"].isin(["TP1_HIT", "TP2_HIT", "SL_HIT", "CLOSED"])]

    if closed.empty:
        st.info("No closed trades yet.")
        return

    # ── Summary metrics ───────────────────────────────────────────────────────
    total_pnl  = closed["realised_pnl"].sum()
    win_trades = (closed["realised_pnl"] > 0).sum()
    total_t    = len(closed)
    winrate    = win_trades / total_t if total_t > 0 else 0.0
    gross_win  = closed.loc[closed["realised_pnl"] > 0,  "realised_pnl"].sum()
    gross_loss = abs(closed.loc[closed["realised_pnl"] <= 0, "realised_pnl"].sum())
    pf         = gross_win / gross_loss if gross_loss > 0 else float("inf")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total PnL",     f"${total_pnl:+,.2f}")
    c2.metric("Win Rate",      f"{winrate:.1%}")
    c3.metric("Profit Factor", f"{pf:.2f}")
    c4.metric("Total Trades",  str(total_t))

    # ── Equity curve from closed positions ────────────────────────────────────
    if "opened_at" in closed.columns:
        equity_df = closed.sort_values("opened_at").copy()
        equity_df["cumulative_pnl"] = equity_df["realised_pnl"].cumsum()

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=equity_df["opened_at"],
            y=equity_df["cumulative_pnl"],
            mode="lines+markers",
            line=dict(color="#58a6ff", width=2),
            name="Cumulative PnL",
        ))
        fig.update_layout(
            title="Cumulative PnL",
            height=350,
            paper_bgcolor="#0d1117", plot_bgcolor="#0d1117",
            font=dict(color="#c9d1d9"),
            xaxis=dict(gridcolor="#21262d"),
            yaxis=dict(gridcolor="#21262d", tickprefix="$"),
            margin=dict(l=40, r=20, t=40, b=20),
        )
        st.plotly_chart(fig, use_container_width=True)

    # ── Monthly returns ───────────────────────────────────────────────────────
    if "opened_at" in closed.columns:
        try:
            closed["opened_at"] = pd.to_datetime(closed["opened_at"])
            closed["month"] = closed["opened_at"].dt.to_period("M").astype(str)
            monthly = closed.groupby("month")["realised_pnl"].sum().reset_index()
            monthly.columns = ["Month", "PnL ($)"]
            monthly["Color"] = monthly["PnL ($)"].apply(lambda x: "#3fb950" if x >= 0 else "#f85149")

            fig2 = go.Figure(go.Bar(
                x=monthly["Month"], y=monthly["PnL ($)"],
                marker_color=monthly["Color"],
            ))
            fig2.update_layout(
                title="Monthly Returns",
                height=300,
                paper_bgcolor="#0d1117", plot_bgcolor="#0d1117",
                font=dict(color="#c9d1d9"),
                xaxis=dict(gridcolor="#21262d"),
                yaxis=dict(gridcolor="#21262d", tickprefix="$"),
                margin=dict(l=40, r=20, t=40, b=20),
            )
            st.plotly_chart(fig2, use_container_width=True)
        except Exception:
            pass

    # ── Full trade list ───────────────────────────────────────────────────────
    st.markdown("### Trade History")
    display = [c for c in [
        "asset", "direction", "entry_price", "status",
        "realised_pnl", "total_fees", "net_pnl", "opened_at", "closed_at"
    ] if c in closed.columns]
    st.dataframe(closed[display], use_container_width=True)

    # Export
    csv = closed.to_csv(index=False)
    st.download_button("Export to CSV", csv, file_name="trade_history.csv", mime="text/csv")


# ─────────────────────────────────────────────────────────────────────────────
#  Tab 5: Paper Trading
# ─────────────────────────────────────────────────────────────────────────────

def _tab_paper() -> None:
    st.markdown("## Paper Trading Mode")

    mode = st.session_state.paper_mode

    if mode:
        st.markdown(
            '<div class="info-box success-box">✅ <b>Paper Trading ACTIVE</b> — '
            'no real orders will be placed. All positions are simulated.</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div class="info-box danger-box">⚠️ <b>LIVE Mode ACTIVE</b> — '
            'real money is at risk. Ensure you have tested thoroughly in paper mode first.</div>',
            unsafe_allow_html=True,
        )

    exec_svc = _get_exec_service()
    stats    = exec_svc.get_risk_stats()

    st.markdown("### Session Statistics")
    c1, c2, c3 = st.columns(3)
    c1.metric("Session Capital",  f"${stats['session_capital']:,.2f}")
    c2.metric("Day PnL",          f"{stats['day_pnl_pct']:+.2f}%")
    c3.metric("Week PnL",         f"{stats['week_pnl_pct']:+.2f}%")

    st.markdown("### Loss Limits")
    day_used  = max(0.0, -stats['day_pnl'])  / stats['session_capital'] * 100
    week_used = max(0.0, -stats['week_pnl']) / stats['session_capital'] * 100

    st.markdown(f"**Daily limit**: {day_used:.1f}% used / {stats['daily_limit_pct']}% max")
    st.progress(min(1.0, day_used / stats["daily_limit_pct"]))

    st.markdown(f"**Weekly limit**: {week_used:.1f}% used / {stats['weekly_limit_pct']}% max")
    st.progress(min(1.0, week_used / stats["weekly_limit_pct"]))

    if stats["is_paused"]:
        st.error(f"Bot is paused: {stats['pause_reason']}")
        if st.button("Resume Bot"):
            exec_svc._risk_manager.resume()
            st.rerun()

    st.divider()

    # ── Paper positions ───────────────────────────────────────────────────────
    st.markdown("### Simulated Positions")
    df_pos = exec_svc.get_positions_df()
    if df_pos.empty:
        st.info("No paper positions yet.")
    else:
        active = df_pos[df_pos["status"].isin(["OPEN", "TP1_HIT"])]
        closed = df_pos[~df_pos["status"].isin(["OPEN", "TP1_HIT"])]

        if not active.empty:
            st.markdown("**Active:**")
            st.dataframe(active, use_container_width=True)

        if not closed.empty:
            st.markdown("**Closed:**")
            st.dataframe(closed, use_container_width=True)


# ─────────────────────────────────────────────────────────────────────────────
#  Main App
# ─────────────────────────────────────────────────────────────────────────────

def run() -> None:
    _init_state()
    _render_sidebar()

    st.markdown("# ⚡ CORE EDGE Assistant v2")
    st.markdown(
        '<div class="info-box">Hyperliquid Perpetuals Trading System | '
        'Run backtest first — <b>never trade live without passing WFO validation</b>.</div>',
        unsafe_allow_html=True,
    )

    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "Live Dashboard",
        "Backtest & Optimisation",
        "Strategy Settings",
        "Performance",
        "Paper Trading",
    ])

    with tab1: _tab_live()
    with tab2: _tab_backtest()
    with tab3: _tab_settings()
    with tab4: _tab_performance()
    with tab5: _tab_paper()


if __name__ == "__main__":
    run()
