import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import PublicProfile from './pages/PublicProfile'
// ─ Módulo Buses ───────────────────────────────────────────────────────────────
import Dashboard       from './pages/Dashboard'
import Estudiantes     from './pages/Estudiantes'
import Supervisores    from './pages/Supervisores'
import Buses           from './pages/Buses'
import Recorridos      from './pages/Recorridos'
import CredencialesNFC from './pages/CredencialesNFC'
import ImprimirCredenciales from './pages/ImprimirCredenciales'
import Asistencia      from './pages/Asistencia'
import Alertas         from './pages/Alertas'
import Reportes        from './pages/Reportes'
import Usuarios        from './pages/Usuarios'
import BusesKiosko     from './pages/BusesKiosko'
import PerfilEstudiante from './pages/PerfilEstudiante'
// ─ Módulo Comedor ─────────────────────────────────────────────────────────────
import DashboardComedor  from './pages/comedor/DashboardComedor'
import CocinaKiosko      from './pages/comedor/CocinaKiosko'
import AsistenciaComedor from './pages/comedor/AsistenciaComedor'
import ControlSemanal    from './pages/comedor/ControlSemanal'
import ReportesComedor   from './pages/comedor/ReportesComedor'
// ─ Módulo Salas ───────────────────────────────────────────────────────────────
import Docentes          from './pages/salas/Docentes'
import SalasKiosko       from './pages/salas/SalasKiosko'
import AsistenciaSalas   from './pages/salas/AsistenciaSalas'
import Salas             from './pages/salas/Salas'

const AppRoutes = () => {
  const { profile } = useAuth()
  const isComedorRole = profile?.cargo === 'Encargado Comedor'
  const isBusRole = profile?.cargo === 'Encargado Bus'
  const isSalasRole = profile?.cargo === 'Encargado Salas'

  return (
    <Routes>
        {/* Rutas Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/perfil/:id" element={<PublicProfile />} />

        {/* Rutas protegidas */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to={isComedorRole ? "/comedor/dashboard" : (isBusRole ? "/asistencia" : (isSalasRole ? "/salas/kiosko" : "/dashboard"))} replace />} />
          {/* Buses */}
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/estudiantes"  element={<Estudiantes />} />
          <Route path="/estudiante/:id" element={<PerfilEstudiante />} />
          <Route path="/supervisores" element={<Supervisores />} />
          <Route path="/buses"        element={<Buses />} />
          <Route path="/recorridos"   element={<Recorridos />} />
          <Route path="/credenciales" element={<CredencialesNFC />} />
          <Route path="/imprimir-qr"  element={<ImprimirCredenciales />} />
          <Route path="/asistencia"   element={<Asistencia />} />
          <Route path="/buses/kiosko" element={<BusesKiosko />} />
          <Route path="/alertas"      element={<Alertas />} />
          <Route path="/reportes"     element={<Reportes />} />
          <Route path="/salas/kiosko" element={<SalasKiosko />} />
          <Route path="/salas/asistencia" element={<AsistenciaSalas />} />
          <Route path="/salas/docentes" element={<Docentes />} />
          <Route path="/salas/gestion-salas" element={<Salas />} />
          <Route path="/usuarios"     element={<Usuarios />} />
          {/* Comedor */}
          <Route path="/comedor/dashboard"  element={<DashboardComedor />} />
          <Route path="/comedor/kiosko"     element={<CocinaKiosko />} />
          <Route path="/comedor/asistencia" element={<AsistenciaComedor />} />
          <Route path="/comedor/semanal"    element={<ControlSemanal />} />
          <Route path="/comedor/reportes"   element={<ReportesComedor />} />
          {/* Salas */}
          <Route path="/salas/docentes"     element={<Docentes />} />
          <Route path="/salas/kiosko"       element={<SalasKiosko />} />
          <Route path="/salas/asistencia"   element={<AsistenciaSalas />} />
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
