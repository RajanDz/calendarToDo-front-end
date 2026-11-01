import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isToday, parseISO, startOfWeek, addDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Plus, Check, Flag, SlidersHorizontal, Trash2 } from 'lucide-react'
import { getAllTasks, createTask, editTask, deleteTask } from '../api/tasks'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/tasks/TaskModal'
import { useIsMobile } from '../hooks/useIsMobile'

// ─── Color / category palette ─────────────────────────────────────────────────

const PALETTE = {
  indigo:  { bg: '#1F1E44', border: '#34327A', text: '#CFCEFF', dot: '#7C7AFF', name: 'Faculty' },
  emerald: { bg: '#102B24', border: '#1D5040', text: '#A6ECD0', dot: '#34D399', name: 'Health' },
  amber:   { bg: '#2E2410', border: '#584418', text: '#F7D999', dot: '#F5B83D', name: 'Personal' },
  rose:    { bg: '#341624', border: '#5E2539', text: '#FFBFD0', dot: '#FB7199', name: 'Deadline' },
  sky:     { bg: '#0E2836', border: '#1A4860', text: '#B0E2FA', dot: '#38BDF8', name: 'Lectures' },
}

function getStoredColors() {
  try { return JSON.parse(localStorage.getItem('calTaskColors') || '{}') } catch { return {} }
}
function getTaskColor(id) {
  return getStoredColors()[String(id)] || 'indigo'
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getGreeting(name) {
  const h = new Date().getHours()
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${g}, ${name}` : g
}

function timeToMin(t) {
  if (!t) return null
  const [h, m] = t.substring(0, 5).split(':').map(Number)
  return h * 60 + m
}

function parseQuickAdd(text) {
  const rx = /\b(\d{1,2})[:.h](\d{2})\b/
  const m = text.match(rx)
  if (!m) return { title: text.trim(), start: null, end: null }
  const h = +m[1], min = +m[2]
  if (h > 23 || min > 59) return { title: text.trim(), start: null, end: null }
  const start = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  const em = (h * 60 + min + 60) % 1440
  const end = `${String(Math.floor(em / 60)).padStart(2, '0')}:${String(em % 60).padStart(2, '0')}`
  return { title: text.replace(rx, '').replace(/\s+/g, ' ').trim(), start, end }
}

function fmtDuration(startMin, endMin) {
  const d = endMin - startMin
  if (d <= 0) return ''
  const h = Math.floor(d / 60), m = d % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}

function calcStreak(tasks) {
  const byDate = {}
  tasks.forEach(t => { (byDate[t.dateOfStart] ??= []).push(t) })
  let streak = 0
  const d = new Date()
  d.setDate(d.getDate() - 1)
  for (let i = 0; i < 365; i++) {
    const key = format(d, 'yyyy-MM-dd')
    const day = byDate[key]
    if (!day?.length || !day.every(t => t.status === 'done')) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function isAnytime(t) {
  return !t.timeOfStart || t.timeOfStart === '00:00:00' || t.timeOfStart === '00:00'
}

// ─── Shared card shell ────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{ background: '#111118', border: '1px solid #1E1E29', borderRadius: 16, padding: 18, ...style }}>
      {children}
    </div>
  )
}

// ─── Day card (week strip) ────────────────────────────────────────────────────

function DayCard({ date, tasks, selected, onClick }) {
  const isT = isToday(parseISO(date))
  const done = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const pct = total ? (done / total) * 100 : 0
  return (
    <button
      onClick={onClick}
      aria-label={`${isT ? 'Today' : format(parseISO(date), 'EEEE')} ${format(parseISO(date), 'MMM d')}`}
      style={{
        background: selected ? '#1D1C38' : '#111118',
        border: `1px solid ${selected ? '#6461F5' : '#1E1E29'}`,
        borderRadius: 12, padding: '12px 12px 10px',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = '#34327A' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = '#1E1E29' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: selected ? '#A5A3FF' : '#6F6F82' }}>
          {isT ? 'Today' : format(parseISO(date), 'EEE')}
        </span>
        <span style={{ fontSize: 11, color: '#6F6F82', fontFamily: 'Geist Mono, monospace' }}>
          {total ? `${done}/${total}` : '–'}
        </span>
      </div>
      <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1, color: selected ? '#ECECF1' : '#9E9EAF' }}>
        {format(parseISO(date), 'd')}
      </span>
      <div style={{ height: 4, borderRadius: 2, background: selected ? '#2A2950' : '#1A1A24' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: selected ? '#7C7AFF' : '#4A4890', transition: 'width 0.3s' }} />
      </div>
    </button>
  )
}

// ─── Up-next hero card ────────────────────────────────────────────────────────

function UpNextCard({ task, countdown, color, onMarkDone }) {
  const pal = PALETTE[color] || PALETTE.indigo
  const isMobile = useIsMobile()
  return (
    <div style={{ background: '#111118', border: '1px solid #1E1E29', borderRadius: 16, overflow: 'hidden', display: 'flex' }}>
      <div style={{ width: 4, background: pal.dot, flexShrink: 0 }} />
      <div style={{ padding: 18, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A5A3FF' }}>
            {countdown.label}
          </span>
          {countdown.pill && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: countdown.running ? pal.bg : '#1A1A28',
              border: `1px solid ${countdown.running ? pal.border : '#2A2A3A'}`,
              color: countdown.running ? pal.text : '#8B8B9E',
              fontFamily: 'Geist Mono, monospace',
            }}>{countdown.pill}</span>
          )}
        </div>
        {/* Stack vertically on mobile */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, color: '#ECECF1', margin: '0 0 6px' }}>{task.name}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#8B8B9E', fontFamily: 'Geist Mono, monospace' }}>
                {task.timeOfStart?.substring(0, 5)} – {task.timeOfEnd?.substring(0, 5)}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: pal.dot, display: 'inline-block' }} />
              <span style={{ fontSize: 13, color: '#6F6F82' }}>{pal.name}</span>
            </div>
          </div>
          <button
            onClick={onMarkDone}
            aria-label="Mark done"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 12px',
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'center' : 'flex-start',
              borderRadius: 8, background: '#1A1A28', border: '1px solid #2A2A3A',
              color: '#8B8B9E', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0, transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#34D399'; e.currentTarget.style.color = '#34D399' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A3A'; e.currentTarget.style.color = '#8B8B9E' }}
          >
            <Check size={14} />
            Mark done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDelete }) {
  const pal = PALETTE[getTaskColor(task.id)] || PALETTE.indigo
  const done = task.status === 'done'
  const hasTime = !isAnytime(task)
  const isMobile = useIsMobile()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', borderRadius: 10, transition: 'background 0.12s', background: hovered ? '#16161F' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => onToggle(task)}
        aria-label={`Toggle ${task.name}`}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
          padding: '10px 8px', borderRadius: 10, border: 'none',
          background: 'transparent', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          border: `1.5px solid ${pal.dot}`, background: done ? pal.dot : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}>
          {done && <Check size={11} color="#0C0C11" strokeWidth={3} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 13.5, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: done ? '#6F6F82' : '#ECECF1',
            textDecoration: done ? 'line-through' : 'none',
            transition: 'color 0.15s',
          }}>{task.name}</span>
          {/* Time shown as sub-label on mobile instead of separate column */}
          {isMobile && hasTime && (
            <span style={{ fontSize: 11, color: '#6F6F82', fontFamily: 'Geist Mono, monospace' }}>
              {task.timeOfStart?.substring(0, 5)} – {task.timeOfEnd?.substring(0, 5)}
            </span>
          )}
        </div>
        {task.urgent && !done && <Flag size={13} color="#FB7199" />}
        {/* Category badge — hidden on mobile to save space */}
        {!isMobile && (
          <span style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
            background: pal.bg, color: pal.text,
          }}>{pal.name}</span>
        )}
        {/* Time column — desktop only */}
        {!isMobile && (
          <span style={{
            width: 92, textAlign: 'right', flexShrink: 0,
            fontSize: 12, color: '#6F6F82', fontFamily: 'Geist Mono, monospace',
          }}>
            {hasTime ? `${task.timeOfStart?.substring(0, 5)} – ${task.timeOfEnd?.substring(0, 5)}` : 'Anytime'}
          </span>
        )}
      </button>
      {/* Delete — always visible on mobile (no hover on touch), hover-only on desktop */}
      <button
        onClick={() => onDelete(task.id)}
        aria-label={`Delete ${task.name}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 7, border: 'none',
          background: 'transparent', cursor: 'pointer', flexShrink: 0,
          marginRight: 4, color: '#5C5C70',
          opacity: isMobile ? 1 : (hovered ? 1 : 0),
          transition: 'opacity 0.15s, color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FB7199'; e.currentTarget.style.background = '#2A1520' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#5C5C70'; e.currentTarget.style.background = 'transparent' }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── Task list card ───────────────────────────────────────────────────────────

function TaskListCard({ title, done, total, scheduled, anytime, onToggle, onDelete }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#ECECF1', margin: 0 }}>{title}</p>
        <span style={{ fontSize: 12, color: '#6F6F82', fontFamily: 'Geist Mono, monospace' }}>
          {done}/{total} done
        </span>
      </div>
      {total === 0 ? (
        <div style={{ border: '1px dashed #2A2A3A', borderRadius: 10, padding: '24px 0', textAlign: 'center', color: '#5C5C70', fontSize: 13 }}>
          Nothing planned. Add a task above.
        </div>
      ) : (
        <>
          {scheduled.length > 0 && (
            <div style={{ marginBottom: anytime.length > 0 ? 10 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#5C5C70', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px 8px' }}>
                Scheduled
              </p>
              {scheduled.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />)}
            </div>
          )}
          {anytime.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#5C5C70', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px 8px' }}>
                Anytime
              </p>
              {anytime.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />)}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ─── Progress card ────────────────────────────────────────────────────────────

function ProgressCard({ done, total, streak }) {
  const r = 34, sw = 7
  const circ = 2 * Math.PI * r
  const pct = total ? done / total : 0
  const offset = circ * (1 - pct)
  const label = total ? `${Math.round(pct * 100)}%` : '–'

  return (
    <Card>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#ECECF1', margin: '0 0 14px' }}>Progress</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="76" height="76" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden="true">
          <circle cx="38" cy="38" r={r} fill="none" stroke="#1D1C38" strokeWidth={sw} />
          {total > 0 && (
            <circle cx="38" cy="38" r={r} fill="none" stroke="#6461F5" strokeWidth={sw}
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.4s' }} />
          )}
          <text x="38" y="38" textAnchor="middle" dominantBaseline="central"
            fill="#ECECF1" fontSize="13" fontWeight="600" fontFamily="Geist, sans-serif"
            style={{ transform: 'rotate(90deg)', transformOrigin: '38px 38px' }}>
            {label}
          </text>
        </svg>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#ECECF1', margin: '0 0 4px' }}>
            {total ? `${done} of ${total} done today` : 'No tasks today'}
          </p>
          <p style={{ fontSize: 12, color: '#6F6F82', margin: 0 }}>
            {streak > 0 ? `${streak}-day streak of finished days` : 'Finish today to start a streak'}
          </p>
        </div>
      </div>
    </Card>
  )
}

// ─── Schedule card ────────────────────────────────────────────────────────────

function ScheduleCard({ tasks, now }) {
  const navigate = useNavigate()
  const sorted = [...tasks].sort((a, b) => (a.timeOfStart || '').localeCompare(b.timeOfStart || ''))
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#ECECF1', margin: 0 }}>Schedule</p>
        <button onClick={() => navigate('/calendar')} style={{ background: 'none', border: 'none', color: '#6461F5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          View week
        </button>
      </div>
      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: '#5C5C70', margin: 0 }}>No scheduled tasks today.</p>
      ) : (
        <div>
          {sorted.map((task, i) => {
            const pal = PALETTE[getTaskColor(task.id)] || PALETTE.indigo
            const done = task.status === 'done'
            const sMin = timeToMin(task.timeOfStart)
            const eMin = timeToMin(task.timeOfEnd)
            const isLive = sMin != null && eMin != null && nowMin >= sMin && nowMin < eMin
            const isPast = eMin != null && nowMin >= eMin
            const dimmed = (isPast || done) && !isLive
            const isLast = i === sorted.length - 1

            return (
              <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '44px 14px 1fr', columnGap: 8, opacity: dimmed ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ textAlign: 'right', paddingTop: 2 }}>
                  <span style={{ fontSize: 12, fontFamily: 'Geist Mono, monospace', color: isLive ? pal.dot : '#6F6F82', fontWeight: isLive ? 600 : 400 }}>
                    {task.timeOfStart?.substring(0, 5)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                    background: isLive || done ? pal.dot : 'transparent',
                    border: `2px solid ${pal.dot}`,
                    boxShadow: isLive ? `0 0 0 3px ${pal.bg}` : 'none',
                  }} />
                  {!isLast && <div style={{ width: 1.5, flex: 1, background: '#1F1F2A', margin: '3px 0 0' }} />}
                </div>
                <div style={{ paddingBottom: isLast ? 0 : 14, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#ECECF1', margin: '0 0 2px', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.name}
                  </p>
                  <p style={{ fontSize: 11.5, color: '#6F6F82', margin: 0 }}>
                    {sMin != null && eMin != null ? `${fmtDuration(sMin, eMin)} · ` : ''}{pal.name}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isMobile = useIsMobile()

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const weekStripRef = useRef(null)
  const [quickAdd, setQuickAdd] = useState('')
  const [qaFocused, setQaFocused] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaults, setModalDefaults] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const { data: allTasks = [] } = useQuery({
    queryKey: ['allTasks', user?.id],
    queryFn: () => getAllTasks(user.id).then(r => r.data),
    enabled: !!user?.id,
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['allTasks'] })
    qc.invalidateQueries({ queryKey: ['tasksByDate'] })
    qc.invalidateQueries({ queryKey: ['upcomingTask'] })
    qc.invalidateQueries({ queryKey: ['next7Days'] })
  }, [qc])

  const createMut = useMutation({ mutationFn: createTask, onSuccess: invalidate })
  const editMut = useMutation({ mutationFn: editTask, onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: deleteTask, onSuccess: invalidate })

  // Week days (Mon–Sun of current week)
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
  }, [])

  useEffect(() => {
    if (!isMobile || !weekStripRef.current) return
    const todayIdx = weekDays.indexOf(todayStr)
    if (todayIdx < 0) return
    const el = weekStripRef.current
    const cardW = 76 + 8
    el.scrollLeft = Math.max(0, todayIdx * cardW - el.clientWidth / 2 + 38)
  }, [isMobile, weekDays, todayStr])

  const tasksByDay = useMemo(() => {
    const map = Object.fromEntries(weekDays.map(d => [d, []]))
    allTasks.forEach(t => { if (map[t.dateOfStart] !== undefined) map[t.dateOfStart].push(t) })
    return map
  }, [allTasks, weekDays])

  const selectedTasks = useMemo(() => allTasks.filter(t => t.dateOfStart === selectedDate), [allTasks, selectedDate])
  const scheduledTasks = useMemo(() =>
    selectedTasks.filter(t => !isAnytime(t)).sort((a, b) => a.timeOfStart.localeCompare(b.timeOfStart)),
    [selectedTasks])
  const anytimeTasks = useMemo(() => selectedTasks.filter(isAnytime), [selectedTasks])

  const todayTasks = useMemo(() => allTasks.filter(t => t.dateOfStart === todayStr), [allTasks, todayStr])
  const todayDone = todayTasks.filter(t => t.status === 'done').length

  const upNextTask = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return allTasks
      .filter(t => t.dateOfStart === todayStr && t.status !== 'done' && t.timeOfEnd && !isAnytime(t))
      .filter(t => timeToMin(t.timeOfEnd) > nowMin)
      .sort((a, b) => (a.timeOfStart || '').localeCompare(b.timeOfStart || ''))[0] ?? null
  }, [allTasks, todayStr, now])

  const upNextCountdown = useMemo(() => {
    if (!upNextTask) return null
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const sMin = timeToMin(upNextTask.timeOfStart)
    const eMin = timeToMin(upNextTask.timeOfEnd)
    if (sMin != null && nowMin >= sMin && nowMin < eMin) {
      const rem = eMin - nowMin
      return { label: 'HAPPENING NOW', pill: `ends in ${rem}m`, running: true }
    }
    const diff = sMin - nowMin
    if (diff <= 0) return null
    const pill = diff < 60 ? `in ${diff}m` : diff % 60 ? `in ${Math.floor(diff / 60)}h ${diff % 60}m` : `in ${diff / 60}h`
    return { label: 'UP NEXT', pill, running: false }
  }, [upNextTask, now])

  const streak = useMemo(() => calcStreak(allTasks), [allTasks])

  const summaryLine = useMemo(() => {
    if (!todayTasks.length) return 'Nothing planned for today'
    const rem = todayTasks.filter(t => t.status !== 'done').length
    return rem === 0 ? 'Everything for today is done' : `${rem} of ${todayTasks.length} tasks left today`
  }, [todayTasks])

  const handleToggle = useCallback(async (task) => {
    await editMut.mutateAsync({
      taskId: task.id,
      name: task.name,
      description: task.description || '',
      dateOfStart: task.dateOfStart,
      timeOfStart: task.timeOfStart,
      dateOfEnd: task.dateOfEnd,
      timeOfEnd: task.timeOfEnd,
      status: task.status === 'done' ? 'pending' : 'done',
    })
  }, [editMut])

  const handleQuickAdd = useCallback(async () => {
    const trimmed = quickAdd.trim()
    if (!trimmed) return
    const { title, start, end } = parseQuickAdd(trimmed)
    if (!title) return
    const h = now.getHours()
    const ds = `${String(h).padStart(2, '0')}:00`
    const de = `${String((h + 1) % 24).padStart(2, '0')}:00`
    await createMut.mutateAsync({
      name: title,
      description: '',
      dateOfStart: selectedDate,
      timeOfStart: start || ds,
      dateOfEnd: selectedDate,
      timeOfEnd: end || de,
      status: 'pending',
    })
    setQuickAdd('')
  }, [quickAdd, selectedDate, now, createMut])

  const handleCreate = useCallback(async (data) => {
    await createMut.mutateAsync({
      name: data.name,
      description: '',
      dateOfStart: data.dateOfStart || data.date,
      timeOfStart: data.timeOfStart,
      dateOfEnd: data.dateOfEnd || data.date,
      timeOfEnd: data.timeOfEnd,
      status: 'pending',
    })
    setModalOpen(false)
    setModalDefaults(null)
    setQuickAdd('')
  }, [createMut])

  const handleEdit = useCallback(async (data) => {
    if (!editingTask) return
    await editMut.mutateAsync({
      taskId: editingTask.id,
      name: data.name,
      description: editingTask.description || '',
      dateOfStart: data.dateOfStart || data.date,
      timeOfStart: data.timeOfStart,
      dateOfEnd: data.dateOfEnd || data.date,
      timeOfEnd: data.timeOfEnd,
      status: editingTask.status,
    })
    setEditingTask(null)
  }, [editingTask, editMut])

  const selectedIsToday = selectedDate === todayStr
  const selectedLabel = selectedIsToday ? "Today's tasks" : format(parseISO(selectedDate), 'EEEE, MMM d')
  const selectedDone = selectedTasks.filter(t => t.status === 'done').length
  const qaPlaceholder = `Add a task to ${selectedIsToday ? 'today' : format(parseISO(selectedDate), 'EEEE')}, e.g. Training 19:00`

  return (
    <>
      <style>{`
        @media (max-width: 1079px) { .dash-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ minHeight: '100vh', padding: isMobile ? '16px 16px 24px' : '28px 32px 40px', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 22 }}>

          {/* 1. Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: '#7A7A8E', margin: '0 0 4px' }}>
                {format(new Date(), 'EEEE, MMMM d')}
              </p>
              <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, letterSpacing: '-0.025em', color: '#ECECF1', margin: '0 0 5px' }}>
                {getGreeting(user?.firstname)}
              </h1>
              <p style={{ fontSize: 13.5, color: '#8B8B9E', margin: 0 }}>{summaryLine}</p>
            </div>
            {/* Calendar shortcut — hidden on mobile (use bottom nav tab) */}
            {!isMobile && (
              <button
                onClick={() => navigate('/calendar')}
                aria-label="Open calendar"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
                  height: 38, padding: '0 14px', borderRadius: 10,
                  background: '#13131A', border: '1px solid #23232F',
                  color: '#8B8B9E', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6461F5'; e.currentTarget.style.color = '#ECECF1' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#23232F'; e.currentTarget.style.color = '#8B8B9E' }}
              >
                <CalendarDays size={14} />
                Open calendar
              </button>
            )}
          </div>

          {/* 2. Quick add bar */}
          <div style={{
            height: 52, borderRadius: 14,
            background: '#111118', border: `1px solid ${qaFocused ? '#6461F5' : '#1E1E29'}`,
            display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, padding: isMobile ? '0 10px 0 12px' : '0 14px 0 16px',
            transition: 'border-color 0.15s',
          }}>
            <Plus size={18} color="#7C7AFF" strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <input
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onFocus={() => setQaFocused(true)}
              onBlur={() => setQaFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd() }}
              placeholder={isMobile ? 'Add a task…' : qaPlaceholder}
              aria-label="Quick add task"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#ECECF1', fontSize: isMobile ? 14 : 14.5, fontFamily: 'inherit', minWidth: 0,
              }}
            />
            {/* Enter hint — desktop only */}
            {!isMobile && (
              <span style={{
                fontSize: 11, color: '#5C5C70', border: '1px solid #2A2A3A',
                borderRadius: 5, padding: '2px 6px', fontFamily: 'Geist Mono, monospace',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>Enter</span>
            )}
            {/* More options — desktop only */}
            {!isMobile && (
              <button
                onClick={() => {
                  const name = quickAdd.trim()
                  const h = now.getHours()
                  setModalDefaults({
                    name,
                    date: selectedDate,
                    timeOfStart: `${String(h).padStart(2, '0')}:00`,
                    timeOfEnd: `${String((h + 1) % 24).padStart(2, '0')}:00`,
                  })
                  setModalOpen(true)
                }}
                aria-label="More options"
                title="Set time, label & more"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: 'transparent', border: '1px solid #2A2A3A',
                  color: '#6F6F82', cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6461F5'; e.currentTarget.style.color = '#A5A3FF'; e.currentTarget.style.background = '#1A1A2E' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A3A'; e.currentTarget.style.color = '#6F6F82'; e.currentTarget.style.background = 'transparent' }}
              >
                <SlidersHorizontal size={14} />
              </button>
            )}
            {/* On mobile: options icon opens modal directly */}
            {isMobile && (
              <button
                onClick={() => {
                  const name = quickAdd.trim()
                  const h = now.getHours()
                  setModalDefaults({
                    name,
                    date: selectedDate,
                    timeOfStart: `${String(h).padStart(2, '0')}:00`,
                    timeOfEnd: `${String((h + 1) % 24).padStart(2, '0')}:00`,
                  })
                  setModalOpen(true)
                }}
                aria-label="More options"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: 'transparent', border: 'none',
                  color: '#6F6F82', cursor: 'pointer',
                }}
              >
                <SlidersHorizontal size={16} />
              </button>
            )}
            <button
              onClick={handleQuickAdd}
              disabled={!quickAdd.trim()}
              aria-label="Add task"
              style={{
                height: 34, padding: isMobile ? '0 12px' : '0 14px', borderRadius: 8, flexShrink: 0,
                background: '#6461F5', border: 'none', boxShadow: 'inset 0 0 0 1px #7B78FF',
                color: '#fff', fontSize: 13.5, fontWeight: 600,
                cursor: quickAdd.trim() ? 'pointer' : 'not-allowed',
                opacity: quickAdd.trim() ? 1 : 0.5,
                fontFamily: 'inherit', transition: 'opacity 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (quickAdd.trim()) e.currentTarget.style.background = '#7270FF' }}
              onMouseLeave={e => e.currentTarget.style.background = '#6461F5'}
            >
              {isMobile ? <Plus size={16} /> : 'Add task'}
            </button>
          </div>

          {/* 3. Week strip — horizontal scroll on mobile, 7-col grid on desktop */}
          {isMobile ? (
            <div ref={weekStripRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {weekDays.map(d => (
                <div key={d} style={{ minWidth: 76, flexShrink: 0 }}>
                  <DayCard
                    date={d}
                    tasks={tasksByDay[d] || []}
                    selected={selectedDate === d}
                    onClick={() => setSelectedDate(d)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
              {weekDays.map(d => (
                <DayCard
                  key={d}
                  date={d}
                  tasks={tasksByDay[d] || []}
                  selected={selectedDate === d}
                  onClick={() => setSelectedDate(d)}
                />
              ))}
            </div>
          )}

          {/* 4. Content grid */}
          <div
            className="dash-grid"
            style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(300px, 1fr)', gap: 16 }}
          >
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {upNextTask && upNextCountdown && (
                <UpNextCard
                  task={upNextTask}
                  countdown={upNextCountdown}
                  color={getTaskColor(upNextTask.id)}
                  onMarkDone={() => handleToggle(upNextTask)}
                />
              )}
              <TaskListCard
                title={selectedLabel}
                done={selectedDone}
                total={selectedTasks.length}
                scheduled={scheduledTasks}
                anytime={anytimeTasks}
                onToggle={handleToggle}
                onDelete={id => deleteMut.mutate(id)}
              />
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <ProgressCard done={todayDone} total={todayTasks.length} streak={streak} />
              <ScheduleCard
                tasks={todayTasks.filter(t => !isAnytime(t))}
                now={now}
              />
            </div>
          </div>

        </div>
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalDefaults(null) }}
        onSubmit={handleCreate}
        modalTitle="New task"
        defaultValues={modalDefaults}
      />
      <TaskModal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleEdit}
        modalTitle="Edit task"
        defaultValues={editingTask ? {
          name: editingTask.name,
          date: editingTask.dateOfStart,
          timeOfStart: editingTask.timeOfStart?.substring(0, 5),
          timeOfEnd: editingTask.timeOfEnd?.substring(0, 5),
          status: editingTask.status,
        } : null}
      />
    </>
  )
}
