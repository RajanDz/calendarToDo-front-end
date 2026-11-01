import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useIsMobile } from '../../hooks/useIsMobile'

export default function AppLayout() {
  const isMobile = useIsMobile()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0C0C11' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: isMobile ? 0 : 64,
        overflowY: 'auto',
        minHeight: '100vh',
        // leave room for the fixed bottom nav on mobile
        paddingBottom: isMobile
          ? 'calc(60px + env(safe-area-inset-bottom, 0px))'
          : 0,
      }}>
        <Outlet />
      </main>
      {isMobile && <BottomNav />}
    </div>
  )
}
