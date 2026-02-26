"""Step 1: Daily market scan for undervalued stocks."""

from datetime import datetime, timedelta

from services.vnstock_client import VnstockClient


async def run_daily_scan(max_symbols: int = 50) -> list[dict]:
    """Screen for undervalued stocks based on financial criteria.

    Returns top 10 candidates sorted by score.
    Args:
        max_symbols: Max stocks to scan (limited by API rate limits).
    """
    print("[DailyScan] Starting daily scan...")
    client = VnstockClient()

    try:
        all_symbols = client.get_all_symbols()
        print(f"[DailyScan] Found {len(all_symbols)} total symbols")

        main_symbols = [
            s for s in all_symbols
            if s.get("exchange") in ("HOSE", "HNX") and s.get("type") == "stock"
        ]
        print(f"[DailyScan] {len(main_symbols)} stocks on HOSE/HNX")

        candidates = []
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        sample = main_symbols[:max_symbols]

        for stock_info in sample:
            symbol = stock_info.get("symbol", "")
            if not symbol:
                continue

            try:
                ratios = client.get_financial_ratios(symbol)
                if not ratios:
                    continue

                latest = ratios[-1]
                pe = client._safe_float(latest.get("priceToEarning"))
                roe = client._safe_float(latest.get("roe"))
                eps = client._safe_float(latest.get("earningPerShare"))

                if pe is None or roe is None:
                    continue
                if pe <= 0 or pe > 20:
                    continue
                # ROE is a decimal: 0.15 = 15%
                if roe < 0.10:
                    continue

                # Score: higher ROE/PE ratio = better value
                score = round((roe / pe) * 10000, 2)

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
                exc_str = str(e).lower()
                if "rate limit" in exc_str or "429" in exc_str:
                    print(f"[DailyScan] Rate limit hit, stopping scan early")
                    break
                print(f"[DailyScan] Skip {symbol}: {e}")
                continue

        candidates.sort(key=lambda x: x["score"], reverse=True)
        top_candidates = candidates[:10]

        print(f"[DailyScan] Found {len(candidates)} candidates, returning top {len(top_candidates)}")
        for c in top_candidates:
            print(f"  {c['symbol']}: PE={c['pe']:.1f}, ROE={c['roe']:.2%}, Score={c['score']}")

        return top_candidates

    except Exception as e:
        print(f"[DailyScan] Error: {e}")
        return []
