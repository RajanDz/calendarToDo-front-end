import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-[#0f0f13]">
      <Sidebar />
      <main className="flex-1 ml-16 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
