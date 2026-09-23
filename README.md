# Sentinel AI

Agentic incident investigation platform.

**Problem:** On-call needs an agent that can read docs, logs, and runbooks, reason with citations, and request human approval before acting.

**Stack (target):** LangGraph · FastAPI · vector store · PostgreSQL · Langfuse · HITL

**Status:** Scaffold — implementation in progress.

## Architecture

User / incident → Agent (RAG + tools) → HITL gate → optional actions → Langfuse traces / evals

## What this repo will demonstrate

- Multi-step agent orchestration
- Retrieval with citations
- Human-in-the-loop before side effects
- LLM-as-judge evals + model fallback

## Demo

- Live: _coming soon_
- Video: _coming soon_

## Run

```bash
# docker compose up  (coming soon)
```

## Attribution

Will start from a production FastAPI + LangGraph template; custom domain (incidents) and HITL UX documented as deltas.
