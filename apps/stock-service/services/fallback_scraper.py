"""Fallback financial data scraper when VCI API fails.

Layer 1: Direct VCI GraphQL call with retry (bypass vnstock overhead, full query)
Layer 2: CafeF JSON API for current + historical ratios
"""

import asyncio
import logging
import math

import httpx

logger = logging.getLogger(__name__)

_VCI_GRAPHQL_URL = "https://trading.vietcap.com.vn/data-mt/graphql"

_VCI_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Referer": "https://trading.vietcap.com.vn/",
    "Origin": "https://trading.vietcap.com.vn/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
}

_CAFEF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}

# Full VCI GraphQL query matching vnstock's exact format (all BSA/CFA/ISA fields)
_VCI_FULL_QUERY = """fragment Ratios on CompanyFinancialRatio {
  ticker
  yearReport
  lengthReport
  updateDate
  revenue
  revenueGrowth
  netProfit
  netProfitGrowth
  ebitMargin
  roe
  roic
  roa
  pe
  pb
  eps
  currentRatio
  cashRatio
  quickRatio
  interestCoverage
  ae
  netProfitMargin
  grossMargin
  ev
  issueShare
  ps
  pcf
  bvps
  evPerEbitda
  BSA1
  BSA2
  BSA5
  BSA8
  BSA10
  BSA159
  BSA16
  BSA22
  BSA23
  BSA24
  BSA162
  BSA27
  BSA29
  BSA43
  BSA46
  BSA50
  BSA209
  BSA53
  BSA54
  BSA55
  BSA56
  BSA58
  BSA67
  BSA71
  BSA173
  BSA78
  BSA79
  BSA80
  BSA175
  BSA86
  BSA90
  BSA96
  CFA21
  CFA22
  at
  fat
  acp
  dso
  dpo
  ccc
  de
  le
  ebitda
  ebit
  dividend
  RTQ10
  charterCapitalRatio
  RTQ4
  epsTTM
  charterCapital
  fae
  RTQ17
  CFA26
  CFA6
  CFA9
  BSA85
  CFA36
  BSB98
  BSB101
  BSA89
  CFA34
  CFA14
  ISB34
  ISB27
  ISA23
  ISS152
  ISA102
  CFA27
  CFA12
  CFA28
  BSA18
  BSB102
  BSB110
  BSB108
  CFA23
  ISB41
  BSB103
  BSA40
  BSB99
  CFA16
  CFA18
  CFA3
  ISB30
  BSA33
  ISB29
  CFS200
  ISA2
  CFA24
  BSB105
  CFA37
  ISS141
  BSA95
  CFA10
  ISA4
  BSA82
  CFA25
  BSB111
  ISI64
  BSB117
  ISA20
  CFA19
  ISA6
  ISA3
  BSB100
  ISB31
  ISB38
  ISB26
  BSA210
  CFA20
  CFA35
  ISA17
  ISS148
  BSB115
  ISA9
  CFA4
  ISA7
  CFA5
  ISA22
  CFA8
  CFA33
  CFA29
  BSA30
  BSA84
  BSA44
  BSB107
  ISB37
  ISA8
  BSB109
  ISA19
  ISB36
  ISA13
  ISA1
  BSB121
  ISA14
  BSB112
  ISA21
  ISA10
  CFA11
  ISA12
  BSA15
  BSB104
  BSA92
  BSB106
  BSA94
  ISA18
  CFA17
  ISI87
  BSB114
  ISA15
  BSB116
  ISB28
  BSB97
  CFA15
  ISA11
  ISB33
  BSA47
  ISB40
  ISB39
  CFA7
  CFA13
  ISS146
  ISB25
  BSA45
  BSB118
  CFA1
  CFS191
  ISB35
  CFB65
  CFA31
  BSB113
  ISB32
  ISA16
  CFS210
  BSA48
  BSA36
  ISI97
  CFA30
  CFA2
  CFB80
  CFA38
  CFA32
  ISA5
  BSA49
  CFB64
  __typename
}

query Query($ticker: String!, $period: String!) {
  CompanyFinancialRatio(ticker: $ticker, period: $period) {
    ratio {
      ...Ratios
      __typename
    }
    period
    __typename
  }
}"""

