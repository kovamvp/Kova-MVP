import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Gem, Home, Inbox, LayoutGrid, Search, Sprout, Users, UserRoundSearch } from 'lucide-react'
import { useApi } from '../lib/api'
import { Avatar } from '../ui'
import { signOut } from '../lib/session'
import SearchPalette from './SearchPalette'
import ProfileMenu from './ProfileMenu'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/prospects', label: 'Prospects', icon: UserRoundSearch },
  { to: '/meetings', label: 'Meetings', icon: CalendarDays },
  { to: '/studio', label: 'Studio', icon: LayoutGrid },
  { to: '/products', label: 'Products', icon: Gem },
  { to: '/growth', label: 'Growth', icon: Sprout },
  { to: '/requests', label: 'Requests', icon: Inbox },
]

export default function Shell({ onOut }: { onOut: () => void }) {
  const { data: rm } = useApi<any>('/s/rm')
  const [search, setSearch] = useState(false)
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [loc.pathname])
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <NavLink to="/" aria-label="Kova Work home"><img src="/wordmark.svg" alt="KOVA" /></NavLink>
          <span className="ws">Work</span>
        </div>
        <button className="searchbox" onClick={() => setSearch(true)}>
          <Search size={16} />
          <span>Search clients, prospects, products</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="right" ref={menuRef}>
          <span className="today">{today}</span>
          <button onClick={() => setMenu((m) => !m)} aria-label="Your profile and settings" aria-expanded={menu} style={{ borderRadius: '50%' }}>
            <Avatar name={rm?.name || 'Priya Sharma'} photo={rm?.photo} size={34} />
          </button>
          {menu && <ProfileMenu rm={rm} onClose={() => setMenu(false)} onOut={() => { signOut(); onOut(); nav('/') }} />}
        </div>
      </header>
      <Outlet />
      <nav className="dock-wrap" aria-label="Main">
        <div className="dock">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      {search && <SearchPalette onClose={() => setSearch(false)} />}
    </div>
  )
}

