import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Mail, User, AtSign, CheckCircle2, Clock, Flame, BarChart2, Pencil, X, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAllTasks, editUserDetails } from '../api/tasks'
import api from '../api/axios'
import { useIsMobile } from '../hooks/useIsMobile'

function Card({ children, style }) {
  return (
    <div style={{
      background: '#111118', border: '1px solid #1E1E29',
      borderRadius: 16, padding: 24, ...style,
    }}>
      {children}
    </div>
  )
}

function StatItem({ icon: Icon, label, value, color = '#7C7AFF' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#ECECF1', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6F6F82', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #1A1A24' }}>
      <Icon size={16} color="#6F6F82" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#5C5C70', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: '#ECECF1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  )
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

const inputStyle = {
  width: '100%', height: 44, padding: '0 12px',
  background: '#1C1C28', border: '1px solid #262633',
  borderRadius: 10, color: '#ECECF1', fontSize: 14,
  outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function EditProfileModal({ open, onClose, user, currentAvatarUrl, onSaved }) {
  const isMobile = useIsMobile()
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(currentAvatarUrl)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ firstname: '', lastname: '', username: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({
        firstname: user?.firstname ?? '',
        lastname: user?.lastname ?? '',
        username: user?.username ?? '',
      })
      setPreview(currentAvatarUrl)
      setFile(null)
      setError('')
    }
  }, [open, user, currentAvatarUrl])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const initials = [user?.firstname, user?.lastname]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('')

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.firstname.trim() || !form.username.trim()) {
      setError('First name and username are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('firstname', form.firstname.trim())
      fd.append('lastname', form.lastname.trim())
      fd.append('username', form.username.trim())
      if (file) fd.append('profilePicture', file)
      const res = await editUserDetails(fd)
      onSaved(res.data, file ? preview : undefined)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const cardStyle = isMobile
    ? {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#14141C', borderRadius: '18px 18px 0 0',
        border: '1px solid #262633', borderBottom: 'none',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        padding: '0 20px 0',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        maxHeight: '90vh', overflowY: 'auto',
      }
    : {
        position: 'relative',
        background: '#14141C', borderRadius: 18,
        border: '1px solid #262633',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        width: '100%', maxWidth: 440,
        margin: '0 16px',
        padding: 28,
      }

  const backdropStyle = {
    position: 'fixed', inset: 0, zIndex: 200,
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    background: 'rgba(5,5,10,.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit profile">
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2E2E3E' }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: isMobile ? 8 : 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#ECECF1' }}>Edit profile</span>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: '#6F6F82', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1B1B25'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Avatar picker */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: preview ? 'transparent' : '#1D1C38',
              border: '3px solid #2A2950',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {preview
                ? <img src={preview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 24, fontWeight: 600, color: '#7C7AFF' }}>{initials || '?'}</span>
              }
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: '50%',
                background: '#6461F5', border: '2px solid #14141C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Camera size={12} color="#fff" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ fontSize: 12, color: '#7C7AFF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Change photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>

        <form onSubmit={handleSubmit} style={{ paddingBottom: isMobile ? 16 : 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#6F6F82', marginBottom: 6 }}>First name</label>
              <input
                value={form.firstname}
                onChange={e => setForm(f => ({ ...f, firstname: e.target.value }))}
                placeholder="First name"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#6461F5'}
                onBlur={e => e.currentTarget.style.borderColor = '#262633'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#6F6F82', marginBottom: 6 }}>Last name</label>
              <input
                value={form.lastname}
                onChange={e => setForm(f => ({ ...f, lastname: e.target.value }))}
                placeholder="Last name"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#6461F5'}
                onBlur={e => e.currentTarget.style.borderColor = '#262633'}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6F6F82', marginBottom: 6 }}>Username</label>
            <input
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="username"
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = '#6461F5'}
              onBlur={e => e.currentTarget.style.borderColor = '#262633'}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 14, padding: '8px 12px', background: '#1a0d0d', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid #262633', background: 'transparent', color: '#8B8B9E', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.background = '#16161F'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.firstname.trim() || !form.username.trim()}
              style={{
                flex: 1, height: 40, borderRadius: 10, border: 'none',
                background: '#6461F5', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: (saving || !form.firstname.trim() || !form.username.trim()) ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#7270FF' }}
              onMouseLeave={e => e.currentTarget.style.background = '#6461F5'}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const isMobile = useIsMobile()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [editing, setEditing] = useState(false)

  const { data: allTasks = [] } = useQuery({
    queryKey: ['allTasks', user?.id],
    queryFn: () => getAllTasks(user.id).then(r => r.data),
    enabled: !!user?.id,
  })

  useEffect(() => {
    api.get('/api/userProfileImg')
      .then(res => {
        const filename = (typeof res.data === 'string' ? res.data.trim() : '').replace(/^\//, '')
        if (filename) setAvatarUrl(`http://localhost:8080/uploads/${filename}`)
      })
      .catch(() => setAvatarUrl(null))
  }, [])

  const handleSaved = (updatedUser, newAvatarPreview) => {
    setUser(prev => ({ ...prev, ...updatedUser }))
    if (newAvatarPreview) {
      // Re-fetch the actual server URL after a short delay for the upload to settle
      setTimeout(() => {
        api.get('/api/userProfileImg')
          .then(res => {
            const filename = (typeof res.data === 'string' ? res.data.trim() : '').replace(/^\//, '')
            if (filename) setAvatarUrl(`http://localhost:8080/uploads/${filename}?t=${Date.now()}`)
          })
          .catch(() => {})
      }, 300)
    }
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(t => t.status === 'done').length
  const todayTasks = allTasks.filter(t => t.dateOfStart === todayStr)
  const todayDone = todayTasks.filter(t => t.status === 'done').length
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0
  const streak = calcStreak(allTasks)

  const initials = [user?.firstname, user?.lastname]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('')

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? '16px 16px 24px' : '28px 32px 40px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 22 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, color: '#7A7A8E', margin: '0 0 4px' }}>Account</p>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, letterSpacing: '-0.025em', color: '#ECECF1', margin: 0 }}>
              Profile
            </h1>
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 36, padding: '0 14px', borderRadius: 10,
              border: '1px solid #262633', background: '#1C1C28',
              color: '#ECECF1', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#24243A'}
            onMouseLeave={e => e.currentTarget.style.background = '#1C1C28'}
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 16, alignItems: 'start' }}>

          {/* Left: avatar + info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 24, borderBottom: '1px solid #1A1A24', marginBottom: 20 }}>
                <div style={{
                  width: 96, height: 96, borderRadius: '50%', marginBottom: 16,
                  background: avatarUrl ? 'transparent' : '#1D1C38',
                  border: '3px solid #2A2950',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 28, fontWeight: 600, color: '#7C7AFF' }}>{initials || '?'}</span>
                  )}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#ECECF1', margin: '0 0 4px', textAlign: 'center' }}>
                  {user?.firstname} {user?.lastname}
                </h2>
                <span style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 20,
                  background: '#1D1C38', border: '1px solid #34327A', color: '#A5A3FF',
                }}>
                  @{user?.username}
                </span>
              </div>

              <div>
                <InfoRow icon={User} label="Full name" value={`${user?.firstname ?? ''} ${user?.lastname ?? ''}`.trim() || '—'} />
                <InfoRow icon={AtSign} label="Username" value={user?.username ?? '—'} />
                <InfoRow icon={Mail} label="Email" value={user?.email ?? '—'} />
              </div>
            </Card>
          </div>

          {/* Right: stats */}
          <Card>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#ECECF1', margin: '0 0 20px' }}>Activity</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <StatItem icon={BarChart2}    label="Total tasks created"     value={totalTasks}       color="#7C7AFF" />
              <StatItem icon={CheckCircle2} label="Tasks completed"         value={completedTasks}   color="#34D399" />
              <StatItem icon={Clock}        label="Completed today"         value={`${todayDone} / ${todayTasks.length || 0}`} color="#38BDF8" />
              <StatItem icon={Flame}        label="Day streak"              value={streak > 0 ? `${streak}d` : '—'} color="#F5B83D" />
              <div style={{ padding: '16px 0 0', borderTop: '1px solid #1A1A24' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#8B8B9E' }}>Overall completion</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ECECF1', fontFamily: 'Geist Mono, monospace' }}>{completionRate}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#1D1C38' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: `${completionRate}%`,
                    background: 'linear-gradient(90deg, #6461F5, #7C7AFF)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>

      <EditProfileModal
        open={editing}
        onClose={() => setEditing(false)}
        user={user}
        currentAvatarUrl={avatarUrl}
        onSaved={handleSaved}
      />
    </div>
  )
}