_CAFEF_INDICATORS_URL = "https://cafef.vn/du-lieu/Ajax/PageNew/ChiSoTaiChinh.ashx?Symbol={symbol}"
_CAFEF_HISTORY_URL = "https://cafef.vn/du-lieu/Ajax/PageNew/GetDataChiSoTaiChinh.ashx?Symbol={symbol}&TotalRow={rows}&EndDate={year}&ReportType=N&Sort=DESC"


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        v = str(val).replace(",", "")
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _normalize_vci_ratio(raw: dict) -> dict:
    """Convert raw VCI GraphQL ratio to the format vnstock_client returns."""
    return {
        "ticker": raw.get("ticker", ""),
        "yearReport": raw.get("yearReport"),
        "lengthReport": raw.get("lengthReport"),
        "priceToEarning": _safe_float(raw.get("pe")),
        "priceToBook": _safe_float(raw.get("pb")),
        "roe": _safe_float(raw.get("roe")),
        "roa": _safe_float(raw.get("roa")),
        "earningPerShare": _safe_float(raw.get("eps")),
        "netProfitMargin": _safe_float(raw.get("netProfitMargin")),
        "grossMargin": _safe_float(raw.get("grossMargin")),
        "financialLeverage": _safe_float(raw.get("le")),
        "dividend": _safe_float(raw.get("dividend")),
        "bookValuePerShare": _safe_float(raw.get("bvps")),
        "market_cap": None,
        "revenue": _safe_float(raw.get("revenue")),
        "netProfit": _safe_float(raw.get("netProfit")),
        "revenueGrowth": _safe_float(raw.get("revenueGrowth")),
    }


def _normalize_cafef_current(data: list[dict], symbol: str) -> dict:
    """Convert CafeF current indicators JSON to vnstock-compatible format."""
    by_code: dict[str, str] = {}
    for item in data:
        code = item.get("Code", "")
        value = item.get("Value", "")
        if code and value:
            by_code[code] = value

    return {
        "ticker": symbol.upper(),
        "yearReport": None,
        "lengthReport": None,
        "priceToEarning": _safe_float(by_code.get("P/E")),
        "priceToBook": _safe_float(by_code.get("Beta")),
        "roe": None,
        "roa": None,
        "earningPerShare": _safe_float(by_code.get("EPScoBan")),
        "netProfitMargin": None,
        "grossMargin": None,
        "financialLeverage": None,
        "dividend": None,
        "bookValuePerShare": _safe_float(by_code.get("GiaTriSoSach")),
        "market_cap": _safe_float(by_code.get("VonHoaThiTruong")),
        "revenue": None,
        "netProfit": None,
        "revenueGrowth": None,
    }


def _pct_to_decimal(val: float | None) -> float | None:
    """Convert CafeF percentage (e.g. 4.71) to VCI decimal format (0.0471)."""
    return round(val / 100, 6) if val is not None else None


def _normalize_cafef_history(entry: dict, symbol: str) -> dict:
    """Convert a CafeF historical ratio entry to vnstock-compatible format."""
    by_code: dict[str, float | None] = {}
    for v in entry.get("Value", []):
        by_code[v["Code"]] = _safe_float(v.get("Value"))

    return {
        "ticker": symbol.upper(),
        "yearReport": entry.get("Year"),
        "lengthReport": entry.get("Quater", 0) or 0,
        "priceToEarning": by_code.get("PE"),
        "priceToBook": None,
        "roe": _pct_to_decimal(by_code.get("ROE")),
        "roa": _pct_to_decimal(by_code.get("ROA")),
        "earningPerShare": by_code.get("EPS"),
        "netProfitMargin": _pct_to_decimal(by_code.get("ROS")),
        "grossMargin": _pct_to_decimal(by_code.get("GOS")),
        "financialLeverage": by_code.get("DAR"),
        "dividend": None,
        "bookValuePerShare": by_code.get("BV"),
        "market_cap": None,
        "revenue": None,
        "netProfit": None,
        "revenueGrowth": None,
    }


