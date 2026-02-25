"""Step 1: Daily market scan for undervalued stocks."""

from datetime import datetime, timedelta

from services.vnstock_client import VnstockClient


async def run_daily_scan() -> list[dict]:
    """Screen for undervalued stocks based on financial criteria.

    Returns top 10 candidates sorted by score.
    """
    print("[DailyScan] Starting daily scan...")
    client = VnstockClient()

    try:
        # Get all listed symbols
        all_symbols = client.get_all_symbols()
        print(f"[DailyScan] Found {len(all_symbols)} total symbols")

        # Filter to main exchanges (HOSE, HNX)
        main_symbols = [
            s for s in all_symbols if s.get("exchange") in ("HOSE", "HNX")
        ]
        print(f"[DailyScan] {len(main_symbols)} symbols on HOSE/HNX")

        candidates = []
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        # Sample a manageable subset for screening (top stocks by listing)
        sample = main_symbols[:100]

        for stock_info in sample:
            symbol = stock_info.get("symbol", "")
            if not symbol:
                continue

            try:
                ratios = client.get_financial_ratios(symbol)
                if not ratios:
                    continue

                latest = ratios[0]
                pe = latest.get("priceToEarning") or latest.get("pe")
                roe = latest.get("roe")
                eps = latest.get("earningPerShare") or latest.get("eps")

                # Convert to float safely
                pe = float(pe) if pe is not None else None
                roe = float(roe) if roe is not None else None

                # Screening criteria
                if pe is None or roe is None:
                    continue
                if pe <= 0 or pe > 20:
                    continue
                if roe < 10:
                    continue

                # Score: lower PE + higher ROE = better
                score = round((roe / pe) * 100, 2)

                # Get current price
                try:
                    price_data = client.get_price_history(
                        symbol, start_date, end_date, "1D"
                    )
                    current_price = price_data[-1]["close"] if price_data else None
                except Exception:
                    current_price = None

                candidates.append(
                    {
                        "symbol": symbol,
                        "name": stock_info.get("organ_name", ""),
                        "exchange": stock_info.get("exchange", ""),
                        "pe": pe,
                        "roe": roe,
                        "eps": eps,
                        "price": current_price,
                        "score": score,
                    }
                )
            except Exception as e:
                print(f"[DailyScan] Skip {symbol}: {e}")
                continue

        # Sort by score descending, take top 10
        candidates.sort(key=lambda x: x["score"], reverse=True)
        top_candidates = candidates[:10]

        print(f"[DailyScan] Found {len(candidates)} candidates, returning top {len(top_candidates)}")
        for c in top_candidates:
            print(f"  {c['symbol']}: PE={c['pe']:.1f}, ROE={c['roe']:.1f}%, Score={c['score']}")

        return top_candidates

    except Exception as e:
        print(f"[DailyScan] Error: {e}")
        return []
