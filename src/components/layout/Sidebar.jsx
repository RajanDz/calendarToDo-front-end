import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  CalendarDays,
  LogOut,
  CheckSquare,
} from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
]

export default function Sidebar() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-16 flex flex-col items-center py-6 gap-6 border-r border-[#2a2a3a] bg-[#1a1a24] z-50">
      <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
        <CheckSquare size={18} className="text-white" />
      </div>

      <nav className="flex flex-col gap-1 flex-1 w-full px-2 mt-4">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            title={label}
            className={({ isActive }) =>
              `flex items-center justify-center w-full h-10 rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-[#6b7280] hover:bg-[#22222f] hover:text-[#f1f1f5]'
              }`
            }
          >
            <Icon size={20} />
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        title="Logout"
        className="flex items-center justify-center w-10 h-10 rounded-lg text-[#6b7280] hover:bg-red-500/10 hover:text-red-400 transition-colors"
      >
        <LogOut size={20} />
      </button>
    </aside>
  )
}
