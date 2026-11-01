import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth,
  eachDayOfInterval, addDays, addWeeks, addMonths, subWeeks, subMonths,
  isSameDay, isSameMonth, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, PanelRight } from 'lucide-react'
import { getAllTasks, createTask, editTask, deleteTask, createRepeatedTask } from '../api/tasks'
import TaskModal from '../components/tasks/TaskModal'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'

// ─── Design tokens ──────────────────────────────────────────────────────────
const ROW_H    = 56   // px per hour
const GUTTER   = 60   // px for time-label gutter
const WK_START = 0    // 0 = Sunday
const MAX_COLS = 3    // max side-by-side columns in the time grid

const PALETTE = {
  indigo:  { bg: '#1F1E44', border: '#34327A', text: '#CFCEFF', dot: '#7C7AFF' },
  emerald: { bg: '#102B24', border: '#1D5040', text: '#A6ECD0', dot: '#34D399' },
  amber:   { bg: '#2E2410', border: '#584418', text: '#F7D999', dot: '#F5B83D' },
  rose:    { bg: '#341624', border: '#5E2539', text: '#FFBFD0', dot: '#FB7199' },
  sky:     { bg: '#0E2836', border: '#1A4860', text: '#B0E2FA', dot: '#38BDF8' },
}

// ─── Utility ────────────────────────────────────────────────────────────────
function parseMin(t = '00:00') {
  const [h, m] = t.substring(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function loadColors() {
  try { return JSON.parse(localStorage.getItem('calTaskColors') || '{}') }
  catch { return {} }
}

function toEvent(task, colors) {
  return {
    id: String(task.id),
    rawId: task.id,
    title: task.name,
    date: task.dateOfStart,
    start: task.timeOfStart?.substring(0, 5) || '00:00',
    end:   task.timeOfEnd?.substring(0, 5)   || '01:00',
    color: colors[String(task.id)] || 'indigo',
    done:  task.status === 'done',
    raw:   task,
  }
}

function getWeekDays(date) {
  const ws = startOfWeek(date, { weekStartsOn: WK_START })
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
}

function headerTitle(view, date) {
  if (view === 'month') return format(date, 'MMMM yyyy')
  if (view === 'day')   return format(date, 'EEEE, MMMM d, yyyy')
  const ws = startOfWeek(date, { weekStartsOn: WK_START })
  const we = endOfWeek(date,   { weekStartsOn: WK_START })
  if (format(ws, 'MMM yyyy') === format(we, 'MMM yyyy'))
    return `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
  return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
}

// ─── layoutEvents ────────────────────────────────────────────────────────────
function layoutEvents(dayEvts) {
  if (dayEvts.length === 0) return []
  const sorted = [...dayEvts].sort((a, b) => {
    const as = parseMin(a.start), bs = parseMin(b.start)
    return as !== bs ? as - bs : parseMin(b.end) - parseMin(a.end)
  })
  const slots = []
  const positioned = sorted.map(ev => {
    const s = parseMin(ev.start)
    const e = Math.max(parseMin(ev.end), s + 1)
    let col = slots.findIndex(endAt => endAt <= s)
    if (col === -1) { col = slots.length; slots.push(e) } else slots[col] = e
    return { ...ev, _col: col, _s: s, _e: e }
  })
  return positioned.map(ev => {
    const concurrent = positioned.filter(o => o._s < ev._e && o._e > ev._s)
    const total = Math.max(...concurrent.map(o => o._col)) + 1
    return { ...ev, _total: total }
  })
}

function computeOverflowPills(laidOut, maxCols = MAX_COLS) {
  const overflow = laidOut.filter(ev => ev._total > maxCols && ev._col >= maxCols - 1)
  if (overflow.length === 0) return []
  const sorted = [...overflow].sort((a, b) => a._s - b._s)
  const used = new Set()
  const pills = []
  for (const ev of sorted) {
    if (used.has(ev.id)) continue
    const group = sorted.filter(o => !used.has(o.id) && o._s < ev._e && o._e > ev._s)
    group.forEach(o => used.add(o.id))
    pills.push({ count: group.length, startMin: Math.min(...group.map(o => o._s)) })
  }
  return pills
}

// ─── EventBlock (time-grid) ──────────────────────────────────────────────────
const COL_EDGE = 4   // px from column wall
const COL_GAP  = 3   // px between sibling event columns

function EventBlock({ ev, onClick, onDelete, colIndex = 0, colCount = 1 }) {
  const c = PALETTE[ev.color] || PALETTE.indigo
  const startMin = parseMin(ev.start)
  const endMin   = parseMin(ev.end)
  const durMin   = endMin - startMin
  const top    = (startMin / 60) * ROW_H + 2
  const height = Math.max((durMin / 60) * ROW_H - 4, 30)

  const slotW    = 1 / colCount
  const leftFrac = colIndex * slotW
  const rightFrac = 1 - (colIndex + 1) * slotW
  const leftPx  = leftFrac  === 0 ? COL_EDGE : COL_GAP / 2
  const rightPx = rightFrac === 0 ? COL_EDGE : COL_GAP / 2
  const leftCSS  = `calc(${leftFrac  * 100}% + ${leftPx}px)`
  const rightCSS = `calc(${rightFrac * 100}% + ${rightPx}px)`

  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(ev) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', top, left: leftCSS, right: rightCSS, height,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: '6px 8px',
        cursor: 'pointer', opacity: ev.done ? 0.45 : 1,
        zIndex: 1, overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
        <span style={{
          color: c.text, fontSize: 12.5, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
          textDecoration: ev.done ? 'line-through' : 'none',
        }}>{ev.title}</span>
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(ev.rawId) }}
            aria-label={`Delete ${ev.title}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 4, border: 'none', flexShrink: 0,
              background: 'rgba(251,113,153,0.15)', color: '#FB7199', cursor: 'pointer', padding: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        )}
      </div>
      {height > 34 && (
        <div style={{ color: c.text, opacity: 0.7, fontSize: 11, fontFamily: 'Geist Mono, monospace' }}>
          {ev.start} – {ev.end}
        </div>
      )}
    </div>
  )
}

