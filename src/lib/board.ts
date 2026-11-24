import type { BoardItem } from '../types'

export interface Point {
  x: number
  y: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Bounding box of one board object. */
export function bounds(item: BoardItem): Box {
  if (item.kind === 'pen') {
    if (item.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of item.points) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }
  if (item.kind === 'note' || item.kind === 'text') return { x: item.x, y: item.y, w: item.w, h: item.h }
  return {
    x: Math.min(item.x1, item.x2),
    y: Math.min(item.y1, item.y2),
    w: Math.abs(item.x2 - item.x1),
    h: Math.abs(item.y2 - item.y1),
  }
}

export function moveItem(item: BoardItem, dx: number, dy: number): BoardItem {
  if (item.kind === 'pen') {
    return { ...item, points: item.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) }
  }
  if (item.kind === 'note' || item.kind === 'text') return { ...item, x: item.x + dx, y: item.y + dy }
  return { ...item, x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy }
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Is point `p` on or near the object? `tol` is in board units (scale it by zoom). */
export function hitItem(item: BoardItem, p: Point, tol: number): boolean {
  if (item.kind === 'pen') {
    const pts = item.points
    if (pts.length === 1) return Math.hypot(pts[0][0] - p.x, pts[0][1] - p.y) <= tol
    for (let i = 1; i < pts.length; i++) {
      const a = { x: pts[i - 1][0], y: pts[i - 1][1] }
      const b = { x: pts[i][0], y: pts[i][1] }
      if (distToSegment(p, a, b) <= tol) return true
    }
    return false
  }
  if (item.kind === 'arrow') {
    return distToSegment(p, { x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 }) <= tol
  }
  const b = bounds(item)
  return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol
}

export function penPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0][0]} ${points[0][1]} l0.01 0`
  return 'M' + points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L')
}

/** Line plus a two-wing arrowhead at (x2, y2). */
export function arrowPath(x1: number, y1: number, x2: number, y2: number): string {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const len = 14
  const spread = 0.42
  const a1 = ang + Math.PI - spread
  const a2 = ang + Math.PI + spread
  return (
    `M${x1} ${y1} L${x2} ${y2}` +
    ` M${x2} ${y2} L${x2 + len * Math.cos(a1)} ${y2 + len * Math.sin(a1)}` +
    ` M${x2} ${y2} L${x2 + len * Math.cos(a2)} ${y2 + len * Math.sin(a2)}`
  )
}

/** Readable text colour for a #rrggbb background. */
export function inkOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#181a20' : '#ffffff'
}