def _extract_income_from_vci(raw_list: list[dict]) -> list[dict]:
    """Extract income statement data from VCI ratio raw response."""
    result = []
    for r in raw_list:
        result.append({
            "yearReport": r.get("yearReport"),
            "revenue": _safe_float(r.get("revenue")),
            "netProfit": _safe_float(r.get("netProfit")),
            "revenueGrowth": _safe_float(r.get("revenueGrowth")),
            "netProfitGrowth": _safe_float(r.get("netProfitGrowth")),
            "grossMargin": _safe_float(r.get("grossMargin")),
            "netProfitMargin": _safe_float(r.get("netProfitMargin")),
            "ebitMargin": _safe_float(r.get("ebitMargin")),
            "ebitda": _safe_float(r.get("ebitda")),
            "ebit": _safe_float(r.get("ebit")),
            "ISA2_total_revenue": _safe_float(r.get("ISA2")),
            "ISA23_net_profit_after_tax": _safe_float(r.get("ISA23")),
            "ISA4_gross_profit": _safe_float(r.get("ISA4")),
        })
    return result


def _extract_balance_from_vci(raw_list: list[dict]) -> list[dict]:
    """Extract balance sheet data from VCI ratio raw response."""
    result = []
    for r in raw_list:
        result.append({
            "yearReport": r.get("yearReport"),
            "BSA1_total_assets": _safe_float(r.get("BSA1")),
            "BSA50_total_liabilities": _safe_float(r.get("BSA50")),
            "BSA86_equity": _safe_float(r.get("BSA86")),
            "currentRatio": _safe_float(r.get("currentRatio")),
            "quickRatio": _safe_float(r.get("quickRatio")),
            "cashRatio": _safe_float(r.get("cashRatio")),
            "de_debt_to_equity": _safe_float(r.get("de")),
            "le_financial_leverage": _safe_float(r.get("le")),
            "interestCoverage": _safe_float(r.get("interestCoverage")),
        })
    return result


def _extract_cashflow_from_vci(raw_list: list[dict]) -> list[dict]:
    """Extract cash flow data from VCI ratio raw response."""
    result = []
    for r in raw_list:
        result.append({
            "yearReport": r.get("yearReport"),
            "CFA21_operating_cash_flow": _safe_float(r.get("CFA21")),
            "CFA22_investing_cash_flow": _safe_float(r.get("CFA22")),
            "CFA3_net_cash_from_operations": _safe_float(r.get("CFA3")),
        })
    return result


