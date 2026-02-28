import json
import math
from datetime import date, datetime
from decimal import Decimal

from services.claude_client import ClaudeClient
from services.vnstock_client import VnstockClient


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

ANALYZE_PROMPT = """You are a Vietnam stock market analyst. Analyze this stock and provide a structured assessment.

IMPORTANT: All text fields (summary, reasoning, signals) MUST be written in Vietnamese.

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

PORTFOLIO_REVIEW_PROMPT = """You are a Vietnam stock market portfolio advisor. Review each holding and provide actionable suggestions.

Each holding includes: symbol, quantity, averagePrice, currentPrice, pnlPercent, horizon, and financial ratios.

For each holding, analyze:
- P&L performance vs investment horizon (nếu lỗ > 15% ở kỳ hạn ngắn → cân nhắc cắt lỗ)
- Financial health from ratios (P/E, ROE, debt levels)
- Whether the holding aligns with the chosen horizon
- Risk/reward at current price level

Decision framework:
- SELL: Lỗ nặng + cơ bản xấu, hoặc đã đạt mục tiêu lợi nhuận, hoặc cơ bản suy giảm nghiêm trọng
- HOLD: Cơ bản tốt + chưa đạt mục tiêu, hoặc đang trong vùng tích lũy hợp lý
- ADD_MORE: Giá đang rẻ + cơ bản mạnh + phù hợp kỳ hạn đầu tư

IMPORTANT: All text MUST be written in Vietnamese. Be specific with numbers.

Respond in JSON format:
{
  "holdings": [
    {
      "symbol": "XXX",
      "action": "HOLD" | "SELL" | "ADD_MORE",
      "reasoning": "2-3 câu giải thích cụ thể bằng tiếng Việt, nêu rõ lý do dựa trên dữ liệu",
      "urgency": "low|medium|high"
    }
  ],
  "portfolio_summary": "đánh giá tổng quan danh mục 3-4 câu bằng tiếng Việt: phân bổ tài sản, rủi ro chung, khuyến nghị cải thiện"
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
  "market_summary": "2-3 câu tóm tắt tâm lý thị trường bằng tiếng Việt"
}"""

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

    async def analyze_stock(self, symbol: str) -> dict:
        """Full stock analysis: price + financials + news → AI summary."""
        from datetime import datetime, timedelta

        from services.news_crawler import NewsCrawler

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        price_data = self.vnstock.get_price_history(symbol, start, end)
        income = self.vnstock.get_income_statement(symbol, "year")
        ratios = self.vnstock.get_financial_ratios(symbol)
        profile = self.vnstock.get_company_profile(symbol)

        crawler = NewsCrawler()
        try:
            news = await crawler.crawl_news(symbol, limit=10)
        except Exception:
            news = []

        data = {
            "symbol": symbol,
            "profile": profile,
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
            cleaned = analysis.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                cleaned = cleaned.rsplit("```", 1)[0]
            return {"symbol": symbol, "analysis": json.loads(cleaned), "raw_data": _sanitize(data)}
        except (json.JSONDecodeError, IndexError):
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

        price_data = self.vnstock.get_price_history(symbol, start_1y, end)
        income = self.vnstock.get_income_statement(symbol, "year")
        balance = self.vnstock.get_balance_sheet(symbol, "year")
        cash_flow = self.vnstock.get_cash_flow(symbol, "year")
        ratios = self.vnstock.get_financial_ratios(symbol)
        profile = self.vnstock.get_company_profile(symbol)

        crawler = NewsCrawler()
        try:
            news = await crawler.crawl_news(symbol, limit=10)
        except Exception:
            news = []

        data = {
            "symbol": symbol,
            "profile": profile,
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
            cleaned = analysis.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                cleaned = cleaned.rsplit("```", 1)[0]
            return {"symbol": symbol, "analysis": json.loads(cleaned), "raw_data": _sanitize(data)}
        except (json.JSONDecodeError, IndexError):
            return {"symbol": symbol, "analysis": analysis, "raw_data": _sanitize(data)}

    async def deep_research(self, symbol: str) -> dict:
        """Deep research report using Claude Opus."""
        from datetime import datetime, timedelta

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=365 * 3)).strftime("%Y-%m-%d")

        price_data = self.vnstock.get_price_history(symbol, start, end)
        income = self.vnstock.get_income_statement(symbol, "year")
        balance = self.vnstock.get_balance_sheet(symbol, "year")
        cash_flow = self.vnstock.get_cash_flow(symbol, "year")
        ratios = self.vnstock.get_financial_ratios(symbol)
        profile = self.vnstock.get_company_profile(symbol)

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
        start_3y = (datetime.now() - timedelta(days=365 * 3)).strftime("%Y-%m-%d")

        profile = self.vnstock.get_company_profile(symbol)
        ratios = self.vnstock.get_financial_ratios(symbol)
        price_data = self.vnstock.get_price_history(symbol, start_1y, end)
        income = self.vnstock.get_income_statement(symbol, "year")
        balance = self.vnstock.get_balance_sheet(symbol, "year")
        cash_flow = self.vnstock.get_cash_flow(symbol, "year")

        crawler = NewsCrawler()
        try:
            news = await crawler.crawl_news(symbol, limit=10)
        except Exception:
            news = []

        yield {"step": 1, "total": 4, "section": "basic_analysis", "title": "Phân tích cơ bản", "status": "in_progress"}
        basic_data = _sanitize({
            "symbol": symbol,
            "profile": profile,
            "financial_ratios": ratios[:4] if len(ratios) > 4 else ratios,
        })
        basic_prompt = """Phân tích cơ bản cổ phiếu Việt Nam này. Bao gồm:
