---
name: gen-workflow
description: Scaffold a new AI action workflow. Creates the backend endpoint, service method, prompt template, and frontend action button.
disable-model-invocation: true
---

# Generate AI Workflow

Create a new AI action workflow for: **$ARGUMENTS**

## Steps

### 1. Define the Workflow

Ask the user:
- What data does this workflow need? (prices, financials, news, custom)
- What should the AI output look like? (structured JSON fields)
- Which Claude model? (Sonnet for fast, Opus for deep)
- Is this user-triggered (button) or scheduled (cron)?

### 2. Backend (Python stock-service)

Create the following files:

**Add prompt to `apps/stock-service/services/ai_workflows.py`:**
```python
{WORKFLOW_NAME}_PROMPT = """You are a Vietnam stock market analyst...
Respond in JSON format:
{
  "field1": "...",
  "field2": "..."
}"""
```

**Add method to AIWorkflowService class:**
```python
async def {workflow_name}(self, symbol: str) -> dict:
    # 1. Gather data via vnstock
    # 2. Build data payload
    # 3. Call Claude
    # 4. Parse and return
```

**Add endpoint to `apps/stock-service/routers/ai_actions.py`:**
```python
@router.post("/{endpoint}/{symbol}")
async def {workflow_name}(symbol: str):
    result = await ai_service.{workflow_name}(symbol)
    return result
```

### 3. Frontend (Next.js)

**Create server action in `apps/nextjs/src/adapters/actions/`**

**Create UI component in `apps/nextjs/app/(protected)/` with:**
- Action button triggering the workflow
- Loading state while AI processes
- Result card displaying structured output

### 4. Test

```bash
curl -s -X POST http://localhost:8000/api/ai/{endpoint}/{test_symbol} | python -m json.tool
```

### 5. Validate

```bash
pnpm check:all
```
