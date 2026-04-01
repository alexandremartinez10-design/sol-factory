# -*- coding: utf-8 -*-
"""
Market Data Service v2
======================
Fetches OHLCV candles, funding rates, and open interest from Hyperliquid.

Key design points
-----------------
* fetch_bulk_candles() pages backward in time with a probe-first strategy:
  before entering the pagination loop it makes one minimal API call to confirm
  the coin name, interval string, and connectivity are all valid.

* _fetch_raw() distinguishes three outcomes:
    - Success  : returns a non-empty list[dict]
    - Empty    : API responded but returned []; logged as WARNING with the
                 raw response printed so the caller can diagnose the cause
    - Exception: logged as ERROR with the full traceback message

* Every pagination step logs: batch number, time window (human-readable),
  candles received, and running total — so "Not enough data" errors always
  have a paper trail.

* Rate-limit friendly: 150 ms sleep between bulk batches.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import pandas as pd
from hyperliquid.info import Info
from hyperliquid.utils import constants

from utils import config
from utils.helpers import timeframe_to_hl, timeframe_to_ms, ts_ms

logger = logging.getLogger(__name__)

# Hyperliquid returns at most this many candles per time-window call.
# Keeping it at 500 is safe; some community reports show the hard cap is
# ~5 000 but 500 avoids any undocumented per-call limits.
_MAX_PER_CALL = 500


def _ms_to_human(ms: int) -> str:
    """Format epoch-milliseconds as a compact UTC string for log messages."""
    return datetime.fromtimestamp(ms / 1_000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


class MarketDataService:
    """Fetches and caches OHLCV, funding, and OI data for all configured assets."""

    def __init__(self, use_testnet: bool = False) -> None:
        url = constants.TESTNET_API_URL if use_testnet else constants.MAINNET_API_URL
        self._info = Info(url, skip_ws=True)
        # cache[asset][tf] = {"df": DataFrame, "fetched_at": epoch_ms}
        self._cache: Dict[str, Dict[str, dict]] = {}
        # Funding cache: {asset: {"rate": float, "fetched_at": epoch_ms}}
        self._funding_cache: Dict[str, dict] = {}

    # -------------------------------------------------------------------------
    # Public: live data
    # -------------------------------------------------------------------------

    def fetch_all(self) -> Dict[str, Dict[str, pd.DataFrame]]:
        """
        Fetch OHLCV for every (asset, timeframe) in config.
        Uses TTL-based cache; re-fetches only when data is stale.
        Returns: dict[asset][tf] -> DataFrame
        """
        result: Dict[str, Dict[str, pd.DataFrame]] = {}
        for asset in config.ASSETS:
            result[asset] = {}
            for tf in config.TIMEFRAMES:
                df = self._get_candles(asset, tf, limit=config.CANDLE_LIVE_LIMIT)
                if df is not None:
                    result[asset][tf] = df
                else:
                    logger.warning(
                        "fetch_all: no data for %s %s — asset will be skipped", asset, tf
                    )
        return result

    def get_funding_rate(self, asset: str) -> Optional[float]:
        """Return latest hourly funding rate for an asset (cached 5 min)."""
        cached = self._funding_cache.get(asset)
        if cached and (ts_ms() - cached["fetched_at"]) < 300_000:
            return cached["rate"]

        for attempt in range(config.MAX_RETRIES):
            try:
                meta = self._info.meta_and_asset_ctxs()
                universe = meta[0].get("universe", [])
                idx = next(
                    (i for i, u in enumerate(universe) if u.get("name") == asset), None
                )
                if idx is None:
                    logger.warning("get_funding_rate: asset '%s' not found in universe", asset)
                    return None
                rate = float(meta[1][idx].get("funding", 0.0))
                self._funding_cache[asset] = {"rate": rate, "fetched_at": ts_ms()}
                return rate
            except Exception as exc:
                wait = config.RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "get_funding_rate %s attempt %d/%d failed: %s — retry in %ds",
                    asset, attempt + 1, config.MAX_RETRIES, exc, wait,
                )
                if attempt < config.MAX_RETRIES - 1:
                    time.sleep(wait)
        return None

    def get_open_interest(self, asset: str) -> Optional[float]:
        """Return current open interest for an asset (in USD)."""
        try:
            meta = self._info.meta_and_asset_ctxs()
            universe = meta[0].get("universe", [])
            idx = next(
                (i for i, u in enumerate(universe) if u.get("name") == asset), None
            )
            if idx is None:
                return None
            return float(meta[1][idx].get("openInterest", 0.0))
        except Exception as exc:
            logger.warning("get_open_interest %s: %s", asset, exc)
            return None

    def get_mark_price(self, asset: str) -> Optional[float]:
        """Return current mark price for an asset."""
        try:
            meta = self._info.meta_and_asset_ctxs()
            universe = meta[0].get("universe", [])
            idx = next(
                (i for i, u in enumerate(universe) if u.get("name") == asset), None
            )
            if idx is None:
                return None
            return float(meta[1][idx].get("markPx", 0.0))
        except Exception as exc:
            logger.warning("get_mark_price %s: %s", asset, exc)
            return None

    # -------------------------------------------------------------------------
    # Public: bulk historical data for backtester
    # -------------------------------------------------------------------------

    def fetch_bulk_candles(
        self, asset: str, timeframe: str, n_candles: int
    ) -> Optional[pd.DataFrame]:
        """
        Fetch up to n_candles candles by paging backward through time.

        Steps
        -----
        1. Probe call  — one minimal request to verify coin/interval/connectivity.
           If this returns empty, we log the raw API response and return None
           immediately with a clear error rather than silently failing.

        2. Pagination loop  — walks backward in _MAX_PER_CALL-candle windows,
           prepending each batch to all_candles.  Every step is INFO-logged:
           batch number, UTC start/end, candles received, running total.

        3. Early-stop conditions:
           * API returned an empty list  (we've hit the asset's listing date,
             or the call truly failed — both logged at WARNING)
           * Exception from the API  (logged at ERROR)
           * We already have >= n_candles  (stop when satisfied)

        Returns a deduplicated, chronologically sorted DataFrame, or None on
        failure (with enough log output to diagnose why).
        """
        hl_interval = timeframe_to_hl(timeframe)
        tf_ms = timeframe_to_ms(timeframe)

        logger.info(
            "fetch_bulk_candles START  asset=%s  tf=%s  hl_interval=%s  "
            "requested=%d  batch_size=%d  tf_ms=%d",
            asset, timeframe, hl_interval, n_candles, _MAX_PER_CALL, tf_ms,
        )

        # ------------------------------------------------------------------
        # Step 1: probe call — one candle window to confirm everything works
        # ------------------------------------------------------------------
        probe_end = ts_ms()
        probe_start = probe_end - tf_ms  # exactly one bar worth of time
        probe_raw, probe_err = self._fetch_raw_detailed(
            asset, hl_interval, probe_start, probe_end
        )

        if probe_err is not None:
            logger.error(
                "fetch_bulk_candles PROBE FAILED  asset=%s  tf=%s  "
                "interval='%s'  start=%s  end=%s\n"
                "  --> API error: %s\n"
                "  Hint: check that the coin name ('%s') is correct and that "
                "the Hyperliquid API is reachable.",
                asset, timeframe, hl_interval,
                _ms_to_human(probe_start), _ms_to_human(probe_end),
                probe_err, asset,
            )
            return None

        if probe_raw is not None and len(probe_raw) == 0:
            logger.error(
                "fetch_bulk_candles PROBE EMPTY  asset=%s  tf=%s  "
                "interval='%s'  start=%s  end=%s\n"
                "  --> API returned an empty list []\n"
                "  Raw response: %r\n"
                "  Hint: '%s' may not be a valid Hyperliquid perpetual symbol, "
                "or no candles exist for this timeframe yet.",
                asset, timeframe, hl_interval,
                _ms_to_human(probe_start), _ms_to_human(probe_end),
                probe_raw, asset,
            )
            return None

        logger.info(
            "fetch_bulk_candles PROBE OK  asset=%s  tf=%s  probe returned %d candle(s)",
            asset, timeframe, len(probe_raw) if probe_raw else 0,
        )

        # ------------------------------------------------------------------
        # Step 2: pagination loop
        # Walk backward in time, anchoring end_time to the actual oldest
        # candle timestamp returned by the previous batch.  This avoids
        # drift caused by candle-boundary misalignment and ensures every
        # batch covers exactly the history that exists.
        #
        # Break conditions (only these):
        #   a) API returns an empty list  -> we've hit listing-date
        #   b) API raises an exception    -> network / server error
        #   c) Safety cap (200 batches)   -> guard against infinite loops
        #   d) We have collected >= n_candles (checked by while-condition)
        # ------------------------------------------------------------------
        _MAX_BATCHES = 200          # safety cap
        all_candles: List[dict] = []
        # candle dict keyed by open-time ms for fast deduplication
        seen: dict = {}
        end_time = ts_ms()
        batch_num = 0

        while len(all_candles) < n_candles and batch_num < _MAX_BATCHES:
            # Always request _MAX_PER_CALL candles worth of time so the window
            # is consistent regardless of how many we still need.
            start_time = end_time - _MAX_PER_CALL * tf_ms

            batch_num += 1
            logger.info(
                "fetch_bulk_candles batch %d  asset=%s  tf=%s  "
                "window=[%s -> %s]  collected_so_far=%d",
                batch_num, asset, timeframe,
                _ms_to_human(start_time), _ms_to_human(end_time),
                len(all_candles),
            )

            raw, err = self._fetch_raw_detailed(asset, hl_interval, start_time, end_time)

            if err is not None:
                logger.error(
                    "fetch_bulk_candles batch %d EXCEPTION  asset=%s  tf=%s\n"
                    "  --> %s\n"
                    "  Stopping pagination. Collected %d candles so far.",
                    batch_num, asset, timeframe, err, len(all_candles),
                )
                break

            if raw is None or len(raw) == 0:
                logger.warning(
                    "fetch_bulk_candles batch %d EMPTY  asset=%s  tf=%s  "
                    "window=[%s -> %s]\n"
                    "  --> API returned [] (reached start of available history "
                    "or a gap in data)\n"
                    "  Stopping pagination. Collected %d candles so far.",
                    batch_num, asset, timeframe,
                    _ms_to_human(start_time), _ms_to_human(end_time),
                    len(all_candles),
                )
                break

            # Deduplicate and prepend new candles
            new_candles = [c for c in raw if c["t"] not in seen]
            for c in new_candles:
                seen[c["t"]] = True
            all_candles = new_candles + all_candles

            logger.info(
                "fetch_bulk_candles batch %d OK  asset=%s  tf=%s  "
                "returned=%d  new=%d  running_total=%d",
                batch_num, asset, timeframe,
                len(raw), len(new_candles), len(all_candles),
            )

            # Anchor next end_time to the ACTUAL oldest candle timestamp,
            # not the computed start_time (critical correctness fix).
            oldest_t = min(c["t"] for c in raw)
            end_time = oldest_t - 1

            time.sleep(0.15)

        # ------------------------------------------------------------------
        # Step 3: finalise
        # ------------------------------------------------------------------
        if not all_candles:
            logger.error(
                "fetch_bulk_candles RESULT: 0 candles collected for %s %s. "
                "Review the log lines above for the exact failure reason.",
                asset, timeframe,
            )
            return None

        df = self._parse_candles(all_candles)
        df = (
            df.drop_duplicates(subset=["timestamp"])
            .sort_values("timestamp")
            .reset_index(drop=True)
        )

        # Trim to exactly the most recent n_candles requested
        if len(df) > n_candles:
            df = df.tail(n_candles).reset_index(drop=True)

        logger.info(
            "fetch_bulk_candles DONE  asset=%s  tf=%s  "
            "total_unique_candles=%d  batches=%d  "
            "date_range=[%s -> %s]",
            asset, timeframe, len(df), batch_num,
            df["timestamp"].iloc[0] if len(df) else "N/A",
            df["timestamp"].iloc[-1] if len(df) else "N/A",
        )
        return df

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    def _get_candles(self, asset: str, tf: str, limit: int) -> Optional[pd.DataFrame]:
        """Return cached candles if fresh, otherwise fetch live."""
        cached = self._cache.get(asset, {}).get(tf)
        if cached:
            age_ms = ts_ms() - cached["fetched_at"]
            if age_ms < config.CACHE_TTL_SECONDS * 1_000:
                logger.debug("_get_candles cache HIT  %s %s  age=%dms", asset, tf, age_ms)
                return cached["df"]

        df = self._fetch_candles(asset, tf, limit)
        if df is not None:
            self._cache.setdefault(asset, {})[tf] = {"df": df, "fetched_at": ts_ms()}
        elif cached:
            logger.warning(
                "_get_candles: fetch failed for %s %s — serving stale cache (%d candles)",
                asset, tf, len(cached["df"]),
            )
            return cached["df"]
        return df

    def _fetch_candles(self, asset: str, tf: str, limit: int) -> Optional[pd.DataFrame]:
        """Single-window fetch for live/analysis use (no pagination)."""
        hl_interval = timeframe_to_hl(tf)
        tf_ms = timeframe_to_ms(tf)
        end_time = ts_ms()
        start_time = end_time - limit * tf_ms

        logger.debug(
            "_fetch_candles  %s %s  interval='%s'  window=[%s -> %s]  limit=%d",
            asset, tf, hl_interval,
            _ms_to_human(start_time), _ms_to_human(end_time), limit,
        )

        for attempt in range(config.MAX_RETRIES):
            raw, err = self._fetch_raw_detailed(asset, hl_interval, start_time, end_time)

            if err is not None:
                # 429 rate-limit: back off longer than the standard retry cadence
                is_rate_limit = "429" in str(err) or "rate limit" in str(err).lower()
                if is_rate_limit:
                    wait = 5 * (2 ** attempt)   # 5 s, 10 s, 20 s …
                    logger.warning(
                        "_fetch_candles %s %s attempt %d/%d RATE LIMITED (429) "
                        "— backing off %ds",
                        asset, tf, attempt + 1, config.MAX_RETRIES, wait,
                    )
                else:
                    wait = config.RETRY_BACKOFF_BASE ** attempt
                    logger.error(
                        "_fetch_candles %s %s attempt %d/%d EXCEPTION: %s — retry in %ds",
                        asset, tf, attempt + 1, config.MAX_RETRIES, err, wait,
                    )
                if attempt < config.MAX_RETRIES - 1:
                    time.sleep(wait)
                continue

            if raw is None or len(raw) == 0:
                logger.warning(
                    "_fetch_candles %s %s attempt %d/%d: API returned empty list. "
                    "interval='%s'  start=%s  end=%s",
                    asset, tf, attempt + 1, config.MAX_RETRIES,
                    hl_interval, _ms_to_human(start_time), _ms_to_human(end_time),
                )
                # Empty is not retryable — the window is just empty.
                return None

            df = self._parse_candles(raw)
            logger.debug(
                "_fetch_candles %s %s OK: %d candles parsed", asset, tf, len(df)
            )
            return df

        logger.error(
            "_fetch_candles %s %s: all %d attempts failed",
            asset, tf, config.MAX_RETRIES,
        )
        return None

    def _fetch_raw_detailed(
        self,
        asset: str,
        hl_interval: str,
        start_time: int,
        end_time: int,
    ) -> Tuple[Optional[List[dict]], Optional[str]]:
        """
        Call candles_snapshot and return (data, error_string).

        Returns
        -------
        (list, None)   -- success; list may be empty
        (None, str)    -- exception; str contains the error message
        """
        try:
            # SDK parameter is 'name' (mapped internally to coin ID).
            # Do NOT pass as keyword 'coin=' — the installed SDK uses 'name='.
            raw = self._info.candles_snapshot(
                asset,          # positional: name
                hl_interval,    # positional: interval
                start_time,     # positional: startTime
                end_time,       # positional: endTime
            )
            # Validate the response is a list (guard against unexpected formats)
            if not isinstance(raw, list):
                return (
                    None,
                    f"Unexpected API response type {type(raw).__name__}: {str(raw)[:200]}",
                )
            return raw, None
        except Exception as exc:
            return None, str(exc)

    @staticmethod
    def _parse_candles(raw: list) -> pd.DataFrame:
        """Convert raw API candle list into a clean OHLCV DataFrame."""
        df = pd.DataFrame(raw)
        rename = {
            "t": "timestamp",
            "o": "open",
            "h": "high",
            "l": "low",
            "c": "close",
            "v": "volume",
        }
        df = df.rename(columns=rename)
        available = [c for c in rename.values() if c in df.columns]
        df = df[available]

        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        for col in ("open", "high", "low", "close", "volume"):
            if col in df.columns:
                df[col] = df[col].astype(float)

        return df.sort_values("timestamp").reset_index(drop=True)
