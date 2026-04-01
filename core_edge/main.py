"""
CORE EDGE — Entry point

Modes:
  python main.py --scan     Headless analysis loop (prints signals to stdout / log file)
  streamlit run ui/dashboard.py   Full interactive dashboard (recommended)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time

from dotenv import load_dotenv

load_dotenv()

# ── Logging setup ────────────────────────────────────────────────────────────
_DEBUG = os.getenv("DEBUG", "false").lower() == "true"
logging.basicConfig(
    level=logging.DEBUG if _DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)-8s] %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("core_edge.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("core_edge.main")

import config
from services.analysis import AnalysisEngine
from services.market_data import MarketDataService
from services.scoring import ScoringEngine


def run_scan_loop() -> None:
    """Headless mode: continuously scan and log signals."""
    market_data = MarketDataService()
    analysis = AnalysisEngine()
    scoring = ScoringEngine()

    logger.info("=" * 60)
    logger.info("  CORE EDGE — Headless Scan Mode")
    logger.info(f"  Assets    : {', '.join(config.ASSETS)}")
    logger.info(f"  Timeframes: {', '.join(config.TIMEFRAMES)}")
    logger.info(f"  Min score : {config.MIN_CONFIDENCE_SCORE}/100")
    logger.info(f"  Interval  : {config.POLLING_INTERVAL}s")
    logger.info("=" * 60)

    cycle = 0
    while True:
        cycle += 1
        logger.info(f"── Cycle {cycle} ────────────────────────────────────")
        try:
            data = market_data.fetch_all()
            raw_signals = analysis.analyze_all(data)
            signals = scoring.score_signals(raw_signals)

            if signals:
                logger.info(f"  {len(signals)} signal(s) detected:")
                for s in signals:
                    logger.info(
                        f"    [{s.score:>3}/100] {s.asset:<5} {s.timeframe:<3} "
                        f"{s.direction.value:<5} | "
                        f"entry={s.entry:>10.4f}  SL={s.stop_loss:>10.4f}  "
                        f"TP1={s.tp1:>10.4f}  TP2={s.tp2:>10.4f}"
                    )
            else:
                logger.info("  No signals meeting criteria this cycle.")

        except KeyboardInterrupt:
            logger.info("Interrupted — shutting down.")
            break
        except Exception as exc:
            logger.error(f"Cycle error: {exc}", exc_info=True)

        logger.info(f"  Next scan in {config.POLLING_INTERVAL}s…")
        try:
            time.sleep(config.POLLING_INTERVAL)
        except KeyboardInterrupt:
            logger.info("Interrupted — shutting down.")
            break


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CORE EDGE Trading System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python main.py --scan                 # headless scan loop\n"
            "  streamlit run ui/dashboard.py         # interactive dashboard\n"
        ),
    )
    parser.add_argument(
        "--scan",
        action="store_true",
        help="Run headless analysis loop (no UI)",
    )
    args = parser.parse_args()

    if args.scan:
        run_scan_loop()
    else:
        print(
            "\n  CORE EDGE — Ready\n"
            "\n"
            "  • Dashboard   :  streamlit run ui/dashboard.py\n"
            "  • Headless    :  python main.py --scan\n"
            "  • Debug mode  :  set DEBUG=true in .env\n"
        )


if __name__ == "__main__":
    main()
