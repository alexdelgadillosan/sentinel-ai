import './style.css'
import {
  AGENT_STEPS,
  CITATIONS,
  EVAL_RESULT,
  FAKE_LOGS,
  SAMPLE_INCIDENTS,
  TRACE_SPANS,
  type AgentStepDef,
} from './data'

type RunState = 'idle' | 'running' | 'awaiting_hitl' | 'executing' | 'done' | 'rejected'

let runState: RunState = 'idle'
let abortController: AbortController | null = null
let selectedSampleId: string | null = SAMPLE_INCIDENTS[0].id

const app = document.querySelector<HTMLDivElement>('#app')!

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderShell(): void {
  app.innerHTML = `
    <header class="site-header">
      <div class="brand">
        <div class="brand-mark"><span class="pulse" aria-hidden="true"></span> Sentinel AI</div>
        <p class="brand-tagline">Agentic incident investigation with RAG, HITL gates, and full observability.</p>
      </div>
      <div class="header-meta">
        <div>ENV <span>demo</span></div>
        <div>MODE <span>scripted-agent</span></div>
        <div>TRACE <span>langfuse-mock</span></div>
      </div>
    </header>

    <section class="section" aria-labelledby="incident-label">
      <div class="section-label" id="incident-label">Incident</div>
      <div class="panel">
        <div class="panel-body incident-row">
          <textarea
            id="incident-input"
            class="incident-textarea"
            rows="3"
            placeholder="Describe the incident…"
            spellcheck="false"
          >${escapeHtml(SAMPLE_INCIDENTS[0].text)}</textarea>
          <div class="sample-chips">
            <span class="chip-label">samples</span>
            ${SAMPLE_INCIDENTS.map(
              (s) =>
                `<button type="button" class="chip${s.id === selectedSampleId ? ' active' : ''}" data-sample="${s.id}">${escapeHtml(s.label)}</button>`,
            ).join('')}
          </div>
          <div class="actions-bar">
            <button type="button" class="btn btn-primary" id="btn-investigate">Investigate</button>
            <button type="button" class="btn btn-ghost" id="btn-reset" disabled>Reset</button>
            <span class="status-hint" id="status-hint">Ready — no LLM calls; agent is scripted.</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="timeline-label">
      <div class="section-label" id="timeline-label">Agent timeline</div>
      <div class="panel">
        <div class="panel-body">
          <div class="timeline" id="timeline">
            <div class="empty-state" id="timeline-empty">Press Investigate to start the agent run.</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section trace-panel" id="trace-section" aria-labelledby="trace-label">
      <div class="section-label" id="trace-label">Langfuse-style trace</div>
      <div class="panel">
        <div class="panel-body" id="trace-body"></div>
      </div>
    </section>

    <section class="section eval-panel" id="eval-section" aria-labelledby="eval-label">
      <div class="section-label" id="eval-label">Eval · LLM-as-judge</div>
      <div class="panel">
        <div class="panel-body" id="eval-body"></div>
      </div>
    </section>

    <section class="section" aria-labelledby="arch-label">
      <div class="section-label" id="arch-label">Architecture</div>
      <div class="panel">
        <div class="arch-diagram">
          <div class="arch-flow">
            <div class="arch-node">
              <div class="icon">01</div>
              <div class="name">Incident</div>
              <div class="desc">Alert / paste</div>
            </div>
            <div class="arch-arrow" aria-hidden="true">→</div>
            <div class="arch-node">
              <div class="icon">02</div>
              <div class="name">LangGraph</div>
              <div class="desc">Orchestrated agents</div>
            </div>
            <div class="arch-arrow" aria-hidden="true">→</div>
            <div class="arch-node">
              <div class="icon">03</div>
              <div class="name">RAG</div>
              <div class="desc">Runbooks + cites</div>
            </div>
            <div class="arch-arrow" aria-hidden="true">→</div>
            <div class="arch-node">
              <div class="icon">04</div>
              <div class="name">Tools</div>
              <div class="desc">Logs · metrics</div>
            </div>
            <div class="arch-arrow" aria-hidden="true">→</div>
            <div class="arch-node">
              <div class="icon">05</div>
              <div class="name">HITL</div>
              <div class="desc">Approve / reject</div>
            </div>
            <div class="arch-arrow" aria-hidden="true">→</div>
            <div class="arch-node">
              <div class="icon">06</div>
              <div class="name">Langfuse</div>
              <div class="desc">Traces · evals</div>
            </div>
          </div>
          <p class="arch-legend">User → LangGraph agents → RAG / tools → HITL gate → optional action → Langfuse traces &amp; judge evals</p>
        </div>
      </div>
    </section>

    <footer class="site-footer">
      <span>Sentinel AI · portfolio demo · no production side effects</span>
      <a href="https://alexdelgadillosan.github.io/sentinel-ai/" target="_blank" rel="noopener">Live demo</a>
    </footer>
  `

  bindShellEvents()
}

