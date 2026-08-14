import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, UserCheck, Bus, MapPin,
  CreditCard, ClipboardList, Bell, BarChart3, LogOut, Wifi, WifiOff,
  UtensilsCrossed, Scan, CalendarDays, BookOpen, Menu, Printer
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ConnectionStatus from './ConnectionStatus'
import { subscribe as subscribeOffline } from '../lib/offlineManager'

const getNavBuses = (alertCount = 0) => [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/estudiantes',  icon: Users,           label: 'Estudiantes' },
  { to: '/supervisores', icon: UserCheck,       label: 'Supervisores' },
  { to: '/buses',        icon: Bus,             label: 'Buses' },
  { to: '/recorridos',   icon: MapPin,          label: 'Recorridos' },
  { to: '/credenciales', icon: CreditCard,      label: 'Credenciales NFC' },
  { to: '/imprimir-qr',  icon: Printer,         label: 'Imprimir QR' },
  { to: '/asistencia',   icon: ClipboardList,   label: 'Asistencia Buses' },
  { to: '/alertas',      icon: Bell,            label: 'Alertas', badge: alertCount, badgeType: 'danger' },
  { to: '/reportes',     icon: BarChart3,       label: 'Reportes Buses' },
  { to: '/usuarios',     icon: Users,           label: 'Usuarios' },
]

const navComedor = [
  { to: '/comedor/dashboard', icon: LayoutDashboard, label: 'Dashboard Comedor' },
  { to: '/comedor/kiosko',    icon: Scan,          label: 'Comedor' },
  { to: '/comedor/asistencia',icon: ClipboardList,  label: 'Asistencia' },
  { to: '/comedor/semanal',   icon: CalendarDays,   label: 'Control Semanal' },
  { to: '/comedor/reportes',  icon: BarChart3,      label: 'Reportes' },
]

const PAGE_META = {
  '/dashboard':           { title: 'Dashboard',             desc: 'Resumen general del sistema' },
  '/estudiantes':         { title: 'Estudiantes',           desc: 'Gestión de estudiantes y autorizaciones' },
  '/supervisores':        { title: 'Supervisores',          desc: 'Gestión del personal de supervisión' },
  '/buses':               { title: 'Buses',                 desc: 'Estado y asignación de buses' },
  '/recorridos':          { title: 'Recorridos',            desc: 'Rutas y horarios de transporte' },
  '/credenciales':        { title: 'Credenciales NFC',      desc: 'Registro y asignación de tarjetas NTAG213' },
  '/imprimir-qr':         { title: 'Imprimir Credenciales QR', desc: 'Generación masiva de credenciales QR' },
  '/asistencia':          { title: 'Asistencia Buses',      desc: 'Historial de registros — Módulo Buses' },
  '/alertas':             { title: 'Alertas',               desc: 'Intentos no autorizados y buses incorrectos' },
  '/reportes':            { title: 'Reportes Buses',        desc: 'Exportación y estadísticas del módulo buses' },
  '/usuarios':            { title: 'Gestión de Usuarios',   desc: 'Administración de accesos y roles' },
  '/comedor/dashboard':   { title: 'Dashboard Comedor',     desc: 'Resumen en vivo del uso del comedor' },
  '/comedor/kiosko':      { title: 'Comedor',                desc: 'Lectura NFC de asistencia al comedor en tiempo real' },
  '/comedor/asistencia':  { title: 'Asistencia Comedor',    desc: 'Historial de registros — Módulo Comedor' },
  '/comedor/semanal':     { title: 'Control Semanal',       desc: 'Vista semanal de asistencia al almuerzo y desayuno' },
  '/comedor/reportes':    { title: 'Reportes Comedor',      desc: 'Estadísticas y exportación del módulo comedor' },
}

export default function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [alertCount, setAlertCount] = useState(0)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [offlineStatus, setOfflineStatus] = useState({ online: navigator.onLine, syncing: false, pendingCount: 0 })

  useEffect(() => {
    return subscribeOffline(setOfflineStatus)
  }, [])
  
  const meta = PAGE_META[pathname] ?? { title: '', desc: '' }
  const now = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const isComedor = pathname.startsWith('/comedor')
  const navBuses = getNavBuses(alertCount)

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    supabase.from('alertas_buses').select('id', { count: 'exact', head: true }).eq('estado', 'NUEVA')
      .then(({ count }) => { if (count != null) setAlertCount(count) })
  }, [pathname])

  const displayName = profile?.nombre ?? user?.email?.split('@')[0] ?? 'Usuario'
  const displayRole = profile?.cargo ?? 'Administrador'
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const isAdmin = displayRole === 'Administrador'

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout">
      {/* Backdrop for mobile sidebar */}
      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Bus size={20} strokeWidth={2.5} />
          </div>
          <div className="sidebar-logo-text">
            <h1>LiceoControl NFC</h1>
            <span>Panel Administrador</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdmin && (
            <>
              {/* ── Módulo Buses ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 8px 6px' }}>
                <Bus size={12} style={{ color: 'var(--primary)' }} />
                <span className="nav-section-label" style={{ padding: 0 }}>Módulo Buses</span>
              </div>
              {navBuses.slice(0, 1).map(item => <NavItem key={item.to} {...item} />)}

              <span className="nav-section-label">Gestión</span>
              {navBuses.slice(1, 6).map(item => <NavItem key={item.to} {...item} />)}

              <span className="nav-section-label">Operación</span>
              {navBuses.slice(6, 9).map(item => <NavItem key={item.to} {...item} />)}

              <span className="nav-section-label">Sistema</span>
              {navBuses.slice(9).map(item => <NavItem key={item.to} {...item} />)}

              {/* ── Separador ── */}
              <div style={{ margin: '12px 0', height: 1, background: 'var(--border)' }} />
            </>
          )}

          {/* ── Módulo Comedor ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 6px' }}>
            <UtensilsCrossed size={12} style={{ color: 'var(--warning)' }} />
            <span className="nav-section-label" style={{ padding: 0 }}>Módulo Comedor</span>
          </div>
          {navComedor.map(item => <NavItem key={item.to} {...item} />)}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="name">{displayName}</div>
              <div className="role">{displayRole}</div>
            </div>
            <LogOut size={15} style={{ color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }} onClick={handleLogout} title="Cerrar sesión" />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                {isComedor && <UtensilsCrossed size={18} style={{ color: 'var(--warning)' }} />}
                {meta.title}
              </h2>
              <p style={{ margin: 0 }}>{meta.desc}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="d-flex gap-1" style={{ fontSize: 12, color: offlineStatus.online ? 'var(--success)' : 'var(--danger)', background: offlineStatus.online ? 'var(--success-bg)' : 'var(--danger-bg)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${offlineStatus.online ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {offlineStatus.online ? <Wifi size={13} /> : <WifiOff size={13} />}
              {offlineStatus.online ? 'Conectado' : 'Sin conexión'}
              {offlineStatus.pendingCount > 0 && <span style={{ marginLeft: 4, fontWeight: 700 }}>({offlineStatus.pendingCount} pendientes)</span>}
            </div>
            <div className="topbar-date">{now}</div>
          </div>
        </header>

        <main className="page-content fade-in">
          <Outlet />
        </main>
      </div>
      <ConnectionStatus />
    </div>
  )
}

function NavItem({ to, icon: Icon, label, badge, badgeType }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <Icon size={17} />
      {label}
      {badge > 0 && <span className={`nav-item-badge ${badgeType}`}>{badge}</span>}
    </NavLink>
  )
}
