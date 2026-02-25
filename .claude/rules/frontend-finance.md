---
paths:
  - "apps/nextjs/app/(protected)/stock/**/*"
  - "apps/nextjs/app/(protected)/portfolio/**/*"
  - "apps/nextjs/app/(protected)/watchlist/**/*"
  - "apps/nextjs/app/(protected)/market-watch/**/*"
  - "apps/nextjs/app/(protected)/research/**/*"
---

# Frontend Finance Rules

## AI Action Buttons
- Every AI action is a button, NOT a chat input
- Show loading spinner with descriptive text while workflow runs
- Display results as structured UI cards, never raw text
- Include confidence score as visual indicator (color-coded)
- Action labels: BUY (green), WATCH (yellow), AVOID (red)

## Stock Charts
- Use TradingView Lightweight Charts library
- Support indicators: MA (20, 50, 200), RSI, MACD, Bollinger Bands
- Default view: 1 year daily candles
- Price format: VND with thousand separators (e.g., 85,000)

## Financial Data Display
- Currency: VND (Vietnamese Dong), use billion VND for large numbers
- Ratios: P/E, P/B, ROE displayed as numbers with 1 decimal
- Percentage changes: color-coded (green positive, red negative)
- Date format: DD/MM/YYYY (Vietnamese convention)

## Portfolio
- Investment horizon shown as badge/chip on each holding
- P&L color-coded: green for profit, red for loss
- AI suggestions (HOLD/SELL/ADD) shown as action cards below holdings

## Pages follow CleanStack pattern
- Server Components by default
- Client logic in `_components/`
- Auth guards in layouts via `requireAuth()`
