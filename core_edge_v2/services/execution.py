# -*- coding: utf-8 -*-
"""
Execution Service v2
====================
Manages order lifecycle on Hyperliquid with full paper-trading support.

Live mode:
  - Places real orders via Hyperliquid Exchange SDK
  - Monitors positions with polling thread
  - Partial close 50% at TP1 + breakeven SL
  - Full close at TP2 or SL

Paper mode (PAPER_TRADING=true):
  - Simulates fills using mark price
  - Tracks paper positions in memory
  - Reports same interface as live mode
  - Uses testnet when possible, or simply simulates locally
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Dict, Optional

import pandas as pd
from dotenv import load_dotenv
from hyperliquid.info import Info
from hyperliquid.utils import constants

from models.position import Position, PositionStatus
from models.signal import Direction, Signal, SignalStatus
from services.risk_manager import RiskManager
from utils import config

load_dotenv()
logger = logging.getLogger(__name__)


class ExecutionService:

    def __init__(
        self,
        paper_mode: bool | None = None,
        initial_capital: float = 10_000.0,
    ) -> None:
        self.paper_mode = paper_mode if paper_mode is not None else config.PAPER_TRADING

        wallet     = os.getenv("HL_WALLET_ADDRESS", "").strip()
        secret_key = os.getenv("HL_API_SECRET", "").strip()

        # Info client is used in both modes for price/state queries
        url = constants.MAINNET_API_URL
        self._info = Info(url, skip_ws=True)

        # Exchange client (only initialised in live mode)
        self._exchange = None

        if not self.paper_mode:
            if not wallet or not secret_key:
                raise ValueError(
                    "Live mode requires HL_WALLET_ADDRESS and HL_API_SECRET in .env"
                )
            import eth_account
            from hyperliquid.exchange import Exchange
            account = eth_account.Account.from_key(secret_key)
            self._exchange = Exchange(account, url)
            logger.info("ExecutionService: LIVE mode initialised")
        else:
            logger.info("ExecutionService: PAPER mode — no real orders will be placed")

        self.wallet_address = wallet
        self.positions: Dict[str, Position] = {}
        self._risk_manager = RiskManager(initial_capital=initial_capital)

        self._monitor_thread: Optional[threading.Thread] = None
        self._monitor_running = False

    # ── Capital ──────────────────────────────────────────────────────────────

    def get_available_capital(self) -> float:
        if self.paper_mode:
            return self._risk_manager.session_capital

        try:
            state = self._info.user_state(self.wallet_address)
            return float(state["marginSummary"]["accountValue"])
        except Exception as exc:
            logger.error(f"Capital fetch failed: {exc}")
            raise

    # ── Signal Execution ─────────────────────────────────────────────────────

    def execute_signal(self, signal: Signal) -> Optional[Position]:
        """
        Execute a signal.
        - Paper mode: creates a simulated position.
        - Live mode: places real orders on Hyperliquid.
        Returns Position or None if risk limits blocked the trade.
        """
        if not self._risk_manager.can_trade():
            logger.warning(
                f"Trade blocked by risk manager: {self._risk_manager.pause_reason}"
            )
            signal.status = SignalStatus.IGNORED
            return None

        capital = self.get_available_capital()
        atr_val = signal._analysis_data.get("atr") if hasattr(signal, "_analysis_data") else None

        size, leverage = self._risk_manager.calculate_position_size(
            capital=capital,
            entry_price=signal.entry,
            stop_loss=signal.stop_loss,
            atr=atr_val,
        )

        position = Position(
            asset=signal.asset,
            direction=signal.direction,
            entry_price=signal.entry,
            initial_sl=signal.stop_loss,
            current_sl=signal.stop_loss,
            tp1=signal.tp1,
            tp2=signal.tp2,
            size=size,
            leverage=leverage,
        )

        if self.paper_mode:
            logger.info(
                f"[PAPER] OPEN {signal.direction.value} {signal.asset} "
                f"entry={signal.entry:.4f} SL={signal.stop_loss:.4f} "
                f"TP1={signal.tp1:.4f} TP2={signal.tp2:.4f} "
                f"size={size:.4f} x{leverage}"
            )
        else:
            self._place_live_orders(signal, size, leverage)

        self.positions[position.id] = position
        signal.status = SignalStatus.EXECUTED
        self._ensure_monitor_running()
        return position

    # ── Live order placement ──────────────────────────────────────────────────

    def _place_live_orders(self, signal: Signal, size: float, leverage: int) -> None:
        """Place entry + SL + TP1 orders on Hyperliquid."""
        is_buy = signal.direction == Direction.LONG
        asset  = signal.asset

        try:
            # Set isolated leverage
            self._exchange.update_leverage(leverage, asset, is_cross=False)

            # Entry (limit GTC)
            self._exchange.order(
                coin=asset, is_buy=is_buy, sz=size,
                limit_px=signal.entry,
                order_type={"limit": {"tif": "Gtc"}},
                reduce_only=False,
            )

            # Stop loss (trigger → market)
            self._exchange.order(
                coin=asset, is_buy=not is_buy,
                sz=size, limit_px=signal.stop_loss,
                order_type={"trigger": {
                    "triggerPx": signal.stop_loss,
                    "isMarket": True, "tpsl": "sl",
                }},
                reduce_only=True,
            )

            # TP1 (trigger → limit, 50% size)
            self._exchange.order(
                coin=asset, is_buy=not is_buy,
                sz=round(size / 2, 4), limit_px=signal.tp1,
                order_type={"trigger": {
                    "triggerPx": signal.tp1,
                    "isMarket": False, "tpsl": "tp",
                }},
                reduce_only=True,
            )

            logger.info(f"[LIVE] Orders placed for {asset} {signal.direction.value}")

        except Exception as exc:
            logger.error(f"Order placement failed for {asset}: {exc}")
            raise

    # ── Position Monitoring ───────────────────────────────────────────────────

    def _ensure_monitor_running(self) -> None:
        if not self._monitor_running:
            self._monitor_running = True
            self._monitor_thread = threading.Thread(
                target=self._monitor_loop, daemon=True, name="pos-monitor"
            )
            self._monitor_thread.start()
            logger.debug("Position monitor thread started")

    def _monitor_loop(self) -> None:
        while self._monitor_running:
            active = [p for p in self.positions.values() if p.is_active]
            if not active:
                self._monitor_running = False
                break

            try:
                self._check_positions()
            except Exception as exc:
                logger.error(f"Monitor error: {exc}")

            time.sleep(config.WS_RECONNECT_INTERVAL)

    def _check_positions(self) -> None:
        """Poll exchange (or simulate) and update position state."""
        if self.paper_mode:
            self._update_paper_positions()
        else:
            self._update_live_positions()

    def _update_paper_positions(self) -> None:
        """Simulate position updates using current mark price."""
        from services.market_data import MarketDataService
        mds = MarketDataService()

        for pos in list(self.positions.values()):
            if not pos.is_active:
                continue
            mark = mds.get_mark_price(pos.asset)
            if mark is None:
                continue
            pos.update_unrealised(mark)

            if pos.status == PositionStatus.OPEN:
                tp1_hit = (
                    (pos.direction == Direction.LONG  and mark >= pos.tp1) or
                    (pos.direction == Direction.SHORT and mark <= pos.tp1)
                )
                if tp1_hit:
                    pnl = abs(pos.tp1 - pos.entry_price) * (pos.size / 2)
                    pos.realised_pnl += pnl
                    pos.tp1_closed_size = pos.size / 2
                    pos.remaining_size  = pos.size / 2
                    pos.current_sl      = pos.entry_price
                    pos.breakeven       = True
                    pos.status          = PositionStatus.TP1_HIT
                    self._risk_manager.record_trade(pnl)
                    logger.info(f"[PAPER] TP1 hit {pos.asset} mark={mark:.4f} pnl={pnl:.2f}")

            if pos.status == PositionStatus.TP1_HIT:
                tp2_hit = (
                    (pos.direction == Direction.LONG  and mark >= pos.tp2) or
                    (pos.direction == Direction.SHORT and mark <= pos.tp2)
                )
                sl_hit = (
                    (pos.direction == Direction.LONG  and mark <= pos.current_sl) or
                    (pos.direction == Direction.SHORT and mark >= pos.current_sl)
                )
                if tp2_hit:
                    pnl = abs(pos.tp2 - pos.entry_price) * pos.remaining_size
                    pos.realised_pnl += pnl
                    pos.status = PositionStatus.TP2_HIT
                    pos.closed_at = datetime.now(timezone.utc)
                    self._risk_manager.record_trade(pnl)
                    logger.info(f"[PAPER] TP2 hit {pos.asset} pnl={pnl:.2f}")
                elif sl_hit:
                    pnl = 0.0  # Breakeven SL = 0 net
                    pos.realised_pnl += pnl
                    pos.status = PositionStatus.SL_HIT
                    pos.closed_at = datetime.now(timezone.utc)
                    self._risk_manager.record_trade(pnl)
                    logger.info(f"[PAPER] Breakeven SL hit {pos.asset}")

    def _update_live_positions(self) -> None:
        """Sync live position state with Hyperliquid."""
        try:
            state = self._info.user_state(self.wallet_address)
            open_on_exchange = {
                p["position"]["coin"]: p["position"]
                for p in state.get("assetPositions", [])
                if float(p["position"].get("szi", 0)) != 0
            }
        except Exception as exc:
            logger.error(f"Failed to fetch live positions: {exc}")
            return

        for pos in list(self.positions.values()):
            if not pos.is_active:
                continue
            ex_pos = open_on_exchange.get(pos.asset)
            if ex_pos is None:
                # Closed on exchange
                pos.status    = PositionStatus.CLOSED
                pos.closed_at = datetime.now(timezone.utc)
                logger.info(f"[LIVE] Position closed on exchange: {pos.asset}")
                continue

            mark = float(ex_pos.get("entryPx", pos.entry_price))
            pos.update_unrealised(mark)

            if pos.status == PositionStatus.OPEN:
                tp1_hit = (
                    (pos.direction == Direction.LONG  and mark >= pos.tp1) or
                    (pos.direction == Direction.SHORT and mark <= pos.tp1)
                )
                if tp1_hit:
                    self._move_to_breakeven_live(pos)

    def _move_to_breakeven_live(self, pos: Position) -> None:
        """Place a new SL at entry price on Hyperliquid."""
        if not self._exchange:
            return
        is_buy = pos.direction == Direction.LONG
        remaining = round(pos.size / 2, 4)
        try:
            self._exchange.order(
                coin=pos.asset, is_buy=not is_buy,
                sz=remaining, limit_px=pos.entry_price,
                order_type={"trigger": {
                    "triggerPx": pos.entry_price,
                    "isMarket": True, "tpsl": "sl",
                }},
                reduce_only=True,
            )
            pos.current_sl = pos.entry_price
            pos.breakeven  = True
            pos.status     = PositionStatus.TP1_HIT
            logger.info(f"[LIVE] Breakeven SL placed for {pos.asset}")
        except Exception as exc:
            logger.error(f"Breakeven SL failed for {pos.asset}: {exc}")

    # ── Close all positions ───────────────────────────────────────────────────

    def close_all_positions(self) -> None:
        """Emergency close of all active positions (paper or live)."""
        for pos in list(self.positions.values()):
            if not pos.is_active:
                continue
            if not self.paper_mode and self._exchange:
                try:
                    is_buy = pos.direction != Direction.LONG
                    self._exchange.market_close(pos.asset)
                except Exception as exc:
                    logger.error(f"Failed to close {pos.asset}: {exc}")
            pos.status    = PositionStatus.CLOSED
            pos.closed_at = datetime.now(timezone.utc)
            logger.warning(f"Force-closed position: {pos.asset}")

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_positions_df(self) -> pd.DataFrame:
        if not self.positions:
            return pd.DataFrame()
        return pd.DataFrame([p.to_dict() for p in self.positions.values()])

    def get_risk_stats(self) -> dict:
        return self._risk_manager.get_stats()
