---
name: analyze-stock
description: Test the stock analysis AI workflow during development. Calls the Python stock-service analyze endpoint.
disable-model-invocation: true
---

# Analyze Stock

Test the AI stock analysis workflow for **$ARGUMENTS**.

## Steps

1. Verify the Python stock-service is running:
```bash
curl -s http://localhost:8000/health
```

2. If not running, start it:
```bash
cd apps/stock-service && source venv/bin/activate && uvicorn main:app --reload --port 8000 &
```

3. Trigger analysis:
```bash
curl -s -X POST http://localhost:8000/api/ai/analyze/$ARGUMENTS | python -m json.tool
```

4. Display the result formatted:
   - Action (BUY/WATCH/AVOID)
   - Confidence score
   - Summary
   - Key metrics
   - Risk level
   - Entry/target/stop-loss prices

5. If the endpoint fails, check:
   - Is `ANTHROPIC_API_KEY` set in `apps/stock-service/.env`?
   - Is vnstock installed? `pip install vnstock`
   - Is the symbol valid? Try: `curl http://localhost:8000/api/listing/search?q=$ARGUMENTS`
