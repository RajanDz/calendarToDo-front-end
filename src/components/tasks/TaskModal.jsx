import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'

const COLORS = {
  indigo:  { dot: '#7C7AFF', ring: '#6461F5' },
  emerald: { dot: '#34D399', ring: '#10b981' },
  amber:   { dot: '#F5B83D', ring: '#f59e0b' },
  rose:    { dot: '#FB7199', ring: '#fb7185' },
  sky:     { dot: '#38BDF8', ring: '#0ea5e9' },
}
const COLOR_KEYS = Object.keys(COLORS)

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(5,5,10,.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  card: {
    position: 'relative',
    background: '#14141C', borderRadius: 18,
    border: '1px solid #262633',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    width: '100%', maxWidth: 420,
    margin: '0 16px',
    padding: 24,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontSize: 16, fontWeight: 600, color: '#ECECF1' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 8, border: 'none',
    background: 'transparent', color: '#6F6F82',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background 0.15s',
  },
  label: { display: 'block', fontSize: 11, color: '#6F6F82', marginBottom: 6 },
  input: {
    width: '100%', height: 44, padding: '0 12px',
    background: '#1C1C28', border: '1px solid #262633',
    borderRadius: 10, color: '#ECECF1', fontSize: 14,
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  smallInput: {
    width: '100%', height: 36, padding: '0 10px',
    background: '#1C1C28', border: '1px solid #262633',
    borderRadius: 10, color: '#ECECF1', fontSize: 13,
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  row: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10, marginBottom: 16 },
  swatches: { display: 'flex', gap: 10, alignItems: 'center' },
  cancelBtn: {
    flex: 1, height: 38, borderRadius: 10,
    border: '1px solid #262633', background: 'transparent',
    color: '#8B8B9E', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  saveBtn: (disabled) => ({
    flex: 1, height: 38, borderRadius: 10,
    border: 'none', background: '#6461F5',
    boxShadow: 'inset 0 0 0 1px #7B78FF, 0 0 0 0 transparent',
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s, background 0.15s',
  }),
}

export default function TaskModal({ open, onClose, onSubmit, defaultValues, modalTitle = 'New task' }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm()
  const [color, setColor] = useState(defaultValues?.color || 'indigo')
  const title = watch('name', '')

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10)
      const nowH = new Date().getHours()
      const startTime = `${String(nowH).padStart(2,'0')}:00`
      const endTime = `${String((nowH + 1) % 24).padStart(2,'0')}:00`

      reset(defaultValues ?? {
        name: '',
        date: today,
        timeOfStart: startTime,
        timeOfEnd: endTime,
        repeated: false,
      })
      setColor(defaultValues?.color || 'indigo')
    }
  }, [open, defaultValues, reset])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isEdit = !!defaultValues?.name

  const submit = async (data) => {
    const date = data.date
    let endTime = data.timeOfEnd
    if (endTime <= data.timeOfStart) {
      const [h, m] = data.timeOfStart.split(':').map(Number)
      const endMin = (h * 60 + m + 60) % (24 * 60)
      endTime = `${String(Math.floor(endMin / 60)).padStart(2,'0')}:${String(endMin % 60).padStart(2,'0')}`
    }
    await onSubmit({
      ...data,
      dateOfStart: date,
      dateOfEnd: date,
      timeOfStart: data.timeOfStart,
      timeOfEnd: endTime,
      status: defaultValues?.status || 'pending',
      color,
    })
  }

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={modalTitle}>
        <div style={S.header}>
          <span style={S.title}>{modalTitle}</span>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close"
            onMouseEnter={e => e.currentTarget.style.background = '#1B1B25'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)}>
          {/* Task name */}
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Task name</label>
            <input
              {...register('name', { required: true })}
              placeholder="e.g. Team standup"
              style={S.input}
              onFocus={e => e.currentTarget.style.borderColor = '#6461F5'}
              onBlur={e => e.currentTarget.style.borderColor = '#262633'}
              autoFocus
            />
          </div>

          {/* Date / Start / End */}
          <div style={S.row}>
            <div>
              <label style={S.label}>Date</label>
              <input type="date" {...register('date', { required: true })} style={S.smallInput}
                onFocus={e => e.currentTarget.style.borderColor = '#6461F5'}
                onBlur={e => e.currentTarget.style.borderColor = '#262633'}
              />
            </div>
            <div>
              <label style={S.label}>Start</label>
              <input type="time" {...register('timeOfStart', { required: true })} style={S.smallInput}
                onFocus={e => e.currentTarget.style.borderColor = '#6461F5'}
                onBlur={e => e.currentTarget.style.borderColor = '#262633'}
              />
            </div>
            <div>
              <label style={S.label}>End</label>
              <input type="time" {...register('timeOfEnd', { required: true })} style={S.smallInput}
                onFocus={e => e.currentTarget.style.borderColor = '#6461F5'}
                onBlur={e => e.currentTarget.style.borderColor = '#262633'}
              />
            </div>
          </div>

          {/* Color swatches */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Color</label>
            <div style={S.swatches}>
              {COLOR_KEYS.map(key => {
                const c = COLORS[key]
                const active = color === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    aria-label={key}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: c.dot,
                      border: 'none', cursor: 'pointer', padding: 0,
                      outline: active ? `2px solid ${c.ring}` : 'none',
                      outlineOffset: active ? 3 : 0,
                      boxShadow: active ? `0 0 0 5px #14141C` : 'none',
                      transition: 'outline 0.1s, box-shadow 0.1s',
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Repeat (create only) */}
          {!isEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input type="checkbox" id="repeated" {...register('repeated')}
                style={{ width: 16, height: 16, accentColor: '#6461F5', cursor: 'pointer' }} />
              <label htmlFor="repeated" style={{ fontSize: 13, color: '#8B8B9E', cursor: 'pointer' }}>Repeat weekly</label>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={S.cancelBtn} onClick={onClose}
              onMouseEnter={e => e.currentTarget.style.background = '#16161F'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Cancel</button>
            <button type="submit" disabled={isSubmitting || !title.trim()} style={S.saveBtn(isSubmitting || !title.trim())}
              onMouseEnter={e => { if (!isSubmitting && title.trim()) e.currentTarget.style.background = '#7270FF' }}
              onMouseLeave={e => e.currentTarget.style.background = '#6461F5'}
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
