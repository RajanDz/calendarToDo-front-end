import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Mail, User, AtSign, CheckCircle2, Clock, Flame, BarChart2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAllTasks, getUserProfileImg } from '../api/tasks'
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

export default function ProfilePage() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [avatarUrl, setAvatarUrl] = useState(null)

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
        <div>
          <p style={{ fontSize: 12, color: '#7A7A8E', margin: '0 0 4px' }}>Account</p>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, letterSpacing: '-0.025em', color: '#ECECF1', margin: 0 }}>
            Profile
          </h1>
        </div>

        {/* Main grid — single column on mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 16, alignItems: 'start' }}>

          {/* Left: avatar + info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              {/* Avatar */}
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

              {/* Info rows */}
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
    </div>
  )
}
