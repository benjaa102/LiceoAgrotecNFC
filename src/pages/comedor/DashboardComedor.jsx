import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Scan, Coffee, Soup, Clock, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardComedor() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [stats, setStats] = useState({ hoy: 0, desayuno: 0, almuerzo: 0, cena: 0 })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  const hoyStr = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('-').reverse().join('-')
  // Depending on JS environment, sometimes the format is dd-mm-yyyy or yyyy-mm-dd
  // Supabase expects yyyy-mm-dd. Let's build it safely:
  const hoyObj = new Date()
  const yyyy = hoyObj.getFullYear()
  const mm = String(hoyObj.getMonth() + 1).padStart(2, '0')
  const dd = String(hoyObj.getDate()).padStart(2, '0')
  const fechaHoy = `${yyyy}-${mm}-${dd}`

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true)
      
      // Obtener registros de hoy
      const { data: regsHoy } = await supabase
        .from('registros_comedor')
        .select('tipo_servicio, hora, metodo')
        .eq('fecha', fechaHoy)

      if (regsHoy) {
        setStats({
          hoy: regsHoy.length,
          desayuno: regsHoy.filter(r => r.tipo_servicio === 'DESAYUNO').length,
          almuerzo: regsHoy.filter(r => r.tipo_servicio === 'ALMUERZO').length,
          cena: regsHoy.filter(r => r.tipo_servicio === 'CENA').length,
        })
      }

      // Obtener registros de los últimos 7 días para el gráfico
      const { data: regsSemana } = await supabase
        .from('registros_comedor')
        .select('fecha, tipo_servicio')
        .order('fecha', { ascending: true })

      if (regsSemana) {
        // Agrupar por fecha
        const porFecha = {}
        regsSemana.forEach(r => {
          if (!porFecha[r.fecha]) porFecha[r.fecha] = { fecha: r.fecha, Desayuno: 0, Almuerzo: 0, Cena: 0 }
          if (r.tipo_servicio === 'DESAYUNO') porFecha[r.fecha].Desayuno++
          if (r.tipo_servicio === 'ALMUERZO') porFecha[r.fecha].Almuerzo++
          if (r.tipo_servicio === 'CENA') porFecha[r.fecha].Cena++
        })
        
        // Tomar las últimas 7 fechas
        const ultimos = Object.values(porFecha).slice(-7).map(d => ({
          ...d,
          dia: new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short' })
        }))
        setChartData(ultimos)
      }

      setLoading(false)
    }

    loadStats()
  }, [fechaHoy])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</p>
        {payload.map(p => <p key={p.name} style={{ color: p.fill }}>{p.name}: <strong>{p.value}</strong></p>)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            ¡Hola, {profile?.nombre?.split(' ')[0] || 'Encargado'}! 👋
          </h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Resumen en vivo del comedor para hoy: {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={() => navigate('/comedor/kiosko')}>
          <Scan size={20} /> Iniciar Lectura NFC
        </button>
      </div>

      {/* ── Stats de Hoy ── */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🍽️</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -1 }}>{stats.hoy}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Raciones totales hoy</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>☕</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--warning)', letterSpacing: -1 }}>{stats.desayuno}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Desayunos</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🍱</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)', letterSpacing: -1 }}>{stats.almuerzo}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Almuerzos</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🍲</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--purple)', letterSpacing: -1 }}>{stats.cena}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Cenas</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* ── Gráfico de Tendencia ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tendencia de Asistencia (Últimos días)</span>
          </div>
          <div className="card-body" style={{ height: 320, padding: '20px 20px 0 0' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="Desayuno" fill="var(--warning)" radius={[4, 4, 0, 0]} stackId="a" maxBarSize={40} />
                  <Bar dataKey="Almuerzo" fill="var(--primary)" radius={[4, 4, 0, 0]} stackId="a" maxBarSize={40} />
                  <Bar dataKey="Cena" fill="var(--purple)" radius={[4, 4, 0, 0]} stackId="a" maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No hay datos suficientes</div>
            )}
          </div>
        </div>

        {/* ── Accesos Rápidos ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Accesos Rápidos</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: 16 }} onClick={() => navigate('/comedor/asistencia')}>
              <Clock size={18} style={{ color: 'var(--text-muted)' }} /> Historial de Asistencia
            </button>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: 16 }} onClick={() => navigate('/comedor/reportes')}>
              <BarChart size={18} style={{ color: 'var(--text-muted)' }} /> Exportar Reportes
            </button>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: 16 }} onClick={() => navigate('/comedor/semanal')}>
              <Users size={18} style={{ color: 'var(--text-muted)' }} /> Control Semanal
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
