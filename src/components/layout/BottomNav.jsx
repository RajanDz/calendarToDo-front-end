import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, User } from 'lucide-react'

const TABS = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: CalendarDays,    label: 'Calendar'  },
  { to: '/profile',  icon: User,            label: 'Profile'   },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: '#0C0C11',
      borderTop: '1px solid #1C1C26',
      display: 'flex',
      zIndex: 300,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end style={{ flex: 1, textDecoration: 'none' }}>
          {({ isActive }) => (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3,
              padding: '10px 0 8px',
              color: isActive ? '#A5A3FF' : '#5C5C70',
              transition: 'color 0.15s',
            }}>
              <div style={{
                width: 44, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? '#1D1C38' : 'transparent',
                transition: 'background 0.15s',
              }}>
                <Icon size={20} />
              </div>
              <span style={{
                fontSize: 10, fontWeight: 500,
                letterSpacing: '0.04em', lineHeight: 1,
              }}>
                {label}
              </span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
