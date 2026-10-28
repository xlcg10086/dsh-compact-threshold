/**
 * Host half of `@local/dsh-compact-control`.
 *
 * Owns one live preference: the auto-compaction threshold ratio (20%–80% of
 * the routed model's context window). The value is persisted under DSH_HOME
 * and applied at runtime by rewriting the live `BasicCompactionEngine`
 * instance's resolved `config` reference for each Agent's isolated preset
 * realm. `BasicCompactionEngine.compactIfNeeded()` reads `this.config` on every
 * call, so the next `agent/pre-step` pressure check uses the new threshold
 * immediately — no plugin reload and no DSH restart.
 *
 * @module @local/dsh-compact-control
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

export const name = 'compact-control'

export const inject = ['agents', 'agentPresets', 'tokenMeter', 'llm']

export const Config = z.object({
  ratio: z.number().min(0.2).max(0.8).default(0.8),
})

const MIN_RATIO = 0.2
const MAX_RATIO = 0.8
const DEFAULT_RATIO = 0.8
const DEFAULT_HEADROOM = 65536

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const STATE_FILE = join(DSH_HOME, 'compact-control.json')

/** Clamp and round to whole percent. */
function clampRatio(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_RATIO
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, Math.round(number * 100) / 100))
}

function readPersistedRatio(fallback) {
  try {
    const raw = readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && typeof parsed.ratio === 'number') {
      return clampRatio(parsed.ratio)
    }
  } catch {
    /* missing or malformed state falls back to the plugin config */
  }
  return clampRatio(fallback)
}

