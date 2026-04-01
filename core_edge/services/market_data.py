"""
Market Data Service — OHLCV retrieval via Hyperliquid REST API.

- Polling only (no WebSocket for candle data).
- Retries up to MAX_RETRIES times with exponential backoff on failure.
- Returns a dict[asset][timeframe] → pd.DataFrame.
"""

from __future__ import annotations

import logging
import time
from typing import Dict, Optional

import pandas as pd
from hyperliquid.info import Info
from hyperliquid.utils import constants

import config

logger = logging.getLogger(__name__)

# Our timeframe notation → Hyperliquid interval string
_TF_MAP: dict[str, str] = {
    "15m": "15m",
    "1H": "1h",
    "4H": "4h",
}

# Milliseconds per interval (used to compute start_time from limit)
_TF_MS: dict[str, int] = {
    "15m": 15 * 60 * 1_000,
    "1H": 60 * 60 * 1_000,
    "4H": 4 * 60 * 60 * 1_000,
}

# Number of candles to request — must be > EMA_LONG + PIVOT_N * 2 + safety margin
_CANDLE_LIMIT = 300


class MarketDataService:
    """Fetches and caches OHLCV data for all configured assets."""

    def __init__(self) -> None:
        self._info = Info(constants.MAINNET_API_URL, skip_ws=True)
        self._cache: Dict[str, Dict[str, pd.DataFrame]] = {}

    # ── Public API ────────────────────────────────────────────────────────────

    def fetch_all(self) -> Dict[str, Dict[str, pd.DataFrame]]:
        """
        Fetch OHLCV for every (asset, timeframe) combination.
        Falls back to cached data for any failed fetch.
        Returns: dict[asset][timeframe] → DataFrame
        """
        result: Dict[str, Dict[str, pd.DataFrame]] = {}

        for asset in config.ASSETS:
            result[asset] = {}
            for tf in config.TIMEFRAMES:
                df = self._fetch_with_retry(asset, tf)
                if df is not None:
                    result[asset][tf] = df
                    # Update cache on success
                    self._cache.setdefault(asset, {})[tf] = df
                elif asset in self._cache and tf in self._cache[asset]:
                    logger.warning(
                        f"{asset} {tf}: using cached data (fetch failed)"
                    )
                    result[asset][tf] = self._cache[asset][tf]
                else:
                    logger.error(f"{asset} {tf}: no data available — skipping")

        return result

    def get_cache(self) -> Dict[str, Dict[str, pd.DataFrame]]:
        return self._cache

    # ── Internal ──────────────────────────────────────────────────────────────

    def _fetch_with_retry(self, asset: str, timeframe: str) -> Optional[pd.DataFrame]:
        hl_interval = _TF_MAP.get(timeframe)
        if hl_interval is None:
            logger.error(f"Unknown timeframe '{timeframe}' — check config.TIMEFRAMES")
            return None

        interval_ms = _TF_MS[timeframe]
        end_time = int(time.time() * 1_000)
        start_time = end_time - (_CANDLE_LIMIT * interval_ms)

        last_exc: Exception | None = None
        for attempt in range(config.MAX_RETRIES):
            try:
                raw = self._info.candles_snapshot(
                    coin=asset,
                    interval=hl_interval,
                    startTime=start_time,
                    endTime=end_time,
                )
                if not raw:
                    logger.warning(f"{asset} {timeframe}: empty response from API")
                    return None

                df = self._parse_candles(raw)
                logger.debug(f"{asset} {timeframe}: {len(df)} candles fetched")
                return df

            except Exception as exc:
                last_exc = exc
                wait = config.RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    f"{asset} {timeframe}: attempt {attempt + 1}/{config.MAX_RETRIES} "
                    f"failed — {exc}. Retrying in {wait}s"
                )
                if attempt < config.MAX_RETRIES - 1:
                    time.sleep(wait)

        logger.error(
            f"{asset} {timeframe}: all {config.MAX_RETRIES} attempts failed. "
            f"Last error: {last_exc}"
        )
        return None

    @staticmethod
    def _parse_candles(raw: list[dict]) -> pd.DataFrame:
        """Convert raw API response list into a clean OHLCV DataFrame."""
        df = pd.DataFrame(raw)

        # Hyperliquid column names
        rename = {"t": "timestamp", "o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"}
        df = df.rename(columns=rename)[list(rename.values())]

        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        for col in ("open", "high", "low", "close", "volume"):
            df[col] = df[col].astype(float)

        df = df.sort_values("timestamp").reset_index(drop=True)
        return df
