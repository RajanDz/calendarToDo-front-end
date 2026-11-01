import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { logout } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, CalendarDays, LogOut, CheckSquare } from 'lucide-react'
import api from '../../api/axios'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
]

const S = {
  rail: {
    position: 'fixed', left: 0, top: 0, bottom: 0, width: 64,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    paddingTop: 20, paddingBottom: 20,
    borderRight: '1px solid #1C1C26',
    background: '#0C0C11',
    zIndex: 50,
  },
  logo: {
    width: 36, height: 36, borderRadius: 10,
    background: '#6461F5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  nav: {
    display: 'flex', flexDirection: 'column', gap: 4,
    flex: 1, width: '100%', padding: '16px 12px 0',
  },
  logout: {
    width: '100%', height: 40, borderRadius: 10, border: 'none',
    background: 'transparent', color: '#6F6F82',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
  },
}

export default function Sidebar() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    api.get('/api/userProfileImg')
      .then(res => {
        const filename = (typeof res.data === 'string' ? res.data.trim() : '').replace(/^\//, '')
        if (filename) setAvatarUrl(`http://localhost:8080/uploads/${filename}`)
      })
      .catch(() => setAvatarUrl(null))
  }, [])

  const initials = [user?.firstname, user?.lastname]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('')

  const handleLogout = async () => {
    await logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <aside style={S.rail} aria-label="Main navigation">
      <div style={S.logo}>
        <CheckSquare size={18} color="#fff" />
      </div>

      <nav style={S.nav}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            title={label}
            aria-label={label}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: 40, borderRadius: 10,
              background: isActive ? '#1D1C38' : 'transparent',
              color: isActive ? '#A5A3FF' : '#6F6F82',
              textDecoration: 'none',
              transition: 'background 0.15s, color 0.15s',
            })}
          >
            <Icon size={20} />
          </NavLink>
        ))}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 12px' }}>
        {/* Profile avatar */}
        <NavLink
          to="/profile"
          title="Profile"
          aria-label="Profile"
          style={({ isActive }) => ({
            width: 40, height: 40, borderRadius: 12,
            border: `2px solid ${isActive ? '#6461F5' : '#2A2950'}`,
            overflow: 'hidden', flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#1D1C38', cursor: 'pointer', textDecoration: 'none',
            transition: 'border-color 0.15s',
          })}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#7C7AFF' }}>{initials || '?'}</span>
          )}
        </NavLink>

        <button
          onClick={handleLogout}
          title="Log out"
          aria-label="Log out"
          style={S.logout}
          onMouseEnter={e => { e.currentTarget.style.background = '#1a0d0d'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6F6F82' }}
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  )
}
