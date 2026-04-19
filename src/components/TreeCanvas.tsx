'use client'
import { useRef, useEffect, useCallback, useState } from 'react'
import { Person, Relation } from '@/lib/db'
import { formatRawDate } from '@/lib/dateUtils'
import styles from './TreeCanvas.module.css'

const FAMILY_COLORS = [
  '#534AB7', // purple
  '#0F6E56', // teal
  '#B5400A', // orange
  '#185FA5', // blue
  '#854F0B', // amber
  '#6B2FA0', // violet
  '#0D7A5F', // emerald
  '#993C1D', // coral
  '#1A5E8A', // steel blue
  '#7A3B69', // plum
  '#2E7D32', // green
  '#B71C1C', // red
]

// Build family color map: personId → color
// Children of same parent-pair share a color
function buildFamilyColors(people: Person[], relations: Relation[]): Map<string, string> {
  const colorMap = new Map<string, string>()
  
  // Group children by their sorted parent set
  const childParents = new Map<string, string[]>() // childId → [parentIds]
  for (const r of relations) {
    if (r.type === 'Parent') {
      if (!childParents.has(r.to)) childParents.set(r.to, [])
      childParents.get(r.to)!.push(r.from)
    }
  }

  // Group by sorted parent key → assign color
  const familyColorMap = new Map<string, string>() // parentKey → color
  let colorIdx = 0

  childParents.forEach((parentIds, childId) => {
    const key = [...parentIds].sort().join('|')
    if (!familyColorMap.has(key)) {
      familyColorMap.set(key, FAMILY_COLORS[colorIdx % FAMILY_COLORS.length])
      colorIdx++
    }
    colorMap.set(childId, familyColorMap.get(key)!)
  })

  // People with no parents → neutral
  people.forEach(p => {
    if (!colorMap.has(p.id)) colorMap.set(p.id, '#888888')
  })

  return colorMap
}

function getColor(id: string, people: Person[], colorMap?: Map<string, string>) {
  if (colorMap) return colorMap.get(id) || '#888888'
  const i = people.findIndex(p => p.id === id)
  return FAMILY_COLORS[(i < 0 ? 0 : i) % FAMILY_COLORS.length]
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}
function pinchDist(t: React.TouchList) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
}

type ToolMode = 'pan' | 'select'

interface ConnectDraft {
  fromId: string
  x1: number; y1: number
  x2: number; y2: number
}

interface SelectRect {
  startX: number; startY: number
  curX: number; curY: number
}

interface Props {
  people: Person[]
  relations: Relation[]
  selectedId: string | null
  isAdmin: boolean
  onSelect: (id: string) => void
  onMove?: (id: string, x: number, y: number) => void
  onMoveMulti?: (moves: { id: string; x: number; y: number }[]) => void
  onConnectRequest?: (fromId: string, toId: string) => void
  onDoubleClickCanvas?: (x: number, y: number) => void
  showType?: boolean
}

