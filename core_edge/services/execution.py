"""
Execution Service — Hyperliquid order management and position monitoring.

Responsibilities:
  - Read capital from the exchange
  - Calculate position size (1 % risk, max x5 leverage)
  - Place Limit Entry + Stop Loss + TP1 as a batch
  - Monitor active positions via periodic polling (mimics WS reconnect logic)
  - Auto-move SL to breakeven when TP1 is hit
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import datetime
from typing import Dict, Optional

import eth_account
from dotenv import load_dotenv
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants

import config
from models.position import Position, PositionStatus
from models.signal import Direction, Signal, SignalStatus

load_dotenv()
logger = logging.getLogger(__name__)


class ExecutionService:

    def __init__(self) -> None:
        wallet = os.getenv("HL_WALLET_ADDRESS", "").strip()
        private_key = os.getenv("HL_API_SECRET", "").strip()

        if not wallet or not private_key:
            raise ValueError(
                "HL_WALLET_ADDRESS and HL_API_SECRET must be set in .env"
            )

        self.wallet_address = wallet
        self._account = eth_account.Account.from_key(private_key)
        self._info = Info(constants.MAINNET_API_URL, skip_ws=True)
        self._exchange = Exchange(self._account, constants.MAINNET_API_URL)

        self.positions: Dict[str, Position] = {}
        self._monitor_thread: Optional[threading.Thread] = None
        self._monitor_running = False

    # ── Capital & Sizing ─────────────────────────────────────────────────────

    def get_available_capital(self) -> float:
        """Return account value (USDC) from Hyperliquid."""
        try:
            state = self._info.user_state(self.wallet_address)
            value = float(state["marginSummary"]["accountValue"])
            logger.info(f"Available capital: ${value:,.2f}")
            return value
        except (KeyError, TypeError, Exception) as exc:
            logger.error(f"Failed to fetch capital: {exc}")
            raise

    def calculate_position_size(
        self, capital: float, entry_price: float, stop_loss: float
    ) -> tuple[float, int]:
        """
        Risk exactly RISK_PER_TRADE of capital.
        Returns (size_in_coins, leverage_used).

        Formula:
          risk_amount  = capital × 0.01
          raw_size     = risk_amount / |entry − sl|          (no leverage)
          notional     = raw_size × entry
          leverage     = ceil(notional / capital), capped at MAX_LEVERAGE
          final_size   = risk_amount / |entry − sl|          (unchanged — leverage only
                         controls margin requirement, not the risk amount)
        """
        if entry_price == stop_loss:
            raise ValueError("Entry and stop-loss cannot be identical")

        risk_amount = capital * config.RISK_PER_TRADE
        price_diff = abs(entry_price - stop_loss)
        raw_size = risk_amount / price_diff
        notional = raw_size * entry_price

        # Minimum leverage to open the position within available margin
        leverage = 1
        if notional > capital:
            leverage = min(config.MAX_LEVERAGE, int(notional / capital) + 1)

        logger.info(
            f"Sizing: capital=${capital:.2f} risk=${risk_amount:.2f} "
            f"Δprice={price_diff:.4f} size={raw_size:.4f} "
            f"notional=${notional:.2f} leverage=x{leverage}"
        )
        return round(raw_size, 4), leverage

    # ── Order Execution ──────────────────────────────────────────────────────

    def execute_signal(self, signal: Signal) -> Position:
        """
        Place Limit Entry + Stop Loss + Take Profit 1 orders simultaneously.
        Returns a Position object that is registered for monitoring.
        """
        capital = self.get_available_capital()
        size, leverage = self.calculate_position_size(
            capital, signal.entry, signal.stop_loss
        )

        is_buy = signal.direction == Direction.LONG
        asset = signal.asset

        logger.info(
            f"Executing {signal.direction.value} {asset} | "
            f"entry={signal.entry} SL={signal.stop_loss} TP1={signal.tp1} "
            f"size={size} x{leverage}"
        )

        try:
            # Set isolated leverage
            lev_resp = self._exchange.update_leverage(leverage, asset, is_cross=False)
            logger.debug(f"Leverage set: {lev_resp}")

            # 1 — Limit entry
            entry_resp = self._exchange.order(
                coin=asset,
                is_buy=is_buy,
                sz=size,
                limit_px=signal.entry,
                order_type={"limit": {"tif": "Gtc"}},
                reduce_only=False,
            )
            logger.info(f"Entry order: {entry_resp}")

            # 2 — Stop loss (trigger → market)
            sl_resp = self._exchange.order(
                coin=asset,
                is_buy=not is_buy,
                sz=size,
                limit_px=signal.stop_loss,
                order_type={
                    "trigger": {
                        "triggerPx": signal.stop_loss,
                        "isMarket": True,
                        "tpsl": "sl",
                    }
                },
                reduce_only=True,
            )
            logger.info(f"SL order: {sl_resp}")

            # 3 — Take profit 1 (trigger → limit)
            tp1_resp = self._exchange.order(
                coin=asset,
                is_buy=not is_buy,
                sz=size,
                limit_px=signal.tp1,
                order_type={
                    "trigger": {
                        "triggerPx": signal.tp1,
                        "isMarket": False,
                        "tpsl": "tp",
                    }
                },
                reduce_only=True,
            )
            logger.info(f"TP1 order: {tp1_resp}")

        except Exception as exc:
            logger.error(f"Order placement failed for {asset}: {exc}")
            raise

        position = Position(
            asset=asset,
            direction=signal.direction,
            entry_price=signal.entry,
            initial_sl=signal.stop_loss,
            current_sl=signal.stop_loss,
            tp1=signal.tp1,
            tp2=signal.tp2,
            size=size,
            leverage=leverage,
        )
        self.positions[position.id] = position
        signal.status = SignalStatus.EXECUTED

        self._ensure_monitor_running()
        logger.info(f"Position created: {position.id}")
        return position

    # ── Position Monitoring ──────────────────────────────────────────────────

    def _ensure_monitor_running(self) -> None:
        if not self._monitor_running:
            self._monitor_running = True
            self._monitor_thread = threading.Thread(
                target=self._monitor_loop, daemon=True, name="position-monitor"
            )
            self._monitor_thread.start()
            logger.info("Position monitor started")

    def _monitor_loop(self) -> None:
        """
        Polls positions every WS_RECONNECT_INTERVAL seconds.
        Stops automatically when no active positions remain.
        Mirrors WebSocket reconnect behaviour: catches exceptions and retries.
        """
        while self._monitor_running:
            active = [p for p in self.positions.values() if p.is_active]
            if not active:
                logger.info("No active positions — monitor stopping")
                self._monitor_running = False
                break

            try:
                self._check_positions()
            except Exception as exc:
                logger.error(
                    f"Monitor poll error: {exc}. "
                    f"Reconnecting in {config.WS_RECONNECT_INTERVAL}s"
                )

            time.sleep(config.WS_RECONNECT_INTERVAL)

    def _check_positions(self) -> None:
        """Single poll: compare known positions against exchange state."""
        user_state = self._info.user_state(self.wallet_address)
        open_on_exchange: dict[str, dict] = {
            p["position"]["coin"]: p["position"]
            for p in user_state.get("assetPositions", [])
            if float(p["position"].get("szi", 0)) != 0
        }

        for pos in list(self.positions.values()):
            if not pos.is_active:
                continue

            exchange_pos = open_on_exchange.get(pos.asset)

            # Position closed on exchange
            if exchange_pos is None:
                pos.status = PositionStatus.CLOSED
                pos.closed_at = datetime.utcnow()
                logger.info(f"Position {pos.id} ({pos.asset}) closed on exchange")
                continue

            # Estimate current mark price
            try:
                mark_px = float(exchange_pos.get("entryPx", pos.entry_price))
            except (TypeError, ValueError):
                mark_px = pos.entry_price

            # TP1 check (only while still OPEN, not already in TP1_HIT state)
            if pos.status == PositionStatus.OPEN:
                tp1_hit = (
                    (pos.direction == Direction.LONG and mark_px >= pos.tp1)
                    or (pos.direction == Direction.SHORT and mark_px <= pos.tp1)
                )
                if tp1_hit:
                    logger.info(
                        f"TP1 reached for {pos.asset} @ {mark_px:.4f} "
                        f"(TP1={pos.tp1:.4f}) — moving SL to breakeven"
                    )
                    self._move_to_breakeven(pos)

    def _move_to_breakeven(self, position: Position) -> None:
        """
        Cancel existing SL and replace with a new one at entry price.
        Half the position remains open (TP1 already filled 50 %).
        """
        is_buy = position.direction == Direction.LONG
        remaining_size = round(position.size / 2, 4)

        try:
            be_resp = self._exchange.order(
                coin=position.asset,
                is_buy=not is_buy,
                sz=remaining_size,
                limit_px=position.entry_price,
                order_type={
                    "trigger": {
                        "triggerPx": position.entry_price,
                        "isMarket": True,
                        "tpsl": "sl",
                    }
                },
                reduce_only=True,
            )
            logger.info(f"Breakeven SL placed: {be_resp}")
        except Exception as exc:
            logger.error(
                f"Failed to place breakeven SL for {position.id}: {exc}"
            )
            return

        position.current_sl = position.entry_price
        position.breakeven = True
        position.status = PositionStatus.TP1_HIT
        logger.info(
            f"Position {position.id} ({position.asset}): "
            f"SL moved to breakeven @ {position.entry_price:.4f}"
        )
