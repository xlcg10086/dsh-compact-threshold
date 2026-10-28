window.__ModuleLoader__.load({
  id: 'dsh-compact-threshold',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'compact-control'

    const ZH = {
      'pill': '自动压缩 {p}%',
      'title': '自动压缩阈值',
      'subtitle': '上下文占用达到窗口的该比例时自动压缩',
      'current': '当前用量',
      'window': '上下文窗口',
      'trigger': '触发线',
      'now': '立即压缩',
      'saving': '保存中…',
      'saved': '已保存',
      'triggered': '已触发压缩',
      'compacting': '压缩中…',
      'pending': '运行中，将在下一步压缩',
      'error': '操作失败',
      'over': '已超过触发线',
      'capNote': '实际触发 {p}%（受输出预留限制）',
      'reset': '恢复 80%',
      'close': '关闭',
      'unavailable': '压缩引擎不可用',
      'statusIdle': '空闲',
      'statusRunning': '运行中',
      'model': '模型',
    }

    const EN = {
      'pill': 'Auto {p}%',
      'title': 'Auto-compaction threshold',
      'subtitle': 'Compact when context usage reaches this share of the window.',
      'current': 'Current',
      'window': 'Window',
      'trigger': 'Trigger',
      'now': 'Compact now',
      'saving': 'Saving…',
      'saved': 'Saved',
      'triggered': 'Compaction started',
      'compacting': 'Compacting…',
      'pending': 'Will compact at the next step',
      'error': 'Action failed',
      'over': 'Above the trigger line',
      'capNote': 'Effective {p}% (limited by output reservation)',
      'reset': 'Reset to 80%',
      'close': 'Close',
      'unavailable': 'Compaction engine unavailable',
      'statusIdle': 'idle',
      'statusRunning': 'running',
      'model': 'Model',
    }

    function formatTokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      if (value >= 1000000) {
        const scaled = value / 1000000
        return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(2).replace(/\.?0+$/, '')}M`
      }
      if (value >= 1000) return `${Math.round(value / 1000)}K`
      return String(Math.round(value))
    }

    function GaugeIcon() {
      return h('svg', {
        width: 14,
        height: 14,
        viewBox: '0 0 16 16',
        'aria-hidden': true,
        style: { display: 'block', flex: '0 0 auto' },
      },
        h('circle', {
          cx: 8, cy: 8, r: 6.25,
          fill: 'none', stroke: 'currentColor', strokeOpacity: 0.25, strokeWidth: 1.4,
        }),
        h('path', {
          d: 'M8 2.1a5.9 5.9 0 0 1 5.3 3.3',
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
        }),
        h('circle', { cx: 8, cy: 8, r: 1.5, fill: 'currentColor' }),
      )
    }

    const CSS = `
      .cc-wrap { position: relative; display: inline-flex; align-items: center; }
      .cc-pill {
        display: inline-flex; align-items: center; gap: 5px;
        height: 26px; padding: 0 9px; border-radius: 999px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-secondary);
        font: inherit; font-size: 12px; line-height: 1;
        cursor: pointer; user-select: none; white-space: nowrap;
        transition: background .12s ease, border-color .12s ease, color .12s ease;
      }
      .cc-pill:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
      .cc-pill[data-open="1"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); }
      .cc-pill-label { font-variant-numeric: tabular-nums; }
      .cc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); }
      .cc-dot[data-over="1"] { background: var(--dsw-alias-state-warn-primary); }
      .cc-panel {
        position: absolute; bottom: calc(100% + 10px); left: -4px;
        width: 340px; max-width: min(340px, calc(100vw - 40px));
        box-sizing: border-box; padding: 14px;
        border-radius: 14px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-overlay);
        color: var(--dsw-alias-label-primary);
        box-shadow: 0 14px 38px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
        z-index: 1200;
      }
      .cc-head { display: flex; align-items: flex-start; gap: 8px; }
      .cc-head-main { flex: 1 1 auto; min-width: 0; }
      .cc-title { font-size: 13px; font-weight: 600; line-height: 18px; }
      .cc-subtitle { margin-top: 2px; font-size: 11px; line-height: 15px; color: var(--dsw-alias-label-secondary); }
      .cc-close {
        flex: 0 0 auto; width: 22px; height: 22px; border: 0; border-radius: 6px;
        background: transparent; color: var(--dsw-alias-label-secondary);
        font-size: 16px; line-height: 1; cursor: pointer;
      }
      .cc-close:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
      .cc-value-row { display: flex; align-items: baseline; gap: 6px; margin: 12px 0 2px; }
      .cc-value { font-size: 28px; line-height: 32px; font-weight: 650; letter-spacing: -0.02em; color: var(--dsw-alias-brand-primary); font-variant-numeric: tabular-nums; }
      .cc-value-unit { font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .cc-value-note { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-secondary); }
      .cc-range-block { margin-top: 6px; }
      .cc-range {
        -webkit-appearance: none; appearance: none; display: block;
        width: 100%; height: 4px; border-radius: 999px; outline: none; cursor: pointer;
      }
      .cc-range::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 16px; height: 16px; border-radius: 50%;
        background: var(--dsw-alias-bg-base);
        border: 2px solid var(--dsw-alias-brand-primary);
        box-shadow: 0 1px 4px color-mix(in srgb, var(--dsw-alias-label-primary) 25%, transparent);
      }
      .cc-range::-moz-range-thumb {
        width: 14px; height: 14px; border-radius: 50%;
        background: var(--dsw-alias-bg-base);
        border: 2px solid var(--dsw-alias-brand-primary);
      }
      .cc-scale { display: flex; justify-content: space-between; margin-top: 5px; font-size: 10px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .cc-chips { display: flex; gap: 4px; margin-top: 10px; flex-wrap: wrap; }
      .cc-chip {
        flex: 1 1 0; min-width: 34px; height: 24px; padding: 0 2px;
        border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
        font: inherit; font-size: 11px; cursor: pointer; font-variant-numeric: tabular-nums;
      }
      .cc-chip:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
      .cc-chip[data-active="1"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, var(--dsw-alias-bg-layer-1)); }
      .cc-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 12px; }
      .cc-stat-label { font-size: 10px; line-height: 14px; color: var(--dsw-alias-label-secondary); }
      .cc-stat-value { margin-top: 1px; font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cc-bar { position: relative; height: 6px; margin-top: 10px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
      .cc-bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--dsw-alias-brand-primary); transition: width .25s ease; }
      .cc-bar-fill[data-over="1"] { background: var(--dsw-alias-state-warn-primary); }
      .cc-bar-mark { position: absolute; top: -2px; bottom: -2px; width: 2px; margin-left: -1px; border-radius: 2px; background: var(--dsw-alias-state-warn-primary); opacity: .9; }
      .cc-status { min-height: 16px; margin-top: 8px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
      .cc-status[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
      .cc-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
      .cc-status[data-tone="ok"] { color: var(--dsw-alias-state-success-primary); }
      .cc-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
      .cc-primary {
        height: 28px; padding: 0 12px; border-radius: 8px; border: 0;
        background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base);
        font: inherit; font-size: 12px; font-weight: 550; cursor: pointer;
      }
      .cc-primary:disabled { opacity: .45; cursor: default; }
      .cc-link {
        height: 28px; padding: 0 6px; border: 0; background: transparent;
        color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; cursor: pointer;
      }
      .cc-link:hover { color: var(--dsw-alias-label-primary); }
    `

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          ctx.locale.register(NS, { zh: ZH, en: EN })
        } catch (error) {
          // A hot-reloaded generation may meet the dictionary left by its predecessor.
          if (!String(error?.message ?? error).includes('already has')) throw error
        }
        const t = ctx.locale.bind(NS)

        function Control(props) {
          const [, setLocaleTick] = React.useState(0)
          const [snap, setSnap] = React.useState(null)
          const [open, setOpen] = React.useState(false)
          const [draft, setDraft] = React.useState(80)
          const [saving, setSaving] = React.useState(false)
          const [flash, setFlash] = React.useState('')
          const wrapRef = React.useRef(null)
          const dragRef = React.useRef(false)
          const sessionId = props?.sessionId

          React.useEffect(() => ctx.locale.subscribe(() => setLocaleTick((value) => value + 1)), [])

          React.useEffect(() => {
            if (!open) return undefined
            const onPointerDown = (event) => {
              const node = wrapRef.current
              if (node !== null && !node.contains(event.target)) setOpen(false)
            }
            const onKeyDown = (event) => {
              if (event.key === 'Escape') setOpen(false)
            }
            document.addEventListener('pointerdown', onPointerDown)
            document.addEventListener('keydown', onKeyDown)
            return () => {
              document.removeEventListener('pointerdown', onPointerDown)
              document.removeEventListener('keydown', onKeyDown)
            }
          }, [open])

          const refresh = React.useCallback(async () => {
            if (typeof sessionId !== 'string' || sessionId === '') return
            try {
              const response = await fetch('api/dsh-compact-control/state', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              })
              const data = await response.json()
              if (data !== null && data.ok === true) setSnap(data)
            } catch {
              /* local route unavailable during teardown */
            }
          }, [sessionId])

          React.useEffect(() => {
            refresh()
            const timer = setInterval(refresh, 4000)
            return () => clearInterval(timer)
          }, [refresh])

          React.useEffect(() => {
            if (!dragRef.current && snap !== null && typeof snap.percent === 'number') setDraft(snap.percent)
          }, [snap?.percent])

          React.useEffect(() => {
            if (flash === '') return undefined
            const timer = setTimeout(() => setFlash(''), 4000)
            return () => clearTimeout(timer)
          }, [flash])

          const commit = React.useCallback(async (percent) => {
            if (typeof sessionId !== 'string' || sessionId === '') return
            setSaving(true)
            try {
              const response = await fetch('api/dsh-compact-control/set', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ sessionId, ratio: percent / 100 }),
              })
              const data = await response.json()
              if (data !== null && data.ok === true) {
                setSnap(data)
                setFlash(data.trigger === 'now' ? (data.compacting ? 'compacting' : 'triggered') : data.trigger === 'next-step' ? 'pending' : 'saved')
              } else {
                setFlash('error')
              }
            } catch {
              setFlash('error')
            } finally {
              setSaving(false)
            }
          }, [sessionId])

          const compactNow = React.useCallback(async () => {
            if (typeof sessionId !== 'string' || sessionId === '') return
            setSaving(true)
            try {
              const response = await fetch('api/dsh-compact-control/now', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              })
              const data = await response.json()
              if (data !== null && data.ok === true) {
                setSnap(data)
                setFlash('triggered')
              } else {
                setFlash(data?.error === 'busy' ? 'pending' : 'error')
              }
            } catch {
              setFlash('error')
            } finally {
              setSaving(false)
            }
          }, [sessionId])

          if (typeof sessionId !== 'string' || sessionId === '') return null

          const usedPercent = snap !== null && typeof snap.usedPercent === 'number' ? Math.max(0, Math.min(1, snap.usedPercent)) : null
          const thresholdPercent = snap !== null && typeof snap.thresholdPercent === 'number' ? Math.max(0, Math.min(1, snap.thresholdPercent)) : null
          const over = snap !== null && snap.thresholdTokens !== null && snap.thresholdTokens !== undefined && snap.usedTokens >= snap.thresholdTokens
          const effectivePercent = thresholdPercent === null ? null : Math.round(thresholdPercent * 100)
          const showCap = effectivePercent !== null && effectivePercent < draft

          let status = null
          let tone = 'warn'
          if (snap !== null && snap.compacting === true) {
            status = t('compacting')
          } else if (flash !== '') {
            status = t(flash)
            tone = flash === 'error' ? 'error' : flash === 'saved' || flash === 'triggered' ? 'ok' : 'warn'
          } else if (over) {
            status = t('over')
          } else if (snap !== null) {
            status = snap.status === 'running' ? t('statusRunning') : t('statusIdle')
            tone = 'muted'
          }

          const rangeBackground = `linear-gradient(to right, var(--dsw-alias-brand-primary) 0%, var(--dsw-alias-brand-primary) ${((draft - 20) / 60) * 100}%, var(--dsw-alias-bg-layer-2) ${((draft - 20) / 60) * 100}%, var(--dsw-alias-bg-layer-2) 100%)`

          return h('span', { className: 'cc-wrap', ref: wrapRef },
            h('button', {
              type: 'button',
              className: 'cc-pill',
              'data-open': open ? '1' : '0',
              title: t('title'),
              'aria-haspopup': 'dialog',
              'aria-expanded': open ? 'true' : 'false',
              onClick: () => {
                setOpen((value) => !value)
                refresh()
              },
            },
              h(GaugeIcon),
              h('span', { className: 'cc-pill-label' }, t('pill', { p: draft })),
              snap !== null ? h('span', { className: 'cc-dot', 'data-over': over ? '1' : '0' }) : null,
            ),
            open ? h('div', { className: 'cc-panel', role: 'dialog', 'aria-label': t('title') },
              h('div', { className: 'cc-head' },
                h('div', { className: 'cc-head-main' },
                  h('div', { className: 'cc-title' }, t('title')),
                  h('div', { className: 'cc-subtitle' }, t('subtitle')),
                ),
                h('button', {
                  type: 'button', className: 'cc-close', 'aria-label': t('close'),
                  onClick: () => setOpen(false),
                }, '×'),
              ),
              h('div', { className: 'cc-value-row' },
                h('span', { className: 'cc-value' }, draft),
                h('span', { className: 'cc-value-unit' }, '%'),
                showCap ? h('span', { className: 'cc-value-note' }, t('capNote', { p: effectivePercent })) : null,
              ),
              h('div', { className: 'cc-range-block' },
                h('input', {
                  className: 'cc-range',
                  type: 'range', min: 20, max: 80, step: 1,
                  value: draft,
                  'aria-label': t('title'),
                  style: { background: rangeBackground },
                  onPointerDown: () => { dragRef.current = true },
                  onChange: (event) => setDraft(Number(event.target.value)),
                  onPointerUp: (event) => {
                    dragRef.current = false
                    commit(Number(event.currentTarget.value))
                  },
                  onKeyUp: (event) => commit(Number(event.currentTarget.value)),
                }),
                h('div', { className: 'cc-scale' }, h('span', null, '20%'), h('span', null, '80%')),
              ),
              h('div', { className: 'cc-chips' },
                [20, 30, 40, 50, 60, 70, 80].map((value) => h('button', {
                  key: value,
                  type: 'button',
                  className: 'cc-chip',
                  'data-active': value === draft ? '1' : '0',
                  onClick: () => { setDraft(value); commit(value) },
                }, `${value}%`)),
              ),
              h('div', { className: 'cc-stats' },
                h('div', null,
                  h('div', { className: 'cc-stat-label' }, t('current')),
                  h('div', { className: 'cc-stat-value' }, formatTokens(snap?.usedTokens)),
                ),
                h('div', null,
                  h('div', { className: 'cc-stat-label' }, t('window')),
                  h('div', { className: 'cc-stat-value' }, formatTokens(snap?.contextWindow)),
                ),
                h('div', null,
                  h('div', { className: 'cc-stat-label' }, t('trigger')),
                  h('div', { className: 'cc-stat-value' }, formatTokens(snap?.thresholdTokens)),
                ),
              ),
              h('div', { className: 'cc-bar' },
                h('div', {
                  className: 'cc-bar-fill',
                  'data-over': over ? '1' : '0',
                  style: { width: `${usedPercent === null ? 0 : usedPercent * 100}%` },
                }),
                thresholdPercent === null ? null : h('div', {
                  className: 'cc-bar-mark',
                  style: { left: `${thresholdPercent * 100}%` },
                }),
              ),
              h('div', { className: 'cc-status', 'data-tone': tone }, status),
              h('div', { className: 'cc-actions' },
                h('button', {
                  type: 'button', className: 'cc-primary', disabled: saving,
                  onClick: compactNow,
                }, t('now')),
                h('button', {
                  type: 'button', className: 'cc-link',
                  onClick: () => { setDraft(80); commit(80) },
                }, t('reset')),
                snap !== null && snap.model !== null && snap.model !== undefined
                  ? h('span', { className: 'cc-value-note', title: `${snap.provider ?? ''}/${snap.model}` }, `${snap.model}`.length > 26 ? `${`${snap.model}`.slice(0, 24)}…` : snap.model)
                  : null,
              ),
            ) : null,
            h('style', null, CSS),
          )
        }

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'compact-control',
          order: 20,
        }, Control))
      },
    }
  },
})
