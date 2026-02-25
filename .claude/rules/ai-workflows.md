---
paths:
  - "apps/stock-service/services/ai_workflows.py"
  - "apps/stock-service/services/claude_client.py"
  - "apps/stock-service/routers/ai_actions.py"
  - "apps/stock-service/jobs/**/*.py"
  - "apps/nextjs/src/adapters/services/ai/**/*"
---

# AI Workflow Rules

## Core Principle
This project uses **action-driven AI** — no chat interface. AI runs as background workflows triggered by buttons or scheduled jobs.

## Workflow Pattern
Every AI action must follow:
1. **Gather** structured data (vnstock + news)
2. **Build** a prompt with clear JSON output format
3. **Call** Claude API with appropriate model
4. **Parse** response as JSON (with fallback for parse errors)
5. **Return** structured result to frontend

## Prompt Engineering
- Always define expected JSON output schema in the prompt
- Include "Respond in JSON format:" with the exact structure
- Be specific about Vietnam stock market context
- Include units (VND, %, billion VND) in field descriptions

## Model Selection
- Claude Sonnet: stock analysis, news summarization, sentiment tagging, portfolio review
- Claude Opus: deep research reports only (expensive, use sparingly)

## Error Handling
- Never let Claude API errors crash the workflow
- Return partial results with error flag if one step fails
- Log all AI API calls for debugging and cost tracking

## Scheduled Jobs (Market Watch)
- Run after VN market close (3:30 PM ICT)
- Pipeline order: scan → news → research → digest
- Each step reads previous step's output from DB
- Jobs must be idempotent (safe to re-run)
