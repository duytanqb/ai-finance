---
paths:
  - "apps/stock-service/**/*.py"
---

# Python Stock Service Rules

## Code Style
- Python 3.11+ with type hints on all functions
- Use `async def` for all endpoint handlers
- Pydantic models for request/response schemas
- No bare `except:` — always catch specific exceptions

## vnstock Usage
- Always use VCI as data source: `Vnstock().stock(symbol, source='VCI')`
- Convert DataFrames to dicts before returning: `df.to_dict(orient="records")`
- Handle empty DataFrames gracefully
- Symbol should always be uppercased: `symbol.upper()`

## API Design
- All endpoints return JSON with consistent structure: `{"symbol": str, "data": ...}`
- Error responses use HTTPException with descriptive messages
- Use Query() with descriptions for all query parameters
- Group endpoints by router (price, financial, screening, listing, ai_actions)

## AI Workflows
- All Claude prompts must request JSON output format
- Always parse Claude response with try/except for JSONDecodeError
- Use Sonnet for fast tasks, Opus only for deep research
- Include raw data alongside AI analysis in responses

## Caching
- Price data: 5 minute TTL
- Financial statements: 1 hour TTL
- Company profiles: 24 hour TTL
- Stock listings: 24 hour TTL