export default function TreeCanvas({
  people, relations, selectedId, isAdmin,
  onSelect, onMove, onMoveMulti, onConnectRequest, onDoubleClickCanvas, showType = true
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tx, setTx] = useState(40)
  const [ty, setTy] = useState(40)
  const [scale, setScale] = useState(1)
  const live = useRef({ tx: 40, ty: 40, scale: 1 })
  useEffect(() => { live.current = { tx, ty, scale } }, [tx, ty, scale])

  const [mode, setMode] = useState<ToolMode>('pan')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  // Build family color map once per render
  const colorMap = buildFamilyColors(people, relations)

  const [selectRect, setSelectRect] = useState<SelectRect | null>(null)
  const [connectDraft, setConnectDraft] = useState<ConnectDraft | null>(null)
  const [connectTargetId, setConnectTargetId] = useState<string | null>(null)

  const connectDraftRef = useRef<ConnectDraft | null>(null)
  const connectDragRef = useRef<{ fromId: string; fromX: number; fromY: number } | null>(null)

  const clamp = (s: number) => Math.min(2.5, Math.max(0.2, s))

  // Clear multi-selection when switching modes
  useEffect(() => {
    if (mode === 'pan') setMultiSelected(new Set())
  }, [mode])

  // ── Wheel zoom ─────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const fn = (e: WheelEvent) => { e.preventDefault(); setScale(s => clamp(s * (e.deltaY < 0 ? 1.1 : 0.9))) }
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [])

  // ── Pan state ──────────────────────────────────────────────
  const pan = useRef({ on: false, sx: 0, sy: 0, tx0: 0, ty0: 0 })

  // ── Node drag (move single) ────────────────────────────────
  const nd = useRef<{ id: string; sx: number; sy: number; nx0: number; ny0: number; moved: boolean } | null>(null)
  // Track if last interaction was a drag — persists after nd is nulled
  const justDragged = useRef(false)

  // ── Multi drag ─────────────────────────────────────────────
  const md = useRef<{ sx: number; sy: number; origPos: Map<string, {x:number;y:number}>; moved: boolean } | null>(null)

  // ── Select rect ────────────────────────────────────────────
  const sr = useRef<{ sx: number; sy: number } | null>(null)

  // Convert client coords → canvas coords
  const toCanvas = (cx: number, cy: number) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return {
      x: (cx - rect.left - live.current.tx) / live.current.scale,
      y: (cy - rect.top  - live.current.ty) / live.current.scale,
    }
  }

  // ── Start connect drag from + button ──────────────────────
  const startConnect = useCallback((e: React.MouseEvent, person: Person) => {
    e.stopPropagation(); e.preventDefault()
    const cv = toCanvas(e.clientX, e.clientY)
    connectDragRef.current = { fromId: person.id, fromX: person.x, fromY: person.y }
    const draft = { fromId: person.id, x1: person.x, y1: person.y, x2: cv.x, y2: cv.y }
    setConnectDraft(draft); connectDraftRef.current = draft
  }, []) // eslint-disable-line

  // ── Mouse down on canvas background ──────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const isNode = (e.target as HTMLElement).closest('[data-node]')
    const isConnect = (e.target as HTMLElement).closest('[data-connect]')
    if (isConnect) return

    if (mode === 'pan') {
      if (isNode) return
      pan.current = { on: true, sx: e.clientX, sy: e.clientY, tx0: live.current.tx, ty0: live.current.ty }
    } else {
      // select mode — start rect or multi-drag
      if (isNode) {
        const nodeEl = (e.target as HTMLElement).closest('[data-node]') as HTMLElement
        const nid = nodeEl?.dataset.node!
        if (multiSelected.has(nid) && multiSelected.size > 1) {
          // drag all selected
          const origPos = new Map<string, {x:number;y:number}>()
          multiSelected.forEach(id => {
            const p = people.find(x => x.id === id)
            if (p) origPos.set(id, { x: p.x, y: p.y })
          })
          md.current = { sx: e.clientX, sy: e.clientY, origPos, moved: false }
        } else {
          // drag single node
          const p = people.find(x => x.id === nid)
          if (p) nd.current = { id: nid, sx: e.clientX, sy: e.clientY, nx0: p.x, ny0: p.y, moved: false }
        }
        return
      }
      // Start selection rect
      const cv = toCanvas(e.clientX, e.clientY)
      sr.current = { sx: cv.x, sy: cv.y }
      setSelectRect({ startX: cv.x, startY: cv.y, curX: cv.x, curY: cv.y })
      setMultiSelected(new Set())
    }
  }, [mode, multiSelected, people]) // eslint-disable-line

  // ── Node mouse down (pan mode) ─────────────────────────────
  const onNodeMD = useCallback((e: React.MouseEvent, p: Person) => {
    if (!isAdmin || mode !== 'pan') return
    if ((e.target as HTMLElement).closest('[data-connect]')) return
    e.stopPropagation()
    nd.current = { id: p.id, sx: e.clientX, sy: e.clientY, nx0: p.x, ny0: p.y, moved: false }
  }, [isAdmin, mode])

  // ── Global mouse move + up ─────────────────────────────────
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      // Pan
      if (pan.current.on) {
        setTx(pan.current.tx0 + e.clientX - pan.current.sx)
        setTy(pan.current.ty0 + e.clientY - pan.current.sy)
      }
      // Single node drag
      if (nd.current) {
        const dx = (e.clientX - nd.current.sx) / live.current.scale
        const dy = (e.clientY - nd.current.sy) / live.current.scale
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          nd.current.moved = true
          justDragged.current = true
          const el = wrapRef.current?.querySelector(`[data-node="${nd.current.id}"]`) as HTMLElement
          if (el) { el.style.left = nd.current.nx0 + dx + 'px'; el.style.top = nd.current.ny0 + dy + 'px' }
        }
      }
      // Multi drag
      if (md.current) {
        const dx = (e.clientX - md.current.sx) / live.current.scale
        const dy = (e.clientY - md.current.sy) / live.current.scale
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          md.current.moved = true
          md.current.origPos.forEach((pos, id) => {
            const el = wrapRef.current?.querySelector(`[data-node="${id}"]`) as HTMLElement
            if (el) { el.style.left = pos.x + dx + 'px'; el.style.top = pos.y + dy + 'px' }
          })
        }
      }
      // Select rect
      if (sr.current) {
        const cv = toCanvas(e.clientX, e.clientY)
        setSelectRect({ startX: sr.current.sx, startY: sr.current.sy, curX: cv.x, curY: cv.y })
        // Compute which people are inside rect
        const minX = Math.min(sr.current.sx, cv.x)
        const maxX = Math.max(sr.current.sx, cv.x)
        const minY = Math.min(sr.current.sy, cv.y)
        const maxY = Math.max(sr.current.sy, cv.y)
        const inside = new Set<string>()
        people.forEach(p => {
          if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) inside.add(p.id)
        })
        setMultiSelected(inside)
      }
      // Connect drag
      if (connectDragRef.current) {
        const cv = toCanvas(e.clientX, e.clientY)
        const draft = { ...connectDraftRef.current!, x2: cv.x, y2: cv.y }
        setConnectDraft(draft); connectDraftRef.current = draft
        const target = document.elementFromPoint(e.clientX, e.clientY)
        const nodeEl = target?.closest('[data-node]') as HTMLElement | null
        const tid = nodeEl?.dataset.node || null
        setConnectTargetId(tid !== connectDragRef.current.fromId ? tid : null)
      }
    }

    const up = (e: MouseEvent) => {
      pan.current.on = false
      // Single node done
      if (nd.current) {
        if (nd.current.moved) {
          const el = wrapRef.current?.querySelector(`[data-node="${nd.current.id}"]`) as HTMLElement
          if (el) onMove?.(nd.current.id, parseFloat(el.style.left), parseFloat(el.style.top))
          // justDragged stays true — onClick will fire and be blocked
        } else {
          justDragged.current = false
          onSelect(nd.current.id)
        }
        nd.current = null
      }
      // Multi drag done
      if (md.current) {
        if (md.current.moved) {
          const dx = (e.clientX - md.current.sx) / live.current.scale
          const dy = (e.clientY - md.current.sy) / live.current.scale
          const moves: { id: string; x: number; y: number }[] = []
          md.current.origPos.forEach((pos, id) => moves.push({ id, x: pos.x + dx, y: pos.y + dy }))
          onMoveMulti?.(moves)
        }
        md.current = null
      }
      // Select rect done
      if (sr.current) { sr.current = null; setSelectRect(null) }
      // Connect done
      if (connectDragRef.current) {
        const target = document.elementFromPoint(e.clientX, e.clientY)
        const nodeEl = target?.closest('[data-node]') as HTMLElement | null
        const tid = nodeEl?.dataset.node
        if (tid && tid !== connectDragRef.current.fromId) onConnectRequest?.(connectDragRef.current.fromId, tid)
        connectDragRef.current = null; setConnectDraft(null); connectDraftRef.current = null; setConnectTargetId(null)
      }
    }

    window.addEventListener('mousemove', mv)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [onMove, onMoveMulti, onSelect, onConnectRequest, people]) // eslint-disable-line

  // ── Touch ──────────────────────────────────────────────────
  const tch = useRef({
    panOn: false, px0: 0, py0: 0, tx0: 0, ty0: 0,
    pinchOn: false, pd0: 0, sc0: 1,
    nodeId: null as string | null, nsx: 0, nsy: 0, nx0: 0, ny0: 0, moved: false,
  })

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = tch.current
    if (e.touches.length === 2) {
      t.pinchOn = true; t.panOn = false
      t.pd0 = pinchDist(e.touches); t.sc0 = live.current.scale; return
    }
    const nodeEl = (e.target as HTMLElement).closest('[data-node]') as HTMLElement | null
    if (nodeEl && isAdmin) {
      const nid = nodeEl.dataset.node!
      const p = people.find(x => x.id === nid)
      if (p) {
        t.nodeId = nid; t.nsx = e.touches[0].clientX; t.nsy = e.touches[0].clientY
        t.nx0 = p.x; t.ny0 = p.y; t.moved = false; return
      }
    }
    t.panOn = true
    t.px0 = e.touches[0].clientX; t.py0 = e.touches[0].clientY
    t.tx0 = live.current.tx; t.ty0 = live.current.ty
  }, [isAdmin, people])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const t = tch.current
    if (t.pinchOn && e.touches.length === 2) { setScale(clamp(t.sc0 * (pinchDist(e.touches) / t.pd0))); return }
    if (t.nodeId) {
      const dx = (e.touches[0].clientX - t.nsx) / live.current.scale
      const dy = (e.touches[0].clientY - t.nsy) / live.current.scale
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        t.moved = true
        const el = wrapRef.current?.querySelector(`[data-node="${t.nodeId}"]`) as HTMLElement
        if (el) { el.style.left = t.nx0 + dx + 'px'; el.style.top = t.ny0 + dy + 'px' }
      }
      return
    }
    if (t.panOn) {
      setTx(t.tx0 + e.touches[0].clientX - t.px0)
      setTy(t.ty0 + e.touches[0].clientY - t.py0)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    const t = tch.current
    t.pinchOn = false; t.panOn = false
    if (t.nodeId) {
      if (t.moved) {
        const el = wrapRef.current?.querySelector(`[data-node="${t.nodeId}"]`) as HTMLElement
        if (el) onMove?.(t.nodeId, parseFloat(el.style.left), parseFloat(el.style.top))
      } else { onSelect(t.nodeId) }
      t.nodeId = null
    }
  }, [onMove, onSelect])

  const W = 2400, H = 1800

  // Selection rect in canvas coords
  const selRect = selectRect ? {
    x: Math.min(selectRect.startX, selectRect.curX),
    y: Math.min(selectRect.startY, selectRect.curY),
    w: Math.abs(selectRect.curX - selectRect.startX),
    h: Math.abs(selectRect.curY - selectRect.startY),
  } : null

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      {isAdmin && (
        <div className={styles.toolbar}>
          <button
            className={`${styles.toolBtn} ${mode === 'pan' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('pan')}
            title="Pan mode — drag to move canvas"
          >
            <span>✋</span> Pan
          </button>
          <button
            className={`${styles.toolBtn} ${mode === 'select' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('select')}
            title="Select mode — drag to select multiple people"
          >
            <span>⬚</span> Select
          </button>
          {multiSelected.size > 0 && (
            <span className={styles.toolInfo}>
              {multiSelected.size} selected — drag to move
            </span>
          )}
          {mode === 'select' && multiSelected.size === 0 && (
            <span className={styles.toolInfo}>Draw a rectangle to select</span>
          )}
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        ref={wrapRef}
        className={styles.wrap}
        style={{ cursor: mode === 'select' ? (sr.current ? 'crosshair' : 'default') : undefined }}
        onMouseDown={onMouseDown}
        onDoubleClick={e => {
          if ((e.target as HTMLElement).closest('[data-node]')) return
          const cv = toCanvas(e.clientX, e.clientY)
          onDoubleClickCanvas?.(cv.x, cv.y)
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={styles.canvas}
          data-tree-canvas="true"
          style={{ transform: `translate(${tx}px,${ty}px) scale(${scale})`, transformOrigin: '0 0', width: W, height: H }}
        >
          <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }} width={W} height={H}>
            {/* Relations — grouped parent lines share a junction point */}
            {(() => {
              const elements: React.ReactNode[] = []

              // 1. Spouse / Partner lines
              relations.filter(r => r.type === 'Spouse' || r.type === 'Partner').forEach((r, i) => {
                const a = people.find(p => p.id === r.from)
                const b = people.find(p => p.id === r.to)
                if (!a || !b) return
                const mx = (a.x + b.x) / 2
                const my = (a.y + b.y) / 2
                const lw = Math.min(r.type.length * 6.5 + 12, 90)
                elements.push(
                  <g key={`sp-${i}`}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="#534AB7" strokeWidth={2} strokeDasharray="6,4" opacity={0.8} />
                    <rect x={mx-lw/2} y={my-9} width={lw} height={18} rx={9}
                      fill="white" fillOpacity={0.9} stroke="#534AB720" strokeWidth={0.5} />
                    <text x={mx} y={my} className={styles.relLabel} fill="#534AB7">{r.type}</text>
                  </g>
                )
              })

              // 2. Parent lines — group by (parent1, parent2) couple → shared junction
              const parentRels = relations.filter(r => r.type === 'Parent')

              // Find all unique children and their parents
              const childParents = new Map<string, string[]>()  // childId → [parentIds]
              parentRels.forEach(r => {
                if (!childParents.has(r.to)) childParents.set(r.to, [])
                childParents.get(r.to)!.push(r.from)
              })

              // Group children by their sorted parent set
              const coupleGroups = new Map<string, { parentIds: string[]; childIds: string[] }>()
              childParents.forEach((parentIds, childId) => {
                const key = [...parentIds].sort().join('|')
                if (!coupleGroups.has(key)) coupleGroups.set(key, { parentIds, childIds: [] })
                coupleGroups.get(key)!.childIds.push(childId)
              })

              coupleGroups.forEach(({ parentIds, childIds }, key) => {
                const parents = parentIds.map(id => people.find(p => p.id === id)).filter(Boolean) as typeof people
                const children = childIds.map(id => people.find(p => p.id === id)).filter(Boolean) as typeof people
                if (!parents.length || !children.length) return

                // Junction X = midpoint of CHILDREN (line drops straight down to them)
                // Junction Y = between parents row and children row
                const pMidY = parents.reduce((s, p) => s + p.y, 0) / parents.length
                const cMidX = children.reduce((s, c) => s + c.x, 0) / children.length
                const cMidY = children.reduce((s, c) => s + c.y, 0) / children.length
                const juncX = cMidX
                const juncY = pMidY + (cMidY - pMidY) * 0.5

                // Lines from each parent down to junction
                parents.forEach((par, i) => {
                  elements.push(
                    <line key={`pj-${key}-${i}`}
                      x1={par.x} y1={par.y} x2={juncX} y2={juncY}
                      stroke="#B0ADA8" strokeWidth={1.5} opacity={0.8} />
                  )
                })

                // Vertical trunk from junction down
                const trunkY = juncY + 20
                if (children.length > 1) {
                  elements.push(
                    <line key={`trunk-${key}`}
                      x1={juncX} y1={juncY} x2={juncX} y2={trunkY}
                      stroke="#B0ADA8" strokeWidth={1.5} opacity={0.8} />
                  )
                }

                // Horizontal bar connecting all children (if >1)
                if (children.length > 1) {
                  const minCX = Math.min(...children.map(c => c.x))
                  const maxCX = Math.max(...children.map(c => c.x))
                  elements.push(
                    <line key={`hbar-${key}`}
                      x1={minCX} y1={trunkY} x2={maxCX} y2={trunkY}
                      stroke="#B0ADA8" strokeWidth={1.5} opacity={0.8} />
                  )
                }

                // Lines from bar down to each child
                children.forEach((child, i) => {
                  const fromX = children.length === 1 ? juncX : child.x
                  const fromY = children.length === 1 ? juncY : trunkY
                  elements.push(
                    <line key={`cj-${key}-${i}`}
                      x1={fromX} y1={fromY} x2={child.x} y2={child.y}
                      stroke="#B0ADA8" strokeWidth={1.5} opacity={0.8} />
                  )
                })

                // "Parent" label on the trunk (or midpoint if single child)
                const labelY = children.length > 1 ? trunkY : (juncY + children[0].y) / 2
                const labelX = juncX
                const lw = 52
                elements.push(
                  <g key={`plabel-${key}`}>
                    <rect x={labelX-lw/2} y={labelY-9} width={lw} height={18} rx={9}
                      fill="white" fillOpacity={0.88} stroke="#B0ADA830" strokeWidth={0.5} />
                    <text x={labelX} y={labelY} className={styles.relLabel} fill="#888">Parent</text>
                  </g>
                )
              })

              // 3. Other relation types (Sibling, Custom, etc.)
              relations.filter(r => r.type !== 'Parent' && r.type !== 'Spouse' && r.type !== 'Partner')
                .forEach((r, i) => {
                  const a = people.find(p => p.id === r.from)
                  const b = people.find(p => p.id === r.to)
                  if (!a || !b) return
                  const mx = (a.x + b.x) / 2
                  const my = Math.min(a.y, b.y) - 30
                  const lx = 0.25*a.x + 0.5*mx + 0.25*b.x
                  const ly = 0.25*a.y + 0.5*my + 0.25*b.y
                  const lw = Math.min(r.type.length * 6.5 + 12, 110)
                  elements.push(
                    <g key={`other-${i}`}>
                      <path d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}
                        stroke="#B0ADA8" strokeWidth={1.5} fill="none" opacity={0.7} strokeDasharray="4,3" />
                      <rect x={lx-lw/2} y={ly-9} width={lw} height={18} rx={9}
                        fill="white" fillOpacity={0.88} stroke="#B0ADA830" strokeWidth={0.5} />
                      <text x={lx} y={ly} className={styles.relLabel} fill="#888">{r.type}</text>
                    </g>
                  )
                })

              return elements
            })()}

            {/* Connect draft line */}
            {connectDraft && (
              <g>
                <line x1={connectDraft.x1} y1={connectDraft.y1} x2={connectDraft.x2} y2={connectDraft.y2}
                  stroke="#534AB7" strokeWidth={2} strokeDasharray="6,4" opacity={0.7} />
                <circle cx={connectDraft.x2} cy={connectDraft.y2} r={6} fill="#534AB7" opacity={0.5} />
              </g>
            )}

            {/* Selection rectangle */}
            {selRect && (
              <rect x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h}
                fill="#534AB720" stroke="#534AB7" strokeWidth={1.5} strokeDasharray="6,3"
                rx={4} />
            )}
          </svg>

          {/* Nodes */}
          {people.map(person => {
            const color = getColor(person.id, people, colorMap)
            const isHovered = hoverId === person.id
            const isTarget  = connectTargetId === person.id
            const isMultiSel = multiSelected.has(person.id)
            return (
              <div
                key={person.id}
                data-node={person.id}
                className={`${styles.node}
                  ${selectedId === person.id ? styles.selected : ''}
                  ${isTarget ? styles.connectTarget : ''}
                  ${isMultiSel ? styles.multiSelected : ''}`}
                style={{ left: person.x, top: person.y }}
                onMouseEnter={() => isAdmin && setHoverId(person.id)}
                onMouseLeave={() => setHoverId(null)}
                onMouseDown={e => onNodeMD(e, person)}
                onClick={() => {
                  if (justDragged.current) { justDragged.current = false; return }
                  onSelect(person.id)
                }}
              >
                {/* Move handle — pan mode hover */}
                {isAdmin && isHovered && mode === 'pan' && !connectDraft && (
                  <div className={styles.moveHandle} title="Drag to move">✥</div>
                )}

                <div className={styles.avatar} style={{ borderColor: color+'50', background: color+'12' }}>
                  {person.photo
                    ? <img src={person.photo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                    : <span style={{ color }}>{getInitials(person.name)}</span>}
                </div>

                {/* Connect (+) button — pan mode hover */}
                {isAdmin && isHovered && mode === 'pan' && (
                  <div data-connect="true" className={styles.connectBtn}
                    title="Drag to connect"
                    onMouseDown={e => startConnect(e, person)}>+</div>
                )}

                <div className={styles.name}>{person.name}</div>
                {showType && person.type && <div className={styles.type}>{person.type}</div>}
                {(person.birthDate || person.birthPlace || person.deathDate || person.isDeceased) && (
                  <div className={styles.nodeMeta}>
                    {person.birthDate && person.deathDate
                      ? <span>{formatRawDate(person.birthDate)} – {formatRawDate(person.deathDate)}</span>
                      : <>
                          {person.birthDate && <span>{formatRawDate(person.birthDate)}</span>}
                          {person.birthPlace && <span>{person.birthPlace}</span>}
                          {person.isDeceased && !person.deathDate && <span style={{opacity:0.5}}>†</span>}
                        </>
                    }
                    {person.birthDate && person.deathDate && person.birthPlace && (
                      <span>{person.birthPlace}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Zoom — sol alt */}
        <div className={styles.zoomCtrl}>
          <button className={styles.zoomBtn} onClick={() => setScale(s => clamp(s*1.3))}>+</button>
          <button className={styles.zoomBtn} onClick={() => setScale(s => clamp(s/1.3))}>−</button>
          <button className={styles.zoomBtn} style={{ fontSize:13 }} onClick={() => { setTx(40); setTy(40); setScale(1) }}>⊡</button>
        </div>

        {people.length === 0 && (
          <div className={styles.empty}>
            <div style={{ fontSize:48, marginBottom:12 }}>🌱</div>
            <p>No people yet.<br />Tap + to add someone.</p>
          </div>
        )}

        {connectDraft && (
          <div className={styles.connectHint}>Drag to another person to connect</div>
        )}
      </div>
    </div>
  )
}