function bindShellEvents(): void {
  const input = document.querySelector<HTMLTextAreaElement>('#incident-input')!
  const investigateBtn = document.querySelector<HTMLButtonElement>('#btn-investigate')!
  const resetBtn = document.querySelector<HTMLButtonElement>('#btn-reset')!

  document.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (runState !== 'idle' && runState !== 'done' && runState !== 'rejected') return
      const id = btn.dataset.sample!
      const sample = SAMPLE_INCIDENTS.find((s) => s.id === id)
      if (!sample) return
      selectedSampleId = id
      input.value = sample.text
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  investigateBtn.addEventListener('click', () => {
    void startInvestigation(input.value.trim())
  })

  resetBtn.addEventListener('click', () => {
    resetRun()
  })
}

function setStatus(text: string, running = false): void {
  const el = document.querySelector('#status-hint')
  if (!el) return
  el.textContent = text
  el.classList.toggle('running', running)
}

function setControls(state: RunState): void {
  runState = state
  const investigateBtn = document.querySelector<HTMLButtonElement>('#btn-investigate')!
  const resetBtn = document.querySelector<HTMLButtonElement>('#btn-reset')!
  const input = document.querySelector<HTMLTextAreaElement>('#incident-input')!
  const chips = document.querySelectorAll<HTMLButtonElement>('[data-sample]')

  const busy = state === 'running' || state === 'awaiting_hitl' || state === 'executing'
  investigateBtn.disabled = busy
  resetBtn.disabled = state === 'idle'
  input.disabled = busy
  chips.forEach((c) => {
    c.disabled = busy
  })
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const id = window.setTimeout(() => resolve(), ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(id)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function waitForHitl(signal: AbortSignal): Promise<'approve' | 'reject'> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const approveBtn = document.querySelector<HTMLButtonElement>('#hitl-approve')
    const rejectBtn = document.querySelector<HTMLButtonElement>('#hitl-reject')

    const onApprove = () => {
      cleanup()
      resolve('approve')
    }
    const onReject = () => {
      cleanup()
      resolve('reject')
    }

    function cleanup() {
      signal.removeEventListener('abort', onAbort)
      approveBtn?.removeEventListener('click', onApprove)
      rejectBtn?.removeEventListener('click', onReject)
    }

    signal.addEventListener('abort', onAbort, { once: true })
    approveBtn?.addEventListener('click', onApprove)
    rejectBtn?.addEventListener('click', onReject)
  })
}

