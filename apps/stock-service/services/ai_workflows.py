import json
import logging
import math
import re
from datetime import date, datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

from services.claude_client import ClaudeClient
from services.vnstock_client import VnstockClient


def _extract_json(text: str) -> dict | list:
    """Robustly extract JSON from AI response, handling code fences and edge cases."""
    cleaned = text.strip()
    # Remove markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    elif cleaned.startswith("```"):
        # Fallback: strip opening/closing fences manually
        cleaned = re.sub(r"^```(?:json)?[\s]*", "", cleaned)
        cleaned = re.sub(r"```\s*$", "", cleaned)
        cleaned = cleaned.strip()
    return json.loads(cleaned)


def _compute_technical_signals(price_data: list[dict]) -> dict:
    """Compute MA and technical signals from OHLCV price data."""
    if not price_data:
        return {}
    closes = [p["close"] for p in price_data]
    n = len(closes)

    def _ma(period: int) -> float | None:
        if n < period:
            return None
        return round(sum(closes[-period:]) / period, 2)

    ma10 = _ma(10)
    ma20 = _ma(20)
    ma50 = _ma(50)
    ma200 = _ma(200)
    current = closes[-1] if closes else None

    signals = {
        "current_price": current,
        "ma10": ma10,
        "ma20": ma20,
        "ma50": ma50,
        "ma200": ma200,
    }

    if current and ma50:
        signals["price_vs_ma50"] = "above" if current > ma50 else "below"
        signals["ma50_distance_pct"] = round((current - ma50) / ma50 * 100, 2)
    if current and ma200:
        signals["price_vs_ma200"] = "above" if current > ma200 else "below"
    if ma10 and ma50:
        signals["ma10_vs_ma50"] = "golden_cross" if ma10 > ma50 else "death_cross"
    if ma50 and ma200:
        signals["ma50_vs_ma200"] = "golden_cross" if ma50 > ma200 else "death_cross"

    if n >= 14:
        gains, losses = [], []
        for i in range(n - 14, n):
            diff = closes[i] - closes[i - 1]
            gains.append(max(diff, 0))
            losses.append(max(-diff, 0))
        avg_gain = sum(gains) / 14
        avg_loss = sum(losses) / 14
        if avg_loss > 0:
            rs = avg_gain / avg_loss
            signals["rsi_14"] = round(100 - (100 / (1 + rs)), 1)
        else:
            signals["rsi_14"] = 100.0

    if n >= 5:
        recent_vol = [p["volume"] for p in price_data[-5:]]
        avg_vol_5 = sum(recent_vol) / 5
        if n >= 20:
            avg_vol_20 = sum(p["volume"] for p in price_data[-20:]) / 20
            if avg_vol_20 > 0:
                signals["volume_ratio_5d_vs_20d"] = round(avg_vol_5 / avg_vol_20, 2)

    return signals


def _sanitize(obj):
    """Convert non-JSON-serializable keys/values to JSON-safe types."""
    if isinstance(obj, dict):
        return {str(k): _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(item) for item in obj]
    if isinstance(obj, set):
        return [_sanitize(item) for item in sorted(str(i) for i in obj)]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    try:
        import numpy as np
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            f = float(obj)
            return None if math.isnan(f) or math.isinf(f) else f
        if isinstance(obj, np.ndarray):
            return [_sanitize(item) for item in obj.tolist()]
        if isinstance(obj, np.bool_):
            return bool(obj)
    except ImportError:
        pass
    return obj


def _normalize_ratios_to_vnd(ratios: list[dict]) -> list[dict]:
    """Convert per-share metrics from 1000 VND to VND for AI consumption.

    VCI and CafeF return EPS and BVPS in 1000 VND units (e.g., EPS=2.0 means 2,000 VND).
    Since prices are already in VND, normalize per-share values to match.
    """
    result = []
    for r in ratios:
        normalized = dict(r)
        for field in ("earningPerShare", "bookValuePerShare"):
            val = normalized.get(field)
            if val is not None and isinstance(val, (int, float)):
                normalized[field] = round(val * 1000)
        result.append(normalized)
    return result


ANALYZE_PROMPT = """You are a Vietnam stock market analyst. Analyze this stock and provide a structured assessment.

IMPORTANT: All text fields (summary, reasoning, signals) MUST be written in Vietnamese.
NOTE: All prices and per-share values (EPS, BVPS) are in VND. Market cap is in billion VND. P/E, P/B, ROE are ratios.

Respond in JSON format:
{
  "action": "BUY" | "WATCH" | "AVOID",
  "confidence": 0-100,
  "summary": "2-3 câu tóm tắt bằng tiếng Việt",
  "technical": {
    "trend": "uptrend|downtrend|sideways",
    "support": number,
    "resistance": number,
    "signals": ["danh sách tín hiệu chính bằng tiếng Việt"]
  },
  "fundamental": {
    "pe_assessment": "cheap|fair|expensive",
    "roe_assessment": "strong|average|weak",
    "revenue_trend": "growing|stable|declining",
    "key_metrics": {}
  },
  "news_sentiment": "positive|neutral|negative",
  "risk_level": "low|medium|high",
  "entry_price": number,
  "stop_loss": number,
  "target_price": number,
  "reasoning": "phân tích chi tiết bằng tiếng Việt"
}"""

DEEP_RESEARCH_PROMPT = """You are a senior Vietnam stock market research analyst. Write a comprehensive research report for this stock.

IMPORTANT: Write the ENTIRE report in Vietnamese (tiếng Việt).
NOTE: All prices and per-share values (EPS, BVPS) are in VND. Market cap is in billion VND. P/E, P/B, ROE are ratios. Use these values directly for valuation calculations.

Include:
1. Tóm tắt tổng quan (Executive Summary)
2. Giới thiệu công ty (Company Overview)
3. Phân tích tài chính (Financial Analysis - multi-year trends)
4. Phân tích kỹ thuật (Technical Analysis)
5. Vị thế ngành & cạnh tranh (Industry & Competitive Position)
6. Yếu tố rủi ro (Risk Factors)
7. Động lực tăng trưởng (Catalysts)
8. Định giá (Valuation - fair value estimate)
9. Khuyến nghị đầu tư (Investment Recommendation - BUY/HOLD/SELL with target price)

Be thorough and data-driven. Cite specific numbers from the provided data."""

