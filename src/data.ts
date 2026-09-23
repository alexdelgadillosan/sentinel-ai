export const SAMPLE_INCIDENTS = [
  {
    id: 'payments-p99',
    label: 'Payments p99 latency',
    text: 'Payments API p99 > 2s since 18:40 UTC',
  },
  {
    id: 'checkout-5xx',
    label: 'Checkout 5xx spike',
    text: 'Checkout service 5xx rate 4.2% (baseline 0.1%) starting 19:12 UTC — correlated with deploy checkout@2.14.1',
  },
  {
    id: 'db-conn',
    label: 'DB connection pool',
    text: 'payment-db connection pool exhausted (max 100) — queue depth climbing, timeouts on /v1/charges',
  },
] as const

export interface AgentStepDef {
  id: string
  title: string
  latencyMs: number
  delayMs: number
  kind: 'retrieve' | 'logs' | 'metrics' | 'propose' | 'action'
}

export const AGENT_STEPS: AgentStepDef[] = [
  {
    id: 'retrieve',
    title: 'Retrieve runbooks / docs',
    latencyMs: 840,
    delayMs: 1200,
    kind: 'retrieve',
  },
  {
    id: 'logs',
    title: 'Query application logs',
    latencyMs: 1320,
    delayMs: 2800,
    kind: 'logs',
  },
  {
    id: 'metrics',
    title: 'Query metrics & detect anomaly',
    latencyMs: 980,
    delayMs: 2400,
    kind: 'metrics',
  },
  {
    id: 'propose',
    title: 'Propose remediation action',
    latencyMs: 1540,
    delayMs: 2800,
    kind: 'propose',
  },
  {
    id: 'action',
    title: 'Execute approved action',
    latencyMs: 620,
    delayMs: 900,
    kind: 'action',
  },
]

export const CITATIONS = [
  { id: 'rb-payments-latency', title: 'runbook://payments/high-p99.md' },
  { id: 'rb-worker-restart', title: 'runbook://payments/worker-restart.md' },
  { id: 'doc-slo', title: 'docs://slo/payments-api.md §2.1' },
]

export const FAKE_LOGS = [
  { t: '18:41:02', level: 'INFO', msg: 'payment-worker[3] processed batch size=48 latency_ms=210' },
  { t: '18:41:14', level: 'WARN', msg: 'payment-worker[1] upstream stripe timeout after 3000ms' },
  { t: '18:41:19', level: 'WARN', msg: 'payment-api p99_latency_ms=2140 threshold=2000' },
  { t: '18:41:27', level: 'ERROR', msg: 'payment-worker[1] circuit_open endpoint=charges retry_after=5s' },
  { t: '18:41:33', level: 'WARN', msg: 'payment-worker[2] queue_depth=312 (warn>200)' },
]

export const TRACE_SPANS = [
  { id: 'root', name: 'investigate_incident', type: 'chain', depth: 0, latencyMs: 8420, cost: 0.048 },
  { id: 'rag', name: 'retrieve_runbooks', type: 'retrieval', depth: 1, latencyMs: 840, cost: 0.002 },
  { id: 'embed', name: 'embed_query', type: 'embedding', depth: 2, latencyMs: 120, cost: 0.0004 },
  { id: 'logs', name: 'tool:query_logs', type: 'tool', depth: 1, latencyMs: 1320, cost: 0 },
  { id: 'metrics', name: 'tool:query_metrics', type: 'tool', depth: 1, latencyMs: 980, cost: 0 },
  { id: 'reason', name: 'llm:propose_action', type: 'generation', depth: 1, latencyMs: 1540, cost: 0.031 },
  { id: 'hitl', name: 'interrupt:human_approval', type: 'chain', depth: 1, latencyMs: 0, cost: 0 },
  { id: 'exec', name: 'tool:restart_worker', type: 'tool', depth: 1, latencyMs: 620, cost: 0 },
  { id: 'judge', name: 'eval:llm_as_judge', type: 'generation', depth: 1, latencyMs: 890, cost: 0.0146 },
]

export const EVAL_RESULT = {
  overall: 0.86,
  faithfulness: 0.91,
  actionSafety: 0.94,
  citationQuality: 0.82,
  modelPrimary: 'claude-sonnet-4',
  modelFallback: 'gpt-4.1-mini',
  fallbackNote:
    'Primary model rate-limited on propose_action (HTTP 429). Fell back to gpt-4.1-mini for that span; judge ran on primary.',
}