function stepContent(step: AgentStepDef, incident: string): string {
  switch (step.kind) {
    case 'retrieve':
      return `
        <p>Searching vector store for runbooks matching: <em>${escapeHtml(incident.slice(0, 80))}${incident.length > 80 ? '…' : ''}</em></p>
        <div style="margin-top:0.5rem">
          ${CITATIONS.map((c) => `<span class="citation">↗ ${escapeHtml(c.title)}</span>`).join('')}
        </div>
      `
    case 'logs':
      return `
        <p>Queried <code>payment-api</code> + <code>payment-worker</code> · last 15m</p>
        <pre class="log-block">${FAKE_LOGS.map((l) => {
          const cls = l.level === 'ERROR' ? 'log-line-err' : l.level === 'WARN' ? 'log-line-warn' : ''
          return `<span class="${cls}">[${l.t}] ${l.level.padEnd(5)} ${escapeHtml(l.msg)}</span>`
        }).join('\n')}</pre>
      `
    case 'metrics':
      return `
        <p>Prometheus · <code>payment_api_latency_p99</code>, <code>worker_queue_depth</code></p>
        <div class="anomaly-note">
          ANOMALY · p99 crossed 2.0s at 18:40:12 UTC (+312% vs 1h baseline). Queue depth correlating with worker[1] circuit_open.
        </div>
      `
    case 'propose':
      return `
        <div class="proposal">
          <p><strong>Proposed action:</strong> restart <code>payment-worker</code> replica #1, then scale deployment to 4 replicas if p99 remains &gt; 1.5s for 3m.</p>
          <p style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-dim)">Rationale: single-worker circuit open + queue backlog matches runbook payments/high-p99 §Restart stale worker.</p>
        </div>
        <div class="hitl-gate" id="hitl-gate">
          <div class="hitl-label">Human-in-the-loop</div>
          <p class="hitl-desc">Side-effecting action requires approval. Agent is paused until you decide.</p>
          <div class="hitl-actions">
            <button type="button" class="btn btn-approve" id="hitl-approve">Approve</button>
            <button type="button" class="btn btn-reject" id="hitl-reject">Reject</button>
          </div>
        </div>
      `
    case 'action':
      return `
        <p class="hitl-resolved approved">✓ Action executed · kubectl rollout restart deploy/payment-worker — replica payment-worker-7f8c9 restarted; scale target=4</p>
        <pre class="log-block">[18:43:01] INFO  rollout triggered by sentinel-agent session=demo
[18:43:04] INFO  payment-worker-7f8c9 terminated (SIGTERM)
[18:43:08] INFO  payment-worker-a2b1c ready · queue_depth=41
[18:43:11] INFO  scaled replicas 3 → 4</pre>
      `
    default:
      return ''
  }
}

function ensureTimeline(): HTMLElement {
  const timeline = document.querySelector<HTMLElement>('#timeline')!
  const empty = document.querySelector('#timeline-empty')
  empty?.remove()
  return timeline
}

function appendStepPlaceholder(step: AgentStepDef): HTMLElement {
  const timeline = ensureTimeline()
  const el = document.createElement('article')
  el.className = 'step'
  el.id = `step-${step.id}`
  el.innerHTML = `
    <div class="step-dot" aria-hidden="true"></div>
    <div>
      <div class="step-header">
        <span class="step-title">${escapeHtml(step.title)}</span>
        <span class="step-latency">…</span>
      </div>
      <div class="step-body"><span style="color:var(--text-dim)">Running…</span></div>
    </div>
  `
  timeline.appendChild(el)
  requestAnimationFrame(() => el.classList.add('visible'))
  return el
}

function completeStep(el: HTMLElement, step: AgentStepDef, incident: string, waiting = false): void {
  const latency = el.querySelector('.step-latency')
  const body = el.querySelector('.step-body')
  if (latency) latency.textContent = `${step.latencyMs} ms`
  if (body) body.innerHTML = stepContent(step, incident)
  el.classList.toggle('waiting', waiting)
  if (!waiting) el.classList.add('done')
}

function renderTrace(): void {
  const section = document.querySelector('#trace-section')!
  const body = document.querySelector('#trace-body')!
  const totalCost = TRACE_SPANS.reduce((s, sp) => s + sp.cost, 0)
  const totalLat = TRACE_SPANS[0]?.latencyMs ?? 0

  body.innerHTML = `
    <div class="trace-meta">
      <div>trace_id <strong>tr_demo_${Date.now().toString(36).slice(-6)}</strong></div>
      <div>total latency <strong>${totalLat.toLocaleString()} ms</strong></div>
      <div>total cost <strong>$${totalCost.toFixed(4)}</strong></div>
      <div>spans <strong>${TRACE_SPANS.length}</strong></div>
    </div>
    <div class="span-tree">
      ${TRACE_SPANS.map((sp) => {
        const indent = '· '.repeat(sp.depth)
        const typeClass =
          sp.type === 'generation' ? 'generation' : sp.type === 'tool' ? 'tool' : ''
        return `
          <div class="span">
            <div class="span-name">
              <span class="indent">${indent}</span>
              ${escapeHtml(sp.name)}
              <span class="span-type ${typeClass}">${escapeHtml(sp.type)}</span>
            </div>
            <div class="span-latency">${sp.latencyMs ? `${sp.latencyMs} ms` : '—'}</div>
            <div class="span-cost">${sp.cost ? `$${sp.cost.toFixed(4)}` : '—'}</div>
          </div>
        `
      }).join('')}
    </div>
  `
  section.classList.add('visible')
}

