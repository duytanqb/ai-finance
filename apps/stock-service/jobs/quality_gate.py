"""Stage 2: Financial quality gate — filter out rubble stocks."""

from services.vnstock_client import VnstockClient

sf = VnstockClient._safe_float


def _find_field(record: dict, *candidates: str) -> float | None:
    """Try multiple field name candidates (EN/VN) and return first match."""
    for key in candidates:
        val = sf(record.get(key))
        if val is not None:
            return val
    for key in record:
        for candidate in candidates:
            if candidate.lower() in key.lower():
                val = sf(record[key])
                if val is not None:
                    return val
    return None


def _is_disqualified(ratios: dict, income: list[dict], balance: list[dict]) -> bool:
    """Hard disqualifiers — instant reject."""
    market_cap = sf(ratios.get("market_cap"))
    if market_cap is not None and market_cap < 0.3:
        return True

    leverage = sf(ratios.get("financial_leverage")) or sf(ratios.get("financialLeverage"))
    if leverage is not None and leverage > 4.0:
        return True

    pe = sf(ratios.get("pe")) or sf(ratios.get("priceToEarning"))
    roe = sf(ratios.get("roe"))

    # Overvalued: high P/E with low ROE = not undervalued
    if pe is not None and pe > 25:
        return True
    if pe is not None and roe is not None and pe > 15 and roe < 0.10:
        return True

    if len(income) >= 2:
        profits = []
        for row in income[:2]:
            p = _find_field(row, "net_income", "lợi nhuận sau thuế", "Lợi nhuận sau thuế")
            profits.append(p)
        if all(p is not None and p < 0 for p in profits):
            return True

    # Revenue declining 2 consecutive years
    if len(income) >= 3:
        revs = []
        for row in income[:3]:
            r = _find_field(row, "revenue", "doanh thu", "Doanh thu thuần")
            revs.append(r)
        if all(r is not None for r in revs) and revs[0] < revs[1] < revs[2]:
            return True

    if balance:
        equity = _find_field(
            balance[0], "equity", "vốn chủ sở hữu", "Vốn chủ sở hữu",
            "OWNER'S EQUITY", "owner_equity",
        )
        if equity is not None and equity <= 0:
            return True

    return False


def _compute_quality_score(ratios: dict, income: list[dict], balance: list[dict]) -> float:
    """Compute 0-100 composite quality score."""
    score = 0.0

    pe = sf(ratios.get("pe")) or sf(ratios.get("priceToEarning"))
    pb = sf(ratios.get("pb")) or sf(ratios.get("priceToBook"))
    roe = sf(ratios.get("roe"))
    npm = sf(ratios.get("net_profit_margin")) or sf(ratios.get("netProfitMargin"))
    leverage = sf(ratios.get("financial_leverage")) or sf(ratios.get("financialLeverage"))
    dividend = sf(ratios.get("dividend_yield")) or sf(ratios.get("dividend"))

    # Factor 1: Value (25pts)
    if pe and 0 < pe <= 8:
        score += 25
    elif pe and pe <= 12:
        score += 20
    elif pe and pe <= 18:
        score += 12
    elif pe and pe <= 25:
        score += 5

    # Factor 2: Profitability (25pts)
    if roe:
        score += min(roe * 100, 15)
    if npm and npm > 0:
        score += min(npm * 50, 10)

    # Factor 3: Growth (25pts)
    rev_growth = _compute_revenue_growth(income)
    profit_growth = _compute_profit_growth(income)
    if rev_growth is not None:
        score += min(max(rev_growth * 50, 0), 12)
    if profit_growth is not None:
        score += min(max(profit_growth * 50, 0), 13)

    # Factor 4: Safety (15pts)
    if leverage is not None:
        if leverage < 2:
            score += 10
        elif leverage < 3:
            score += 5
    if dividend and dividend > 0.02:
        score += min(dividend * 100, 5)

    # Factor 5: Book value discount (10pts)
    if pb and 0 < pb < 1.0:
        score += 10
    elif pb and pb < 1.5:
        score += 5

    return round(score, 2)


