import { useState, useEffect } from 'react'
import { Calendar, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { startOfWeek, addDays, format } from 'date-fns'
import { es } from 'date-fns/locale/es'

export default function ControlSemanal() {
  const [servicio, setServicio] = useState('ALMUERZO')
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  
  const [inscripciones, setInscripciones] = useState([])
  const [registros, setRegistros]         = useState([])
  const [estudiantes, setEstudiantes]     = useState([])

  // Calculate current week (Monday to Friday)
  const today = new Date()
  const start = startOfWeek(today, { weekStartsOn: 1 }) // Monday
  const DIAS_SEMANA = Array.from({ length: 5 }).map((_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
  const LABELS_DIAS = Array.from({ length: 5 }).map((_, i) => format(addDays(start, i), 'EEE d', { locale: es }))

  const loadData = async () => {
    setLoading(true)
    const [resInsc, resReg, resEst] = await Promise.all([
      supabase.from('inscripciones_comedor').select('*').eq('activo', true),
      supabase.from('registros_comedor').select('*').gte('fecha', DIAS_SEMANA[0]).lte('fecha', DIAS_SEMANA[4]),
      supabase.from('estudiantes').select('*')
    ])
    if (resInsc.data) setInscripciones(resInsc.data)
    if (resReg.data) setRegistros(resReg.data)
    if (resEst.data) setEstudiantes(resEst.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const getEstudianteById = (id) => estudiantes.find(e => e.id === id)

  // Filtrar el viernes si el servicio no es Desayuno.
  const isViernesIndex = (idx) => LABELS_DIAS[idx].toLowerCase().startsWith('vie')
  
  const diasActivos = DIAS_SEMANA.filter((_, idx) => 
    !(isViernesIndex(idx) && servicio !== 'DESAYUNO')
  )
  
  const labelsActivos = LABELS_DIAS.filter((_, idx) => 
    !(isViernesIndex(idx) && servicio !== 'DESAYUNO')
  )

  // Estudiantes inscritos en el servicio
  const inscritos = inscripciones
    .filter(i => i.tipo_servicio === servicio && i.activo)
    .map(i => getEstudianteById(i.id_estudiante))
    .filter(Boolean)
    .filter(e => !search || e.nombre.toLowerCase().includes(search.toLowerCase()) || e.curso.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const getEstado = (id_estudiante, fecha) => {
    return registros.some(r =>
      r.id_estudiante === id_estudiante &&
      r.tipo_servicio === servicio &&
      r.fecha === fecha
    )
  }

  const getMetodo = (id_estudiante, fecha) => {
    const r = registros.find(r =>
      r.id_estudiante === id_estudiante &&
      r.tipo_servicio === servicio &&
      r.fecha === fecha
    )
    return r?.metodo ?? null
  }

  // Totales por día
  const totalesPorDia = diasActivos.map(fecha =>
    inscritos.filter(e => getEstado(e.id, fecha)).length
  )

  // Calcular resumen por estudiante
  const getResumen = (id_estudiante) => {
    const asistidos = diasActivos.filter(fecha => getEstado(id_estudiante, fecha)).length
    return { asistidos, ausentes: diasActivos.length - asistidos }
  }

  const servColor = servicio === 'ALMUERZO' ? 'var(--primary)' : servicio === 'CENA' ? 'var(--purple)' : 'var(--warning)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Selector de servicio */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4 }}>
          {['ALMUERZO', 'DESAYUNO', 'CENA'].map(s => (
            <button key={s} onClick={() => setServicio(s)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: servicio === s ? servColor : 'transparent', color: servicio === s ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              {s === 'ALMUERZO' ? '🍽 Almuerzo' : s === 'CENA' ? '🍲 Cena' : '☕ Desayuno'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 14px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
          <Calendar size={14} /> Semana del {format(start, 'd', { locale: es })} al {format(addDays(start, 4), "d 'de' MMMM yyyy", { locale: es })}
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>

        <input className="input" style={{ maxWidth: 220 }} placeholder="Filtrar por nombre o curso…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--success)', bg: 'var(--success-bg)', label: '✓  Asistió (NFC)' },
          { color: 'var(--purple)',  bg: 'var(--purple-bg)',  label: '✓  Asistió (Manual)' },
          { color: 'var(--danger)',  bg: 'var(--danger-bg)',  label: '✗  No asistió' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 28, height: 20, borderRadius: 6, background: l.bg, border: `1px solid ${l.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: l.color, fontWeight: 700 }}>
              {l.label.slice(0, 1)}
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{l.label.slice(3)}</span>
          </div>
        ))}
      </div>

      {/* Tabla semanal */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Calendar size={16} /> Control Semanal — {servicio}</span>
          <span className="text-muted text-sm">{inscritos.length} inscritos</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando control semanal desde Supabase...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Estudiante</th>
                  <th>Curso</th>
                  {labelsActivos.map((lbl, i) => (
                    <th key={lbl} style={{ textAlign: 'center', minWidth: 70 }}>
                      <div>{lbl}</div>
                      <div style={{ fontSize: 10, color: servColor, fontWeight: 700 }}>{totalesPorDia[i]}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Asistidos</th>
                  <th style={{ textAlign: 'center' }}>Ausentes</th>
                </tr>
              </thead>
              <tbody>
                {inscritos.length === 0 && (
                  <tr><td colSpan={10}><div className="empty-state"><Calendar size={32} /><p>Sin inscritos para este servicio</p></div></td></tr>
                )}
                {inscritos.map(est => {
                  const resumen = getResumen(est.id)
                  return (
                    <tr key={est.id}>
                      <td><strong>{est.nombre}</strong></td>
                      <td><span className="chip">{est.curso}</span></td>
                      {diasActivos.map(fecha => {
                        const asistio = getEstado(est.id, fecha)
                        const metodo  = getMetodo(est.id, fecha)
                        const color   = !asistio ? 'var(--danger)' : metodo === 'NFC' ? 'var(--success)' : 'var(--purple)'
                        const bg      = !asistio ? 'var(--danger-bg)' : metodo === 'NFC' ? 'var(--success-bg)' : 'var(--purple-bg)'
                        return (
                          <td key={fecha} style={{ textAlign: 'center', padding: '10px 8px' }}>
                            <div style={{ width: 32, height: 26, margin: '0 auto', borderRadius: 6, background: bg, border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color }}>
                              {asistio ? '✓' : '✗'}
                            </div>
                          </td>
                        )
                      })}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>{resumen.asistidos}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: resumen.ausentes > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{resumen.ausentes}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-bright)' }}>
                  <td colSpan={2} style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Total asistencias</td>
                  {totalesPorDia.map((t, i) => (
                    <td key={i} style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 800, color: servColor, fontSize: 16 }}>{t}</td>
                  ))}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Resumen de la semana */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labelsActivos.length}, 1fr)`, gap: 12 }}>
          {labelsActivos.map((lbl, i) => {
            const pct = inscritos.length > 0 ? Math.round((totalesPorDia[i] / inscritos.length) * 100) : 0
            return (
              <div key={lbl} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>{lbl}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: servColor }}>{totalesPorDia[i]}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>de {inscritos.length} inscritos</div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${servColor}, ${servColor}99)` }} />
                </div>
                <div style={{ fontSize: 11, color: pct >= 80 ? 'var(--success)' : 'var(--warning)', marginTop: 4, fontWeight: 700 }}>{pct}%</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
