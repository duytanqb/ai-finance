import json

from services.claude_client import ClaudeClient
from services.vnstock_client import VnstockClient

ANALYZE_PROMPT = """You are a Vietnam stock market analyst. Analyze this stock and provide a structured assessment.

Respond in JSON format:
{
  "action": "BUY" | "WATCH" | "AVOID",
  "confidence": 0-100,
  "summary": "2-3 sentence summary",
  "technical": {
    "trend": "uptrend|downtrend|sideways",
    "support": number,
    "resistance": number,
    "signals": ["list of key signals"]
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
  "reasoning": "detailed reasoning"
}"""

DEEP_RESEARCH_PROMPT = """You are a senior Vietnam stock market research analyst. Write a comprehensive research report for this stock.

Include:
1. Executive Summary
2. Company Overview
3. Financial Analysis (multi-year trends)
4. Technical Analysis
5. Industry & Competitive Position
6. Risk Factors
7. Catalysts
8. Valuation (fair value estimate)
9. Investment Recommendation (BUY/HOLD/SELL with target price)

Be thorough and data-driven. Cite specific numbers from the provided data."""

PORTFOLIO_REVIEW_PROMPT = """You are a Vietnam stock market portfolio advisor. Review each holding and provide suggestions.

For each holding, consider:
- Current P&L and investment horizon
- Technical trend
- Fundamental health
- Recent news sentiment

Respond in JSON format:
{
  "holdings": [
    {
      "symbol": "XXX",
      "action": "HOLD" | "SELL" | "ADD_MORE",
      "reasoning": "explanation",
      "urgency": "low|medium|high"
    }
  ],
  "portfolio_summary": "overall assessment"
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

        analysis = await self.claude.analyze(ANALYZE_PROMPT, data)

        try:
            return {"symbol": symbol, "analysis": json.loads(analysis), "raw_data": data}
        except json.JSONDecodeError:
            return {"symbol": symbol, "analysis": analysis, "raw_data": data}

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

        report = await self.claude.deep_analyze(DEEP_RESEARCH_PROMPT, data)
        return {"symbol": symbol, "report": report, "model": "opus"}

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

        prompt = f"Compare these {len(symbols)} Vietnam stocks side by side. Highlight strengths and weaknesses of each. Recommend which is the best investment and why."
        analysis = await self.claude.analyze(prompt, stocks_data)
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
