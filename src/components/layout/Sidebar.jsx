import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, CalendarDays, LogOut, CheckSquare } from 'lucide-react'

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
  logoutWrap: { padding: '0 12px' },
  logout: {
    width: '100%', height: 40, borderRadius: 10, border: 'none',
    background: 'transparent', color: '#6F6F82',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
  },
}

export default function Sidebar() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

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

      <div style={S.logoutWrap}>
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