PORTFOLIO_REVIEW_PROMPT = """You are a Vietnam stock market portfolio advisor.
Review each holding and provide actionable suggestions.

NOTE: All prices and per-share values (EPS, BVPS) are in VND. Market cap is in billion VND. P/E, P/B, ROE are ratios.

Each holding includes:
- Position: symbol, quantity, averagePrice, currentPrice, pnlPercent, horizon, stopLoss, takeProfit
- Financial ratios: P/E, ROE, debt levels (latest period)
- Technical signals: MA10/MA20/MA50/MA200 values, RSI-14, volume ratio, cross signals (golden_cross/death_cross)
- Deep research summary (research_summary field, if available): comprehensive fundamental + technical + company analysis

For each holding, analyze:
- P&L performance vs investment horizon (lỗ > 15% ngắn hạn → cắt lỗ)
- Technical signals: price vs MA50 (above=bullish, below=bearish), RSI (>70 overbought, <30 oversold), volume trends
- MA cross signals: golden_cross = bullish momentum, death_cross = bearish momentum
- Financial health from ratios AND deep research (if provided)
- Whether the holding aligns with the chosen horizon
- Risk/reward at current price level

Decision framework:
- SELL: Lỗ nặng + cơ bản xấu, hoặc đã đạt TP, hoặc death_cross + RSI yếu + cơ bản xấu
- HOLD: Cơ bản tốt + chưa đạt mục tiêu, hoặc tín hiệu kỹ thuật trung tính
- ADD_MORE: Giá dưới MA50 + cơ bản mạnh + golden_cross gần đây + phù hợp kỳ hạn

If research_summary is available for a holding, USE IT for deeper reasoning about company quality and outlook.
If not available, base analysis on ratios and technical signals only.

IMPORTANT: All text MUST be written in Vietnamese. Be specific with numbers and price levels.

For each holding, also check the "dividend" field in ratios data. If dividend data is available, include it.

Respond in JSON:
{
  "holdings": [
    {
      "symbol": "XXX",
      "action": "HOLD" | "SELL" | "ADD_MORE",
      "reasoning": "3-4 câu giải thích dựa trên vị thế, kỹ thuật, và deep research (nếu có)",
      "urgency": "low|medium|high",
      "suggested_stop_loss": number or null (VND, based on MA50/support levels),
      "suggested_take_profit": number or null (VND, based on resistance/valuation),
      "dividend_yield": number or null (decimal, e.g. 0.035 = 3.5%, from ratios if available)
    }
  ],
  "portfolio_summary": "đánh giá tổng quan danh mục 3-4 câu: phân bổ, rủi ro, tín hiệu kỹ thuật chung, khuyến nghị"
}"""


QUICK_ASSESS_BATCH_PROMPT = """You are a Vietnam stock market VALUE INVESTING analyst (phong cách đầu tư giá trị).
You will receive a batch of stock candidates with their key financial metrics.

Your job: Find genuinely UNDERVALUED stocks — stocks trading below intrinsic value.

For EACH stock, decide: PASS (genuinely undervalued) or FAIL (not undervalued or too risky).

A stock FAILS if:
- P/E is high (> 15) without exceptional growth to justify it
- P/B is high (> 2.5) — not a value stock
- Revenue declining for 2+ years
- Financial leverage > 4 (debt trap)
- Net profit margin negative or < 2% without improvement
- ROE below 8% — poor capital efficiency
- Market cap too small (< 300B VND) — illiquid
- Metrics suggest manipulation or window dressing
- Stock is in a declining industry with no moat

A stock PASSES (undervalued) if it has MOST of these:
- P/E below 12 AND positive earnings growth
- P/B below 1.5 (ideally below 1.0 = below book value)
- ROE above 15% — strong profitability
- Revenue AND profit growing YoY
- Low debt (financial leverage < 3)
- Dividend yield > 3%
- Clear competitive advantage or market leader

Priority 8-10: Strong undervalue signal (P/E < 10, ROE > 18%, growing revenue)
Priority 5-7: Moderate value (decent metrics but some concerns)
Priority 1-4: Borderline — just barely passes

IMPORTANT: Be STRICT. Only PASS stocks that are genuinely undervalued. Better to miss a stock than include an overvalued one. All reasoning MUST be in Vietnamese.

Respond in JSON format:
{
  "assessments": [
    {
      "symbol": "XXX",
      "verdict": "PASS" or "FAIL",
      "reason": "1 câu giải thích bằng tiếng Việt",
      "priority": 1-10
    }
  ]
}"""

FULL_ANALYSIS_PROMPT = """You are a senior Vietnam stock market analyst performing a comprehensive investment analysis.
Analyze this stock using ALL provided data: price chart patterns, financial statements, and recent news.

NOTE: All prices and per-share values (EPS, BVPS) are in VND. Market cap is in billion VND. P/E, P/B, ROE are ratios.

Your analysis MUST cover these 3 dimensions:

1. KỸ THUẬT (Technical/Chart):
   - Current price trend (uptrend/downtrend/sideways) based on OHLCV data
   - Key support and resistance levels (specific prices)
   - Volume trend analysis
   - Notable candlestick patterns from recent data
   - Distance from 52-week high/low

2. CƠ BẢN (Fundamental):
   - P/E, P/B, ROE, EPS assessment
   - Revenue and profit trends (multi-year from income statement)
   - Balance sheet health (debt levels, equity, leverage)
   - Cash flow quality
   - Dividend yield if available

3. TIN TỨC (News & Sentiment):
   - Recent news sentiment (positive/neutral/negative)
   - Key catalysts or risks from news headlines
   - Industry/sector context from news

IMPORTANT: All text MUST be written in Vietnamese (tiếng Việt).

Respond in JSON format:
{
  "action": "BUY" | "WATCH" | "AVOID",
  "confidence": 0-100,
  "summary": "3-5 câu tóm tắt toàn diện bằng tiếng Việt, bao gồm kỹ thuật + cơ bản + tin tức",
  "technical": {
    "trend": "uptrend|downtrend|sideways",
    "support": number,
    "resistance": number,
    "signals": ["tín hiệu kỹ thuật bằng tiếng Việt"]
  },
  "fundamental": {
    "pe_assessment": "cheap|fair|expensive",
    "roe_assessment": "strong|average|weak",
    "revenue_trend": "growing|stable|declining",
    "balance_health": "strong|adequate|weak",
    "key_metrics": {}
  },
  "news_sentiment": "positive|neutral|negative",
  "news_highlights": ["điểm nổi bật tin tức bằng tiếng Việt"],
  "risk_level": "low|medium|high",
  "entry_price": number,
  "stop_loss": number,
  "target_price": number,
  "reasoning": "phân tích chi tiết bằng tiếng Việt bao gồm cả 3 khía cạnh"
}"""


NEWS_EXTRACT_PROMPT = """You are a Vietnam stock market news analyst.
Read these news headlines and identify specific stock tickers (HOSE/HNX) that are being discussed in a POSITIVE investment context.

Only include stocks with:
- Clear positive catalysts (new contracts, earnings beat, expansion, M&A)
- Industry tailwinds mentioned
- Analyst upgrade or positive research report
- Strong quarterly results announced

Do NOT include stocks mentioned in:
- Negative contexts (lawsuits, losses, scandals, investigations)
- General market commentary without specific stock thesis
- Advertisements or sponsored content

IMPORTANT: All reasoning in Vietnamese.

Respond in JSON:
{
  "stocks": [
    {
      "symbol": "XXX",
      "reason": "lý do bằng tiếng Việt",
      "context": "tóm tắt tin tức liên quan"
    }
  ]
}"""


