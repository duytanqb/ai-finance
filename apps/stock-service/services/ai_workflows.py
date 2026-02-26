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

PORTFOLIO_REVIEW_PROMPT = """You are a Vietnam stock market portfolio advisor. Review each holding and provide suggestions.

For each holding, consider:
- Current P&L and investment horizon
- Technical trend
- Fundamental health
- Recent news sentiment

IMPORTANT: All text fields (reasoning, portfolio_summary) MUST be written in Vietnamese.

Respond in JSON format:
{
  "holdings": [
    {
      "symbol": "XXX",
      "action": "HOLD" | "SELL" | "ADD_MORE",
      "reasoning": "giải thích bằng tiếng Việt",
      "urgency": "low|medium|high"
    }
  ],
  "portfolio_summary": "đánh giá tổng quan bằng tiếng Việt"
}"""


class AIWorkflowService:
    """Orchestrates AI analysis workflows."""

    def __init__(self):
        self.vnstock = VnstockClient()
        self.claude = ClaudeClient()

    async def analyze_stock(self, symbol: str) -> dict:
        """Full stock analysis: price + financials + news → AI summary."""
        from datetime import datetime, timedelta

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        price_data = self.vnstock.get_price_history(symbol, start, end)
        income = self.vnstock.get_income_statement(symbol, "year")
        ratios = self.vnstock.get_financial_ratios(symbol)
        profile = self.vnstock.get_company_profile(symbol)

        data = {
            "symbol": symbol,
            "profile": profile,
            "price_history_last_30": price_data[-30:] if len(price_data) > 30 else price_data,
            "price_52w_high": max(p["high"] for p in price_data) if price_data else None,
            "price_52w_low": min(p["low"] for p in price_data) if price_data else None,
            "current_price": price_data[-1]["close"] if price_data else None,
            "income_statement": income[:4] if len(income) > 4 else income,
            "financial_ratios": ratios[:4] if len(ratios) > 4 else ratios,
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

        end = datetime.now().strftime("%Y-%m-%d")
        start_1y = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
        start_3y = (datetime.now() - timedelta(days=365 * 3)).strftime("%Y-%m-%d")

        profile = self.vnstock.get_company_profile(symbol)
        ratios = self.vnstock.get_financial_ratios(symbol)
        price_data = self.vnstock.get_price_history(symbol, start_1y, end)
        income = self.vnstock.get_income_statement(symbol, "year")
        balance = self.vnstock.get_balance_sheet(symbol, "year")
        cash_flow = self.vnstock.get_cash_flow(symbol, "year")

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
        summary_data = {
            "symbol": symbol,
            "basic_analysis": basic_content,
            "chart_analysis": chart_content,
            "company_analysis": company_content,
        }
        summary_prompt = """Dựa trên ba phần phân tích (cơ bản, kỹ thuật/biểu đồ, và tài chính công ty), viết tóm tắt đầu tư cuối cùng. Bao gồm:

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
        enriched = []
        for h in holdings:
            ratios = self.vnstock.get_financial_ratios(h["symbol"])
            enriched.append({**h, "ratios": ratios[:1] if ratios else []})

        analysis = await self.claude.analyze(PORTFOLIO_REVIEW_PROMPT, {"holdings": enriched})

        try:
            return {"review": json.loads(analysis)}
        except json.JSONDecodeError:
            return {"review": analysis}
