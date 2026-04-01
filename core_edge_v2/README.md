# CORE EDGE Assistant v2

A production-ready, statistically grounded semi-automatic trading assistant for **Hyperliquid perpetuals** (2026).

---

## What it does

- Detects high-probability setups via 5 confluence criteria: **structure** (HH/HL pivots), **EMA 50/200**, **RSI 14**, **wick rejection**, **volume surge**
- Applies mandatory edge filters: **ADX > 25**, **ATR volatility percentile**, **funding rate**, **OI spike detection**
- Requires **multi-timeframe confirmation** (≥2 TFs agree) before generating a signal
- Dynamic scoring weights optimised by **Optuna walk-forward validation** (6 training + 1 OOS month, rolling)
- **Live signals only enabled when walk-forward passes** (PF > 1.8, Sharpe > 1.5, MaxDD < 15%)
- Full **paper trading mode** — test without risking real money
- Hard **daily −3% / weekly −8%** loss limits with auto-pause

---

## Installation

```bash
# 1. Clone / copy this folder
cd core_edge_v2

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up credentials
cp .env.example .env
# Edit .env and fill in HL_WALLET_ADDRESS and HL_API_SECRET
```

> **Never commit `.env` to git.** Add it to `.gitignore` immediately.

---

## Step 1 — Run the backtest FIRST

**This is not optional.** Before enabling live signals you must validate the strategy on historical data.

```bash
streamlit run main.py
```

1. Open `http://localhost:8501`
2. Go to **Backtest & Optimisation** tab
3. Select an asset (e.g. BTC) and timeframe (1H)
4. Set candles to `5000`
5. Click **Run Backtest** — wait for results
6. Verify metrics: Profit Factor > 1.8, Sharpe > 1.5, MaxDD < 15%
7. Click **Walk-Forward Optimise** — this runs Optuna across multiple folds
8. Ensure ≥3 folds pass the gate. Only then will live signals be enabled.

---

## Step 2 — Test in Paper Mode

1. In the sidebar, ensure **Paper Trading** is ON (default)
2. Go to **Live Dashboard** and click **Scan Markets**
3. Review signals. Execute some to see paper positions.
4. Monitor for at least 1–2 weeks before going live.

---

## Step 3 — Go Live (with extreme caution)

```
⚠️  WARNING: Live mode places REAL orders using REAL money.
    You can lose your entire trading capital.
    Only proceed after completing Steps 1 and 2.
    Never risk more than you can afford to lose.
```

1. Confirm your `.env` has valid mainnet credentials
2. In the sidebar: toggle off Paper Trading → click **Confirm Live Mode**
3. The bot will only place signals if the walk-forward gate is OPEN (green status in sidebar)
4. Monitor the **Performance** tab regularly

---

## Project Structure

```
core_edge_v2/
├── main.py                     # Entry point → launches Streamlit
├── requirements.txt
├── .env.example                # Copy to .env and fill in keys
│
├── utils/
│   ├── config.py               # All parameters (edit here, not service files)
│   ├── logger.py               # Rotating file + coloured console logger
│   └── helpers.py              # Shared utility functions
│
├── models/
│   ├── signal.py               # Signal dataclass
│   └── position.py             # Position dataclass
│
├── services/
│   ├── market_data.py          # Candle fetching + funding + OI (bulk + live)
│   ├── analysis.py             # 5-criteria analysis + ADX + ATR + multi-TF
│   ├── scoring.py              # Dynamic confidence score (0–100)
│   ├── backtester.py           # Vectorized + event-driven backtester
│   ├── optimizer.py            # Walk-forward Optuna optimisation
│   ├── risk_manager.py         # Position sizing + daily/weekly loss limits
│   └── execution.py            # Order placement (live) + simulation (paper)
│
├── ui/
│   └── dashboard.py            # Streamlit dashboard (5 tabs)
│
└── tests/
    └── test_backtester.py      # Bias detection + fee + sizing unit tests
```

---

## Running Tests

```bash
pip install pytest
pytest tests/ -v
```

Key tests:
- `test_no_lookahead_bias` — verifies no future data leaks into signals
- `test_fee_calculation` — verifies realistic fee deduction
- `test_position_sizing` — verifies exactly 1% risk per trade
- `test_full_backtest_smoke` — end-to-end sanity check

---

## Configuration

All parameters live in `utils/config.py`. Key settings:

| Parameter | Default | Description |
|---|---|---|
| `RISK_PER_TRADE` | 1% | Capital risked per trade |
| `MAX_LEVERAGE` | 5x | Maximum leverage |
| `DAILY_LOSS_LIMIT` | 3% | Auto-pause threshold |
| `WEEKLY_LOSS_LIMIT` | 8% | Auto-pause threshold |
| `MIN_CONFIDENCE_SCORE` | 70 | Minimum signal score to trade |
| `ADX_MIN` | 25 | Skip ranging markets below this ADX |
| `ATR_PERCENTILE_MIN` | 60th | Only trade high-volatility environments |
| `FUNDING_LONG_MAX` | +0.03%/h | Skip longs in expensive funding |
| `MIN_PROFIT_FACTOR` | 1.8 | Live gate threshold |
| `MIN_SHARPE` | 1.5 | Live gate threshold |
| `MAX_DRAWDOWN` | 15% | Live gate threshold |

---

## Risk Disclaimer

```
RISK DISCLAIMER — READ BEFORE USE

This software is provided for educational and research purposes only.
Cryptocurrency trading, including perpetual futures on Hyperliquid, involves
substantial risk of loss and is not suitable for all investors.

Past backtested performance does NOT guarantee future results.
Walk-forward optimisation reduces overfitting but does not eliminate it.
Market conditions change and a historically profitable strategy can fail.

You are solely responsible for:
  - Any financial losses incurred while using this software
  - Verifying that algorithmic trading complies with your local regulations
  - Securing your private keys and API credentials

Never trade with money you cannot afford to lose.
Start with the smallest possible position sizes.
Monitor the bot continuously — do not run unattended for extended periods.

The authors provide no warranty, express or implied, regarding the
profitability or fitness for any particular purpose of this software.
```

---

## Hyperliquid SDK Reference

- API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/
- SDK: `hyperliquid-python-sdk` on PyPI
- Testnet: `constants.TESTNET_API_URL` (used automatically in paper mode when available)

---

*CORE EDGE v2 — Built for serious traders. Trade responsibly.*
