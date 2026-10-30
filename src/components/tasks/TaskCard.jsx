import { format } from 'date-fns'
import { Clock, Trash2, Pencil } from 'lucide-react'

const statusColors = {
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'in progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  pending: 'bg-[#2a2a3a] text-[#9ca3af] border-[#2a2a3a]',
}

export default function TaskCard({ task, onDelete, onEdit }) {
  const statusKey = task.status?.toLowerCase() ?? 'pending'
  const statusClass = statusColors[statusKey] ?? statusColors['pending']

  const startTime = task.timeOfStart?.substring(0, 5)
  const endTime = task.timeOfEnd?.substring(0, 5)

  return (
    <div className="group bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4 hover:border-indigo-500/40 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[#f1f1f5] truncate">{task.name}</h3>
          {task.description && (
            <p className="text-sm text-[#6b7280] mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-[#6b7280]">
            <Clock size={12} />
            <span>{startTime} — {endTime}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusClass} capitalize`}>
            {task.status}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
