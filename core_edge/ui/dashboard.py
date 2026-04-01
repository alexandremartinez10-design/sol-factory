"""
CORE EDGE Dashboard — Streamlit UI

Run with:
    streamlit run ui/dashboard.py

Layout:
  Header   → capital, open positions, last refresh timestamp
  Section 1 → Detected opportunities (score-sorted table with EXECUTE / IGNORE)
  Section 2 → Active positions with status, BE indicator
  Section 3 → Closed position history (expandable)
"""

from __future__ import annotations

import logging
import os
import sys
import time
from datetime import datetime
from typing import Dict, List

import pandas as pd
import streamlit as st

# ── Path resolution (works whether run from project root or ui/ folder) ────
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import config
from models.position import Position, PositionStatus
from models.signal import Direction, Signal, SignalStatus
from services.analysis import AnalysisEngine
from services.market_data import MarketDataService
from services.scoring import ScoringEngine

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Page config (must be first Streamlit call)
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="CORE EDGE",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Styling ───────────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
        /* Dark header banner */
        .ce-header {
            background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
            border-left: 4px solid #238636;
            padding: 18px 24px;
            border-radius: 8px;
            margin-bottom: 24px;
        }
        .ce-header h1 { color: #e6edf3; margin: 0 0 4px 0; font-size: 1.8rem; }
        .ce-header .meta { color: #8b949e; font-size: 0.9rem; }
        .ce-header .meta strong { color: #e6edf3; }

        /* Score badge colours */
        .score-green  { color: #3fb950; font-weight: 700; }
        .score-orange { color: #d29922; font-weight: 700; }

        /* Section divider */
        .section-title {
            font-size: 1.05rem;
            font-weight: 600;
            color: #8b949e;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
    </style>
    """,
    unsafe_allow_html=True,
)

# ─────────────────────────────────────────────────────────────────────────────
# Session-state helpers
# ─────────────────────────────────────────────────────────────────────────────

def _init_state() -> None:
    defaults: dict = {
        "signals": [],               # List[Signal]
        "positions": {},             # Dict[str, Position]
        "ignored_ids": set(),        # Set[str]  — signal IDs dismissed by user
        "last_refresh": None,        # datetime | None
        "execution_svc": None,       # ExecutionService | None
        "execution_ok": False,       # bool — whether creds loaded successfully
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

    # Heavy objects (cached across reruns)
    if "market_data" not in st.session_state:
        st.session_state["market_data"] = MarketDataService()
    if "analysis_engine" not in st.session_state:
        st.session_state["analysis_engine"] = AnalysisEngine()
    if "scoring_engine" not in st.session_state:
        st.session_state["scoring_engine"] = ScoringEngine()

    # Execution service (optional — needs valid .env)
    if not st.session_state["execution_ok"] and st.session_state["execution_svc"] is None:
        try:
            from services.execution import ExecutionService
            st.session_state["execution_svc"] = ExecutionService()
            st.session_state["execution_ok"] = True
        except Exception as exc:
            logger.warning(f"Execution service disabled: {exc}")


def _run_analysis() -> None:
    """Full scan: fetch → analyse → score → merge into session state."""
    with st.spinner("Fetching OHLCV data…"):
        data = st.session_state["market_data"].fetch_all()

    with st.spinner("Running analysis…"):
        raw = st.session_state["analysis_engine"].analyze_all(data)
        new_signals: List[Signal] = st.session_state["scoring_engine"].score_signals(raw)

    # Remove ignored signals
    new_signals = [s for s in new_signals if s.id not in st.session_state["ignored_ids"]]

    # Keep already-executed / ignored signals, add truly new ones
    existing_pending = {s.id for s in st.session_state["signals"] if s.status == SignalStatus.PENDING}
    kept = [s for s in st.session_state["signals"] if s.status != SignalStatus.PENDING]
    merged = kept + [s for s in new_signals if s.id not in existing_pending]

    st.session_state["signals"] = merged
    st.session_state["last_refresh"] = datetime.utcnow()


# ─────────────────────────────────────────────────────────────────────────────
# Render helpers
# ─────────────────────────────────────────────────────────────────────────────

def _score_html(score: int) -> str:
    cls = "score-green" if score >= 80 else "score-orange"
    icon = "🟢" if score >= 80 else "🟡"
    return f'<span class="{cls}">{icon} {score}/100</span>'


def _direction_icon(direction: Direction) -> str:
    return "▲ LONG" if direction == Direction.LONG else "▼ SHORT"


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    _init_state()

    # ── Header ────────────────────────────────────────────────────────────────
    capital_str = "N/A"
    if st.session_state["execution_ok"]:
        try:
            cap = st.session_state["execution_svc"].get_available_capital()
            capital_str = f"${cap:,.2f}"
        except Exception:
            capital_str = "⚠ API error"

    open_count = sum(
        1 for p in st.session_state["positions"].values() if p.is_active
    )
    last_ts = st.session_state["last_refresh"]
    last_str = last_ts.strftime("%H:%M:%S UTC") if last_ts else "—"

    st.markdown(
        f"""
        <div class="ce-header">
            <h1>⚡ CORE EDGE Assistant</h1>
            <div class="meta">
                Capital&nbsp;: <strong>{capital_str}</strong>
                &nbsp;|&nbsp;
                Positions ouvertes&nbsp;: <strong>{open_count}</strong>
                &nbsp;|&nbsp;
                Dernière analyse&nbsp;: <strong>{last_str}</strong>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Controls ──────────────────────────────────────────────────────────────
    col_btn, col_auto, col_info = st.columns([2, 2, 6])
    with col_btn:
        if st.button("🔍 Analyser maintenant", use_container_width=True, type="primary"):
            _run_analysis()
            st.rerun()
    with col_auto:
        auto = st.checkbox("Auto-refresh 60 s", value=False)

    if not st.session_state["execution_ok"]:
        st.warning(
            "⚠ Service d'exécution non disponible — vérifiez HL_WALLET_ADDRESS "
            "et HL_API_SECRET dans votre fichier .env"
        )

    # Auto-refresh logic
    if auto:
        time.sleep(config.POLLING_INTERVAL)
        _run_analysis()
        st.rerun()

    st.markdown("---")

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — OPPORTUNITIES
    # ══════════════════════════════════════════════════════════════════════════
    st.markdown('<div class="section-title">🎯 Opportunités détectées</div>', unsafe_allow_html=True)

    pending: List[Signal] = [
        s for s in st.session_state["signals"]
        if s.status == SignalStatus.PENDING and s.id not in st.session_state["ignored_ids"]
    ]

    if not pending:
        st.info("Aucune opportunité en attente. Lancez une analyse ou patientez jusqu'au prochain refresh.")
    else:
        # Column headers
        hdr = st.columns([1, 1.2, 1, 1.3, 1.3, 1.3, 1.3, 1.3, 1.4, 1.4])
        for col, label in zip(
            hdr,
            ["Asset", "Direction", "TF", "Entry", "Stop Loss", "TP1", "TP2", "Score", "Execute", "Ignore"],
        ):
            col.markdown(f"**{label}**")
        st.markdown('<hr style="margin:4px 0 10px 0">', unsafe_allow_html=True)

        for sig in pending:
            cols = st.columns([1, 1.2, 1, 1.3, 1.3, 1.3, 1.3, 1.3, 1.4, 1.4])

            cols[0].write(f"**{sig.asset}**")
            dir_icon = "🟢 ▲ LONG" if sig.direction == Direction.LONG else "🔴 ▼ SHORT"
            cols[1].write(dir_icon)
            cols[2].write(sig.timeframe)
            cols[3].write(f"`{sig.entry:,.4f}`")
            cols[4].write(f"`{sig.stop_loss:,.4f}`")
            cols[5].write(f"`{sig.tp1:,.4f}`")
            cols[6].write(f"`{sig.tp2:,.4f}`")
            cols[7].markdown(_score_html(sig.score), unsafe_allow_html=True)

            with cols[8]:
                if st.button("▶ EXECUTE", key=f"exec_{sig.id}", use_container_width=True):
                    if not st.session_state["execution_ok"]:
                        st.error("Exécution désactivée — configurez .env")
                    else:
                        try:
                            with st.spinner(f"Envoi des ordres {sig.asset}…"):
                                pos = st.session_state["execution_svc"].execute_signal(sig)
                            st.session_state["positions"][pos.id] = pos
                            sig.status = SignalStatus.EXECUTED
                            st.success(f"✅ {sig.asset} exécuté — position {pos.id[:8]}")
                            st.rerun()
                        except Exception as exc:
                            st.error(f"Erreur d'exécution : {exc}")

            with cols[9]:
                if st.button("✕ IGNORE", key=f"ign_{sig.id}", use_container_width=True):
                    st.session_state["ignored_ids"].add(sig.id)
                    sig.status = SignalStatus.IGNORED
                    st.rerun()

    st.markdown("---")

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — ACTIVE POSITIONS
    # ══════════════════════════════════════════════════════════════════════════
    st.markdown('<div class="section-title">📊 Positions actives</div>', unsafe_allow_html=True)

    active: List[Position] = [p for p in st.session_state["positions"].values() if p.is_active]

    if not active:
        st.info("Aucune position active.")
    else:
        hdr2 = st.columns([1, 1.2, 1.3, 1.5, 1.3, 1, 2])
        for col, label in zip(
            hdr2,
            ["Asset", "Direction", "Entry", "SL actuel", "TP1", "Levier", "Status"],
        ):
            col.markdown(f"**{label}**")
        st.markdown('<hr style="margin:4px 0 10px 0">', unsafe_allow_html=True)

        for pos in active:
            cols = st.columns([1, 1.2, 1.3, 1.5, 1.3, 1, 2])
            cols[0].write(f"**{pos.asset}**")
            dir_icon = "🟢 ▲ LONG" if pos.direction == Direction.LONG else "🔴 ▼ SHORT"
            cols[1].write(dir_icon)
            cols[2].write(f"`{pos.entry_price:,.4f}`")

            sl_label = f"`{pos.current_sl:,.4f}`"
            if pos.breakeven:
                sl_label += " 🔐 BE"
            cols[3].markdown(sl_label)
            cols[4].write(f"`{pos.tp1:,.4f}`")
            cols[5].write(f"x{pos.leverage}")

            if pos.status == PositionStatus.TP1_HIT:
                cols[6].markdown("✅ **TP1 atteint** — SL au BE")
            else:
                cols[6].markdown("🔵 En cours")

    st.markdown("---")

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — HISTORY
    # ══════════════════════════════════════════════════════════════════════════
    closed: List[Position] = [
        p for p in st.session_state["positions"].values() if not p.is_active
    ]

    with st.expander(f"📜 Historique des positions clôturées ({len(closed)})"):
        if not closed:
            st.write("Aucune position clôturée dans cette session.")
        else:
            rows = []
            for p in sorted(closed, key=lambda x: x.opened_at, reverse=True):
                rows.append(
                    {
                        "Asset": p.asset,
                        "Direction": p.direction.value,
                        "Entry": p.entry_price,
                        "SL": p.current_sl,
                        "TP1": p.tp1,
                        "TP2": p.tp2,
                        "Status": p.status.value,
                        "Ouverture": p.opened_at.strftime("%Y-%m-%d %H:%M"),
                        "Clôture": p.closed_at.strftime("%Y-%m-%d %H:%M") if p.closed_at else "—",
                    }
                )
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # ── Footer ────────────────────────────────────────────────────────────────
    st.markdown(
        '<p style="color:#484f58;font-size:0.78rem;text-align:center;margin-top:32px;">'
        "CORE EDGE — Système semi-automatique | Validez toujours manuellement avant exécution"
        "</p>",
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
