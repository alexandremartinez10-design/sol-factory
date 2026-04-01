# -*- coding: utf-8 -*-
"""
Hyperliquid API connection diagnostic script.

Run with:
    python tests/test_api_connection.py

Checks:
  1. Raw HTTP reachability of the /info endpoint
  2. All available perpetual symbols (exact names the SDK accepts)
  3. Valid interval strings accepted by candleSnapshot
  4. Fetch 10 candles for the first symbol found
  5. Fetch 10 candles for BTC, ETH, SOL specifically
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Allow imports from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from hyperliquid.info import Info
from hyperliquid.utils import constants

API_URL = constants.MAINNET_API_URL
SEPARATOR = "-" * 70


def section(title: str) -> None:
    print(f"\n{SEPARATOR}")
    print(f"  {title}")
    print(SEPARATOR)


# ---------------------------------------------------------------------------
# 1. Raw HTTP check
# ---------------------------------------------------------------------------
section("1. Raw HTTP reachability")

try:
    resp = requests.post(
        f"{API_URL}/info",
        json={"type": "meta"},
        timeout=10,
    )
    print(f"  Status : {resp.status_code}")
    print(f"  URL    : {API_URL}/info")
    if resp.status_code != 200:
        print(f"  Body   : {resp.text[:300]}")
        print("  ERROR: non-200 response — API may be down or URL is wrong")
        sys.exit(1)
    else:
        print("  OK: API is reachable")
except Exception as e:
    print(f"  EXCEPTION: {e}")
    print("  Cannot reach Hyperliquid API. Check network / firewall.")
    sys.exit(1)


# ---------------------------------------------------------------------------
# 2. List all perp symbols via SDK
# ---------------------------------------------------------------------------
section("2. All available perpetual symbols")

info = Info(API_URL, skip_ws=True)

try:
    meta = info.meta_and_asset_ctxs()
    universe = meta[0].get("universe", [])
    print(f"  Total symbols found: {len(universe)}")
    print()
    print(f"  {'#':<5} {'name':<12} {'szDecimals':<12} {'maxLeverage'}")
    print(f"  {'-'*5} {'-'*12} {'-'*12} {'-'*12}")
    for i, asset in enumerate(universe):
        name = asset.get("name", "?")
        sz   = asset.get("szDecimals", "?")
        lev  = asset.get("maxLeverage", "?")
        print(f"  {i:<5} {name:<12} {str(sz):<12} {lev}")
    first_symbol = universe[0]["name"] if universe else None
except Exception as e:
    print(f"  EXCEPTION listing symbols: {e}")
    first_symbol = None


# ---------------------------------------------------------------------------
# 3. name_to_coin mapping (what the SDK uses internally)
# ---------------------------------------------------------------------------
section("3. SDK internal name_to_coin mapping (first 20)")

try:
    mapping = info.name_to_coin
    items = list(mapping.items())
    print(f"  Total entries in name_to_coin: {len(items)}")
    print()
    print(f"  {'name':<14} -> coin_id")
    print(f"  {'-'*14}    {'-'*20}")
    for name, coin_id in items[:20]:
        print(f"  {name:<14} -> {coin_id}")
    if len(items) > 20:
        print(f"  ... ({len(items) - 20} more)")
except Exception as e:
    print(f"  EXCEPTION reading name_to_coin: {e}")


# ---------------------------------------------------------------------------
# 4. Valid interval strings
# ---------------------------------------------------------------------------
section("4. Valid candleSnapshot interval strings")

CANDIDATE_INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h",
                       "8h", "12h", "1d", "3d", "1w",
                       "1H", "4H", "1D"]  # also test uppercase variants

test_coin = first_symbol or "BTC"
now_ms = int(time.time() * 1_000)
window_ms = 60 * 60 * 1_000  # 1 hour window

print(f"  Testing with coin='{test_coin}', 1-hour window")
print()
print(f"  {'interval':<10} result")
print(f"  {'-'*10} {'-'*40}")

valid_intervals: list[str] = []
for iv in CANDIDATE_INTERVALS:
    try:
        raw = info.candles_snapshot(test_coin, iv, now_ms - window_ms, now_ms)
        if isinstance(raw, list) and len(raw) > 0:
            valid_intervals.append(iv)
            print(f"  {iv:<10} OK — {len(raw)} candle(s) returned")
        elif isinstance(raw, list):
            print(f"  {iv:<10} OK — empty list (0 candles, interval may be too coarse)")
        else:
            print(f"  {iv:<10} UNEXPECTED response type: {type(raw).__name__}: {str(raw)[:80]}")
    except Exception as e:
        print(f"  {iv:<10} ERROR: {e}")

print()
print(f"  Valid intervals returning data: {valid_intervals}")


# ---------------------------------------------------------------------------
# 5. Fetch 10 candles for first symbol found
# ---------------------------------------------------------------------------
section(f"5. Fetch 10 candles for first symbol: '{first_symbol}'")

if first_symbol and valid_intervals:
    iv = valid_intervals[0]
    iv_ms_map = {
        "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
        "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
        "8h": 28_800_000, "12h": 43_200_000, "1d": 86_400_000,
    }
    iv_ms = iv_ms_map.get(iv, 3_600_000)
    start = now_ms - 12 * iv_ms
    end   = now_ms

    try:
        raw = info.candles_snapshot(first_symbol, iv, start, end)
        print(f"  Symbol: {first_symbol}  interval: {iv}  window: 12 bars")
        print(f"  Candles returned: {len(raw)}")
        if raw:
            print(f"  First candle keys : {list(raw[0].keys())}")
            print(f"  First candle sample: {raw[0]}")
            print(f"  Last  candle sample: {raw[-1]}")
    except Exception as e:
        print(f"  EXCEPTION: {e}")
else:
    print("  Skipped — no valid symbol or interval found above")


# ---------------------------------------------------------------------------
# 6. Fetch 10 candles for BTC, ETH, SOL
# ---------------------------------------------------------------------------
section("6. Fetch 10 x 1h candles for BTC, ETH, SOL")

for sym in ["BTC", "ETH", "SOL"]:
    start = now_ms - 12 * 3_600_000
    try:
        raw = info.candles_snapshot(sym, "1h", start, now_ms)
        if isinstance(raw, list) and raw:
            first = raw[0]
            print(f"  {sym:<6} OK  candles={len(raw)}  "
                  f"open={first.get('o','?')}  close={first.get('c','?')}  "
                  f"t={first.get('t','?')}")
        elif isinstance(raw, list):
            print(f"  {sym:<6} EMPTY LIST — 0 candles returned for '1h'")
        else:
            print(f"  {sym:<6} UNEXPECTED: {type(raw).__name__}: {str(raw)[:100]}")
    except Exception as e:
        print(f"  {sym:<6} EXCEPTION: {e}")


# ---------------------------------------------------------------------------
# 7. Cross-check config symbols against SDK name_to_coin
# ---------------------------------------------------------------------------
section("7. Config symbols vs SDK name_to_coin")

try:
    from utils.config import ASSETS, TIMEFRAMES
    from utils.helpers import timeframe_to_hl

    print(f"  Config ASSETS    : {ASSETS}")
    print(f"  Config TIMEFRAMES: {TIMEFRAMES}")
    print()

    mapping = info.name_to_coin
    for asset in ASSETS:
        in_sdk = asset in mapping
        status = "OK" if in_sdk else "MISSING from name_to_coin — fetch will fail"
        print(f"  {asset:<10} {status}")

    print()
    for tf in TIMEFRAMES:
        hl = timeframe_to_hl(tf)
        ok = hl in valid_intervals
        status = f"-> '{hl}' {'OK' if ok else 'NOT in valid intervals list'}"
        print(f"  {tf:<8} {status}")

except Exception as e:
    print(f"  EXCEPTION: {e}")


print(f"\n{SEPARATOR}")
print("  Diagnostic complete.")
print(SEPARATOR)
