import logging

import pandas as pd

if not hasattr(pd.DataFrame, "applymap"):
    pd.DataFrame.applymap = pd.DataFrame.map

from vnstock import Vnstock

from services.cache import TTL_COMPANY, TTL_FINANCIAL, TTL_LISTING, TTL_PRICE, cache

logger = logging.getLogger(__name__)


class VnstockClient:
    """Wrapper around vnstock library for Vietnam stock market data."""

    def __init__(self, source: str = "VCI"):
        self.source = source

    def _stock(self, symbol: str):
        return Vnstock().stock(symbol=symbol.upper(), source=self.source)

    def _cached(self, key: str, ttl: int, fetcher):
        cached = cache.get(key)
        if cached is not None:
            return cached
        data = fetcher()
        cache.set(key, data, ttl)
        return data

    def get_price_history(
        self, symbol: str, start: str, end: str, interval: str = "1D"
    ) -> list[dict]:
        key = f"stock:price:{symbol.upper()}:{start}:{end}:{interval}"

        def fetch():
            stock = self._stock(symbol)
            df = stock.quote.history(start=start, end=end, interval=interval)
            records = df.to_dict(orient="records")
            price_fields = ("open", "high", "low", "close")
            for rec in records:
                if "time" in rec and hasattr(rec["time"], "isoformat"):
                    rec["time"] = rec["time"].isoformat()
                for field in price_fields:
                    if field in rec and isinstance(rec[field], (int, float)):
                        rec[field] = round(rec[field] * 1000)
            return records

        return self._cached(key, TTL_PRICE, fetch)

    def get_price_board(self, symbols: list[str]) -> list[dict]:
        syms_key = ",".join(sorted(s.upper() for s in symbols))
        key = f"stock:board:{syms_key}"

        def fetch():
            from vnstock import Trading

            board = Trading(source=self.source).price_board(symbols)
            if isinstance(board.columns, pd.MultiIndex):
                board = self._flatten_board_columns(board)
            records = board.to_dict(orient="records")
            price_fields = (
                "ref_price", "match_price", "ceiling", "floor",
                "bid_price_1", "bid_price_2", "bid_price_3",
                "ask_price_1", "ask_price_2", "ask_price_3",
                "highest", "lowest", "average",
            )
            for rec in records:
                for field in price_fields:
                    val = self._safe_float(rec.get(field))
                    if val is not None:
                        rec[field] = round(val * 1000)
                ref = self._safe_float(rec.get("ref_price"))
                price = self._safe_float(rec.get("match_price"))
                if ref and price:
                    rec["change"] = round(price - ref, 2)
                    rec["pct_change"] = round((price - ref) / ref * 100, 2)
                else:
                    rec["change"] = 0
                    rec["pct_change"] = 0
            return records

        return self._cached(key, TTL_PRICE, fetch)

    @staticmethod
    def _flatten_board_columns(df: pd.DataFrame) -> pd.DataFrame:
        flat_cols = []
        for col in df.columns:
            if isinstance(col, tuple) and len(col) == 2:
                group, name = col
                flat_cols.append(name)
            else:
                flat_cols.append(str(col))
        df = df.copy()
        df.columns = flat_cols
        if df.columns.duplicated().any():
            df = df.loc[:, ~df.columns.duplicated(keep="first")]
        return df

    def get_income_statement(self, symbol: str, period: str = "year") -> list[dict]:
        key = f"stock:income:{symbol.upper()}:{period}"

        def fetch():
            stock = self._stock(symbol)
            df = stock.finance.income_statement(period=period)
            return df.to_dict(orient="records")

        return self._cached(key, TTL_FINANCIAL, fetch)

    def get_balance_sheet(self, symbol: str, period: str = "year") -> list[dict]:
        key = f"stock:balance:{symbol.upper()}:{period}"

        def fetch():
            stock = self._stock(symbol)
            df = stock.finance.balance_sheet(period=period)
            return df.to_dict(orient="records")

        return self._cached(key, TTL_FINANCIAL, fetch)

    def get_cash_flow(self, symbol: str, period: str = "year") -> list[dict]:
        key = f"stock:cashflow:{symbol.upper()}:{period}"

        def fetch():
            stock = self._stock(symbol)
            df = stock.finance.cash_flow(period=period)
            return df.to_dict(orient="records")

        return self._cached(key, TTL_FINANCIAL, fetch)

    def get_financial_ratios(self, symbol: str) -> list[dict]:
        key = f"stock:ratios:{symbol.upper()}"

        def fetch():
            stock = self._stock(symbol)
            df = stock.finance.ratio(period="year")
            if isinstance(df.columns, pd.MultiIndex):
                df = self._flatten_ratio_columns(df)
            return df.to_dict(orient="records")

        return self._cached(key, TTL_FINANCIAL, fetch)

    @staticmethod
    def _flatten_ratio_columns(df: pd.DataFrame) -> pd.DataFrame:
        """Flatten MultiIndex columns from finance.ratio() to clean string keys."""
        col_map = {
            ("Meta", "ticker"): "ticker",
            ("Meta", "yearReport"): "yearReport",
            ("Meta", "lengthReport"): "lengthReport",
        }
        flat_cols = []
        for col in df.columns:
            if col in col_map:
                flat_cols.append(col_map[col])
            elif isinstance(col, tuple) and len(col) == 2:
                name = col[1]
                mapping = {
                    "Fixed Asset-To-Equity": "fixedAssetToEquity",
                    "Owners' Equity/Charter Capital": "equityToCharter",
                    "Net Profit Margin (%)": "netProfitMargin",
                    "ROE (%)": "roe",
                    "ROA (%)": "roa",
                    "Dividend yield (%)": "dividend",
                    "Financial Leverage": "financialLeverage",
                    "Market Capital (Bn. VND)": "market_cap",
                    "Outstanding Share (Mil. Shares)": "outstandingShares",
                    "P/E": "priceToEarning",
                    "P/B": "priceToBook",
                    "P/S": "priceToSales",
                    "P/Cash Flow": "priceToCashFlow",
                    "EPS (VND)": "earningPerShare",
                    "BVPS (VND)": "bookValuePerShare",
                }
                flat_cols.append(mapping.get(name, name))
            else:
                flat_cols.append(str(col))
        df = df.copy()
        df.columns = flat_cols
        return df

    def get_company_profile(self, symbol: str) -> dict:
        key = f"stock:profile:{symbol.upper()}"

        def fetch():
            stock = self._stock(symbol)
            df = stock.company.overview()
            if df is not None and not df.empty:
                return df.to_dict(orient="records")[0]
            return {}

        return self._cached(key, TTL_COMPANY, fetch)

    def get_all_symbols(self, exchange: str | None = None) -> list[dict]:
        key = f"stock:listing:{exchange or 'ALL'}"

        def fetch():
            from vnstock import Listing

            listing = Listing()
            df = listing.symbols_by_exchange()
            if exchange:
                df = df[df["exchange"] == exchange.upper()]
            df = df.fillna("")
            return df.to_dict(orient="records")

        return self._cached(key, TTL_LISTING, fetch)

    def search_symbol(self, query: str) -> list[dict]:
        symbols = self.get_all_symbols()
        query_lower = query.lower()
        return [
            s
            for s in symbols
            if query_lower in str(s.get("symbol", "")).lower()
            or query_lower in str(s.get("organ_name", "")).lower()
            or query_lower in str(s.get("en_organ_name", "")).lower()
        ][:20]

    def screen_stocks(self, filters: dict, max_scan: int = 50) -> list[dict]:
        exchange = filters.get("exchange")
        symbols = self.get_all_symbols(exchange)

        stock_symbols = [s for s in symbols if s.get("type") == "stock"]

        min_pe = filters.get("min_pe")
        max_pe = filters.get("max_pe")
        min_pb = filters.get("min_pb")
        max_pb = filters.get("max_pb")
        min_roe = filters.get("min_roe")
        min_market_cap = filters.get("min_market_cap")
        min_dividend_yield = filters.get("min_dividend_yield")

        has_filters = any(
            v is not None
            for v in [min_pe, max_pe, min_pb, max_pb, min_roe, min_market_cap, min_dividend_yield]
        )
        if not has_filters:
            return stock_symbols

        results: list[dict] = []
        scanned = 0
        rate_limited = False
        symbol_list = [s.get("symbol") for s in stock_symbols if s.get("symbol")]

        for ticker in symbol_list:
            if scanned >= max_scan:
                break
            try:
                ratios = self.get_financial_ratios(ticker)
                scanned += 1
                if not ratios:
                    continue
                latest = ratios[-1]

                pe = self._safe_float(latest.get("priceToEarning"))
                pb = self._safe_float(latest.get("priceToBook"))
                roe = self._safe_float(latest.get("roe"))
                market_cap = self._safe_float(latest.get("market_cap"))
                dividend_yield = self._safe_float(latest.get("dividend"))

                if min_pe is not None and (pe is None or pe < min_pe):
                    continue
                if max_pe is not None and (pe is None or pe > max_pe):
                    continue
                if min_pb is not None and (pb is None or pb < min_pb):
                    continue
                if max_pb is not None and (pb is None or pb > max_pb):
                    continue
                if min_roe is not None and (roe is None or roe < min_roe):
                    continue
                if min_market_cap is not None and (market_cap is None or market_cap < min_market_cap):
                    continue
                if min_dividend_yield is not None and (dividend_yield is None or dividend_yield < min_dividend_yield):
                    continue

                symbol_info = next((s for s in stock_symbols if s.get("symbol") == ticker), {})
                results.append(
                    {
                        "symbol": ticker,
                        "organ_name": symbol_info.get("organ_name", ""),
                        "exchange": symbol_info.get("exchange", ""),
                        "pe": pe,
                        "pb": pb,
                        "roe": roe,
                        "market_cap": market_cap,
                        "dividend_yield": dividend_yield,
                    }
                )
            except Exception as exc:
                exc_str = str(exc).lower()
                if "rate limit" in exc_str or "429" in exc_str:
                    logger.warning("Rate limit hit at %d/%d symbols", scanned, len(symbol_list))
                    rate_limited = True
                    break
                logger.debug("Screening skip %s: %s", ticker, exc)
                continue

        if rate_limited:
            logger.info("Returning %d partial results due to rate limit", len(results))

        return results

    @staticmethod
    def _safe_float(value) -> float | None:
        if value is None:
            return None
        try:
            f = float(value)
            import math
            if math.isnan(f) or math.isinf(f):
                return None
            return f
        except (ValueError, TypeError):
            return None
