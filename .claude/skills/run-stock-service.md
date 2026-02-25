---
name: run-stock-service
description: Start the Python stock-service for local development
disable-model-invocation: true
---

# Run Stock Service

Start the Python stock-service locally.

## Steps

1. Check if already running:
```bash
curl -s http://localhost:8000/health 2>/dev/null || echo "Not running"
```

2. If not running, start it:
```bash
cd apps/stock-service
source venv/bin/activate 2>/dev/null || (python -m venv venv && source venv/bin/activate && pip install -r requirements.txt)
cp .env.example .env 2>/dev/null
uvicorn main:app --reload --port 8000
```

3. Verify endpoints:
```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/docs  # Swagger UI
```

4. Test a basic call:
```bash
curl -s "http://localhost:8000/api/listing/search?q=VCB"
```
