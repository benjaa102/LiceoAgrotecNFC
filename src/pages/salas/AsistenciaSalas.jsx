import { useState, useEffect } from 'react'
import { ClipboardList, Search, RefreshCw, Calendar, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AsistenciaSalas() {
  const [asistencia, setAsistencia] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [docentes, setDocentes] = useState([])
  const [salas, setSalas] = useState([])
  const [observaciones, setObservaciones] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [filterDocente, setFilterDocente] = useState('')
  const [filterSala, setFilterSala] = useState('')
  const [filterFecha, setFilterFecha] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [resAsis, resEst, resDoc, resSalas, resObs] = await Promise.all([
      supabase.from('asistencia_salas').select('*').order('fecha', { ascending: false }).order('hora', { ascending: false }).limit(500),
      supabase.from('estudiantes').select('*'),
      supabase.from('docentes').select('*'),
      supabase.from('salas').select('*'),
      supabase.from('observaciones_sesion').select('*').order('created_at', { ascending: false }).limit(100)
    ])
    if (resAsis.data) setAsistencia(resAsis.data)
    if (resEst.data) setEstudiantes(resEst.data)
    if (resDoc.data) setDocentes(resDoc.data)
    if (resSalas.data) setSalas(resSalas.data)
    if (resObs.data) setObservaciones(resObs.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const getEstudiante = (id) => estudiantes.find(e => e.id === id)
  const getDocente = (id) => docentes.find(d => d.id === id)

  const filtered = asistencia.filter(reg => {
    const est = getEstudiante(reg.id_estudiante)
    const doc = getDocente(reg.id_docente)
    const q = search.toLowerCase()
    
    const matchSearch = !q || 
      est?.nombre?.toLowerCase().includes(q) || 
      est?.rut?.includes(q) || 
      est?.curso?.toLowerCase().includes(q) ||
      doc?.nombre?.toLowerCase().includes(q)
      
    const matchDocente = !filterDocente || reg.id_docente === filterDocente
    const matchSala = !filterSala || reg.id_sala === filterSala
    const matchFecha = !filterFecha || reg.fecha === filterFecha
    
    return matchSearch && matchDocente && matchSala && matchFecha
  })

  const allSessions = Object.values(filtered.reduce((acc, curr) => {
    const doc = getDocente(curr.id_docente)
    const sala = salas.find(s => s.id === curr.id_sala)
    const key = `${curr.id_docente}_${curr.fecha}_${curr.id_sala || 'none'}`
    if (!acc[key]) {
      const obs = observaciones.find(o => o.id_docente === curr.id_docente && o.fecha === curr.fecha && o.id_sala === curr.id_sala)
      acc[key] = { 
        key, 
        docente: doc, 
        asignatura: doc?.asignatura || 'Sin Asignatura', 
        fecha: curr.fecha, 
        sala: sala, 
        obs,
        count: 0 
      }
    }
    acc[key].count++
    return acc
  }, {})).sort((a,b) => b.fecha.localeCompare(a.fecha) || b.count - a.count)

  const [selectedSessionKey, setSelectedSessionKey] = useState(null)
  
  const selectedSessionData = selectedSessionKey ? allSessions.find(s => s.key === selectedSessionKey) : null
  const selectedSessionStudents = selectedSessionKey ? filtered.filter(reg => {
    return `${reg.id_docente}_${reg.fecha}_${reg.id_sala || 'none'}` === selectedSessionKey
  }).sort((a,b) => b.hora.localeCompare(a.hora)) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div className="responsive-controls-bar" style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div className="responsive-controls-group" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="input-group" style={{ width: '100%' }}>
            <Search size={15} className="input-group-icon" />
            <input className="input" placeholder="Buscar por alumno, rut o profesor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
          <select className="input" style={{ width: '100%' }} value={filterDocente} onChange={e => setFilterDocente(e.target.value)}>
            <option value="">Todos los docentes</option>
            {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre} - {d.asignatura}</option>)}
          </select>
          <select className="input" style={{ width: '100%' }} value={filterSala} onChange={e => setFilterSala(e.target.value)}>
            <option value="">Todas las salas</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          
          <div className="input-group" style={{ width: '100%' }}>
            <Calendar size={15} className="input-group-icon" />
            <input type="date" className="input" value={filterFecha} onChange={e => setFilterFecha(e.target.value)} />
          </div>
        </div>
        
        <div className="responsive-controls-group" style={{ justifyContent: 'flex-end', flexShrink: 0 }}>
          <span className="text-muted text-sm" style={{ alignSelf: 'center', marginRight: 8 }}>{allSessions.length} sesiones encontradas</span>
          <button className="btn btn-secondary btn-icon" onClick={loadData} disabled={loading} title="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando registros...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {allSessions.map((session) => (
            <div key={session.key} className="card fade-in" style={{ overflow: 'hidden', position: 'relative', border: '1px solid var(--border)', transition: 'all 0.3s ease', padding: 0 }}>
              {/* Subtle background glow */}
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'var(--primary-bg)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, rgba(79,142,247,0.15), rgba(79,142,247,0.02))', border: '1px solid rgba(79,142,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 20px rgba(79,142,247,0.1)' }}>
                    <ClipboardList size={26} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{session.asignatura}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Prof. {session.docente?.nombre || 'Desconocido'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  <Calendar size={14} />
                  <span>Fecha: <strong style={{ color: 'var(--text-secondary)' }}>{session.fecha}</strong></span>
                </div>

                {session.obs && (
                  <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--primary)', fontSize: 13 }}>
                    {session.obs.curso && (
                      <div style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 4 }}>Curso: {session.obs.curso}</div>
                    )}
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{session.obs.comentario}"</div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', letterSpacing: -1 }}>{session.count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estudiantes</div>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{session.sala?.nombre || 'S/E'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sala / Espacio</div>
                  </div>
                </div>
              </div>
              
              <div style={{ padding: '0 24px 24px 24px', position: 'relative', zIndex: 1 }}>
                <button className="btn btn-secondary w-full" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-bright)' }} onClick={() => setSelectedSessionKey(session.key)}>
                  <Users size={15} style={{ marginRight: 6 }}/> Ver Lista de Asistencia
                </button>
              </div>
            </div>
          ))}
          {allSessions.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="empty-state"><ClipboardList size={32} /><p>No se encontraron sesiones registradas.</p></div>
            </div>
          )}
        </div>
      )}

      {/* Modal Lista de Estudiantes */}
      {selectedSessionKey && selectedSessionData && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedSessionKey(null)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <span className="modal-title"><ClipboardList size={18} /> Asistencia — {selectedSessionData.asignatura} ({selectedSessionData.fecha})</span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setSelectedSessionKey(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 0, maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ padding: '16px 20px', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 13, flexWrap: 'wrap' }}>
                <div>Profesor: <strong>{selectedSessionData.docente?.nombre || 'Desconocido'}</strong></div>
                <div>Sala: <strong>{selectedSessionData.sala?.nombre || 'S/E'}</strong></div>
                {(() => {
                  if (selectedSessionData.docente?.hora_inicio && selectedSessionData.docente?.hora_fin) {
                    return <div>Horario: <strong>{selectedSessionData.docente.hora_inicio.slice(0,5)} - {selectedSessionData.docente.hora_fin.slice(0,5)}</strong></div>
                  } else if (selectedSessionStudents.length > 0) {
                    const times = selectedSessionStudents.map(s => s.hora).sort()
                    const firstTime = times[0]
                    const [h, m] = firstTime.split(':')
                    const minutes = parseInt(h) * 60 + parseInt(m)
                    
                    const bloques = [
                      { id: 'ingreso', m: 8*60+10, label: '08:10 - 08:30' }, { id: '1', m: 8*60+30, label: '08:30 - 09:15' }, { id: '2', m: 9*60+15, label: '09:15 - 10:00' },
                      { id: '3', m: 10*60+15, label: '10:15 - 11:00' }, { id: '4', m: 11*60+0, label: '11:00 - 11:45' }, { id: '5', m: 11*60+55, label: '11:55 - 12:40' },
                      { id: '6', m: 12*60+40, label: '12:40 - 13:25' }, { id: 'ingreso2', m: 14*60+0, label: '14:00 - 14:15' }, { id: '7', m: 14*60+15, label: '14:15 - 15:00' },
                      { id: '8', m: 15*60+0, label: '15:00 - 15:45' }, { id: '9', m: 16*60+0, label: '16:00 - 16:45' }, { id: '10', m: 16*60+45, label: '16:45 - 17:30' },
                      { id: '11', m: 17*60+30, label: '17:30 - 18:15' }
                    ]
                    
                    let minDiff = Infinity
                    let activeBlockLabel = null
                    for (const b of bloques) {
                      const diff = minutes - b.m
                      if (diff >= -15 && diff < 45) {
                        if (Math.abs(diff) < minDiff) {
                          minDiff = Math.abs(diff)
                          activeBlockLabel = b.label
                        }
                      }
                    }
                    
                    if (activeBlockLabel) {
                      return <div>Horario de Bloque: <strong>{activeBlockLabel}</strong></div>
                    }
                    return <div>Horario Activo: <strong>{firstTime.slice(0,5)} - {times[times.length-1].slice(0,5)}</strong></div>
                  }
                  return null
                })()}
                <div>Total Presentes: <strong style={{ color: 'var(--primary)' }}>{selectedSessionData.count}</strong></div>
              </div>
              {selectedSessionData.obs && (
                <div style={{ padding: '12px 20px', background: 'rgba(79, 142, 247, 0.05)', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  {selectedSessionData.obs.curso && (
                    <div style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 4 }}>Curso/Nivel: {selectedSessionData.obs.curso}</div>
                  )}
                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontStyle: 'normal' }}>Observación: </span> 
                    "{selectedSessionData.obs.comentario}"
                  </div>
                  {selectedSessionData.obs.created_at && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Registrado el {new Date(selectedSessionData.obs.created_at).toLocaleDateString('es-CL')} a las {new Date(selectedSessionData.obs.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
              <div className="table-responsive-wrapper" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
                <table style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                    <tr>
                      <th>Estudiante</th>
                      <th>RUT</th>
                      <th>Curso Orig.</th>
                      <th>Hora de Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSessionStudents.map(reg => {
                      const est = getEstudiante(reg.id_estudiante)
                      return (
                        <tr key={reg.id}>
                          <td><strong>{est?.nombre || 'Desconocido'}</strong></td>
                          <td className="font-mono text-sm">{est?.rut}</td>
                          <td><span className="chip">{est?.curso || 'S/C'}</span></td>
                          <td style={{ fontWeight: 600 }}>{reg.hora.slice(0,5)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedSessionKey(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