function persistRatio(ratio) {
  try {
    writeFileSync(STATE_FILE, `${JSON.stringify({ ratio, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
  } catch {
    /* a read-only home must not break live control */
  }
}

export function apply(ctx, config) {
  let ratio = readPersistedRatio(config?.ratio ?? DEFAULT_RATIO)
  const modelInfoCache = new Map()
  const sessionRecords = new Map()

  const json = (body) => Response.json(body, { headers: { 'cache-control': 'no-store' } })

  function getAgent(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
    return ctx.get('agents')?.get?.(sessionId)
  }

  function getEngine(agent) {
    try {
      const preset = ctx.get('agentPresets')
      const viaPreset = preset?.serviceFor?.(agent, 'compaction')
      if (viaPreset !== undefined) return viaPreset
    } catch {
      /* fall through to the agent-scoped lookup */
    }
    try {
      return agent?.ctx?.get?.('compaction')
    } catch {
      return undefined
    }
  }

  /**
   * Rewrite the engine's resolved config reference. The object produced by
   * `resolveConfig` is deep-frozen; replacing the instance property keeps every
   * other resolved field intact while the next call re-reads the new ratio.
   */
  function patchEngine(engine) {
    if (engine === undefined || engine === null || typeof engine !== 'object') return false
    const current = engine.config
    if (current === undefined || current === null || typeof current !== 'object') return false
    if (typeof current.thresholdRatio !== 'number') return false
    if (current.thresholdRatio === ratio) return true
    const next = { ...current, thresholdRatio: ratio }
    if (Array.isArray(current.modelPolicies)) {
      next.modelPolicies = current.modelPolicies.map((policy) => {
        if (policy === null || typeof policy !== 'object') return policy
        if (policy.thresholdRatio === undefined) return policy
        return { ...policy, thresholdRatio: ratio }
      })
    }
    try {
      engine.config = Object.freeze(next)
      return true
    } catch {
      return false
    }
  }

  function applyToAllAgents() {
    const agents = ctx.get('agents')?.list?.() ?? []
    for (const agent of agents) patchEngine(getEngine(agent))
    const rootEngine = ctx.get('compaction')
    if (rootEngine !== undefined) patchEngine(rootEngine)
  }

  async function resolveModelInfo(provider, model) {
    if (typeof provider !== 'string' || typeof model !== 'string') return undefined
    const key = `${provider}/${model}`
    if (modelInfoCache.has(key)) return modelInfoCache.get(key)
    try {
      const info = await ctx.get('llm')?.resolveModelInfo?.(provider, model)
      if (info !== undefined) modelInfoCache.set(key, info)
      return info
    } catch {
      return undefined
    }
  }

  function recordFor(agent) {
    const key = String(agent.id)
    let record = sessionRecords.get(key)
    if (record === undefined) {
      record = { compacting: false, lastError: null, lastResult: null }
      sessionRecords.set(key, record)
    }
    return record
  }

  async function snapshot(agent) {
    const session = agent?.session
    if (session === undefined) return { ok: false, error: 'session-unavailable' }
    const engine = getEngine(agent)
    if (engine !== undefined) patchEngine(engine)

    let usedTokens = 0
    try {
      usedTokens = ctx.get('tokenMeter')?.measure?.(session)?.totalTokens ?? 0
    } catch {
      usedTokens = 0
    }

    const header = session.requestHeader?.()?.config
    const requestContext = session.requestContext?.()
    let contextWindow = Number.isInteger(requestContext?.contextWindow) ? requestContext.contextWindow : undefined
    let defaultMaxTokens
    if (!Number.isInteger(contextWindow) || contextWindow <= 0) {
      const info = await resolveModelInfo(header?.provider, header?.model)
      contextWindow = info?.context?.contextWindow
      defaultMaxTokens = info?.defaultMaxTokens
    } else if (header?.maxTokens === undefined) {
      defaultMaxTokens = (await resolveModelInfo(header?.provider, header?.model))?.defaultMaxTokens
    }

    const reservedCompletionTokens = header?.maxTokens ?? defaultMaxTokens ?? 0
    const headroomTokens = engine?.config?.headroomTokens ?? DEFAULT_HEADROOM
    const messageBudgetTokens = Number.isInteger(contextWindow) ? contextWindow - reservedCompletionTokens : undefined
    const pressureBudgetTokens = messageBudgetTokens === undefined ? undefined : messageBudgetTokens - headroomTokens
    const thresholdTokens = Number.isInteger(contextWindow) && contextWindow > 0 && pressureBudgetTokens > 0
      ? Math.floor(Math.min(contextWindow * ratio, pressureBudgetTokens))
      : null
    const record = recordFor(agent)

    return {
      ok: true,
      ratio,
      percent: Math.round(ratio * 100),
      usedTokens,
      contextWindow: Number.isInteger(contextWindow) && contextWindow > 0 ? contextWindow : null,
      thresholdTokens,
      usedPercent: Number.isInteger(contextWindow) && contextWindow > 0 ? usedTokens / contextWindow : null,
      thresholdPercent: Number.isInteger(contextWindow) && contextWindow > 0 && thresholdTokens !== null ? thresholdTokens / contextWindow : null,
      provider: header?.provider ?? null,
      model: header?.model ?? null,
      status: agent?.status ?? 'unknown',
      compacting: record.compacting,
      lastError: record.lastError,
      lastResult: record.lastResult,
    }
  }

  function startCompact(agent) {
    const record = recordFor(agent)
    if (record.compacting) return false
    const engine = getEngine(agent)
    if (engine === undefined || typeof engine.compactNow !== 'function') {
      record.lastError = 'compaction-unavailable'
      return false
    }
    patchEngine(engine)
    record.compacting = true
    record.lastError = null
    record.lastResult = null
    try {
      Promise.resolve(engine.compactNow(agent, new AbortController().signal)).then(
        (result) => {
          record.compacting = false
          record.lastResult = result === null || result === undefined ? 'empty' : 'compacted'
        },
        (error) => {
          record.compacting = false
          record.lastError = error instanceof Error ? error.message : String(error)
        },
      )
      return true
    } catch (error) {
      record.compacting = false
      record.lastError = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  async function readBody(request) {
    try {
      const value = await request.json()
      return value !== null && typeof value === 'object' ? value : null
    } catch {
      return null
    }
  }

  // Keep the live engine aligned for agents that mount after this plugin.
  ctx.on('agent/created', ({ agent }) => {
    patchEngine(getEngine(agent))
  })
  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'idle') patchEngine(getEngine(agent))
  })
  // Re-assert before each step, in case a preset generation re-mounted.
  ctx.on('agent/pre-step', ({ agent }, next) => {
    patchEngine(getEngine(agent))
    return next()
  })

  applyToAllAgents()

  ctx.inject(['connection'], (child) => {
    const connection = child.get('connection')
    const register = connection?.fetch?.register
    if (typeof register !== 'function') return

    const route = (path, fetch) => child.effect(
      () => connection.fetch.register({ path, methods: ['POST'], requestBody: 'buffered', fetch }),
      `compact-control:${path}`,
    )

    route('/api/dsh-compact-control/state', async (request) => {
      const body = await readBody(request)
      const agent = getAgent(body?.sessionId)
      if (agent === undefined) return json({ ok: false, error: 'session-not-found' })
      return json(await snapshot(agent))
    })

    route('/api/dsh-compact-control/set', async (request) => {
      const body = await readBody(request)
      if (body === null || typeof body.ratio !== 'number' || !Number.isFinite(body.ratio)) {
        return json({ ok: false, error: 'invalid-ratio' })
      }
      const previousRatio = ratio
      const nextRatio = clampRatio(body.ratio)
      ratio = nextRatio
      persistRatio(ratio)
      applyToAllAgents()

      let trigger = 'none'
      const agent = getAgent(body?.sessionId)
      if (agent !== undefined && nextRatio < previousRatio) {
        const before = await snapshot(agent)
        if (before.thresholdTokens !== null && before.usedTokens >= before.thresholdTokens) {
          if (agent.status === 'idle') trigger = startCompact(agent) ? 'now' : 'unavailable'
          else trigger = 'next-step'
        }
      }
      if (agent === undefined) return json({ ok: true, trigger, ratio, percent: Math.round(ratio * 100) })
      return json({ ...(await snapshot(agent)), trigger })
    })

    route('/api/dsh-compact-control/now', async (request) => {
      const body = await readBody(request)
      const agent = getAgent(body?.sessionId)
      if (agent === undefined) return json({ ok: false, error: 'session-not-found' })
      if (agent.status !== 'idle') return json({ ok: false, error: 'busy' })
      if (!startCompact(agent)) return json({ ok: false, error: 'compaction-unavailable' })
      return json({ ...(await snapshot(agent)), trigger: 'now' })
    })
  })
}