SECTOR_ANALYSIS_PROMPT = """You are a Vietnam stock market SECTOR analyst.
Analyze these market news headlines and identify which SECTORS/INDUSTRIES are receiving money inflows or have positive catalysts.

Think about:
- Which industries benefit from government policy, regulations, or economic trends?
- Which sectors have positive earnings seasons or growth drivers?
- Where is institutional money flowing (banking, real estate, tech, etc.)?
- What macro trends (interest rates, FDI, infrastructure spending) favor which sectors?

Available sector names (MUST use exactly these):
Ngân hàng, Bất động sản, Chứng khoán, Công nghệ và thông tin, Thực phẩm - Đồ uống, Bán lẻ, Bán buôn, Khai khoáng, Xây dựng, Vật liệu xây dựng, Tiện ích, Vận tải - kho bãi, SX Nhựa - Hóa chất, Thiết bị điện, Bảo hiểm, Chăm sóc sức khỏe, Chế biến Thủy sản, SX Hàng gia dụng, SX Phụ trợ, Nông - Lâm - Ngư, Dịch vụ lưu trú, ăn uống, giải trí, Sản phẩm cao su, Tài chính khác, Dịch vụ tư vấn, hỗ trợ, SX Thiết bị, máy móc

IMPORTANT:
- Only pick sectors with CLEAR evidence from the headlines
- All text in Vietnamese
- If no clear sector signal, return fewer sectors
- Confidence > 70 = strong signal, 50-70 = moderate, < 50 = weak
- Also pick the 5-8 most important/market-moving headlines and write a brief summary for each

Respond in JSON:
{
  "sectors": [
    {
      "sector_name": "Ngân hàng",
      "confidence": 80,
      "thesis": "Giải thích bằng tiếng Việt tại sao dòng tiền chảy vào ngành này...",
      "catalysts": ["Chính sách nới room tín dụng", "Lãi suất giảm"]
    }
  ],
  "market_mood": "positive|neutral|negative",
  "market_summary": "Viết 1 đoạn tổng quan thị trường chi tiết (8-12 câu) bằng tiếng Việt. Bao gồm: (1) Xu hướng chung của VN-Index và thanh khoản, (2) Dòng tiền đang chảy vào ngành nào và tại sao, (3) Các yếu tố vĩ mô tác động (lãi suất, tỷ giá, chính sách), (4) Tâm lý nhà đầu tư và rủi ro cần lưu ý, (5) Nhận định ngắn hạn cho tuần tới",
  "important_news": [
    {
      "index": 0,
      "title": "Tiêu đề tin tức",
      "summary": "2-3 câu phân tích tác động đến thị trường: tin này ảnh hưởng thế nào đến dòng tiền, ngành nào hưởng lợi/thiệt hại, mức độ tác động ngắn/trung hạn",
      "impact": "positive|negative|neutral",
      "related_sectors": ["Ngân hàng"]
    }
  ]
}"""

NEWS_STOCK_SELECTION_PROMPT = """You are a Vietnam stock market analyst.
Given hot sectors and market news, select the top {limit} stocks most likely to benefit from current market conditions.

SECTOR CONTEXT:
{sector_context}

CANDIDATE STOCKS (from hot sectors):
{stock_list}

MARKET NEWS HEADLINES:
{headlines}

Select the {limit} stocks with the STRONGEST news-backed investment thesis.
Prioritize:
- Stocks directly mentioned in positive news
- Stocks that benefit most from sector catalysts
- Large-cap, liquid stocks (well-known names like VCB, FPT, HPG, TCB, VNM, MWG, VIC, etc.)
- Stocks in sectors with highest confidence

IMPORTANT: All reasoning in Vietnamese.

Respond in JSON:
{{
  "selected": [
    {{"symbol": "XXX", "reason": "lý do tiếng Việt", "news_relevance": 1-10}}
  ]
}}"""


SECTOR_AWARE_BATCH_PROMPT = """You are a Vietnam stock market VALUE INVESTING analyst (phong cách đầu tư giá trị).
You will receive a batch of stock candidates that belong to HOT SECTORS identified from current market news.

SECTOR CONTEXT:
{sector_context}

Your job: Find genuinely UNDERVALUED stocks within these hot sectors.
Stocks in hot sectors have an EXTRA advantage — they ride the sector momentum.

For EACH stock, decide: PASS (undervalued + sector tailwind) or FAIL.

A stock FAILS if:
- P/E > 15 without exceptional growth
- Revenue declining 2+ years
- Financial leverage > 4
- Net profit margin negative or < 2%
- ROE below 8%
- Does NOT benefit from the sector thesis

A stock PASSES if it has MOST of:
- P/E below 12 AND positive earnings growth
- ROE above 15%
- Revenue AND profit growing YoY
- Low debt (financial leverage < 3)
- DIRECTLY benefits from sector catalysts
- Market leader or strong competitive position

Priority 8-10: Strong value + strong sector alignment
Priority 5-7: Decent value + moderate sector benefit
Priority 1-4: Marginal value or weak sector connection

IMPORTANT: Be STRICT. All reasoning in Vietnamese. Include which sector thesis each stock aligns with.

Respond in JSON:
{
  "assessments": [
    {
      "symbol": "XXX",
      "verdict": "PASS" or "FAIL",
      "reason": "1-2 câu giải thích bằng tiếng Việt, nêu rõ liên hệ với ngành",
      "priority": 1-10,
      "sector_alignment": "Ngân hàng"
    }
  ]
}"""


