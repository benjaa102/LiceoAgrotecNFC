import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
// ─ Módulo Buses ───────────────────────────────────────────────────────────────
import Dashboard       from './pages/Dashboard'
import Estudiantes     from './pages/Estudiantes'
import Supervisores    from './pages/Supervisores'
import Buses           from './pages/Buses'
import Recorridos      from './pages/Recorridos'
import CredencialesNFC from './pages/CredencialesNFC'
import Asistencia      from './pages/Asistencia'
import Alertas         from './pages/Alertas'
import Reportes        from './pages/Reportes'
import Usuarios        from './pages/Usuarios'
// ─ Módulo Comedor ─────────────────────────────────────────────────────────────
import DashboardComedor  from './pages/comedor/DashboardComedor'
import CocinaKiosko      from './pages/comedor/CocinaKiosko'
import AsistenciaComedor from './pages/comedor/AsistenciaComedor'
import ControlSemanal    from './pages/comedor/ControlSemanal'
import ReportesComedor   from './pages/comedor/ReportesComedor'

const AppRoutes = () => {
  const { profile } = useAuth()
  const isAdmin = profile?.cargo === 'Administrador'

  return (
    <Routes>
        {/* Login público */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to={isAdmin ? "/dashboard" : "/comedor/dashboard"} replace />} />
          {/* Buses */}
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/estudiantes"  element={<Estudiantes />} />
          <Route path="/supervisores" element={<Supervisores />} />
          <Route path="/buses"        element={<Buses />} />
          <Route path="/recorridos"   element={<Recorridos />} />
          <Route path="/credenciales" element={<CredencialesNFC />} />
          <Route path="/asistencia"   element={<Asistencia />} />
          <Route path="/alertas"      element={<Alertas />} />
          <Route path="/reportes"     element={<Reportes />} />
          <Route path="/usuarios"     element={<Usuarios />} />
          {/* Comedor */}
          <Route path="/comedor/dashboard"  element={<DashboardComedor />} />
          <Route path="/comedor/kiosko"     element={<CocinaKiosko />} />
          <Route path="/comedor/asistencia" element={<AsistenciaComedor />} />
          <Route path="/comedor/semanal"    element={<ControlSemanal />} />
          <Route path="/comedor/reportes"   element={<ReportesComedor />} />
        </Route>

        {/* Fallback: redirigir al login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
