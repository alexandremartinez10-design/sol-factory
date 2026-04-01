# ⚡ CORE EDGE — Multi-Timeframe Swing Trading System

Semi-automatic trading system for **Hyperliquid** perps.
The AI detects and scores opportunities — **you decide before any order is sent**.

---

## Architecture

```
core_edge/
├── .env                    ← API credentials (never commit)
├── main.py                 ← CLI entry point
├── config.py               ← All tunable parameters
├── requirements.txt
├── models/
│   ├── signal.py           ← Signal dataclass
│   └── position.py         ← Position dataclass
├── services/
│   ├── market_data.py      ← OHLCV polling via Hyperliquid REST
│   ├── analysis.py         ← Pivot detection, EMA, RSI, confluence
│   ├── scoring.py          ← Confidence Score (0–100)
│   └── execution.py        ← Order placement + position monitoring
└── ui/
    └── dashboard.py        ← Streamlit dashboard
```

---

## Strategy — CORE EDGE

### Timeframes
| Role | Timeframe |
|------|-----------|
| Confirmation | 4H |
| Signal | 1H |
| Entry timing | 15m |

### Long confluence (ALL must be true)
1. Uptrend structure — Higher Highs + Higher Lows (N=5 pivot confirmation)
2. Price above EMA 50 **and** EMA 200
3. RSI 14 between **40 and 65** (momentum without overbought)
4. Lower wick ≥ 40% of total candle range (rejection candle)
5. Volume ≥ 1.2× the 20-candle average

### Short confluence (ALL must be true)
1. Downtrend structure — Lower Highs + Lower Lows
2. Price below EMA 50 **and** EMA 200
3. RSI 14 between **35 and 60**
4. Upper wick ≥ 40% of total candle range
5. Volume ≥ 1.2× the 20-candle average

### Confidence Score (0–100)
| Criterion | Weight |
|-----------|--------|
| Structure clarity (pivots) | 25 % |
| EMA 50/200 alignment spread | 25 % |
| RSI in optimal zone (45–55) | 20 % |
| Wick rejection strength | 15 % |
| Volume ratio | 15 % |

Only signals with score **≥ 65** are shown. Score ≥ 80 = green, 65–79 = orange.

### Risk Management
- **Risk per trade**: 1% of available capital
- **Max leverage**: x5 (isolated margin)
- **TP1**: entry ± 1.5R → auto-closes 50%, SL moves to breakeven
- **TP2**: entry ± 3R → displayed in UI, placed manually (optional)

---

## Installation

### Prerequisites
- Python 3.11 or later
- A Hyperliquid account with an **API agent key** (not your main wallet key)

### 1. Clone / download the project

```bash
cd core_edge
```

### 2. Create a virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure credentials

Edit `.env` (already provided as a template):

```env
HL_WALLET_ADDRESS=0xYourChecksummedWalletAddress
HL_API_SECRET=0xYourAPIAgentPrivateKey
DEBUG=false
```

> **How to get an API key on Hyperliquid**
> Go to **app.hyperliquid.xyz → API → Create API Agent**.
> Use the agent's private key in `HL_API_SECRET`, not your main wallet key.

---

## Running

### Interactive Dashboard (recommended)

```bash
streamlit run ui/dashboard.py
```

Open `http://localhost:8501` in your browser.

### Headless scan (CLI)

Logs signals to stdout and `core_edge.log` without any UI:

```bash
python main.py --scan
```

---

## Workflow

```
1. Click "Analyser maintenant"
   └─► MarketDataService fetches OHLCV for all assets × timeframes
   └─► AnalysisEngine checks confluence rules
   └─► ScoringEngine assigns score, filters < 65

2. Review the "Opportunités détectées" table
   ├─► Click EXECUTE  → 3 orders sent (Entry + SL + TP1)
   └─► Click IGNORE   → signal dismissed

3. Monitor "Positions actives"
   └─► When TP1 is hit → SL auto-moves to breakeven
   └─► TP2 level is shown; place that order manually if desired
```

---

## Configuration (`config.py`)

All parameters are in `config.py`. Key ones:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ASSETS` | BTC, ETH, SOL, ARB, OP | Assets to monitor |
| `TIMEFRAMES` | 15m, 1H, 4H | Timeframes analysed |
| `PIVOT_N` | 5 | Candles for pivot confirmation |
| `MIN_CONFIDENCE_SCORE` | 65 | Minimum score to display |
| `RISK_PER_TRADE` | 0.01 | 1% risk per trade |
| `MAX_LEVERAGE` | 5 | Maximum leverage (isolated) |
| `POLLING_INTERVAL` | 60 | Seconds between scans |

---

## Security

- **Never commit `.env`** — it's listed in `.gitignore` by design.
- Use a **dedicated API agent key**, not your main wallet private key.
- The system uses **isolated margin** by default — no cross-margin risk.
- All orders require **manual confirmation** in the UI before execution.

---

## Disclaimer

This software is provided for educational and informational purposes only.
Trading cryptocurrencies carries significant risk. Always validate signals manually
and never risk capital you cannot afford to lose.