class FallbackFinancialScraper:
    """Fallback financial data when VCI vnstock fails."""

    def __init__(self):
        self._vci_raw_cache: dict[str, list[dict]] = {}

    async def _fetch_vci_raw(self, symbol: str, period: str = "Y", retries: int = 2) -> list[dict]:
        """Fetch raw VCI GraphQL data with retry. Caches per symbol."""
        cache_key = f"{symbol.upper()}:{period}"
        if cache_key in self._vci_raw_cache:
            return self._vci_raw_cache[cache_key]

        payload = {
            "query": _VCI_FULL_QUERY,
            "variables": {"ticker": symbol.upper(), "period": period},
        }

        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient(timeout=15, headers=_VCI_HEADERS) as client:
                    resp = await client.post(_VCI_GRAPHQL_URL, json=payload)
                    resp.raise_for_status()
                    data = resp.json()

                ratios_raw = data.get("data", {}).get("CompanyFinancialRatio", {}).get("ratio", [])
                if not ratios_raw:
                    logger.warning("VCI direct: no data for %s (attempt %d)", symbol, attempt + 1)
                    if attempt < retries:
                        await asyncio.sleep(3)
                        continue
                    self._vci_raw_cache[cache_key] = []
                    return []

                self._vci_raw_cache[cache_key] = ratios_raw
                logger.info("VCI direct succeeded for %s (%d records)", symbol, len(ratios_raw))
                return ratios_raw
            except Exception as e:
                logger.warning("VCI direct attempt %d failed for %s: %s", attempt + 1, symbol, e)
                if attempt < retries:
                    await asyncio.sleep(3)

        self._vci_raw_cache[cache_key] = []
        return []

    async def get_ratios_vci_direct(self, symbol: str, period: str = "Y", retries: int = 2) -> list[dict]:
        """Direct VCI GraphQL call with retry — returns normalized ratios."""
        raw = await self._fetch_vci_raw(symbol, period, retries)
        if not raw:
            return []
        return [_normalize_vci_ratio(r) for r in raw]

    async def get_income_vci_direct(self, symbol: str) -> list[dict]:
        """Extract income statement from VCI direct data."""
        raw = await self._fetch_vci_raw(symbol, retries=0)
        return _extract_income_from_vci(raw) if raw else []

    async def get_balance_vci_direct(self, symbol: str) -> list[dict]:
        """Extract balance sheet from VCI direct data."""
        raw = await self._fetch_vci_raw(symbol, retries=0)
        return _extract_balance_from_vci(raw) if raw else []

    async def get_cashflow_vci_direct(self, symbol: str) -> list[dict]:
        """Extract cash flow from VCI direct data."""
        raw = await self._fetch_vci_raw(symbol, retries=0)
        return _extract_cashflow_from_vci(raw) if raw else []

    async def get_ratios_cafef(self, symbol: str) -> list[dict]:
        """Fetch financial ratios from CafeF JSON API (current + historical)."""
        sym = symbol.lower()
        results: list[dict] = []

        try:
            async with httpx.AsyncClient(timeout=10, headers=_CAFEF_HEADERS, follow_redirects=True) as client:
                current_resp, history_resp = await asyncio.gather(
                    client.get(_CAFEF_INDICATORS_URL.format(symbol=sym)),
                    client.get(_CAFEF_HISTORY_URL.format(symbol=sym, rows=10, year=2026)),
                    return_exceptions=True,
                )

                # Parse historical ratios (richer data: EPS, P/E, ROE, ROA, BV, ROS, GOS, DAR)
                if isinstance(history_resp, httpx.Response) and history_resp.status_code == 200:
                    try:
                        hist_data = history_resp.json()
                        entries = hist_data.get("Data", {}).get("Value", [])
                        for entry in entries:
                            results.append(_normalize_cafef_history(entry, symbol))
                    except Exception as e:
                        logger.debug("CafeF history parse failed for %s: %s", symbol, e)

                # Merge current indicators into latest year entry (has market cap, P/B)
                if isinstance(current_resp, httpx.Response) and current_resp.status_code == 200:
                    try:
                        curr_data = current_resp.json()
                        items = curr_data.get("Data", [])
                        if items:
                            current = _normalize_cafef_current(items, symbol)
                            if results:
                                # Enrich the most recent entry with current market data
                                for key in ["priceToEarning", "priceToBook", "earningPerShare",
                                             "bookValuePerShare", "market_cap"]:
                                    if current.get(key) is not None and results[0].get(key) is None:
                                        results[0][key] = current[key]
                            else:
                                results = [current]
                    except Exception as e:
                        logger.debug("CafeF current parse failed for %s: %s", symbol, e)

        except Exception as e:
            logger.warning("CafeF request failed for %s: %s", symbol, e)

        if results:
            logger.info("CafeF fallback succeeded for %s (%d records)", symbol, len(results))
        return results

    async def get_ratios_with_fallback(self, symbol: str) -> list[dict]:
        """Try VCI direct first, then CafeF JSON API."""
        result = await self.get_ratios_vci_direct(symbol)
        if result:
            return result

        result = await self.get_ratios_cafef(symbol)
        if result:
            return result

        logger.warning("All fallback sources failed for %s ratios", symbol)
        return []

    async def get_income_with_fallback(self, symbol: str) -> list[dict]:
        """Get income statement data via VCI direct fallback."""
        return await self.get_income_vci_direct(symbol)

    async def get_balance_with_fallback(self, symbol: str) -> list[dict]:
        """Get balance sheet data via VCI direct fallback."""
        return await self.get_balance_vci_direct(symbol)

    async def get_cashflow_with_fallback(self, symbol: str) -> list[dict]:
        """Get cash flow data via VCI direct fallback."""
        return await self.get_cashflow_vci_direct(symbol)
