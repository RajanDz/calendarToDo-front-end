import { useEffect, useRef } from 'react'
import { Clock, Pencil, Trash2, X } from 'lucide-react'

const statusColors = {
  done: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'in progress': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  pending: 'text-[#9ca3af] bg-[#2a2a3a] border-[#2a2a3a]',
}

export default function TaskPopover({ task, x, y, onClose, onEdit, onDelete }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const vw = window.innerWidth
    const vh = window.innerHeight + window.scrollY
    const rect = el.getBoundingClientRect()

    if (x + rect.width > vw - 16) {
      el.style.left = `${vw - rect.width - 16}px`
    } else {
      el.style.left = `${x}px`
    }
    if (y + rect.height > vh - 16) {
      el.style.top = `${y - rect.height - 48}px`
    } else {
      el.style.top = `${y}px`
    }
    el.style.opacity = '1'
  }, [x, y])

  const statusKey = task.status?.toLowerCase() ?? 'pending'
  const statusClass = statusColors[statusKey] ?? statusColors['pending']

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', opacity: 0, zIndex: 9999, left: x, top: y }}
      className="w-72 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl shadow-2xl p-4 transition-opacity"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-[#f1f1f5] text-sm leading-snug">{task.name}</h3>
        <button onClick={onClose} className="p-0.5 text-[#6b7280] hover:text-[#f1f1f5] transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">{task.description}</p>
      )}

      <div className="flex items-center gap-1.5 text-xs text-[#6b7280] mb-3">
        <Clock size={12} />
        <span>
          {task.timeOfStart?.substring(0, 5)} — {task.timeOfEnd?.substring(0, 5)}
        </span>
        <span className="text-[#2a2a3a]">·</span>
        <span>{task.dateOfStart}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusClass}`}>
          {task.status}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-lg text-[#6b7280] hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => { onDelete(task.id); onClose() }}
            className="p-1.5 rounded-lg text-[#6b7280] hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
