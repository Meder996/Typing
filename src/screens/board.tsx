import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useApp } from '../context'
import { Icon, type IconName } from '../icons'
import { newId } from '../lib/habits'
import { arrowPath, bounds, clampZoom, hitItem, inkOn, moveItem, penPath, type Point } from '../lib/board'
import type { BoardItem } from '../types'

type Tool = 'select' | 'hand' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'note' | 'text' | 'erase'
type View = { x: number; y: number; z: number }
type Gesture =
  | { kind: 'pan'; start: Point; origin: View }
  | { kind: 'draw'; id: string; base: BoardItem[]; start: Point }
  | { kind: 'move'; id: string; base: BoardItem[]; start: Point }
  | { kind: 'erase'; base: BoardItem[] }

export const BOARD_COLORS = ['#8b85e9', '#ff7a7a', '#7bd88f', '#ffd166', '#4cc9f0', '#f4f4f7', '#181a20']

const TOOLS: { id: Tool; label: string; icon: IconName }[] = [
  { id: 'select', label: 'Select and move (V)', icon: 'cursor' },
  { id: 'hand', label: 'Pan (H)', icon: 'hand' },
  { id: 'pen', label: 'Pen (P)', icon: 'pen' },
  { id: 'rect', label: 'Rectangle (R)', icon: 'square' },
  { id: 'ellipse', label: 'Ellipse (O)', icon: 'circle' },
  { id: 'arrow', label: 'Arrow (A)', icon: 'arrow' },
  { id: 'note', label: 'Sticky note (N)', icon: 'note' },
  { id: 'text', label: 'Text (T)', icon: 'type' },
  { id: 'erase', label: 'Eraser (E)', icon: 'eraser' },
]
const SHORTCUTS: Record<string, Tool> = { v: 'select', h: 'hand', p: 'pen', r: 'rect', o: 'ellipse', a: 'arrow', n: 'note', t: 'text', e: 'erase' }
const CURSORS: Record<Tool, string> = {
  select: 'default',
  hand: 'grab',
  pen: 'crosshair',
  rect: 'crosshair',
  ellipse: 'crosshair',
  arrow: 'crosshair',
  note: 'copy',
  text: 'text',
  erase: 'not-allowed',
}
const PEN_WIDTH = 3
const NOTE_SIZE = { w: 180, h: 140 }
const TEXT_SIZE = { w: 240, h: 44 }
const HIT_PX = 6

const isText = (it: BoardItem): it is Extract<BoardItem, { kind: 'note' | 'text' }> => it.kind === 'note' || it.kind === 'text'

