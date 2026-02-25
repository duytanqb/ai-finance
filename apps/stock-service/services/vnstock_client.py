from vnstock import Vnstock


class VnstockClient:
    """Wrapper around vnstock library for Vietnam stock market data."""

    def __init__(self, source: str = "VCI"):
        self.source = source

    def _stock(self, symbol: str):
        return Vnstock().stock(symbol=symbol.upper(), source=self.source)

    def get_price_history(
        self, symbol: str, start: str, end: str, interval: str = "1D"
    ) -> list[dict]:
        stock = self._stock(symbol)
        df = stock.quote.history(start=start, end=end, interval=interval)
        return df.to_dict(orient="records")

    def get_price_board(self, symbols: list[str]) -> list[dict]:
        from vnstock import Trading

        board = Trading(source=self.source).price_board(symbols)
        return board.to_dict(orient="records")

    def get_income_statement(self, symbol: str, period: str = "year") -> list[dict]:
        stock = self._stock(symbol)
        df = stock.finance.income_statement(period=period)
        return df.to_dict(orient="records")

    def get_balance_sheet(self, symbol: str, period: str = "year") -> list[dict]:
        stock = self._stock(symbol)
        df = stock.finance.balance_sheet(period=period)
        return df.to_dict(orient="records")

    def get_cash_flow(self, symbol: str, period: str = "year") -> list[dict]:
        stock = self._stock(symbol)
        df = stock.finance.cash_flow(period=period)
        return df.to_dict(orient="records")

    def get_financial_ratios(self, symbol: str) -> list[dict]:
        stock = self._stock(symbol)
        df = stock.finance.ratio(period="year")
        return df.to_dict(orient="records")

    def get_company_profile(self, symbol: str) -> dict:
        stock = self._stock(symbol)
        df = stock.company.profile()
        if df is not None and not df.empty:
            return df.to_dict(orient="records")[0]
        return {}

    def get_all_symbols(self, exchange: str | None = None) -> list[dict]:
        from vnstock import Listing

        listing = Listing()
        df = listing.all_symbols()
        if exchange:
            df = df[df["exchange"] == exchange.upper()]
        return df.to_dict(orient="records")

    def search_symbol(self, query: str) -> list[dict]:
        symbols = self.get_all_symbols()
        query_lower = query.lower()
        return [
            s
            for s in symbols
            if query_lower in s.get("symbol", "").lower()
            or query_lower in s.get("organ_name", "").lower()
        ][:20]

    def screen_stocks(self, filters: dict) -> list[dict]:
        # Basic screening using listing + ratios
        # Full implementation will use vnstock screening API
        symbols = self.get_all_symbols(filters.get("exchange"))
        return symbols