class AIWorkflowService:
    """Orchestrates AI analysis workflows."""

    def __init__(self):
        self.vnstock = VnstockClient()
        self.claude = ClaudeClient()
        self._fallback = None

    def _get_fallback(self):
        if self._fallback is None:
            from services.fallback_scraper import FallbackFinancialScraper
            self._fallback = FallbackFinancialScraper()
        return self._fallback

    async def _get_price_with_fallback(self, symbol: str, start: str, end: str) -> list[dict]:
        """Get price history, falling back to DNSE if VCI fails."""
        try:
            return self.vnstock.get_price_history(symbol, start, end)
        except Exception as e:
            logger.warning("VCI price failed for %s: %s, trying DNSE fallback", symbol, e)
        try:
            from services.dnse_client import DnseClient
            from datetime import datetime
            start_ts = int(datetime.strptime(start, "%Y-%m-%d").timestamp())
            end_ts = int(datetime.strptime(end, "%Y-%m-%d").timestamp())
            dnse = DnseClient()
            candles = await dnse.get_ohlc(symbol, "1D", start_ts, end_ts)
            for c in candles:
                for f in ("open", "high", "low", "close"):
                    if c.get(f) is not None:
                        c[f] = round(c[f] * 1000)
            logger.info("DNSE price fallback succeeded for %s (%d candles)", symbol, len(candles))
            return candles
        except Exception as e2:
            logger.warning("DNSE price fallback also failed for %s: %s", symbol, e2)
            return []

    async def analyze_stock(self, symbol: str) -> dict:
        """Full stock analysis: price + financials + news → AI summary."""
        from datetime import datetime, timedelta

        from services.news_crawler import NewsCrawler

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        price_data: list[dict] = []
        income: list[dict] = []
        ratios: list[dict] = []
        profile: dict = {}

        price_data = await self._get_price_with_fallback(symbol, start, end)
        try:
            income = self.vnstock.get_income_statement(symbol, "year")
        except Exception as e:
            logger.warning("analyze_stock %s: income fetch failed: %s, trying fallback", symbol, e)
            income = await self._get_fallback().get_income_with_fallback(symbol)
        try:
            ratios = self.vnstock.get_financial_ratios(symbol)
        except Exception as e:
            logger.warning("analyze_stock %s: ratios fetch failed: %s, trying fallback", symbol, e)
            ratios = await self._get_fallback().get_ratios_with_fallback(symbol)
        try:
            profile = self.vnstock.get_company_profile(symbol)
        except Exception as e:
            logger.warning("analyze_stock %s: profile fetch failed: %s", symbol, e)

        crawler = NewsCrawler()
        try:
            news = await crawler.crawl_news(symbol, limit=10)
        except Exception:
            news = []

        ratios = _normalize_ratios_to_vnd(ratios)
        data = {
            "symbol": symbol,
            "profile": profile,
            "technical_signals": _compute_technical_signals(price_data),
            "price_history_last_30": price_data[-30:] if len(price_data) > 30 else price_data,
            "price_52w_high": max(p["high"] for p in price_data) if price_data else None,
            "price_52w_low": min(p["low"] for p in price_data) if price_data else None,
            "current_price": price_data[-1]["close"] if price_data else None,
            "income_statement": income[:4] if len(income) > 4 else income,
            "financial_ratios": ratios[:4] if len(ratios) > 4 else ratios,
            "recent_news": [{"title": n["title"], "source": n["source"], "date": n["published_at"], "snippet": n["snippet"]} for n in news[:5]],
        }

        analysis = await self.claude.analyze(ANALYZE_PROMPT, _sanitize(data))

        try:
            return {"symbol": symbol, "analysis": _extract_json(analysis), "raw_data": _sanitize(data)}
        except (json.JSONDecodeError, IndexError, ValueError):
            return {"symbol": symbol, "analysis": analysis, "raw_data": _sanitize(data)}

    async def full_analysis(self, symbol: str) -> dict:
        """Comprehensive analysis: chart + financials + news → AI structured report.

        Unlike analyze_stock() which is basic, this fetches balance sheet, cash flow,
        60 days of price data, and recent news for a thorough 3-dimensional analysis.
        """
        from datetime import datetime, timedelta

        from services.news_crawler import NewsCrawler

        end = datetime.now().strftime("%Y-%m-%d")
        start_1y = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        price_data: list[dict] = []
        income: list[dict] = []
        balance: list[dict] = []
        cash_flow: list[dict] = []
        ratios: list[dict] = []
        profile: dict = {}

        price_data = await self._get_price_with_fallback(symbol, start_1y, end)
        try:
            income = self.vnstock.get_income_statement(symbol, "year")
        except Exception as e:
            logger.warning("full_analysis %s: income fetch failed: %s, trying fallback", symbol, e)
            income = await self._get_fallback().get_income_with_fallback(symbol)
        try:
            balance = self.vnstock.get_balance_sheet(symbol, "year")
        except Exception as e:
            logger.warning("full_analysis %s: balance fetch failed: %s, trying fallback", symbol, e)
            balance = await self._get_fallback().get_balance_with_fallback(symbol)
        try:
            cash_flow = self.vnstock.get_cash_flow(symbol, "year")
        except Exception as e:
            logger.warning("full_analysis %s: cashflow fetch failed: %s, trying fallback", symbol, e)
            cash_flow = await self._get_fallback().get_cashflow_with_fallback(symbol)
        try:
            ratios = self.vnstock.get_financial_ratios(symbol)
        except Exception as e:
            logger.warning("full_analysis %s: ratios fetch failed: %s, trying fallback", symbol, e)
            ratios = await self._get_fallback().get_ratios_with_fallback(symbol)
        try:
            profile = self.vnstock.get_company_profile(symbol)
        except Exception as e:
            logger.warning("full_analysis %s: profile fetch failed: %s", symbol, e)

        crawler = NewsCrawler()
        try:
            news = await crawler.crawl_news(symbol, limit=10)
        except Exception:
            news = []

        ratios = _normalize_ratios_to_vnd(ratios)
        data = {
            "symbol": symbol,
            "profile": profile,
            "technical_signals": _compute_technical_signals(price_data),
            "price_history_60d": price_data[-60:] if len(price_data) > 60 else price_data,
            "price_52w_high": max(p["high"] for p in price_data) if price_data else None,
            "price_52w_low": min(p["low"] for p in price_data) if price_data else None,
            "current_price": price_data[-1]["close"] if price_data else None,
            "income_statement": income[:5] if len(income) > 5 else income,
            "balance_sheet": balance[:3] if len(balance) > 3 else balance,
            "cash_flow": cash_flow[:3] if len(cash_flow) > 3 else cash_flow,
            "financial_ratios": ratios[:5] if len(ratios) > 5 else ratios,
            "recent_news": [
                {"title": n["title"], "source": n["source"], "date": n["published_at"], "snippet": n["snippet"]}
                for n in news[:5]
            ],
        }

        analysis = await self.claude.analyze(FULL_ANALYSIS_PROMPT, _sanitize(data))

        try:
            return {"symbol": symbol, "analysis": _extract_json(analysis), "raw_data": _sanitize(data)}
        except (json.JSONDecodeError, IndexError, ValueError):
            return {"symbol": symbol, "analysis": analysis, "raw_data": _sanitize(data)}

    async def deep_research(self, symbol: str) -> dict:
        """Deep research report using Claude Opus."""
        from datetime import datetime, timedelta

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=365 * 3)).strftime("%Y-%m-%d")

        price_data: list[dict] = []
        income: list[dict] = []
        balance: list[dict] = []
        cash_flow: list[dict] = []
        ratios: list[dict] = []
        profile: dict = {}

        price_data = await self._get_price_with_fallback(symbol, start, end)
        try:
            income = self.vnstock.get_income_statement(symbol, "year")
        except Exception as e:
            logger.warning("deep_research %s: income fetch failed: %s, trying fallback", symbol, e)
            income = await self._get_fallback().get_income_with_fallback(symbol)
        try:
            balance = self.vnstock.get_balance_sheet(symbol, "year")
        except Exception as e:
            logger.warning("deep_research %s: balance fetch failed: %s, trying fallback", symbol, e)
            balance = await self._get_fallback().get_balance_with_fallback(symbol)
        try:
            cash_flow = self.vnstock.get_cash_flow(symbol, "year")
        except Exception as e:
            logger.warning("deep_research %s: cashflow fetch failed: %s, trying fallback", symbol, e)
            cash_flow = await self._get_fallback().get_cashflow_with_fallback(symbol)
        try:
            ratios = self.vnstock.get_financial_ratios(symbol)
        except Exception as e:
            logger.warning("deep_research %s: ratios fetch failed: %s, trying fallback", symbol, e)
            ratios = await self._get_fallback().get_ratios_with_fallback(symbol)
        try:
            profile = self.vnstock.get_company_profile(symbol)
        except Exception as e:
            logger.warning("deep_research %s: profile fetch failed: %s", symbol, e)

        ratios = _normalize_ratios_to_vnd(ratios)
        data = {
            "symbol": symbol,
            "profile": profile,
            "price_history_monthly": price_data[::20] if price_data else [],
            "income_statement": income,
            "balance_sheet": balance,
            "cash_flow": cash_flow,
            "financial_ratios": ratios,
        }

        report = await self.claude.deep_analyze(DEEP_RESEARCH_PROMPT, _sanitize(data))
        return {"symbol": symbol, "report": report, "model": "opus"}

    async def deep_research_stream(self, symbol: str):
        """Stream deep research report as 4 separate AI calls."""
        from datetime import datetime, timedelta

        from services.news_crawler import NewsCrawler

        end = datetime.now().strftime("%Y-%m-%d")
        start_1y = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        profile = {}
        ratios: list[dict] = []
        price_data: list[dict] = []
        income: list[dict] = []
        balance: list[dict] = []
        cash_flow: list[dict] = []

        try:
            profile = self.vnstock.get_company_profile(symbol)
        except Exception as e:
            logger.warning("deep_research_stream %s: profile fetch failed: %s", symbol, e)
        try:
            ratios = self.vnstock.get_financial_ratios(symbol)
        except Exception as e:
            logger.warning("deep_research_stream %s: ratios fetch failed: %s, trying fallback", symbol, e)
            ratios = await self._get_fallback().get_ratios_with_fallback(symbol)
        price_data = await self._get_price_with_fallback(symbol, start_1y, end)
        try:
            income = self.vnstock.get_income_statement(symbol, "year")
        except Exception as e:
            logger.warning("deep_research_stream %s: income fetch failed: %s, trying fallback", symbol, e)
            income = await self._get_fallback().get_income_with_fallback(symbol)
        try:
            balance = self.vnstock.get_balance_sheet(symbol, "year")
        except Exception as e:
            logger.warning("deep_research_stream %s: balance fetch failed: %s, trying fallback", symbol, e)
            balance = await self._get_fallback().get_balance_with_fallback(symbol)
        try:
            cash_flow = self.vnstock.get_cash_flow(symbol, "year")
        except Exception as e:
            logger.warning("deep_research_stream %s: cashflow fetch failed: %s, trying fallback", symbol, e)
            cash_flow = await self._get_fallback().get_cashflow_with_fallback(symbol)

        crawler = NewsCrawler()
        try:
            news = await crawler.crawl_news(symbol, limit=10)
        except Exception:
            news = []

        ratios = _normalize_ratios_to_vnd(ratios)

        # Track data availability and warn user about missing data
        data_warnings: list[str] = []
        if not profile:
            data_warnings.append("Hồ sơ công ty: không có dữ liệu")
        if not ratios:
            data_warnings.append("Chỉ số tài chính (P/E, ROE, EPS): không có dữ liệu")
        if not price_data:
            data_warnings.append("Lịch sử giá: không có dữ liệu")
        if not income:
            data_warnings.append("Báo cáo kết quả kinh doanh: không có dữ liệu")
        if not balance:
            data_warnings.append("Bảng cân đối kế toán: không có dữ liệu")
        if not cash_flow:
            data_warnings.append("Báo cáo lưu chuyển tiền tệ: không có dữ liệu")
        if not news:
            data_warnings.append("Tin tức gần đây: không có dữ liệu")

        if data_warnings:
            yield {"step": 0, "total": 4, "section": "data_status", "status": "warning", "warnings": data_warnings}

        yield {"step": 1, "total": 4, "section": "basic_analysis", "title": "Phân tích cơ bản", "status": "in_progress"}
        basic_data = _sanitize({
            "symbol": symbol,
            "profile": profile,
            "financial_ratios": ratios[:5] if len(ratios) > 5 else ratios,
        })
        basic_missing = []
        if not profile:
            basic_missing.append("company profile")
        if not ratios:
            basic_missing.append("financial ratios (P/E, ROE, EPS)")
        basic_prompt = f"""Phân tích cơ bản cổ phiếu Việt Nam này. Bao gồm:
- Tổng quan công ty (ngành nghề, vị thế thị trường)
- Đánh giá chỉ số quan trọng: P/E, P/B, ROE, EPS
- Lịch sử cổ tức (nếu có)
- Đánh giá sức khỏe tài chính tổng thể

NOTE: All prices and per-share values (EPS, BVPS) are in VND. Market cap is in billion VND.
{"WARNING: Missing data: " + ", ".join(basic_missing) + ". State clearly which data is unavailable. Do NOT fabricate numbers." if basic_missing else ""}
IMPORTANT: Write ENTIRELY in Vietnamese. Use clear markdown with headers. Be concise but data-driven."""
        basic_content = await self.claude.analyze(basic_prompt, basic_data)
        yield {"step": 1, "total": 4, "section": "basic_analysis", "title": "Phân tích cơ bản", "status": "completed", "content": basic_content}

        yield {"step": 2, "total": 4, "section": "candle_chart", "title": "Phân tích biểu đồ nến", "status": "in_progress"}
        chart_data = _sanitize({
            "symbol": symbol,
            "technical_signals": _compute_technical_signals(price_data),
            "price_history_recent": price_data[-60:] if len(price_data) > 60 else price_data,
            "price_52w_high": max(p["high"] for p in price_data) if price_data else None,
            "price_52w_low": min(p["low"] for p in price_data) if price_data else None,
            "current_price": price_data[-1]["close"] if price_data else None,
        })
        chart_missing = "WARNING: No price data available. State clearly that technical analysis cannot be performed without price data. Do NOT fabricate price levels." if not price_data else ""
        chart_prompt = f"""Phân tích biến động giá và tín hiệu kỹ thuật của cổ phiếu này. Bao gồm:
- Xu hướng hiện tại (tăng/giảm/đi ngang)
- Ngưỡng hỗ trợ và kháng cự quan trọng (mức giá cụ thể)
- Phân tích đường trung bình động (MA 20/50/200)
- Phân tích xu hướng khối lượng giao dịch
- Mô hình nến đáng chú ý
- Đánh giá RSI/động lượng

NOTE: All prices are in VND (e.g., 33500 = 33,500 VND).
{chart_missing}
IMPORTANT: Write ENTIRELY in Vietnamese. Use clear markdown with headers. Give specific price levels in VND."""
        chart_content = await self.claude.analyze(chart_prompt, chart_data)
        yield {"step": 2, "total": 4, "section": "candle_chart", "title": "Phân tích biểu đồ nến", "status": "completed", "content": chart_content}

        yield {"step": 3, "total": 4, "section": "company_analysis", "title": "Phân tích công ty", "status": "in_progress"}
        has_missing_statements = not income or not balance or not cash_flow
        company_data = _sanitize({
            "symbol": symbol,
            "profile": profile,
            "income_statement": income,
            "balance_sheet": balance,
            "cash_flow": cash_flow,
            "financial_ratios": ratios[:10] if has_missing_statements else (ratios[:5] if len(ratios) > 5 else ratios),
        })
        company_missing = []
        if not income:
            company_missing.append("income statement")
        if not balance:
            company_missing.append("balance sheet")
        if not cash_flow:
            company_missing.append("cash flow statement")
        if has_missing_statements and ratios:
            company_prompt = f"""Phân tích tài chính công ty dựa trên dữ liệu chỉ số tài chính nhiều năm (financial_ratios).

LƯU Ý: Báo cáo tài chính chi tiết ({", ".join(company_missing)}) không khả dụng. Hãy SỬ DỤNG financial_ratios (chứa {len(ratios)} năm dữ liệu: EPS, P/E, P/B, ROE, ROA, biên lợi nhuận, đòn bẩy tài chính, doanh thu, lợi nhuận ròng, tăng trưởng) để phân tích:

- Xu hướng EPS và P/E qua các năm
- Xu hướng ROE, ROA (hiệu quả sử dụng vốn)
- Biên lợi nhuận ròng (netProfitMargin) và biên gộp (grossMargin)
- Đòn bẩy tài chính (financialLeverage) — mức nợ
- Xu hướng doanh thu và lợi nhuận ròng (revenue, netProfit, revenueGrowth)
- Cổ tức (dividend) nếu có
- Đánh giá tổng thể sức khỏe tài chính

NOTE: All prices and per-share values (EPS, BVPS) are in VND. Market cap is in billion VND.
IMPORTANT: You MUST provide a detailed analysis using the available ratio data. Do NOT say analysis cannot be performed. Write ENTIRELY in Vietnamese. Use clear markdown with headers. Cite specific numbers and year-over-year changes."""
        else:
            company_prompt = f"""Phân tích chuyên sâu báo cáo tài chính của công ty. Bao gồm:
- Xu hướng doanh thu và lợi nhuận (nhiều năm)
- Phân tích biên lợi nhuận (gộp, hoạt động, ròng)
- Sức khỏe bảng cân đối (mức nợ, thanh khoản)
- Chất lượng dòng tiền (hoạt động vs đầu tư vs tài chính)
- Động lực tăng trưởng và rủi ro từ dữ liệu tài chính
- Vị thế ngành và lợi thế cạnh tranh

{"WARNING: Missing: " + ", ".join(company_missing) + ". Use financial_ratios as supplement. Do NOT fabricate numbers." if company_missing else ""}
IMPORTANT: Write ENTIRELY in Vietnamese. Use clear markdown with headers. Cite specific numbers and year-over-year changes."""
        company_content = await self.claude.analyze(company_prompt, company_data)
        yield {"step": 3, "total": 4, "section": "company_analysis", "title": "Phân tích công ty", "status": "completed", "content": company_content}

        yield {"step": 4, "total": 4, "section": "summary", "title": "Tóm tắt & Khuyến nghị", "status": "in_progress"}
        news_for_summary = [{"title": n["title"], "source": n["source"], "date": n["published_at"], "snippet": n["snippet"]} for n in news[:5]]
        summary_data = {
            "symbol": symbol,
            "basic_analysis": basic_content,
            "chart_analysis": chart_content,
            "company_analysis": company_content,
            "recent_news": news_for_summary,
        }
        summary_prompt = """Dựa trên ba phần phân tích (cơ bản, kỹ thuật/biểu đồ, và tài chính công ty) VÀ tin tức gần đây, viết tóm tắt đầu tư cuối cùng. Bao gồm:

1. **Luận điểm đầu tư** — 2-3 câu tóm tắt cơ hội
2. **Kịch bản tích cực** — lý do cổ phiếu có thể tăng trưởng
3. **Kịch bản tiêu cực** — rủi ro và lo ngại chính
4. **Định giá** — ước tính giá trị hợp lý với phương pháp (all prices in VND)
5. **Khuyến nghị** — MUA / GIỮ / BÁN với:
   - Giá mục tiêu (VND)
   - Vùng giá mua vào (VND)
   - Mức cắt lỗ (VND)
   - Kỳ hạn đầu tư (ngắn hạn/trung hạn/dài hạn)
6. **Mức độ tự tin** — 1-100 với giải thích ngắn

NOTE: All prices and per-share values (EPS, BVPS) in the data are in VND. Use current_price from chart data as reference for price targets.
IMPORTANT: Write ENTIRELY in Vietnamese. Use clear markdown. Be decisive in your recommendation."""
        summary_content = await self.claude.analyze(summary_prompt, summary_data)
        yield {"step": 4, "total": 4, "section": "summary", "title": "Tóm tắt & Khuyến nghị", "status": "completed", "content": summary_content}

    async def quick_assess_batch(self, candidates: list[dict]) -> list[dict]:
        """Batch quick assessment of multiple stocks in one Claude call."""
        batch_data = []
        for c in candidates:
            batch_data.append({
                "symbol": c.get("symbol"),
                "name": c.get("name", ""),
                "pe": c.get("pe"),
                "pb": c.get("pb"),
                "roe": c.get("roe"),
                "eps": c.get("eps"),
                "net_profit_margin": c.get("net_profit_margin"),
                "financial_leverage": c.get("financial_leverage"),
                "dividend_yield": c.get("dividend_yield"),
                "market_cap": c.get("market_cap"),
                "quality_score": c.get("quality_score"),
                "income_summary": c.get("income_summary"),
                "balance_summary": c.get("balance_summary"),
            })

        response = await self.claude.analyze(
            QUICK_ASSESS_BATCH_PROMPT,
            _sanitize({"stocks": batch_data, "count": len(batch_data)}),
        )

        verdict_map = {}
        try:
            parsed = _extract_json(response)
            for a in parsed.get("assessments", []):
                verdict_map[a.get("symbol", "")] = a
        except (json.JSONDecodeError, KeyError, ValueError):
            pass

        result = []
        for c in candidates:
            assessment = verdict_map.get(c["symbol"], {})
            c["ai_verdict"] = assessment.get("verdict", "PASS")
            c["ai_reason"] = assessment.get("reason", "")
            c["ai_priority"] = assessment.get("priority", 5)
            result.append(c)

        return result

    async def extract_stocks_from_news(
        self, headlines: list[dict], exclude_symbols: set[str]
    ) -> list[dict]:
        """Extract promising stock tickers from news headlines."""
        response = await self.claude.analyze(
            NEWS_EXTRACT_PROMPT,
            _sanitize({"headlines": headlines, "exclude": list(exclude_symbols)}),
        )

        try:
            parsed = _extract_json(response)
            return [
                s for s in parsed.get("stocks", [])
                if s.get("symbol") and s["symbol"].upper() not in exclude_symbols
            ]
        except (json.JSONDecodeError, KeyError, ValueError):
            return []

    async def analyze_sectors_from_news(self, headlines: list[dict]) -> dict:
        """Identify hot sectors from market news headlines."""
        news_data = [
            {"index": i, "title": h.get("title", ""), "snippet": h.get("snippet", "")}
            for i, h in enumerate(headlines)
        ]

        response = await self.claude.analyze(
            SECTOR_ANALYSIS_PROMPT,
            _sanitize({"headlines": news_data, "count": len(news_data), "date": datetime.now().strftime("%Y-%m-%d")}),
        )

        try:
            parsed = _extract_json(response)
            sectors = parsed.get("sectors", [])
            sectors.sort(key=lambda x: x.get("confidence", 0), reverse=True)
            parsed["sectors"] = sectors[:5]
            return parsed
        except (json.JSONDecodeError, KeyError, ValueError):
            return {"sectors": [], "market_mood": "neutral", "market_summary": "Không thể phân tích tin tức"}

    async def quick_assess_batch_with_sectors(
        self, candidates: list[dict], sector_context: str
    ) -> list[dict]:
        """Sector-aware batch assessment of stocks."""
        batch_data = []
        for c in candidates:
            batch_data.append({
                "symbol": c.get("symbol"),
                "name": c.get("name", ""),
                "sector_name": c.get("sector_name", ""),
                "pe": c.get("pe"),
                "pb": c.get("pb"),
                "roe": c.get("roe"),
                "eps": c.get("eps"),
                "net_profit_margin": c.get("net_profit_margin"),
                "financial_leverage": c.get("financial_leverage"),
                "dividend_yield": c.get("dividend_yield"),
                "market_cap": c.get("market_cap"),
                "quality_score": c.get("quality_score"),
                "income_summary": c.get("income_summary"),
                "balance_summary": c.get("balance_summary"),
            })

        prompt = SECTOR_AWARE_BATCH_PROMPT.format(sector_context=sector_context)
        response = await self.claude.analyze(
            prompt,
            _sanitize({"stocks": batch_data, "count": len(batch_data)}),
        )

        verdict_map = {}
        try:
            parsed = _extract_json(response)
            for a in parsed.get("assessments", []):
                verdict_map[a.get("symbol", "")] = a
        except (json.JSONDecodeError, KeyError, ValueError):
            pass

        result = []
        for c in candidates:
            assessment = verdict_map.get(c["symbol"], {})
            c["ai_verdict"] = assessment.get("verdict", "PASS")
            c["ai_reason"] = assessment.get("reason", "")
            c["ai_priority"] = assessment.get("priority", 5)
            c["sector_alignment"] = assessment.get("sector_alignment", c.get("sector_name", ""))
            result.append(c)

        return result

    async def select_stocks_from_news(
        self, candidates: list[dict], headlines: list[dict], sector_analysis: dict, limit: int = 10
    ) -> list[dict]:
        """Use AI to select top N stocks based on news relevance and sector context."""
        sector_context = ""
        for s in sector_analysis.get("sectors", []):
            sector_context += f"- {s.get('sector_name', '')}: {s.get('thesis', '')} (confidence: {s.get('confidence', 0)})\n"

        stock_list = ""
        for c in candidates:
            stock_list += f"- {c.get('symbol', '')} ({c.get('name', '')}) — ngành: {c.get('sector_name', '')}, sàn: {c.get('exchange', '')}\n"

        headline_text = ""
        for h in headlines[:40]:
            headline_text += f"- {h.get('title', '')}\n"

        prompt = NEWS_STOCK_SELECTION_PROMPT.format(
            limit=limit,
            sector_context=sector_context,
            stock_list=stock_list,
            headlines=headline_text,
        )

        response = await self.claude.analyze(prompt, _sanitize({"count": len(candidates), "limit": limit}))

        try:
            parsed = _extract_json(response)
            selected_symbols = {s.get("symbol", "").upper() for s in parsed.get("selected", [])}
            reason_map = {s.get("symbol", "").upper(): s for s in parsed.get("selected", [])}
        except (json.JSONDecodeError, KeyError, ValueError):
            selected_symbols = {c["symbol"] for c in candidates[:limit]}
            reason_map = {}

        result = []
        for c in candidates:
            if c["symbol"].upper() in selected_symbols:
                ai_info = reason_map.get(c["symbol"].upper(), {})
                c["news_selection_reason"] = ai_info.get("reason", "")
                c["news_relevance"] = ai_info.get("news_relevance", 5)
                result.append(c)

        result.sort(key=lambda x: x.get("news_relevance", 0), reverse=True)
        return result[:limit]

    async def compare_stocks(self, symbols: list[str]) -> dict:
        """Compare 2-3 stocks side by side."""
        stocks_data = {}
        for symbol in symbols:
            ratios = self.vnstock.get_financial_ratios(symbol)
            profile = self.vnstock.get_company_profile(symbol)
            stocks_data[symbol] = {
                "profile": profile,
                "ratios": ratios[:2] if len(ratios) > 2 else ratios,
            }

        prompt = f"So sánh {len(symbols)} cổ phiếu Việt Nam này. Nêu bật điểm mạnh và điểm yếu của từng cổ phiếu. Khuyến nghị cổ phiếu nào là lựa chọn đầu tư tốt nhất và giải thích lý do. Write ENTIRELY in Vietnamese."
        analysis = await self.claude.analyze(prompt, _sanitize(stocks_data))
        return {"symbols": symbols, "comparison": analysis}

    async def summarize_video(self, video: dict) -> dict:
        """Summarize a YouTube video transcript using AI."""
        title = video.get("title", "")
        channel = video.get("channel_name", "")
        transcript = video.get("transcript", "")

        if len(transcript) > 12000:
            transcript = transcript[:6000] + "\n...\n" + transcript[-6000:]

        prompt = """Bạn là chuyên gia phân tích thị trường chứng khoán Việt Nam.
Hãy phân tích nội dung video YouTube về chứng khoán dưới đây và trích xuất thông tin quan trọng.

Trả về JSON với cấu trúc:
{
  "stocks_mentioned": [{"symbol": "MÃ CỔ PHIẾU (viết hoa)", "sentiment": "bullish|bearish|neutral", "context": "tóm tắt nhận định 1-2 câu: vì sao bullish/bearish, mức giá mục tiêu nếu có"}],
  "sectors": [{"name": "tên ngành", "outlook": "triển vọng ngành 2-3 câu, bao gồm catalyst và rủi ro"}],
  "key_points": ["điểm chính 1 (viết đầy đủ 1-2 câu)", "điểm chính 2", ...],
  "risk_warnings": ["cảnh báo rủi ro 1", ...],
  "trading_recommendations": ["khuyến nghị giao dịch cụ thể 1", ...],
  "overall_sentiment": "bullish|bearish|neutral",
  "summary": "Tóm tắt nội dung video chi tiết trong 4-6 câu. Bao gồm: nhận định xu hướng thị trường, ngành/cổ phiếu trọng tâm, chiến lược giao dịch gợi ý, và cảnh báo rủi ro chính"
}

Lưu ý:
- Chỉ liệt kê mã cổ phiếu thực sự được nhắc đến (VD: VCB, FPT, HPG, PVS...)
- Sentiment dựa trên nhận định của người nói
- key_points: tối đa 7 điểm quan trọng nhất, viết đầy đủ ý không quá ngắn gọn
- risk_warnings: các cảnh báo về rủi ro thị trường, vĩ mô
- trading_recommendations: ghi cụ thể mức giá, vùng mua/bán nếu người nói đề cập
- Viết bằng tiếng Việt"""

        data = {
            "video_title": title,
            "channel": channel,
            "transcript": transcript,
        }

        result = await self.claude.analyze(prompt, _sanitize(data))

        try:
            parsed = _extract_json(result)
            parsed["video_id"] = video.get("video_id", "")
            parsed["title"] = title
            parsed["channel_name"] = channel
            parsed["published_at"] = video.get("published_at", "")
            parsed["thumbnail_url"] = video.get("thumbnail_url", "")
            parsed["duration_minutes"] = video.get("duration_minutes", 0)
            return parsed
        except (json.JSONDecodeError, IndexError, ValueError):
            logger.warning("Failed to parse video summary for %s", title)
            return {
                "video_id": video.get("video_id", ""),
                "title": title,
                "channel_name": channel,
                "published_at": video.get("published_at", ""),
                "summary": result,
                "stocks_mentioned": [],
                "sectors": [],
                "key_points": [],
                "risk_warnings": [],
                "trading_recommendations": [],
                "overall_sentiment": "neutral",
            }

    async def youtube_market_digest(self, video_summaries: list[dict]) -> dict:
        """Cross-reference video summaries into a unified market digest."""
        if not video_summaries:
            return {
                "consensus_stocks": [],
                "hot_sectors": [],
                "conflicting_views": [],
                "risk_warnings": [],
                "market_sentiment": "neutral",
                "summary": "Không có video mới để phân tích.",
            }

        prompt = """Bạn là chuyên gia tổng hợp phân tích thị trường chứng khoán Việt Nam.
Dưới đây là tóm tắt AI từ nhiều kênh YouTube tài chính khác nhau trong ngày.
Hãy tổng hợp và đối chiếu các nhận định để đưa ra bức tranh toàn cảnh thị trường.

Trả về JSON với cấu trúc:
{
  "consensus_stocks": [{"symbol": "MÃ", "mentions": số_lần_nhắc, "avg_sentiment": "bullish|bearish|neutral", "contexts": ["nhận định từ kênh A", "nhận định từ kênh B"]}],
  "hot_sectors": [{"name": "tên ngành", "outlook": "triển vọng chi tiết 2-3 câu", "mentioned_by": ["kênh A", "kênh B"]}],
  "conflicting_views": [{"topic": "chủ đề", "views": [{"creator": "kênh", "position": "quan điểm"}]}],
  "risk_warnings": ["cảnh báo rủi ro tổng hợp 1", ...],
  "market_sentiment": "bullish|bearish|neutral",
  "summary": "Viết 1 đoạn tổng quan thị trường chi tiết (8-15 câu) dựa trên TẤT CẢ các video. Bao gồm: (1) Xu hướng chung VN-Index theo nhận định các kênh, (2) Dòng tiền đang chảy vào đâu và vì sao, (3) Ngành/cổ phiếu nào được nhiều kênh đồng thuận nhất, (4) Các yếu tố vĩ mô và rủi ro được nhắc đến, (5) Các quan điểm trái chiều nổi bật giữa các kênh, (6) Nhận định chung cho phiên/tuần tới"
}

Lưu ý:
- consensus_stocks: chỉ liệt kê cổ phiếu được 2+ kênh nhắc đến, hoặc cổ phiếu được nhấn mạnh đặc biệt
- conflicting_views: khi các kênh có nhận định trái ngược
- risk_warnings: tổng hợp tất cả cảnh báo rủi ro, loại bỏ trùng lặp
- hot_sectors outlook: viết chi tiết triển vọng ngành, không chỉ 1 câu ngắn
- summary: PHẢI viết đầy đủ chi tiết, đây là phần quan trọng nhất giúp nhà đầu tư nắm bắt toàn cảnh thị trường
- Viết bằng tiếng Việt"""

        data = {"video_summaries": video_summaries}
        result = await self.claude.analyze(prompt, _sanitize(data))

        try:
            return _extract_json(result)
        except (json.JSONDecodeError, IndexError, ValueError):
            logger.warning("Failed to parse youtube digest")
            return {
                "consensus_stocks": [],
                "hot_sectors": [],
                "conflicting_views": [],
                "risk_warnings": [],
                "market_sentiment": "neutral",
                "summary": "Không thể phân tích dữ liệu. Vui lòng thử lại.",
            }

    async def extract_recommendation(self, symbol: str, report_text: str) -> dict:
        """Extract structured BUY/HOLD/SELL recommendation from deep research report."""
        if not report_text:
            return {"recommendation": "HOLD", "confidence": 0, "summary": "Không có dữ liệu"}

        prompt = """Từ báo cáo phân tích cổ phiếu dưới đây, trích xuất thông tin khuyến nghị đầu tư.

Trả về JSON:
{
  "recommendation": "BUY|HOLD|SELL",
  "confidence": 0-100,
  "target_price": số (giá mục tiêu VND, null nếu không có),
  "entry_price": số (vùng giá mua vào VND, null nếu không có),
  "stop_loss": số (mức cắt lỗ VND, null nếu không có),
  "summary": "2-3 câu tóm tắt lý do khuyến nghị bằng tiếng Việt"
}

Lưu ý:
- Nếu báo cáo khuyến nghị MUA/TÍCH LŨY → BUY
- Nếu báo cáo khuyến nghị GIỮ/THEO DÕI → HOLD
- Nếu báo cáo khuyến nghị BÁN/TRÁNH → SELL
- Confidence dựa trên mức độ tự tin trong báo cáo
- Giá trị VND (không chia 1000)"""

        truncated = report_text[:8000] if len(report_text) > 8000 else report_text
        result = await self.claude.analyze(prompt, _sanitize({"symbol": symbol, "report": truncated}))

        try:
            return _extract_json(result)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Failed to parse recommendation for %s", symbol)
            return {"recommendation": "HOLD", "confidence": 0, "summary": result[:200]}

    async def watchlist_review(self, symbols: list[str]) -> dict:
        """Review watchlist stocks with MA50 signal as primary indicator."""
        from datetime import datetime, timedelta

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

        stock_signals = []
        for symbol in symbols:
            price_data = await self._get_price_with_fallback(symbol, start, end)
            if not price_data:
                stock_signals.append({
                    "symbol": symbol,
                    "error": "Không có dữ liệu giá",
                })
                continue

            signals = _compute_technical_signals(price_data)
            stock_signals.append({
                "symbol": symbol,
                "current_price": signals.get("current_price"),
                "ma50": signals.get("ma50"),
                "ma10": signals.get("ma10"),
                "ma20": signals.get("ma20"),
                "price_vs_ma50": signals.get("price_vs_ma50"),
                "ma50_distance_pct": signals.get("ma50_distance_pct"),
                "ma10_vs_ma50": signals.get("ma10_vs_ma50"),
                "rsi_14": signals.get("rsi_14"),
                "volume_ratio_5d_vs_20d": signals.get("volume_ratio_5d_vs_20d"),
            })

        valid_signals = [s for s in stock_signals if "error" not in s]
        if not valid_signals:
            return {"results": stock_signals}

        prompt = """Bạn là chuyên gia phân tích kỹ thuật chứng khoán Việt Nam.
Dựa trên tín hiệu MA50 và các chỉ báo kỹ thuật, đánh giá từng cổ phiếu trong watchlist.

QUY TẮC QUAN TRỌNG:
- MA50 là tín hiệu CHÍNH: Giá trên MA50 → xu hướng TĂNG, tín hiệu MUA tốt
- Giá dưới MA50 → xu hướng GIẢM, nên CHỜ ĐỢI
- MA10 cắt lên MA50 (golden_cross) → tín hiệu mua mạnh
- MA10 cắt xuống MA50 (death_cross) → tín hiệu bán
- RSI > 70: quá mua (cẩn thận), RSI < 30: quá bán (có thể mua)
- Volume ratio > 1.5: khối lượng tăng đáng kể

GIÁ MUA GỢI Ý (suggested_buy_price):
- Nếu signal = BUY: gợi ý giá mua tốt dựa trên MA50, hỗ trợ gần nhất, và giá hiện tại
  + Giá mua nên <= giá hiện tại (mua ngay) hoặc gần MA50/MA20 (chờ pullback)
- Nếu signal = WAIT: gợi ý giá mua khi pullback về MA50 hoặc vùng hỗ trợ
- Nếu signal = SELL: không gợi ý (null)
- QUAN TRỌNG: Đơn vị giá GIỐNG HỆT dữ liệu đầu vào (VD: current_price=26650 thì suggested_buy_price=27000, KHÔNG PHẢI 27)

Trả về JSON:
{
  "results": [
    {
      "symbol": "MÃ",
      "signal": "BUY|WAIT|SELL",
      "confidence": "high|medium|low",
      "suggested_buy_price": 27000,
      "reasoning": "giải thích ngắn gọn 2-3 câu bằng tiếng Việt, bao gồm lý do gợi ý giá mua"
    }
  ]
}

Lưu ý: Viết bằng tiếng Việt. Signal BUY khi giá trên MA50 và các chỉ báo hỗ trợ."""

        result = await self.claude.analyze(prompt, _sanitize({"stocks": valid_signals}))

        try:
            ai_results = _extract_json(result)
            ai_map = {r["symbol"]: r for r in ai_results.get("results", [])}
        except (json.JSONDecodeError, IndexError, KeyError, ValueError):
            logger.warning("Failed to parse watchlist review AI response")
            ai_map = {}

        final_results = []
        for s in stock_signals:
            symbol = s["symbol"]
            ai = ai_map.get(symbol, {})
            final_results.append({
                **s,
                "signal": ai.get("signal", "WAIT" if s.get("price_vs_ma50") == "below" else "BUY"),
                "confidence": ai.get("confidence", "medium"),
                "suggested_buy_price": ai.get("suggested_buy_price"),
                "reasoning": ai.get("reasoning", ""),
            })

        return {"results": final_results}

    async def portfolio_review(self, holdings: list[dict]) -> dict:
        """Review portfolio holdings with AI suggestions."""
        import time
        from datetime import datetime, timedelta

        enriched = []
        for h in holdings:
            symbol = h.get("symbol", "")
            try:
                ratios = self.vnstock.get_financial_ratios(symbol)
                time.sleep(1.1)
            except Exception as e:
                logger.warning("portfolio_review %s: ratios fetch failed: %s, trying fallback", symbol, e)
                ratios = await self._get_fallback().get_ratios_with_fallback(symbol)

            try:
                end = datetime.now().strftime("%Y-%m-%d")
                start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
                price_data = self.vnstock.get_price_history(symbol, start, end)
                signals = _compute_technical_signals(price_data)
            except Exception:
                signals = {}

            ratios = _normalize_ratios_to_vnd(ratios)
            entry = {
                **h,
                "ratios": ratios[:1] if ratios else [],
                "technical_signals": signals,
            }
            enriched.append(entry)

        analysis = await self.claude.analyze(PORTFOLIO_REVIEW_PROMPT, _sanitize({"holdings": enriched}))

        try:
            return {"review": _extract_json(analysis)}
        except (json.JSONDecodeError, IndexError, ValueError):
            return {"review": analysis}
