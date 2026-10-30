import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isToday, parseISO } from 'date-fns'
import {
  getUpcomingTask,
  getTasksByDate,
  getTasksForNext7Days,
  createTask,
  createRepeatedTask,
  deleteTask,
  editTask,
} from '../api/tasks'
import { useAuth } from '../context/AuthContext'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import { Plus, Clock, CalendarDays, Zap } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(today)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  const { data: upcoming } = useQuery({
    queryKey: ['upcomingTask'],
    queryFn: () => getUpcomingTask().then((r) => r.data),
    refetchInterval: 60000,
  })

  const { data: todayTasks = [], isLoading: loadingToday } = useQuery({
    queryKey: ['tasksByDate', selectedDate],
    queryFn: () =>
      getTasksByDate(selectedDate)
        .then((r) => r.data)
        .catch(() => []),
  })

  const { data: next7 = [] } = useQuery({
    queryKey: ['next7Days'],
    queryFn: () => getTasksForNext7Days().then((r) => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasksByDate'] })
    qc.invalidateQueries({ queryKey: ['next7Days'] })
    qc.invalidateQueries({ queryKey: ['upcomingTask'] })
  }

  const createMutation = useMutation({
    mutationFn: ({ data, repeated }) =>
      repeated ? createRepeatedTask(data) : createTask(data),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: invalidate,
  })

  const editMutation = useMutation({
    mutationFn: editTask,
    onSuccess: invalidate,
  })

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
    setEditingTask(null)
  }

  const openEdit = (task) => {
    setEditingTask(task)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const groupedNext7 = next7.reduce((acc, task) => {
    const d = task.dateOfStart
    if (!acc[d]) acc[d] = []
    acc[d].push(task)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#f1f1f5]">
          {greeting()}, {user?.firstname} 👋
        </h1>
        <p className="text-[#6b7280] text-sm mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-indigo-400" />
            <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Upcoming</span>
          </div>
          {upcoming ? (
            <>
              <p className="text-lg font-semibold text-[#f1f1f5] mt-2">{upcoming.name}</p>
              <p className="text-sm text-[#6b7280] mt-0.5">{upcoming.description}</p>
              <div className="flex items-center gap-1.5 mt-3 text-sm text-indigo-400">
                <Clock size={14} />
                <span>{upcoming.timeOfStart?.substring(0, 5)} — {upcoming.timeOfEnd?.substring(0, 5)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#6b7280] mt-3">No upcoming tasks for today.</p>
          )}
        </div>

        <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-indigo-400" />
            <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">This week</span>
          </div>
          <p className="text-3xl font-bold text-[#f1f1f5]">{next7.length}</p>
          <p className="text-sm text-[#6b7280] mt-0.5">tasks in the next 7 days</p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-[#f1f1f5]">Tasks</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#9ca3af] outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add task
          </button>
        </div>

        {loadingToday ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : todayTasks.length === 0 ? (
          <div className="text-center py-12 bg-[#1a1a24] border border-[#2a2a3a] border-dashed rounded-2xl">
            <p className="text-[#6b7280] text-sm">No tasks for this day.</p>
            <button onClick={() => setModalOpen(true)} className="mt-2 text-indigo-400 text-sm hover:text-indigo-300 transition-colors">
              Add one +
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDelete={(id) => deleteMutation.mutate(id)}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </div>

      {Object.keys(groupedNext7).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-[#f1f1f5] mb-4">Next 7 days</h2>
          <div className="flex flex-col gap-4">
            {Object.entries(groupedNext7).sort(([a], [b]) => a.localeCompare(b)).map(([date, tasks]) => (
              <div key={date}>
                <p className="text-xs text-[#6b7280] mb-2 font-medium">
                  {format(parseISO(date), 'EEEE, MMM d')}
                </p>
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        title="New task"
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