// ─── OverflowPill ─────────────────────────────────────────────────────────────
function OverflowPill({ count, startMin, onClick, maxCols = MAX_COLS }) {
  const top      = (startMin / 60) * ROW_H + 2
  const leftFrac = (maxCols - 1) / maxCols
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top,
        left:   `calc(${leftFrac * 100}% + ${COL_GAP / 2}px)`,
        right:  `${COL_EDGE}px`,
        height: 26,
        background: hovered ? '#1E1E2E' : '#16161F',
        border: `1px dashed ${hovered ? '#6461F5' : '#2E2E42'}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hovered ? '#A5A3FF' : '#6F6F82',
        fontSize: 11, fontWeight: 600,
        zIndex: 2, cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      +{count} more
    </div>
  )
}

// ─── DayDetailPopup ───────────────────────────────────────────────────────────
const POPUP_COL_W   = 180  // min px per event column in the popup
const POPUP_LABEL_W = 52

function DayDetailPopup({ dayStr, events, onClose, onEventClick, onDeleteEvent, onSwitchToDay }) {
  const isMobile = useIsMobile()
  const dayEvts = useMemo(() => events.filter(e => e.date === dayStr), [events, dayStr])
  const laidOut = useMemo(() => layoutEvents(dayEvts), [dayEvts])
  const [hoveredId, setHoveredId] = useState(null)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const allStarts  = laidOut.map(e => e._s)
  const allEnds    = laidOut.map(e => e._e)
  const startHour  = laidOut.length ? Math.max(0,  Math.floor(Math.min(...allStarts) / 60))        : 0
  const endHour    = laidOut.length ? Math.min(24, Math.ceil(Math.max(...allEnds, startHour * 60 + 60) / 60)) : 1
  const hours      = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const gridH      = (endHour - startHour) * ROW_H

  const peakCols   = laidOut.length ? Math.max(...laidOut.map(e => e._total)) : 1
  const eventAreaW = Math.max(peakCols * POPUP_COL_W, 320)

  const date = parseISO(dayStr)

  const panelStyle = isMobile ? {
    // Bottom sheet on mobile
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: '88vh',
    background: '#111118', border: '1px solid #1E1E29',
    borderRadius: '16px 16px 0 0',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    zIndex: 201, boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  } : {
    // Centered modal on desktop
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: `min(${eventAreaW + POPUP_LABEL_W + 32}px, calc(100vw - 80px))`,
    maxWidth: 920, maxHeight: '80vh',
    background: '#111118', border: '1px solid #1E1E29', borderRadius: 16,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    zIndex: 201, boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
      />

      {/* Panel */}
      <div style={panelStyle}>
        {/* Drag handle — mobile only */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2E2E42' }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #1E1E29', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#6F6F82', marginBottom: 2, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {format(date, 'EEEE')}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#ECECF1', letterSpacing: '-0.02em' }}>
              {format(date, 'MMMM d, yyyy')}
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: '#6F6F82' }}>
                {laidOut.length} task{laidOut.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => { onSwitchToDay(date); onClose() }}
              style={{
                height: 30, padding: '0 12px', borderRadius: 8,
                border: '1px solid #23232F', background: '#13131A',
                color: '#ECECF1', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Day view →</button>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: '1px solid #23232F', background: '#13131A',
                color: '#8B8B9E', fontSize: 18, lineHeight: 1,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', minHeight: 0 }}>
          {/* Time labels */}
          <div style={{
            width: POPUP_LABEL_W, flexShrink: 0,
            position: 'relative', height: gridH,
            borderRight: '1px solid #1A1A24',
          }}>
            {hours.map(h => (
              <div key={h} style={{
                position: 'absolute', top: (h - startHour) * ROW_H, right: 8, height: ROW_H,
                display: 'flex', alignItems: 'flex-start', paddingTop: 4,
              }}>
                <span style={{ color: '#5C5C70', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Event area — scrolls horizontally when crowded */}
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <div style={{ width: eventAreaW, height: gridH, position: 'relative' }}>
              {/* Hour lines */}
              {hours.map(h => (
                <div key={h} style={{
                  position: 'absolute', top: (h - startHour) * ROW_H, left: 0, right: 0,
                  height: ROW_H, borderBottom: '1px solid #1A1A24',
                }} />
              ))}

              {/* Events */}
              {laidOut.map(ev => {
                const c        = PALETTE[ev.color] || PALETTE.indigo
                const topPx    = (ev._s - startHour * 60) / 60 * ROW_H + 2
                const heightPx = Math.max((ev._e - ev._s) / 60 * ROW_H - 4, 30)
                const leftPx   = ev._col * POPUP_COL_W + COL_EDGE
                const widthPx  = POPUP_COL_W - COL_EDGE * 2
                const isHov    = hoveredId === ev.id
                return (
                  <div
                    key={ev.id}
                    onMouseEnter={() => setHoveredId(ev.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    style={{
                      position: 'absolute', top: topPx, left: leftPx,
                      width: widthPx, height: heightPx,
                      background: c.bg, border: `1px solid ${c.border}`,
                      borderRadius: 8, padding: '6px 8px',
                      cursor: 'pointer', opacity: ev.done ? 0.45 : 1, overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                      <span style={{
                        color: c.text, fontSize: 12.5, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, textDecoration: ev.done ? 'line-through' : 'none',
                      }}>{ev.title}</span>
                      {isHov && (
                        <button
                          onClick={e => { e.stopPropagation(); onDeleteEvent(ev.rawId) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 18, height: 18, borderRadius: 4, border: 'none', flexShrink: 0,
                            background: 'rgba(251,113,153,0.15)', color: '#FB7199', cursor: 'pointer', padding: 0,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    {heightPx > 34 && (
                      <div style={{ color: c.text, opacity: 0.7, fontSize: 11, fontFamily: 'Geist Mono, monospace' }}>
                        {ev.start} – {ev.end}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── TimeGrid (Week / Day) ───────────────────────────────────────────────────
function TimeGrid({ days, events, onSlotClick, onEventClick, onDeleteEvent, onDayHeaderClick, onOpenDayPopup }) {
  const scrollRef = useRef(null)
  const isMobile = useIsMobile()
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes()
  })

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7.5 * ROW_H
  }, [days.length])

  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(t)
  }, [])

  const hours    = Array.from({ length: 24 }, (_, i) => i)
  const nowTop   = (nowMin / 60) * ROW_H
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const isWeek   = days.length > 1

  // On mobile week view: narrower gutter, min 120px per day column, max 2 overlapping columns
  const GUTTER_W        = isMobile ? 40 : GUTTER
  const mobileWeek      = isMobile && isWeek
  const colTemplate     = mobileWeek
    ? `${GUTTER_W}px repeat(${days.length}, minmax(120px, 1fr))`
    : `${GUTTER_W}px repeat(${days.length}, minmax(0, 1fr))`
  const gridMinW        = mobileWeek ? GUTTER_W + days.length * 120 : undefined
  const effectiveMaxCols = mobileWeek ? 2 : MAX_COLS

  const headerRow = (
    <div style={{
      display: 'grid', gridTemplateColumns: colTemplate,
      borderBottom: '1px solid #1A1A24', flexShrink: 0,
      ...(mobileWeek ? { minWidth: gridMinW, position: 'sticky', top: 0, zIndex: 10, background: '#111118' } : {}),
    }}>
      <div />
      {days.map(day => {
        const isTdy  = isToday(day)
        const dayStr = format(day, 'yyyy-MM-dd')
        return (
          <div
            key={dayStr}
            onClick={() => isWeek && onOpenDayPopup(format(day, 'yyyy-MM-dd'))}
            style={{ padding: '10px 0', textAlign: 'center', borderLeft: '1px solid #1A1A24', cursor: isWeek ? 'pointer' : 'default' }}
          >
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: '#5C5C70', textTransform: 'uppercase', marginBottom: 4 }}>
              {format(day, 'EEE')}
            </div>
            <div style={{ width: 28, height: 28, borderRadius: 6, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTdy ? '#6461F5' : 'transparent', color: isTdy ? '#fff' : '#ECECF1', fontSize: 14, fontWeight: 600 }}>
              {format(day, 'd')}
            </div>
          </div>
        )
      })}
    </div>
  )

  const gridBody = (
    <div style={{
      height: 24 * ROW_H,
      display: 'grid',
      gridTemplateColumns: colTemplate,
      minWidth: gridMinW,
    }}>
          {/* Hour labels */}
          <div style={{ position: 'relative', borderRight: '1px solid #1A1A24' }}>
            {hours.map(h => (
              <div key={h} style={{
                position: 'absolute', top: h * ROW_H, right: 8, height: ROW_H,
                display: 'flex', alignItems: 'flex-start', paddingTop: 4,
              }}>
                {h > 0 && (
                  <span style={{ color: '#5C5C70', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const dayStr  = format(day, 'yyyy-MM-dd')
            const isTdy   = dayStr === todayStr
            const dayEvts = events.filter(e => e.date === dayStr)
            const laidOut = layoutEvents(dayEvts)

            const visibleEvts = laidOut
              .filter(ev => ev._total <= effectiveMaxCols || ev._col < effectiveMaxCols - 1)
              .map(ev => ev._total > effectiveMaxCols ? { ...ev, _total: effectiveMaxCols } : ev)
            const overflowPills = computeOverflowPills(laidOut, effectiveMaxCols)

            return (
              <div key={dayStr} style={{
                position: 'relative',
                borderLeft: '1px solid #1A1A24',
                background: isTdy ? 'rgba(100,97,245,0.02)' : 'transparent',
              }}>
                {/* Hour slots */}
                {hours.map(h => (
                  <div
                    key={h}
                    onClick={() => onSlotClick(day, h, 0)}
                    style={{
                      position: 'absolute', top: h * ROW_H, left: 0, right: 0,
                      height: ROW_H, borderBottom: '1px solid #1A1A24', cursor: 'pointer',
                    }}
                  />
                ))}

                {/* Events */}
                {visibleEvts.map(ev => (
                  <EventBlock key={ev.id} ev={ev} onClick={onEventClick} onDelete={onDeleteEvent} colIndex={ev._col} colCount={ev._total} />
                ))}

                {/* Overflow pills */}
                {overflowPills.map((pill, i) => (
                  <OverflowPill key={i} count={pill.count} startMin={pill.startMin} onClick={() => onOpenDayPopup(dayStr)} maxCols={effectiveMaxCols} />
                ))}

                {/* Now line */}
                {isTdy && (
                  <div style={{
                    position: 'absolute', top: nowTop - 1, left: -5, right: 0,
                    zIndex: 5, pointerEvents: 'none',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5C7A', flexShrink: 0 }} />
                    <div style={{ flex: 1, height: 2, background: '#FF5C7A' }} />
                  </div>
                )}
              </div>
            )
          })}
    </div>
  )

  // Mobile week: headers sticky inside the single scroll container so horizontal scroll stays in sync
  if (mobileWeek) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {headerRow}
          {gridBody}
        </div>
      </div>
    )
  }

  // Desktop / mobile day: headers outside the scroll container (original structure)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {headerRow}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {gridBody}
      </div>
    </div>
  )
}

// ─── MobileWeekView ──────────────────────────────────────────────────────────
const MW_ROW_H = 40

function mwLayout(dayEvts) {
  const long  = dayEvts.filter(ev => parseMin(ev.end) - parseMin(ev.start) >= 240)
  const short = dayEvts.filter(ev => parseMin(ev.end) - parseMin(ev.start) <  240)

  // Greedy lane assignment for rails — longer task first when tied on start time
  const longSorted = [...long].sort((a, b) => {
    const as = parseMin(a.start), bs = parseMin(b.start)
    if (as !== bs) return as - bs
    return (parseMin(b.end) - parseMin(b.start)) - (parseMin(a.end) - parseMin(a.start))
  })
  const railEnds = []
  const longPositioned = longSorted.map(ev => {
    const s = parseMin(ev.start)
    const e = Math.max(parseMin(ev.end), s + 1)
    let lane = railEnds.findIndex(end => end <= s)
    if (lane === -1) { lane = railEnds.length; railEnds.push(e) } else railEnds[lane] = e
    return { ...ev, _lane: lane, _s: s, _e: e }
  })
  // Greedy lane assignment for short tasks (independent of rails)
  const sorted = [...short].sort((a, b) => {
    const as = parseMin(a.start), bs = parseMin(b.start)
    return as !== bs ? as - bs : (parseMin(b.end) - parseMin(b.start)) - (parseMin(a.end) - parseMin(a.start))
  })
  const laneEnds = []
  const positioned = sorted.map(ev => {
    const s = parseMin(ev.start)
    const e = Math.max(parseMin(ev.end), s + 1)
    let lane = laneEnds.findIndex(end => end <= s)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(e) } else laneEnds[lane] = e
    return { ...ev, _lane: lane, _s: s, _e: e }
  })
  const withTotal = positioned.map(ev => {
    const concurrent = positioned.filter(o => o._s < ev._e && o._e > ev._s)
    return { ...ev, _total: Math.max(...concurrent.map(o => o._lane)) + 1 }
  })

  return { long: longPositioned, short: withTotal }
}

function mwOverflowChips(shortTasks) {
  const overflow = shortTasks.filter(ev => ev._total > 3 && ev._lane >= 2)
  if (!overflow.length) return []
  const sorted = [...overflow].sort((a, b) => a._s - b._s)
  const used = new Set()
  const chips = []
  for (const ev of sorted) {
    if (used.has(ev.id)) continue
    const group = sorted.filter(o => !used.has(o.id) && o._s < ev._e && o._e > ev._s)
    group.forEach(o => used.add(o.id))
    chips.push({ count: group.length, startMin: Math.min(...group.map(o => o._s)), endMin: Math.max(...group.map(o => o._e)) })
  }
  return chips
}

function MobileWeekView({ currentDate, selectedDate, onSelectDate, onWeekChange, events, onEventClick, onSlotClick, onOpenDayPopup }) {
  const weekDays  = getWeekDays(currentDate)
  const scrollRef = useRef(null)
  const touchX    = useRef(null)

  const dayStr  = format(selectedDate, 'yyyy-MM-dd')
  const dayEvts = events.filter(e => e.date === dayStr)
  const { long: longTasks, short: shortTasks } = useMemo(() => mwLayout(dayEvts), [dayEvts])
  const chips = useMemo(() => mwOverflowChips(shortTasks), [shortTasks])

  // Offset for tasks/chips at [s,e): only rails that actually overlap shift them right
  const railOffset = (s, e) => {
    const overlapping = longTasks.filter(r => r._s < e && r._e > s)
    return overlapping.length ? 4 + (Math.max(...overlapping.map(r => r._lane)) + 1) * 26 : 4
  }

  useEffect(() => {
    if (!scrollRef.current) return
    const first = dayEvts.length ? Math.min(...dayEvts.map(ev => parseMin(ev.start))) : 7 * 60
    scrollRef.current.scrollTop = Math.max(0, (first / 60) * MW_ROW_H - MW_ROW_H)
  }, [dayStr])

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const goDay = (delta) => {
    const next  = addDays(selectedDate, delta)
    const nextW = startOfWeek(next,           { weekStartsOn: WK_START })
    const curW  = startOfWeek(selectedDate,   { weekStartsOn: WK_START })
    if (!isSameDay(nextW, curW)) onWeekChange(next)
    onSelectDate(next)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 8 }}>

      {/* Week strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4, padding: '0 12px', flexShrink: 0 }}>
        {weekDays.map(day => {
          const ds    = format(day, 'yyyy-MM-dd')
          const isTdy = isToday(day)
          const isSel = isSameDay(day, selectedDate)
          const dots  = events.filter(e => e.date === ds).slice(0, 4)
          return (
            <button key={ds} onClick={() => onSelectDate(day)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '8px 0 7px', borderRadius: 10,
              border: `1px solid ${isSel ? '#7B78FF' : '#1E1E29'}`,
              background: isSel ? '#6461F5' : isTdy ? '#1D1C38' : '#111118',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: isSel ? '#C7C6FF' : isTdy ? '#A5A3FF' : '#6F6F82' }}>
                {format(day, 'EEE')}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: isSel ? '#fff' : '#ECECF1', lineHeight: 1 }}>
                {format(day, 'd')}
              </span>
              <div style={{ display: 'flex', gap: 2, minHeight: 4 }}>
                {dots.map((ev, i) => (
                  <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.8)' : (PALETTE[ev.color] || PALETTE.indigo).dot }} />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#ECECF1' }}>{format(selectedDate, 'EEEE, MMM d')}</span>
        <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: '#6F6F82' }}>
          {dayEvts.length} task{dayEvts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Day grid */}
      <div style={{
        flex: 1, margin: '0 12px', overflow: 'hidden',
        background: '#111118', border: '1px solid #1E1E29', borderRadius: 16,
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto' }}
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (Math.abs(dx) >= 40) goDay(dx < 0 ? 1 : -1)
          }}
        >
          {dayEvts.length === 0 ? (
            <div style={{ height: 24 * MW_ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6F6F82' }}>
              Nothing scheduled
            </div>
          ) : (
            <div style={{ height: 24 * MW_ROW_H, display: 'flex' }}>
              {/* Hour gutter */}
              <div style={{ width: 40, flexShrink: 0, position: 'relative', borderRight: '1px solid #1A1A24' }}>
                {hours.map(h => (
                  <div key={h} style={{ position: 'absolute', top: h * MW_ROW_H, right: 6, height: MW_ROW_H, display: 'flex', alignItems: 'flex-start', paddingTop: 3 }}>
                    {h > 0 && <span style={{ color: '#5C5C70', fontSize: 10, fontFamily: 'Geist Mono, monospace' }}>{String(h).padStart(2, '0')}:00</span>}
                  </div>
                ))}
              </div>

              {/* Event area */}
              <div style={{ flex: 1, position: 'relative' }}>
                {/* Hour lines + slot click */}
                {hours.map(h => (
                  <div key={h} onClick={() => onSlotClick(selectedDate, h, 0)} style={{ position: 'absolute', top: h * MW_ROW_H, left: 0, right: 0, height: MW_ROW_H, borderBottom: '1px solid #1A1A24', cursor: 'pointer' }} />
                ))}

                {/* Rail (long ≥4h) tasks — each lane at left = 4 + lane * 26 */}
                {longTasks.map(ev => {
                  const c    = PALETTE[ev.color] || PALETTE.indigo
                  const s    = ev._s, e = ev._e
                  const t    = (s / 60) * MW_ROW_H + 1
                  const ht   = Math.max(((e - s) / 60) * MW_ROW_H - 2, 30)
                  const left = 4 + ev._lane * 26
                  return (
                    <div key={ev.id} onClick={ev2 => { ev2.stopPropagation(); onEventClick(ev) }} style={{ position: 'absolute', top: t, left, width: 22, height: ht, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 7, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 600, color: c.text, overflow: 'hidden', maxHeight: '100%', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    </div>
                  )
                })}

                {/* Short tasks */}
                {shortTasks.map(ev => {
                  if (ev._total > 3 && ev._lane >= 2) return null
                  const c     = PALETTE[ev.color] || PALETTE.indigo
                  const total = Math.min(ev._total, 3)
                  const top   = (ev._s / 60) * MW_ROW_H + 1
                  const ht    = Math.max(((ev._e - ev._s) / 60) * MW_ROW_H - 2, 30)
                  const off   = railOffset(ev._s, ev._e)
                  const avail = `(100% - ${off + 4}px)`
                  const lCSS  = `calc(${off}px + ${avail} * ${ev._lane / total} + 1px)`
                  const rCSS  = `calc(${avail} * ${(total - ev._lane - 1) / total} + 4px + 1px)`
                  return (
                    <div key={ev.id} onClick={ev2 => { ev2.stopPropagation(); onEventClick(ev) }} style={{ position: 'absolute', top, left: lCSS, right: rCSS, height: ht, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 7, padding: '3px 7px', cursor: 'pointer', opacity: ev.done ? 0.45 : 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: ev.done ? 'line-through' : 'none' }}>{ev.title}</div>
                      {ht > 34 && <div style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: c.text, opacity: 0.7, whiteSpace: 'nowrap' }}>{ev.start}–{ev.end}</div>}
                    </div>
                  )
                })}

                {/* +N overflow chips */}
                {chips.map((chip, i) => {
                  const off   = railOffset(chip.startMin, chip.endMin)
                  const avail = `(100% - ${off + 4}px)`
                  const lCSS  = `calc(${off}px + ${avail} * ${2 / 3} + 1px)`
                  const rCSS  = `calc(4px + 1px)`
                  return (
                    <div key={i} onClick={e => { e.stopPropagation(); onOpenDayPopup(dayStr) }} style={{ position: 'absolute', top: (chip.startMin / 60) * MW_ROW_H + 1, left: lCSS, right: rCSS, height: 28, background: '#16161F', border: '1px dashed #34324F', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#A5A3FF', cursor: 'pointer', zIndex: 2 }}>
                      +{chip.count}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MonthChip ───────────────────────────────────────────────────────────────
function MonthChip({ ev, c, onEventClick, onDeleteEvent }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 5px', borderRadius: 4, marginBottom: 2,
        background: c.bg, overflow: 'hidden', cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div
        onClick={e => { e.stopPropagation(); onEventClick(ev) }}
        style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
        <span style={{ color: c.text, fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {ev.title}
        </span>
      </div>
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDeleteEvent(ev.rawId) }}
          aria-label={`Delete ${ev.title}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 14, height: 14, borderRadius: 3, border: 'none', flexShrink: 0,
            background: 'rgba(251,113,153,0.2)', color: '#FB7199', cursor: 'pointer', padding: 0,
          }}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── MonthView ───────────────────────────────────────────────────────────────