/** Infinite canvas with pan/zoom, pen, shapes, arrows, sticky notes, text and an eraser. Saved per account. */
export default function Board() {
  const { user, update } = useApp()
  const [items, setItems] = useState<BoardItem[]>(() => user.board ?? [])
  const itemsRef = useRef<BoardItem[]>(items)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(BOARD_COLORS[0])
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const viewRef = useRef<View>(view)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [depth, setDepth] = useState({ undo: 0, redo: 0 })
  const past = useRef<BoardItem[][]>([])
  const future = useRef<BoardItem[][]>([])
  const gesture = useRef<Gesture | null>(null)
  const textBase = useRef<BoardItem[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})

  const setLive = (next: BoardItem[]) => {
    itemsRef.current = next
    setItems(next)
  }
  const setV = (next: View) => {
    viewRef.current = next
    setView(next)
  }
  const syncDepth = () => setDepth({ undo: past.current.length, redo: future.current.length })
  const persist = (list: BoardItem[]) => update((u) => ({ ...u, board: list }))

  /** Records one finished action in undo history and saves the board to the account. */
  const commit = (base: BoardItem[]) => {
    const cur = itemsRef.current
    if (cur === base) return
    past.current.push(base)
    future.current = []
    syncDepth()
    persist(cur)
  }

  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(itemsRef.current)
    setLive(prev)
    setSelected(null)
    setEditing(null)
    persist(prev)
    syncDepth()
  }

  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(itemsRef.current)
    setLive(next)
    setSelected(null)
    setEditing(null)
    persist(next)
    syncDepth()
  }

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }
  }

  const hitAt = (p: Point) => {
    const tol = HIT_PX / viewRef.current.z
    const list = itemsRef.current
    for (let i = list.length - 1; i >= 0; i--) if (hitItem(list[i], p, tol)) return list[i]
    return null
  }

  /** Zoom by `factor` keeping the screen point (sx, sy) fixed. */
  const zoomAt = (sx: number, sy: number, factor: number) => {
    const v = viewRef.current
    const z = clampZoom(v.z * factor)
    const k = z / v.z
    setV({ z, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k })
  }

  const zoomCenter = (factor: number) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (r) zoomAt(r.width / 2, r.height / 2, factor)
  }

  const startEditing = (id: string, base: BoardItem[]) => {
    textBase.current = base
    setEditing(id)
  }

  const finishEditing = () => {
    if (!editing) return
    const id = editing
    const empty = itemsRef.current.some((it) => it.id === id && isText(it) && it.text.trim() === '')
    setEditing(null)
    if (empty) {
      // An untouched note or text box disappears instead of being saved.
      setLive(itemsRef.current.filter((it) => it.id !== id))
      setSelected(null)
      persist(itemsRef.current)
      return
    }
    commit(textBase.current)
  }

  const changeText = (id: string, text: string) =>
    setLive(itemsRef.current.map((it) => (it.id === id && isText(it) ? { ...it, text } : it)))

  const removeSelected = () => {
    if (!selected) return
    const base = itemsRef.current
    setLive(base.filter((it) => it.id !== selected))
    setSelected(null)
    commit(base)
  }

  const pickColor = (c: string) => {
    setColor(c)
    if (!selected) return
    const base = itemsRef.current
    setLive(base.map((it) => (it.id === selected ? { ...it, color: c } : it)))
    commit(base)
  }

  const clearBoard = () => {
    if (!itemsRef.current.length || !window.confirm('Clear the whole whiteboard? You can still undo this.')) return
    const base = itemsRef.current
    setLive([])
    setSelected(null)
    commit(base)
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.target instanceof HTMLTextAreaElement) return
    const base = itemsRef.current
    const p = toWorld(e)
    const grab = () => e.currentTarget.setPointerCapture(e.pointerId)
    const pan = () => {
      gesture.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, origin: viewRef.current }
      grab()
    }

    if (e.button === 1 || tool === 'hand') return pan()
    if (e.button !== 0) return

    if (tool === 'select') {
      const hit = hitAt(p)
      if (!hit) {
        setSelected(null)
        return pan()
      }
      setSelected(hit.id)
      gesture.current = { kind: 'move', id: hit.id, base, start: p }
      return grab()
    }

    if (tool === 'erase') {
      const hit = hitAt(p)
      if (hit) setLive(base.filter((it) => it.id !== hit.id))
      gesture.current = { kind: 'erase', base }
      return grab()
    }

    if (tool === 'note' || tool === 'text') {
      // Keep focus in the new text box (a mousedown would otherwise blur it and discard it).
      e.preventDefault()
      const id = newId()
      const item: BoardItem =
        tool === 'note'
          ? { id, kind: 'note', color, x: p.x - NOTE_SIZE.w / 2, y: p.y - NOTE_SIZE.h / 2, w: NOTE_SIZE.w, h: NOTE_SIZE.h, text: '' }
          : { id, kind: 'text', color, x: p.x, y: p.y - TEXT_SIZE.h / 2, w: TEXT_SIZE.w, h: TEXT_SIZE.h, text: '' }
      setLive([...base, item])
      setSelected(id)
      setTool('select')
      startEditing(id, base)
      return
    }

    const id = newId()
    if (tool === 'pen') {
      setLive([...base, { id, kind: 'pen', color, points: [[p.x, p.y]] }])
    } else {
      setLive([...base, { id, kind: tool, color, x1: p.x, y1: p.y, x2: p.x, y2: p.y }])
    }
    gesture.current = { kind: 'draw', id, base, start: p }
    grab()
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      setV({ ...g.origin, x: g.origin.x + e.clientX - g.start.x, y: g.origin.y + e.clientY - g.start.y })
      return
    }
    const p = toWorld(e)
    if (g.kind === 'draw') {
      setLive(
        itemsRef.current.map((it) => {
          if (it.id !== g.id) return it
          if (it.kind === 'pen') return { ...it, points: [...it.points, [p.x, p.y] as [number, number]] }
          if (it.kind === 'rect' || it.kind === 'ellipse' || it.kind === 'arrow') return { ...it, x2: p.x, y2: p.y }
          return it
        }),
      )
      return
    }
    if (g.kind === 'move') {
      const dx = p.x - g.start.x
      const dy = p.y - g.start.y
      if (Math.hypot(dx, dy) * viewRef.current.z < 3) return
      setLive(g.base.map((it) => (it.id === g.id ? moveItem(it, dx, dy) : it)))
      return
    }
    const hit = hitAt(p)
    if (hit) setLive(itemsRef.current.filter((it) => it.id !== hit.id))
  }

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    gesture.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!g || g.kind === 'pan') return
    if (g.kind === 'draw') {
      const it = itemsRef.current.find((i) => i.id === g.id)
      // A click without a drag should not leave an empty shape behind.
      if (it && it.kind !== 'pen' && !isText(it) && Math.hypot(it.x2 - it.x1, it.y2 - it.y1) * viewRef.current.z < 3) {
        setLive(g.base)
      }
    }
    commit(g.base)
  }

  const onDoubleClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    const hit = hitAt(toWorld(e))
    if (hit && isText(hit)) {
      setSelected(hit.id)
      startEditing(hit.id, itemsRef.current)
    }
  }

  keyRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    if (mod && key === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (mod && key === 'y') {
      e.preventDefault()
      redo()
      return
    }
    if (mod) return
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault()
      removeSelected()
      return
    }
    if (e.key === 'Escape') {
      setSelected(null)
      setTool('select')
      return
    }
    const next = SHORTCUTS[key]
    if (next) setTool(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    // Native listener so the page does not scroll while the board pans or zooms.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01))
        return
      }
      const v = viewRef.current
      setV({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const pickTool = (t: Tool) => setTool(t)
  const selectedItem = selected ? items.find((it) => it.id === selected) : undefined
  const v = view

  const drawItem = (it: BoardItem) => {
    switch (it.kind) {
      case 'pen':
        return (
          <path key={it.id} d={penPath(it.points)} stroke={it.color} strokeWidth={PEN_WIDTH} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )
      case 'rect': {
        const b = bounds(it)
        return <rect key={it.id} x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={it.color} fillOpacity={0.15} stroke={it.color} strokeWidth={2.5} />
      }
      case 'ellipse': {
        const b = bounds(it)
        return (
          <ellipse key={it.id} cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={it.color} fillOpacity={0.15} stroke={it.color} strokeWidth={2.5} />
        )
      }
      case 'arrow':
        return (
          <path key={it.id} d={arrowPath(it.x1, it.y1, it.x2, it.y2)} stroke={it.color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )
      case 'note':
      case 'text': {
        const editingThis = editing === it.id
        return (
          <g key={it.id}>
            {it.kind === 'note' && <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={14} fill={it.color} />}
            <foreignObject x={it.x} y={it.y} width={it.w} height={it.h}>
              <textarea
                className={`board-text ${it.kind} ${editingThis ? 'is-editing' : ''}`}
                value={it.text}
                readOnly={!editingThis}
                autoFocus={editingThis}
                placeholder={it.kind === 'note' ? 'Type a note' : 'Text'}
                style={{ color: it.kind === 'note' ? inkOn(it.color) : it.color }}
                onChange={(e) => changeText(it.id, e.target.value)}
                onBlur={finishEditing}
              />
            </foreignObject>
          </g>
        )
      }
    }
  }

  const outline = selectedItem
    ? (() => {
        const b = bounds(selectedItem)
        const p = 6 / v.z
        return { x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p }
      })()
    : null

  return (
    <div className="board-page">
      <div className="board-title">
        <Icon name="board" size={18} />
        Whiteboard
      </div>

      <div className="board-tools" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`board-tool ${tool === t.id ? 'on' : ''}`}
            aria-pressed={tool === t.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => pickTool(t.id)}
          >
            <Icon name={t.icon} size={18} />
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        className="board-svg"
        style={{ cursor: CURSORS[tool] }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        role="application"
        aria-label="Whiteboard canvas"
      >
        <defs>
          <pattern id="board-grid" width={24 * v.z} height={24 * v.z} patternUnits="userSpaceOnUse" x={v.x} y={v.y}>
            <circle cx={1.2} cy={1.2} r={1.2} className="board-dot" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#board-grid)" />
        <g transform={`translate(${v.x} ${v.y}) scale(${v.z})`}>
          {items.map(drawItem)}
          {outline && <rect className="board-sel" x={outline.x} y={outline.y} width={outline.w} height={outline.h} rx={6} />}
        </g>
      </svg>

      {items.length === 0 && (
        <div className="board-hint">
          <p>Pick a tool below and start drawing.</p>
          <p className="small">Drag the empty canvas to pan. Scroll to move, Ctrl + scroll to zoom. Double-click a note to edit it.</p>
        </div>
      )}

      <div className="board-bottom">
        <div className="board-panel" aria-label="Colour">
          {BOARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`board-swatch ${color === c ? 'on' : ''}`}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => pickColor(c)}
            />
          ))}
        </div>

        <div className="board-panel">
          <button type="button" className="board-action" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!depth.undo} onClick={undo}>
            <Icon name="undo" size={18} />
          </button>
          <button type="button" className="board-action" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!depth.redo} onClick={redo}>
            <Icon name="redo" size={18} />
          </button>
          {selected && (
            <button type="button" className="board-action" aria-label="Delete selected" title="Delete (Del)" onClick={removeSelected}>
              <Icon name="close" size={18} />
            </button>
          )}
          <button type="button" className="board-action" aria-label="Clear board" title="Clear board" disabled={!items.length} onClick={clearBoard}>
            <Icon name="trash" size={18} />
          </button>
        </div>

        <div className="board-panel">
          <button type="button" className="board-action" aria-label="Zoom out" onClick={() => zoomCenter(1 / 1.25)}>
            <Icon name="zoomOut" size={18} />
          </button>
          <button type="button" className="board-zoom" title="Reset view" onClick={() => setV({ x: 0, y: 0, z: 1 })}>
            {Math.round(v.z * 100)}%
          </button>
          <button type="button" className="board-action" aria-label="Zoom in" onClick={() => zoomCenter(1.25)}>
            <Icon name="zoomIn" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
