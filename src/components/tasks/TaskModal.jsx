import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'

export default function TaskModal({ open, onClose, onSubmit, defaultValues, title }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()

  useEffect(() => {
    if (open) {
      reset(defaultValues ?? {
        name: '',
        description: '',
        dateOfStart: '',
        timeOfStart: '',
        dateOfEnd: '',
        timeOfEnd: '',
        status: 'pending',
        repeated: false,
        repeatUntil: '',
      })
    }
  }, [open, defaultValues, reset])

  if (!open) return null

  const isEdit = !!defaultValues

  const submit = async (data) => {
    await onSubmit(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#f1f1f5]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#22222f] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Task name *</label>
            <input
              {...register('name', { required: 'Name is required' })}
              className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. Team standup"
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="Optional notes..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#6b7280] mb-1.5">Start date *</label>
              <input
                type="date"
                {...register('dateOfStart', { required: true })}
                className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#6b7280] mb-1.5">Start time *</label>
              <input
                type="time"
                {...register('timeOfStart', { required: true })}
                className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#6b7280] mb-1.5">End date *</label>
              <input
                type="date"
                {...register('dateOfEnd', { required: true })}
                className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#6b7280] mb-1.5">End time *</label>
              <input
                type="time"
                {...register('timeOfEnd', { required: true })}
                className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Status</label>
            <select
              {...register('status')}
              className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="pending">Pending</option>
              <option value="in progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          {!isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="repeated"
                {...register('repeated')}
                className="w-4 h-4 rounded accent-indigo-500"
              />
              <label htmlFor="repeated" className="text-sm text-[#9ca3af]">Repeat weekly</label>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#2a2a3a] text-sm text-[#9ca3af] hover:bg-[#22222f] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
