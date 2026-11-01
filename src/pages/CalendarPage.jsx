import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format, startOfWeek, endOfWeek, startOfMonth,
  eachDayOfInterval, addDays, addWeeks, addMonths, subWeeks, subMonths,
  isSameDay, isSameMonth, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { getAllTasks, createTask, editTask, deleteTask, createRepeatedTask } from '../api/tasks'
import TaskModal from '../components/tasks/TaskModal'
import { useAuth } from '../context/AuthContext'

// ─── Design tokens ──────────────────────────────────────────────────────────
const ROW_H = 56      // px per hour
const GUTTER = 60     // px for time-label gutter
const WK_START = 0    // 0 = Sunday

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

// ─── EventBlock (time-grid) ──────────────────────────────────────────────────
function EventBlock({ ev, onClick, onDelete }) {
  const c = PALETTE[ev.color] || PALETTE.indigo
  const startMin = parseMin(ev.start)
  const endMin   = parseMin(ev.end)
  const durMin   = Math.max(endMin - startMin, 20)
  const top    = (startMin / 60) * ROW_H + 2
  const height = Math.max((durMin / 60) * ROW_H - 4, (20 / 60) * ROW_H)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(ev) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', top, left: 4, right: 4, height,
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

// ─── TimeGrid (Week / Day) ───────────────────────────────────────────────────
function TimeGrid({ days, events, onSlotClick, onEventClick, onDeleteEvent, onDayHeaderClick }) {
  const scrollRef = useRef(null)
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${GUTTER}px repeat(${days.length}, minmax(0,1fr))`,
        borderBottom: '1px solid #1A1A24', flexShrink: 0,
      }}>
        <div />
        {days.map(day => {
          const isTdy = isToday(day)
          const dayStr = format(day, 'yyyy-MM-dd')
          return (
            <div
              key={dayStr}
              onClick={() => isWeek && onDayHeaderClick(day)}
              style={{
                padding: '10px 0', textAlign: 'center',
                borderLeft: '1px solid #1A1A24',
                cursor: isWeek ? 'pointer' : 'default',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: '#5C5C70', textTransform: 'uppercase', marginBottom: 4 }}>
                {format(day, 'EEE')}
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: 6, margin: '0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isTdy ? '#6461F5' : 'transparent',
                color: isTdy ? '#fff' : '#ECECF1',
                fontSize: 14, fontWeight: 600,
              }}>
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{
          height: 24 * ROW_H,
          display: 'grid',
          gridTemplateColumns: `${GUTTER}px repeat(${days.length}, minmax(0,1fr))`,
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
                {dayEvts.map(ev => (
                  <EventBlock key={ev.id} ev={ev} onClick={onEventClick} onDelete={onDeleteEvent} />
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

  const [view, setView]               = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [miniDate, setMiniDate]       = useState(new Date())
  const [modalOpen, setModalOpen]     = useState(false)
  const [modalDefaults, setModalDefaults] = useState(null)
  const [taskColors, setTaskColors]   = useState(loadColors)

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

  // Navigation
  const goNext = () => {
    if (view === 'month') setCurrentDate(d => addMonths(d, 1))
    else if (view === 'week') setCurrentDate(d => addWeeks(d, 1))
    else setCurrentDate(d => addDays(d, 1))
  }
  const goPrev = () => {
    if (view === 'month') setCurrentDate(d => subMonths(d, 1))
    else if (view === 'week') setCurrentDate(d => subWeeks(d, 1))
    else setCurrentDate(d => addDays(d, -1))
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
    ? getWeekDays(currentDate)
    : view === 'day'
      ? [currentDate]
      : null

  const title = headerTitle(view, currentDate)

  // Button styles
  const navBtn = {
    height: 32, padding: '0 10px', borderRadius: 8,
    border: '1px solid #23232F', background: '#13131A',
    color: '#ECECF1', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  }

  return (
    <div style={{
      position: 'fixed', left: 64, top: 0, right: 0, bottom: 0,
      background: '#0C0C11',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 24px',
      gap: 20,
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        {/* Left: label + title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#7A7A8E', marginBottom: 2, letterSpacing: '0.01em' }}>Calendar</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#ECECF1', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </h1>
        </div>

        {/* Nav: prev / next / today */}
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

        {/* View switcher */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#111118', borderRadius: 10,
          border: '1px solid #1E1E29', padding: 3,
          flexShrink: 0,
        }}>
          {['month','week','day'].map(v => (
            <button
              key={v}
              onClick={() => switchView(v)}
              style={{
                height: 28, padding: '0 12px', borderRadius: 7, border: 'none',
                background: view === v ? '#6461F5' : 'transparent',
                color: view === v ? '#fff' : '#8B8B9E',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s, color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Add task */}
        <button
          onClick={() => openAddModal()}
          style={{
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

      {/* ── Body: calendar + sidebar ── */}
      <div style={{ flex: 1, display: 'flex', gap: 20, overflow: 'hidden', minHeight: 0 }}>
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
            />
          )}
        </div>

        {/* Right sidebar */}
        <div style={{
          width: 280, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 16,
          overflow: 'hidden',
        }}>
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
        </div>
      </div>

      {/* Modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalDefaults(null) }}
        onSubmit={handleCreate}
        modalTitle="New task"
        defaultValues={modalDefaults}
      />
    </div>
  )
}