const WDAY_LABELS = WK_START === 0
  ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function MonthView({ currentDate, events, selectedDate, onSelectDate, onEventClick, onDeleteEvent, onSwitchToDay }) {
  const monthStart = startOfMonth(currentDate)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: WK_START })
  const days = (() => {
    const arr = eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) })
    return arr
  })()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', flexShrink: 0 }}>
        {WDAY_LABELS.map(d => (
          <div key={d} style={{
            padding: '10px 0', textAlign: 'center',
            fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
            color: '#5C5C70', textTransform: 'uppercase',
            borderBottom: '1px solid #1A1A24',
          }}>{d}</div>
        ))}
      </div>

      {/* 6-week grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(6,1fr)', overflow: 'hidden' }}>
        {days.map(day => {
          const dayStr  = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, currentDate)
          const isTdy   = isToday(day)
          const isSel   = isSameDay(day, selectedDate)
          const dayEvts = events.filter(e => e.date === dayStr)

          return (
            <div
              key={dayStr}
              onClick={() => { onSelectDate(day); onSwitchToDay(day) }}
              style={{
                borderRight: '1px solid #1A1A24', borderBottom: '1px solid #1A1A24',
                background: !inMonth ? '#0E0E14' : 'transparent',
                padding: 6, cursor: 'pointer', overflow: 'hidden', minHeight: 0,
              }}
            >
              <div style={{ marginBottom: 3 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: 6,
                  background: isTdy ? '#6461F5' : isSel ? '#1D1C38' : 'transparent',
                  color: !inMonth ? '#2A2A3A' : isTdy ? '#fff' : isSel ? '#A5A3FF' : '#ECECF1',
                  fontSize: 12, fontWeight: 500,
                }}>
                  {format(day, 'd')}
                </span>
              </div>

              {dayEvts.slice(0, 3).map(ev => {
                const c = PALETTE[ev.color] || PALETTE.indigo
                return (
                  <MonthChip key={ev.id} ev={ev} c={c} onEventClick={onEventClick} onDeleteEvent={onDeleteEvent} />
                )
              })}

              {dayEvts.length > 3 && (
                <div style={{ fontSize: 11, color: '#6F6F82', padding: '1px 5px' }}>
                  +{dayEvts.length - 3} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MiniMonth (sidebar) ─────────────────────────────────────────────────────
const MINI_LABELS = WK_START === 0 ? ['S','M','T','W','T','F','S'] : ['M','T','W','T','F','S','S']

function MiniMonth({ displayDate, onDisplayChange, selectedDate, onSelectDate, events }) {
  const gridStart = startOfWeek(startOfMonth(displayDate), { weekStartsOn: WK_START })
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <div style={{ background: '#111118', border: '1px solid #1E1E29', borderRadius: 16, padding: 16, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ECECF1' }}>
          {format(displayDate, 'MMMM yyyy')}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { fn: () => onDisplayChange(d => subMonths(d, 1)), label: '‹' },
            { fn: () => onDisplayChange(d => addMonths(d, 1)), label: '›' },
          ].map(({ fn, label }) => (
            <button key={label} onClick={fn} aria-label={label === '‹' ? 'Previous month' : 'Next month'} style={{
              width: 22, height: 22, borderRadius: 6, border: '1px solid #23232F',
              background: '#13131A', color: '#8B8B9E', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 2 }}>
        {MINI_LABELS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#5C5C70', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
        {days.map(day => {
          const dayStr    = format(day, 'yyyy-MM-dd')
          const inMonth   = isSameMonth(day, displayDate)
          const isTdy     = isToday(day)
          const isSel     = isSameDay(day, selectedDate)
          const dayEvts   = events.filter(e => e.date === dayStr)
          const dotColor  = dayEvts.length > 0 ? (PALETTE[dayEvts[0].color] || PALETTE.indigo).dot : null

          return (
            <div key={dayStr} onClick={() => onSelectDate(day)} style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{
                width: 26, height: 26, margin: '0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
                background: isSel ? '#6461F5' : isTdy ? '#1D1C38' : 'transparent',
                color: !inMonth ? '#2A2A3A' : isSel ? '#fff' : isTdy ? '#A5A3FF' : '#ECECF1',
                fontSize: 11.5, fontWeight: 500,
              }}>
                {format(day, 'd')}
              </div>
              {dotColor && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor, margin: '1px auto 0' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── SidebarTaskRow ───────────────────────────────────────────────────────────
function SidebarTaskRow({ ev, c, onToggle, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 10,
        background: '#13131A', border: '1px solid #1E1E29',
      }}
    >
      <button
        onClick={() => onToggle(ev)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          flex: 1, minWidth: 0, border: 'none', background: 'transparent',
          cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${c.dot}`,
          background: ev.done ? c.dot : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {ev.done && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#0C0C11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: '#ECECF1',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: ev.done ? 'line-through' : 'none',
            opacity: ev.done ? 0.5 : 1,
          }}>{ev.title}</div>
          <div style={{ fontSize: 11, color: '#6F6F82', fontFamily: 'Geist Mono, monospace' }}>
            {ev.start} – {ev.end}
          </div>
        </div>
      </button>
      <button
        onClick={() => onDelete(ev.rawId)}
        aria-label={`Delete ${ev.title}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 7, border: 'none', flexShrink: 0,
          background: 'transparent', color: '#5C5C70', cursor: 'pointer',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.15s, color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FB7199'; e.currentTarget.style.background = '#2A1520' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#5C5C70'; e.currentTarget.style.background = 'transparent' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  )
}

// ─── TaskSidebar ─────────────────────────────────────────────────────────────
function TaskSidebar({ selectedDate, events, onToggle, onDelete }) {
  const dayStr   = format(selectedDate, 'yyyy-MM-dd')
  const dayEvts  = events.filter(e => e.date === dayStr)
  const doneN    = dayEvts.filter(e => e.done).length
  const label    = isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMM d, yyyy')

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ECECF1' }}>{label}</span>
        {dayEvts.length > 0 && (
          <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: '#6F6F82' }}>
            {doneN}/{dayEvts.length} done
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dayEvts.length === 0 ? (
          <div style={{
            border: '1px dashed #1E1E29', borderRadius: 12, padding: '24px 16px',
            textAlign: 'center', color: '#5C5C70', fontSize: 12,
          }}>Nothing scheduled</div>
        ) : (
          dayEvts.map(ev => {
            const c = PALETTE[ev.color] || PALETTE.indigo
            return (
              <SidebarTaskRow key={ev.id} ev={ev} c={c} onToggle={onToggle} onDelete={onDelete} />
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── CalendarPage (main) ─────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isMobile = useIsMobile()

  const [view, setView]               = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [miniDate, setMiniDate]       = useState(new Date())
  const [modalOpen, setModalOpen]     = useState(false)
  const [popupDay, setPopupDay]       = useState(null)
  const [modalDefaults, setModalDefaults] = useState(null)
  const [taskColors, setTaskColors]   = useState(loadColors)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: rawTasks = [] } = useQuery({
    queryKey: ['allTasks', user?.id],
    queryFn: () => getAllTasks(user.id).then(r => r.data),
    enabled: !!user?.id,
  })

  const events = rawTasks.map(t => toEvent(t, taskColors))

  const saveColor = useCallback((taskId, color) => {
    setTaskColors(prev => {
      const next = { ...prev, [String(taskId)]: color }
      localStorage.setItem('calTaskColors', JSON.stringify(next))
      return next
    })
  }, [])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['allTasks'] })
    qc.invalidateQueries({ queryKey: ['tasksByDate'] })
    qc.invalidateQueries({ queryKey: ['upcomingTask'] })
    qc.invalidateQueries({ queryKey: ['next7Days'] })
  }

  const toggleMutation = useMutation({
    mutationFn: ({ ev }) => editTask({
      taskId: ev.rawId,
      name: ev.raw.name,
      description: ev.raw.description || '',
      dateOfStart: ev.raw.dateOfStart,
      timeOfStart: ev.raw.timeOfStart,
      dateOfEnd: ev.raw.dateOfEnd,
      timeOfEnd: ev.raw.timeOfEnd,
      status: ev.done ? 'pending' : 'done',
    }),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (taskId) => deleteTask(taskId),
    onSuccess: invalidate,
  })

  const createMutation = useMutation({
    mutationFn: ({ data, repeated }) =>
      repeated ? createRepeatedTask(data) : createTask(data),
    onSuccess: (res, vars) => {
      const task = res?.data
      if (task?.id && vars.color) saveColor(task.id, vars.color)
      invalidate()
      setModalOpen(false)
      setModalDefaults(null)
    },
  })

  // Navigation — mobile week view moves 1 day at a time (3-day window)
  const goNext = () => {
    if (view === 'month') setCurrentDate(d => addMonths(d, 1))
    else if (view === 'week' && isMobile) {
      setCurrentDate(d => addWeeks(d, 1))
      setSelectedDate(d => addWeeks(d, 1))
    }
    else if (view === 'week') setCurrentDate(d => addWeeks(d, 1))
    else setCurrentDate(d => addDays(d, 1))
  }
  const goPrev = () => {
    if (view === 'month') setCurrentDate(d => subMonths(d, 1))
    else if (view === 'week' && isMobile) {
      setCurrentDate(d => subWeeks(d, 1))
      setSelectedDate(d => subWeeks(d, 1))
    }
    else if (view === 'week') setCurrentDate(d => subWeeks(d, 1))
    else setCurrentDate(d => addDays(d, 1))
  }
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()) }

  const switchView = (v) => { setView(v) }

  const openAddModal = (defaults = null) => {
    setModalDefaults(defaults)
    setModalOpen(true)
  }

  const handleSlotClick = (day, hour) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const start = minsToTime(hour * 60)
    const end   = minsToTime(hour * 60 + 60)
    openAddModal({ date: dateStr, timeOfStart: start, timeOfEnd: end })
  }

  const handleEventClick = (ev) => {
    toggleMutation.mutate({ ev })
  }

  const handleDayHeaderClick = (day) => {
    setCurrentDate(day)
    setSelectedDate(day)
    setView('day')
  }

  const handleMiniSelectDate = (day) => {
    setSelectedDate(day)
    setCurrentDate(day)
  }

  const handleMonthSelectDate = (day) => {
    setSelectedDate(day)
  }

  const handleCreate = async (data) => {
    const payload = {
      name: data.name,
      description: data.description || '',
      dateOfStart: data.dateOfStart,
      timeOfStart: data.timeOfStart,
      dateOfEnd: data.dateOfEnd,
      timeOfEnd: data.timeOfEnd,
      status: 'pending',
    }
    await createMutation.mutateAsync({ data: payload, repeated: data.repeated, color: data.color })
  }

  const visibleDays = view === 'week'
    ? (isMobile ? [selectedDate] : getWeekDays(currentDate))
    : view === 'day'
      ? [currentDate]
      : null

  const title = (isMobile && view === 'week')
    ? format(currentDate, 'MMMM yyyy')
    : headerTitle(view, currentDate)

  // Button styles
  const navBtn = {
    height: 32, padding: '0 10px', borderRadius: 8,
    border: '1px solid #23232F', background: '#13131A',
    color: '#ECECF1', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  }

  const sidebarContent = (
    <>
      <MiniMonth
        displayDate={miniDate}
        onDisplayChange={setMiniDate}
        selectedDate={selectedDate}
        onSelectDate={handleMiniSelectDate}
        events={events}
      />
      <TaskSidebar
        selectedDate={selectedDate}
        events={events}
        onToggle={handleEventClick}
        onDelete={id => deleteMutation.mutate(id)}
      />
    </>
  )

  return (
    <div style={{
      position: 'fixed',
      left: isMobile ? 0 : 64,
      top: 0, right: 0,
      bottom: isMobile ? 'calc(60px + env(safe-area-inset-bottom, 0px))' : 0,
      background: '#0C0C11',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      padding: isMobile ? '12px 12px 12px' : '24px 28px 24px',
      gap: isMobile ? 10 : 20,
    }}>

      {/* ── Header ── */}
      {isMobile ? (
        /* ── Mobile header: two rows ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {/* Row 1: prev/title/next + sidebar toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={goPrev} style={{ ...navBtn, width: 32, padding: 0, flexShrink: 0 }} aria-label="Previous">
              <ChevronLeft size={16} />
            </button>
            <h1 style={{
              flex: 1, textAlign: 'center',
              fontSize: 15, fontWeight: 600, color: '#ECECF1',
              margin: 0, letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{title}</h1>
            <button onClick={goNext} style={{ ...navBtn, width: 32, padding: 0, flexShrink: 0 }} aria-label="Next">
              <ChevronRight size={16} />
            </button>
            {view !== 'week' && (
              <button
                onClick={() => setSidebarOpen(o => !o)}
                aria-label="Toggle sidebar"
                style={{
                  ...navBtn, width: 32, padding: 0, flexShrink: 0,
                  background: sidebarOpen ? '#1D1C38' : '#13131A',
                  color: sidebarOpen ? '#A5A3FF' : '#ECECF1',
                }}
              >
                <PanelRight size={16} />
              </button>
            )}
          </div>
          {/* Row 2: view switcher + today + add */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: '#111118', borderRadius: 10,
              border: '1px solid #1E1E29', padding: 3, flexShrink: 0,
            }}>
              {['month','week','day'].map(v => (
                <button key={v} onClick={() => switchView(v)} style={{
                  height: 26, padding: '0 10px', borderRadius: 7, border: 'none',
                  background: view === v ? '#6461F5' : 'transparent',
                  color: view === v ? '#fff' : '#8B8B9E',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.15s, color 0.15s',
                }}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={goToday} style={{ ...navBtn, flexShrink: 0 }}>Today</button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => openAddModal({ date: format(selectedDate, 'yyyy-MM-dd') })}
              style={{
                height: 34, width: 34, borderRadius: 10, border: 'none',
                background: '#6461F5',
                boxShadow: 'inset 0 0 0 1px #7B78FF',
                color: '#fff', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ) : (
        /* ── Desktop header: single row ── */
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#7A7A8E', marginBottom: 2, letterSpacing: '0.01em' }}>Calendar</div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: '#ECECF1', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={goPrev} style={{ ...navBtn, width: 32, padding: 0 }} aria-label="Previous"
              onMouseEnter={e => e.currentTarget.style.background = '#16161F'}
              onMouseLeave={e => e.currentTarget.style.background = '#13131A'}
            ><ChevronLeft size={16} /></button>
            <button onClick={goNext} style={{ ...navBtn, width: 32, padding: 0 }} aria-label="Next"
              onMouseEnter={e => e.currentTarget.style.background = '#16161F'}
              onMouseLeave={e => e.currentTarget.style.background = '#13131A'}
            ><ChevronRight size={16} /></button>
            <button onClick={goToday} style={navBtn}
              onMouseEnter={e => e.currentTarget.style.background = '#16161F'}
              onMouseLeave={e => e.currentTarget.style.background = '#13131A'}
            >Today</button>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#111118', borderRadius: 10,
            border: '1px solid #1E1E29', padding: 3, flexShrink: 0,
          }}>
            {['month','week','day'].map(v => (
              <button key={v} onClick={() => switchView(v)} style={{
                height: 28, padding: '0 12px', borderRadius: 7, border: 'none',
                background: view === v ? '#6461F5' : 'transparent',
                color: view === v ? '#fff' : '#8B8B9E',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s, color 0.15s', textTransform: 'capitalize',
              }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => openAddModal({ date: format(selectedDate, 'yyyy-MM-dd') })} style={{
            height: 38, padding: '0 16px', borderRadius: 10, border: 'none',
            background: '#6461F5',
            boxShadow: 'inset 0 0 0 1px #7B78FF, 0 0 16px rgba(100,97,245,0.25)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0, transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#7270FF'}
            onMouseLeave={e => e.currentTarget.style.background = '#6461F5'}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add task
          </button>
        </div>
      )}

      {/* ── Body: calendar + sidebar ── */}
      <div style={{ flex: 1, display: 'flex', gap: 20, overflow: 'hidden', minHeight: 0 }}>

        {isMobile && view === 'week' ? (
          /* ── Mobile week: strip + single day grid ── */
          <MobileWeekView
            currentDate={currentDate}
            selectedDate={selectedDate}
            onSelectDate={day => { setSelectedDate(day); setCurrentDate(day) }}
            onWeekChange={day => setCurrentDate(day)}
            events={events}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
            onOpenDayPopup={setPopupDay}
          />
        ) : (
          <>
            {/* Calendar panel */}
            <div style={{
              flex: 1, background: '#111118', border: '1px solid #1E1E29',
              borderRadius: 16, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', minWidth: 0,
            }}>
              {view === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  selectedDate={selectedDate}
                  onSelectDate={handleMonthSelectDate}
                  onEventClick={handleEventClick}
                  onDeleteEvent={id => deleteMutation.mutate(id)}
                  onSwitchToDay={handleDayHeaderClick}
                />
              )}
              {(view === 'week' || view === 'day') && visibleDays && (
                <TimeGrid
                  days={visibleDays}
                  events={events}
                  onSlotClick={handleSlotClick}
                  onEventClick={handleEventClick}
                  onDeleteEvent={id => deleteMutation.mutate(id)}
                  onDayHeaderClick={handleDayHeaderClick}
                  onOpenDayPopup={setPopupDay}
                />
              )}
            </div>

            {/* Right sidebar — desktop only */}
            {!isMobile && (
              <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
                {sidebarContent}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Mobile sidebar slide-over ── */}
      {isMobile && sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 80 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: '82vw', maxWidth: 300,
            background: '#111118', borderLeft: '1px solid #1E1E29',
            zIndex: 81, display: 'flex', flexDirection: 'column', gap: 16,
            padding: 16,
            paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
            overflowY: 'auto',
          }}>
            {sidebarContent}
          </div>
        </>
      )}

      {/* Modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalDefaults(null) }}
        onSubmit={handleCreate}
        modalTitle="New task"
        defaultValues={modalDefaults}
      />

      {/* Day detail popup / bottom sheet */}
      {popupDay && (
        <DayDetailPopup
          dayStr={popupDay}
          events={events}
          onClose={() => setPopupDay(null)}
          onEventClick={handleEventClick}
          onDeleteEvent={id => { deleteMutation.mutate(id) }}
          onSwitchToDay={day => { handleDayHeaderClick(day); setPopupDay(null) }}
        />
      )}
    </div>
  )
}
