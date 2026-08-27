import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, CheckCheck, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale/es'

const TIPO_META = {
  BUS_INCORRECTO:       { label: 'Bus Incorrecto',        color: 'warning', icon: '⚠️' },
  AUTORIZACION_REVOCADA:{ label: 'Autorización Revocada', color: 'danger',  icon: '🚫' },
  CREDENCIAL_DESCONOCIDA:{ label: 'Credencial Desconocida', color: 'danger', icon: '❓' },
}

export default function Alertas() {
  const [data, setData]       = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [buses, setBuses]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('todas')

  const loadData = async () => {
    setLoading(true)
    const [resAlertas, resEst, resBus] = await Promise.all([
      supabase.from('alertas_buses').select('*').order('timestamp', { ascending: false }).limit(200),
      supabase.from('estudiantes').select('id, nombre, curso, rut'),
      supabase.from('buses').select('id, numero_bus')
    ])
    if (resAlertas.data) setData(resAlertas.data)
    if (resEst.data) setEstudiantes(resEst.data)
    if (resBus.data) setBuses(resBus.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const getEstudianteById = (id) => estudiantes.find(e => e.id === id)
  const getNombreBus = (id) => {
    const bus = buses.find(b => b.id === id)
    return bus?.numero_bus ?? bus?.nombre ?? '—'
  }

  const filtered = data.filter(a => {
    if (filter === 'nuevas')   return a.estado === 'NUEVA'
    if (filter === 'revisadas') return a.estado === 'REVISADA'
    return true
  })

  const marcarRevisada = async (id) => {
    await supabase.from('alertas_buses').update({ estado: 'REVISADA' }).eq('id', id)
    setData(d => d.map(a => a.id === id ? { ...a, estado: 'REVISADA' } : a))
  }

  const marcarTodasRevisadas = async () => {
    const nuevasIds = data.filter(a => a.estado === 'NUEVA').map(a => a.id)
    if (nuevasIds.length > 0) {
      await supabase.from('alertas_buses').update({ estado: 'REVISADA' }).in('id', nuevasIds)
    }
    setData(d => d.map(a => ({ ...a, estado: 'REVISADA' })))
  }

  const nuevas   = data.filter(a => a.estado === 'NUEVA').length
  const revisadas = data.filter(a => a.estado === 'REVISADA').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <MiniStat label="Total Alertas" v={data.length}  color="var(--text-primary)" />
        <MiniStat label="Nuevas"        v={nuevas}      color="var(--danger)" />
        <MiniStat label="Revisadas"     v={revisadas}   color="var(--success)" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 10, padding: 4, gap: 4, border: '1px solid var(--border)' }}>
          {[['todas', 'Todas'], ['nuevas', 'Nuevas'], ['revisadas', 'Revisadas']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'all 0.15s', background: filter === val ? 'var(--primary)' : 'transparent', color: filter === val ? 'white' : 'var(--text-muted)' }}>
              {lbl}{val === 'nuevas' && nuevas > 0 ? ` (${nuevas})` : ''}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
        <div style={{ marginLeft: 'auto' }}>
          {nuevas > 0 && (
            <button className="btn btn-success btn-sm" onClick={marcarTodasRevisadas}>
              <CheckCheck size={14} /> Marcar todas revisadas
            </button>
          )}
        </div>
      </div>

      {/* Alertas list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div className="card">
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando alertas desde Supabase...</div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="card">
            <div className="empty-state" style={{ padding: '48px' }}>
              <Bell size={36} />
              <p>No hay alertas {filter !== 'todas' ? `en estado "${filter}"` : ''}</p>
            </div>
          </div>
        )}
        {filtered.map(alerta => {
          const est = getEstudianteById(alerta.id_estudiante)
          const meta = TIPO_META[alerta.tipo] ?? { label: alerta.tipo, color: 'muted', icon: '•' }
          const ts = new Date(alerta.timestamp)
          return (
            <div key={alerta.id} className={`alert-item${alerta.estado === 'NUEVA' ? ' nueva' : ' revisada'}`}>
              <div className={`alert-icon`} style={{ background: `var(--${meta.color}-bg)` }}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
              </div>
              <div className="alert-info">
                <div className="alert-title">
                  {est?.nombre ?? 'Estudiante desconocido'}
                  <span style={{ fontSize: 11, marginLeft: 8 }} className={`badge badge-${meta.color}`}>{meta.label}</span>
                </div>
                <div className="alert-sub">
                  Bus intentado: <strong style={{ color: 'var(--text-secondary)' }}>{getNombreBus(alerta.id_bus_intento)}</strong>
                  {alerta.id_bus_correcto && (
                    <> · Bus correcto: <strong style={{ color: 'var(--success)' }}>{getNombreBus(alerta.id_bus_correcto)}</strong></>
                  )}
                  {est && <> · Curso: {est.curso}</>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span className="alert-time">{isNaN(ts) ? '' : format(ts, "d MMM · HH:mm", { locale: es })}</span>
                {alerta.estado === 'NUEVA' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => marcarRevisada(alerta.id)}>
                    <CheckCheck size={13} /> Revisar
                  </button>
                )}
                {alerta.estado === 'REVISADA' && (
                  <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ Revisada</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniStat({ label, v, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: -1 }}>{v}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
