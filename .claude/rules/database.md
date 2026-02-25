---
paths:
  - "packages/drizzle/**/*"
  - "apps/nextjs/src/adapters/repositories/**/*"
---

# Database Rules

## Schema Design (Drizzle ORM)
- All tables use UUID primary keys
- Include `created_at` and `updated_at` timestamps on every table
- Use snake_case for column names
- Foreign keys with proper references and cascade rules

## Finance-Specific Tables

### Core Tables
- `stocks` — symbol, name, exchange, sector, industry
- `stock_prices` — symbol, date, open, high, low, close, volume (daily snapshots)
- `financial_statements` — symbol, period, type, data (JSONB)

### Portfolio Tables
- `portfolios` — user_id, name
- `holdings` — portfolio_id, symbol, quantity, avg_price, horizon, bought_at
- `transactions` — holding_id, type (buy/sell), quantity, price, date, fees
- `daily_snapshots` — holding_id, date, price, unrealized_pnl

### Market Watch Tables
- `scan_results` — date, symbol, score, criteria_matched
- `news_articles` — symbol, title, url, source, sentiment, summary, published_at
- `research_reports` — symbol, date, action, confidence, report (JSONB), model_used
- `daily_digests` — date, content (JSONB)

### Watchlist Tables
- `watchlists` — user_id, name
- `watchlist_items` — watchlist_id, symbol, target_price, notes

## Conventions
- Repository implementations use Drizzle query builder
- Complex reads use CQRS queries (direct ORM, no domain layer)
- Writes go through Use Cases → Repository
- Transactions managed at controller level