function renderEval(): void {
  const section = document.querySelector('#eval-section')!
  const body = document.querySelector('#eval-body')!
  const e = EVAL_RESULT

  body.innerHTML = `
    <div class="eval-grid">
      <div class="eval-card">
        <div class="label">Overall</div>
        <div class="value">${e.overall.toFixed(2)}</div>
      </div>
      <div class="eval-card">
        <div class="label">Faithfulness</div>
        <div class="value">${e.faithfulness.toFixed(2)}</div>
      </div>
      <div class="eval-card">
        <div class="label">Action safety</div>
        <div class="value">${e.actionSafety.toFixed(2)}</div>
      </div>
      <div class="eval-card">
        <div class="label">Citation quality</div>
        <div class="value score-mid">${e.citationQuality.toFixed(2)}</div>
      </div>
    </div>
    <div class="eval-note">
      <strong style="color:var(--text);font-weight:500">Model fallback:</strong>
      ${escapeHtml(e.fallbackNote)}
      <br /><br />
      Primary <code>${escapeHtml(e.modelPrimary)}</code> · fallback <code>${escapeHtml(e.modelFallback)}</code>
    </div>
  `
  section.classList.add('visible')
}

async function startInvestigation(incident: string): Promise<void> {
  if (!incident) {
    setStatus('Paste or select an incident first.')
    return
  }
  if (runState === 'running' || runState === 'awaiting_hitl' || runState === 'executing') return

  abortController?.abort()
  abortController = new AbortController()
  const { signal } = abortController

  // Clear previous run UI bits but keep shell
  document.querySelector('#trace-section')?.classList.remove('visible')
  document.querySelector('#eval-section')?.classList.remove('visible')
  const timeline = document.querySelector('#timeline')!
  timeline.innerHTML = ''

  setControls('running')
  setStatus('Agent running…', true)

  try {
    const stepsBeforeHitl = AGENT_STEPS.filter((s) => s.kind !== 'action')
    const actionStep = AGENT_STEPS.find((s) => s.kind === 'action')!

    for (const step of stepsBeforeHitl) {
      const el = appendStepPlaceholder(step)
      await sleep(step.delayMs, signal)

      if (step.kind === 'propose') {
        completeStep(el, step, incident, true)
        setControls('awaiting_hitl')
        setStatus('Waiting for human approval…', true)

        const decision = await waitForHitl(signal)
        el.classList.remove('waiting')
        el.classList.add('done')

        const gate = document.querySelector('#hitl-gate')
        if (decision === 'reject') {
          if (gate) {
            gate.innerHTML = `
              <div class="hitl-label">Human-in-the-loop</div>
              <p class="hitl-resolved rejected">✗ Rejected — no side effects. Trace still recorded for review.</p>
            `
          }
          renderTrace()
          renderEval()
          setControls('rejected')
          setStatus('Run complete — action rejected.')
          return
        }

        if (gate) {
          gate.innerHTML = `
            <div class="hitl-label">Human-in-the-loop</div>
            <p class="hitl-resolved approved">✓ Approved — proceeding to execute.</p>
          `
        }
        setControls('executing')
        setStatus('Executing approved action…', true)
      } else {
        completeStep(el, step, incident)
      }
    }

    const actionEl = appendStepPlaceholder(actionStep)
    await sleep(actionStep.delayMs, signal)
    completeStep(actionEl, actionStep, incident)

    renderTrace()
    renderEval()
    setControls('done')
    setStatus('Run complete — action executed + trace & eval available.')
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      setStatus('Reset.')
      return
    }
    console.error(err)
    setControls('idle')
    setStatus('Error during demo run.')
  }
}

function resetRun(): void {
  abortController?.abort()
  abortController = null
  selectedSampleId = SAMPLE_INCIDENTS[0].id

  document.querySelector('#trace-section')?.classList.remove('visible')
  document.querySelector('#eval-section')?.classList.remove('visible')

  const timeline = document.querySelector('#timeline')!
  timeline.innerHTML = `<div class="empty-state" id="timeline-empty">Press Investigate to start the agent run.</div>`

  const input = document.querySelector<HTMLTextAreaElement>('#incident-input')!
  input.value = SAMPLE_INCIDENTS[0].text
  input.disabled = false

  document.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('active', (c as HTMLElement).dataset.sample === selectedSampleId)
    ;(c as HTMLButtonElement).disabled = false
  })

  setControls('idle')
  setStatus('Ready — no LLM calls; agent is scripted.')
}

renderShell()
