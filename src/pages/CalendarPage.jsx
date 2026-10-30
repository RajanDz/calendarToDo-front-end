import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import { format, parseISO } from 'date-fns'
import {
  getAllTasks,
  getTasksByDate,
  deleteTask,
  editTask,
  createTask,
  createRepeatedTask,
} from '../api/tasks'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import TaskPopover from '../components/tasks/TaskPopover'
import { useAuth } from '../context/AuthContext'
import { Plus, LayoutGrid, Columns2, CalendarDays } from 'lucide-react'

const VIEWS = [
  { key: 'dayGridMonth', label: 'Month', icon: LayoutGrid },
  { key: 'timeGridWeek', label: 'Week', icon: Columns2 },
  { key: 'timeGridDay', label: 'Day', icon: CalendarDays },
]

const statusColors = {
  done: '#10b981',
  'in progress': '#f59e0b',
  pending: '#6366f1',
}

export default function CalendarPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const calRef = useRef(null)

  const [activeView, setActiveView] = useState('timeGridWeek')
  const [selectedDate, setSelectedDate] = useState(null)
  const [popover, setPopover] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  const { data: allTasks = [] } = useQuery({
    queryKey: ['allTasks', user?.id],
    queryFn: () => getAllTasks(user.id).then((r) => r.data),
    enabled: !!user?.id,
  })

  const calendarEvents = allTasks.map((task) => ({
    id: String(task.id),
    title: task.name,
    start: `${task.dateOfStart}T${task.timeOfStart}`,
    end: `${task.dateOfEnd}T${task.timeOfEnd}`,
    backgroundColor: statusColors[task.status?.toLowerCase()] ?? '#6366f1',
    borderColor: 'transparent',
    extendedProps: { task },
  }))

  const { data: dayTasks = [], isLoading: loadingDay } = useQuery({
    queryKey: ['tasksByDate', selectedDate],
    queryFn: () =>
      getTasksByDate(selectedDate)
        .then((r) => r.data)
        .catch(() => []),
    enabled: !!selectedDate && activeView === 'dayGridMonth',
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['allTasks'] })
    qc.invalidateQueries({ queryKey: ['tasksByDate'] })
    qc.invalidateQueries({ queryKey: ['upcomingTask'] })
    qc.invalidateQueries({ queryKey: ['next7Days'] })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => { invalidate(); setPopover(null) },
  })

  const editMutation = useMutation({
    mutationFn: editTask,
    onSuccess: () => { invalidate(); setEditingTask(null) },
  })

  const createMutation = useMutation({
    mutationFn: ({ data, repeated }) =>
      repeated ? createRepeatedTask(data) : createTask(data),
    onSuccess: () => { invalidate(); setModalOpen(false) },
  })

  const switchView = (viewKey) => {
    setActiveView(viewKey)
    setSelectedDate(null)
    setPopover(null)
    calRef.current?.getApi().changeView(viewKey)
  }

  const handleDateClick = ({ dateStr }) => {
    if (activeView === 'dayGridMonth') {
      setSelectedDate(dateStr)
      setPopover(null)
    }
  }

  const handleEventClick = ({ event, jsEvent }) => {
    jsEvent.stopPropagation()
    const task = event.extendedProps.task
    const rect = jsEvent.target.closest('.fc-event').getBoundingClientRect()
    setPopover({ task, x: rect.left, y: rect.bottom + 8 })
  }

  const handleCreate = async (data) => {
    const payload = {
      name: data.name,
      description: data.description || '',
      dateOfStart: data.dateOfStart,
      timeOfStart: data.timeOfStart,
      dateOfEnd: data.repeated ? data.repeatUntil || data.dateOfEnd : data.dateOfEnd,
      timeOfEnd: data.timeOfEnd,
      status: data.status,
    }
    await createMutation.mutateAsync({ data: payload, repeated: data.repeated })
  }

  const handleEdit = async (data) => {
    await editMutation.mutateAsync({
      taskId: editingTask.id,
      name: data.name,
      description: data.description,
      dateOfStart: data.dateOfStart,
      timeOfStart: data.timeOfStart,
      dateOfEnd: data.dateOfEnd,
      timeOfEnd: data.timeOfEnd,
      status: data.status,
    })
  }

  const isMonthView = activeView === 'dayGridMonth'

  return (
    <div className="max-w-6xl mx-auto" onClick={() => setPopover(null)}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#f1f1f5]">Calendar</h1>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-1 gap-1">
            {VIEWS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => switchView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeView === key
                    ? 'bg-indigo-500 text-white'
                    : 'text-[#6b7280] hover:text-[#f1f1f5]'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setModalOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add task
          </button>
        </div>
      </div>

      {isMonthView ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl p-4">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="en-GB"
              events={calendarEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              height="auto"
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            />
          </div>

          <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl p-5">
            {selectedDate ? (
              <>
                <p className="text-sm font-semibold text-[#f1f1f5] mb-4">
                  {format(parseISO(selectedDate), 'MMMM d, yyyy')}
                </p>
                {loadingDay ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2].map((i) => <div key={i} className="h-16 bg-[#22222f] rounded-xl animate-pulse" />)}
                  </div>
                ) : dayTasks.length === 0 ? (
                  <p className="text-sm text-[#6b7280]">No tasks this day.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        onEdit={(t) => { setEditingTask(t); setSelectedDate(null) }}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full py-12">
                <p className="text-sm text-[#6b7280] text-center">Click a date to see its tasks</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl p-4">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale="en-GB"
            events={calendarEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            allDaySlot={false}
            nowIndicator={true}
            height={650}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          />
        </div>
      )}

      {popover && (
        <TaskPopover
          task={popover.task}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
          onEdit={(task) => { setPopover(null); setEditingTask(task) }}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        title="New task"
        defaultValues={selectedDate ? { dateOfStart: selectedDate, dateOfEnd: selectedDate } : undefined}
      />

      <TaskModal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleEdit}
        title="Edit task"
        defaultValues={editingTask ? {
          name: editingTask.name,
          description: editingTask.description,
          dateOfStart: editingTask.dateOfStart,
          timeOfStart: editingTask.timeOfStart?.substring(0, 5),
          dateOfEnd: editingTask.dateOfEnd,
          timeOfEnd: editingTask.timeOfEnd?.substring(0, 5),
          status: editingTask.status,
        } : null}
      />
    </div>
  )
}