def _compute_revenue_growth(income: list[dict]) -> float | None:
    """YoY revenue growth from most recent 2 periods."""
    if len(income) < 2:
        return None
    curr = _find_field(income[0], "revenue", "doanh thu", "Doanh thu thuần")
    prev = _find_field(income[1], "revenue", "doanh thu", "Doanh thu thuần")
    if curr and prev and prev != 0:
        return (curr - prev) / abs(prev)
    return None


def _compute_profit_growth(income: list[dict]) -> float | None:
    """YoY net profit growth from most recent 2 periods."""
    if len(income) < 2:
        return None
    curr = _find_field(income[0], "net_income", "lợi nhuận sau thuế", "Lợi nhuận sau thuế")
    prev = _find_field(income[1], "net_income", "lợi nhuận sau thuế", "Lợi nhuận sau thuế")
    if curr and prev and prev > 0:
        return (curr - prev) / abs(prev)
    return None


def _summarize_income(income: list[dict]) -> dict:
    """Extract key trends for AI context."""
    if not income:
        return {}
    latest = income[0]
    revenue = _find_field(latest, "revenue", "doanh thu", "Doanh thu thuần")
    net_income = _find_field(latest, "net_income", "lợi nhuận sau thuế", "Lợi nhuận sau thuế")
    return {
        "latest_revenue": revenue,
        "latest_net_income": net_income,
        "revenue_growth_pct": _compute_revenue_growth(income),
        "profit_growth_pct": _compute_profit_growth(income),
        "periods": len(income),
    }


def _summarize_balance(balance: list[dict]) -> dict:
    """Extract key balance sheet metrics for AI context."""
    if not balance:
        return {}
    latest = balance[0]
    total_assets = _find_field(latest, "total_assets", "tổng tài sản", "Tổng cộng tài sản")
    equity = _find_field(
        latest, "equity", "vốn chủ sở hữu", "Vốn chủ sở hữu",
        "OWNER'S EQUITY",
    )
    total_debt = _find_field(latest, "total_debt", "nợ phải trả", "Nợ phải trả")
    dte = None
    if total_debt and equity and equity > 0:
        dte = round(total_debt / equity, 2)
    return {
        "total_assets": total_assets,
        "equity": equity,
        "total_debt": total_debt,
        "debt_to_equity": dte,
    }


async def run_quality_gate(candidates: list[dict]) -> list[dict]:
    """Stage 2: Deep financial quality filter.

    Fetches income statement + balance sheet for each candidate.
    Applies hard disqualifiers and computes composite quality score.
    Returns top 25 sorted by quality score.
    """
    import time

    from services.cache import cache

    client = VnstockClient()
    qualified = []

    for c in candidates:
        symbol = c["symbol"]
        try:
            ratios = c.get("ratios", c)

            try:
                income_cached = cache.get(f"stock:income:{symbol.upper()}:year") is not None
                income = client.get_income_statement(symbol, "year")
                if not income_cached:
                    time.sleep(1.1)
            except Exception:
                income = []
            try:
                balance_cached = cache.get(f"stock:balance:{symbol.upper()}:year") is not None
                balance = client.get_balance_sheet(symbol, "year")
                if not balance_cached:
                    time.sleep(1.1)
            except Exception:
                balance = []

            if _is_disqualified(ratios, income, balance):
                print(f"  [QualityGate] REJECT {symbol} (disqualified)")
                continue

            score = _compute_quality_score(ratios, income, balance)
            c["quality_score"] = score
            c["income_summary"] = _summarize_income(income)
            c["balance_summary"] = _summarize_balance(balance)
            qualified.append(c)

        except Exception as e:
            exc_str = str(e).lower()
            if "rate limit" in exc_str or "429" in exc_str:
                print(f"  [QualityGate] Rate limit hit, waiting 60s...")
                time.sleep(60)
                continue
            print(f"  [QualityGate] Skip {symbol}: {e}")
            continue

    qualified.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
    result = qualified[:25]
    print(f"[QualityGate] {len(result)} qualified from {len(candidates)} candidates")
    return result