- Tổng quan công ty (ngành nghề, vị thế thị trường)
- Đánh giá chỉ số quan trọng: P/E, P/B, ROE, EPS
- Lịch sử cổ tức (nếu có)
- Đánh giá sức khỏe tài chính tổng thể

IMPORTANT: Write ENTIRELY in Vietnamese. Use clear markdown with headers. Be concise but data-driven."""
        basic_content = await self.claude.analyze(basic_prompt, basic_data)
        yield {"step": 1, "total": 4, "section": "basic_analysis", "title": "Phân tích cơ bản", "status": "completed", "content": basic_content}

        yield {"step": 2, "total": 4, "section": "candle_chart", "title": "Phân tích biểu đồ nến", "status": "in_progress"}
        chart_data = _sanitize({
            "symbol": symbol,
            "price_history_recent": price_data[-60:] if len(price_data) > 60 else price_data,
            "price_52w_high": max(p["high"] for p in price_data) if price_data else None,
            "price_52w_low": min(p["low"] for p in price_data) if price_data else None,
            "current_price": price_data[-1]["close"] if price_data else None,
        })
        chart_prompt = """Phân tích biến động giá và tín hiệu kỹ thuật của cổ phiếu này. Bao gồm:
- Xu hướng hiện tại (tăng/giảm/đi ngang)
- Ngưỡng hỗ trợ và kháng cự quan trọng (mức giá cụ thể)
- Phân tích đường trung bình động (MA 20/50/200)
- Phân tích xu hướng khối lượng giao dịch
- Mô hình nến đáng chú ý
- Đánh giá RSI/động lượng

IMPORTANT: Write ENTIRELY in Vietnamese. Use clear markdown with headers. Give specific price levels."""
        chart_content = await self.claude.analyze(chart_prompt, chart_data)
        yield {"step": 2, "total": 4, "section": "candle_chart", "title": "Phân tích biểu đồ nến", "status": "completed", "content": chart_content}

        yield {"step": 3, "total": 4, "section": "company_analysis", "title": "Phân tích công ty", "status": "in_progress"}
        company_data = _sanitize({
            "symbol": symbol,
            "profile": profile,
            "income_statement": income,
            "balance_sheet": balance,
            "cash_flow": cash_flow,
        })
        company_prompt = """Phân tích chuyên sâu báo cáo tài chính của công ty. Bao gồm:
- Xu hướng doanh thu và lợi nhuận (nhiều năm)
- Phân tích biên lợi nhuận (gộp, hoạt động, ròng)
- Sức khỏe bảng cân đối (mức nợ, thanh khoản)
- Chất lượng dòng tiền (hoạt động vs đầu tư vs tài chính)
- Động lực tăng trưởng và rủi ro từ dữ liệu tài chính
- Vị thế ngành và lợi thế cạnh tranh

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
4. **Định giá** — ước tính giá trị hợp lý với phương pháp
5. **Khuyến nghị** — MUA / GIỮ / BÁN với:
   - Giá mục tiêu
   - Vùng giá mua vào
   - Mức cắt lỗ
   - Kỳ hạn đầu tư (ngắn hạn/trung hạn/dài hạn)
6. **Mức độ tự tin** — 1-100 với giải thích ngắn

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
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                cleaned = cleaned.rsplit("```", 1)[0]
            parsed = json.loads(cleaned)
            for a in parsed.get("assessments", []):
                verdict_map[a.get("symbol", "")] = a
        except (json.JSONDecodeError, KeyError):
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
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                cleaned = cleaned.rsplit("```", 1)[0]
            parsed = json.loads(cleaned)
            return [
                s for s in parsed.get("stocks", [])
                if s.get("symbol") and s["symbol"].upper() not in exclude_symbols
            ]
        except (json.JSONDecodeError, KeyError):
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
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                cleaned = cleaned.rsplit("```", 1)[0]
            parsed = json.loads(cleaned)
            sectors = parsed.get("sectors", [])
            sectors.sort(key=lambda x: x.get("confidence", 0), reverse=True)
            parsed["sectors"] = sectors[:5]
            return parsed
        except (json.JSONDecodeError, KeyError):
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
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                cleaned = cleaned.rsplit("```", 1)[0]
            parsed = json.loads(cleaned)
            for a in parsed.get("assessments", []):
                verdict_map[a.get("symbol", "")] = a
        except (json.JSONDecodeError, KeyError):
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

    async def portfolio_review(self, holdings: list[dict]) -> dict:
        """Review portfolio holdings with AI suggestions."""
        import time

        enriched = []
        for h in holdings:
            symbol = h.get("symbol", "")
            try:
                ratios = self.vnstock.get_financial_ratios(symbol)
                time.sleep(1.1)
            except Exception:
                ratios = []
            enriched.append({**h, "ratios": ratios[:1] if ratios else []})

        analysis = await self.claude.analyze(PORTFOLIO_REVIEW_PROMPT, _sanitize({"holdings": enriched}))

        try:
            cleaned = analysis.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                cleaned = cleaned.rsplit("```", 1)[0]
            return {"review": json.loads(cleaned)}
        except (json.JSONDecodeError, IndexError):
            return {"review": analysis}
