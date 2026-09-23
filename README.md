# Sentinel AI

Agentic incident investigation demo — client-side Vite + TypeScript SPA for GitHub Pages.

**Live:** https://alexdelgadillosan.github.io/sentinel-ai/

**Problem:** On-call needs an agent that can read docs, logs, and runbooks, reason with citations, and request human approval before acting.

**Stack (demo):** Vite · TypeScript · scripted multi-step agent (no real LLM calls)  
**Stack (target production):** LangGraph · FastAPI · vector store · PostgreSQL · Langfuse · HITL

## What this demo shows

1. **Incident input** — paste or select a sample (e.g. Payments API p99 &gt; 2s)
2. **Agent timeline** — retrieve runbooks (citations), query logs, query metrics, propose action
3. **HITL gate** — Approve / Reject blocks until you decide; no side effects without approval
4. **Action + Langfuse-style trace** — span tree with latency / mock cost after approve
5. **Eval panel** — LLM-as-judge scores + model fallback note
6. **Architecture** — LangGraph agents → RAG → tools → HITL → Langfuse

## Architecture

```
User / incident → LangGraph agents → RAG (runbooks) + tools (logs/metrics)
                → HITL gate → optional action → Langfuse traces / evals
```

## Run locally

```bash
npm install
npm run dev
```

Build for GitHub Pages (`base: '/sentinel-ai/'`):

```bash
npm install
npm run build
npm run preview
```

## Deploy

Push to `main` runs [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) and publishes to GitHub Pages.

## Attribution

Interactive portfolio demo of the Sentinel AI product concept. Agent steps are scripted for a deterministic, offline-friendly experience — no API keys required.
