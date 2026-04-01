"""
CORE EDGE — Global Configuration
All tunable parameters live here. Never hardcode values in service modules.
"""

# ─── Assets & Timeframes ──────────────────────────────────────────────────────
ASSETS: list[str] = ["BTC", "ETH", "SOL", "ARB", "OP"]
TIMEFRAMES: list[str] = ["15m", "1H", "4H"]

# ─── Pivot / Structure Detection ─────────────────────────────────────────────
PIVOT_N: int = 5  # Candles required on each side to confirm a pivot

# ─── Indicators ──────────────────────────────────────────────────────────────
EMA_SHORT: int = 50
EMA_LONG: int = 200
RSI_PERIOD: int = 14

# ─── Volume ──────────────────────────────────────────────────────────────────
VOLUME_MA_PERIOD: int = 20
VOLUME_RATIO_MIN: float = 1.2  # Signal candle must be ≥ 1.2× the 20-period avg

# ─── Wick Rejection ──────────────────────────────────────────────────────────
MIN_WICK_RATIO: float = 0.40  # Wick must be ≥ 40% of total candle range

# ─── RSI Zones ───────────────────────────────────────────────────────────────
LONG_RSI_MIN: float = 40.0
LONG_RSI_MAX: float = 65.0
SHORT_RSI_MIN: float = 35.0
SHORT_RSI_MAX: float = 60.0
RSI_OPTIMAL_MIN: float = 45.0  # Used for scoring (max score at 45-55)
RSI_OPTIMAL_MAX: float = 55.0

# ─── Signal Filtering ────────────────────────────────────────────────────────
MIN_CONFIDENCE_SCORE: int = 65  # Signals below this are discarded

# ─── Risk Management ─────────────────────────────────────────────────────────
RISK_PER_TRADE: float = 0.01   # 1% of available capital per trade
MAX_LEVERAGE: int = 5

# ─── Take Profit Levels ──────────────────────────────────────────────────────
TP1_R_MULTIPLE: float = 1.5   # TP1 = entry ± 1.5R
TP2_R_MULTIPLE: float = 3.0   # TP2 = entry ± 3R  (displayed, manual execution)

# ─── Timing ──────────────────────────────────────────────────────────────────
POLLING_INTERVAL: int = 60         # seconds between full market scans
WS_RECONNECT_INTERVAL: int = 30    # seconds between position-monitor polls

# ─── API Retry ───────────────────────────────────────────────────────────────
MAX_RETRIES: int = 3
RETRY_BACKOFF_BASE: int = 2  # Exponential backoff base (seconds)
