import { useState, useEffect } from 'react'
import { Users, UserCheck, Bus, Bell, CreditCard, TrendingUp, AlertTriangle, Wifi, UtensilsCrossed, Coffee } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'

// Gráfico de prueba mientras no tengamos registros de asistencia reales
const mockChartData = [
  { dia: 'Lun', presentes: 410, ausentes: 18, rechazos: 2 },
  { dia: 'Mar', presentes: 425, ausentes: 12, rechazos: 0 },
  { dia: 'Mié', presentes: 418, ausentes: 15, rechazos: 3 },
  { dia: 'Jue', presentes: 430, ausentes: 8,  rechazos: 1 },
  { dia: 'Vie', presentes: 405, ausentes: 25, rechazos: 4 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEstudiantes: 0,
    totalSupervisores: 0,
    totalBuses: 0,
    credencialesActivas: 0,
    presentesHoy: 0,
    alertasNuevas: 0,
    pendienteSync: 0,
    rechazosHoy: 0
  })
  
  const [buses, setBuses] = useState([])
  const [recorridos, setRecorridos] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const { count: cEst } = await supabase.from('estudiantes').select('*', { count: 'exact', head: true })
      const { count: cSup } = await supabase.from('supervisores').select('*', { count: 'exact', head: true })
      const { count: cBus } = await supabase.from('buses').select('*', { count: 'exact', head: true })
      const { count: cCred } = await supabase.from('credenciales').select('*', { count: 'exact', head: true }).eq('estado', 'ACTIVA')
      
      const [resBuses, resRec, resSup] = await Promise.all([
        supabase.from('buses').select('*'),
        supabase.from('recorridos').select('*'),
        supabase.from('supervisores').select('*')
      ])

      setStats(prev => ({
        ...prev,
        totalEstudiantes: cEst || 0,
        totalSupervisores: cSup || 0,
        totalBuses: cBus || 0,
        credencialesActivas: cCred || 0
      }))

      if (resBuses.data) setBuses(resBuses.data)
      if (resRec.data) setRecorridos(resRec.data)
      if (resSup.data) setSupervisores(resSup.data)
        
      setLoading(false)
    }
    loadStats()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, opacity: loading ? 0.6 : 1, transition: 'opacity 0.3s' }}>

      {/* ── Sección Principal ─────────────────────────────────────── */}
      <SectionHeader icon={<Bus size={15} />} title="Módulo Buses y General" color="var(--primary)" />

      <div className="stats-grid">
        {[
          { label: 'Total Estudiantes',  value: stats.totalEstudiantes,    icon: Users,          color: 'var(--primary)',  bg: 'var(--primary-glow)' },
          { label: 'Supervisores',       value: stats.totalSupervisores,   icon: UserCheck,      color: 'var(--purple)',   bg: 'var(--purple-bg)' },
          { label: 'Buses Registrados',  value: stats.totalBuses,          icon: Bus,            color: 'var(--info)',     bg: 'var(--info-bg)' },
          { label: 'Creds. Activas',     value: stats.credencialesActivas, icon: CreditCard,     color: 'var(--warning)',  bg: 'var(--warning-bg)' },
          { label: 'Presentes Hoy',      value: stats.presentesHoy,        icon: TrendingUp,     color: 'var(--success)',  bg: 'var(--success-bg)' },
          { label: 'Rechazos Hoy',       value: stats.rechazosHoy,         icon: AlertTriangle,  color: 'var(--danger)',   bg: 'var(--danger-bg)' },
          { label: 'Alertas Nuevas',     value: stats.alertasNuevas,       icon: Bell,           color: 'var(--danger)',   bg: 'var(--danger-bg)' },
          { label: 'Pendiente Sync',     value: stats.pendienteSync,       icon: Wifi,           color: 'var(--info)',     bg: 'var(--info-bg)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent-color': s.color, '--accent-bg': s.bg }}>
            <div className="stat-card-header">
              <span className="stat-card-label">{s.label}</span>
              <div className="stat-card-icon"><s.icon size={17} style={{ color: s.color }} /></div>
            </div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Columna Izquierda: Gráfico y Alertas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Gráfico buses */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><TrendingUp size={16} /> Asistencia Buses — Semanal</span>
            </div>
            <div className="card-body">
              <div className="chart-container" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <TrendingUp size={32} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <p style={{ margin: 0 }}>No hay datos suficientes para mostrar estadísticas.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alertas y Novedades */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title"><Bell size={16} /> Alertas y Novedades</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={32} style={{ opacity: 0.5, marginBottom: 12, color: 'var(--success)' }} />
                <p style={{ margin: 0 }}>Todo está al día. No hay alertas nuevas.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Estado buses */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Bus size={16} /> Estado de Buses Activos</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {buses.length === 0 && <div className="text-muted text-center" style={{ padding: 20 }}>No hay buses registrados.</div>}
            {buses.map(bus => {
              const rec = recorridos.find(r => r.id === bus.id_recorrido)
              const sup = supervisores.find(s => s.id === bus.id_supervisor)
              const estadoColor = { ACTIVO: 'var(--success)', MANTENIMIENTO: 'var(--warning)' }[bus.estado] ?? 'var(--danger)'
              return (
                <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: estadoColor, flexShrink: 0, boxShadow: `0 0 6px ${estadoColor}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{bus.numero_bus} — {rec?.nombre ?? 'Sin recorrido'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sup: {sup?.nombre ?? 'Sin asignar'} · Patente: {bus.patente}</div>
                  </div>
                  <span className={`badge badge-${{ ACTIVO: 'success', MANTENIMIENTO: 'warning', INACTIVO: 'danger' }[bus.estado] ?? 'muted'}`}>{bus.estado}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 4px 12px ${color}40` }}>
        {icon}
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</h3>
    </div>
  )
}
