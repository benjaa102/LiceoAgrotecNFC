import { useState, useEffect } from 'react'
import { ClipboardList, Search, RefreshCw, Calendar, Download, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AsistenciaSalas() {
  const [asistencia, setAsistencia] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [docentes, setDocentes] = useState([])
  const [salas, setSalas] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [filterDocente, setFilterDocente] = useState('')
  const [filterSala, setFilterSala] = useState('')
  const [filterFecha, setFilterFecha] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [resAsis, resEst, resDoc, resSalas] = await Promise.all([
      supabase.from('asistencia_salas').select('*').order('fecha', { ascending: false }).order('hora', { ascending: false }).limit(500),
      supabase.from('estudiantes').select('*'),
      supabase.from('docentes').select('*'),
      supabase.from('salas').select('*')
    ])
    if (resAsis.data) setAsistencia(resAsis.data)
    if (resEst.data) setEstudiantes(resEst.data)
    if (resDoc.data) setDocentes(resDoc.data)
    if (resSalas.data) setSalas(resSalas.data)
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
    if (!acc[key]) acc[key] = { 
      key, 
      docente: doc, 
      asignatura: doc?.asignatura || 'Sin Asignatura', 
      fecha: curr.fecha, 
      sala: sala, 
      count: 0 
    }
    acc[key].count++
    return acc
  }, {})).sort((a,b) => b.fecha.localeCompare(a.fecha) || b.count - a.count)

  const [selectedSessionKey, setSelectedSessionKey] = useState(null)
  
  const selectedSessionData = selectedSessionKey ? allSessions.find(s => s.key === selectedSessionKey) : null
  const selectedSessionStudents = selectedSessionKey ? filtered.filter(reg => {
    return `${reg.id_docente}_${reg.fecha}_${reg.id_sala || 'none'}` === selectedSessionKey
  }).sort((a,b) => b.hora.localeCompare(a.hora)) : []

  const exportCSV = () => {
    const headers = ['Estudiante','RUT','Curso','Asignatura','Profesor','Sala','Fecha','Hora']
    const rows = filtered.map(reg => {
      const est = getEstudiante(reg.id_estudiante)
      const doc = getDocente(reg.id_docente)
      const sala = salas.find(s => s.id === reg.id_sala)
      return [est?.nombre || '', est?.rut || '', est?.curso || '', doc?.asignatura || '', doc?.nombre || '', sala?.nombre || '', reg.fecha, reg.hora?.slice(0,5) || '']
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `asistencia_salas_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="input-group" style={{ maxWidth: 280 }}>
            <Search size={15} className="input-group-icon" />
            <input className="input" placeholder="Buscar por alumno, rut o profesor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
          <select className="input" style={{ width: 180 }} value={filterDocente} onChange={e => setFilterDocente(e.target.value)}>
            <option value="">Todos los docentes</option>
            {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre} - {d.asignatura}</option>)}
          </select>
          <select className="input" style={{ width: 150 }} value={filterSala} onChange={e => setFilterSala(e.target.value)}>
            <option value="">Todas las salas</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          
          <div className="input-group" style={{ width: 160 }}>
            <Calendar size={15} className="input-group-icon" />
            <input type="date" className="input" value={filterFecha} onChange={e => setFilterFecha(e.target.value)} />
          </div>
        </div>
        
        <div className="toolbar-right">
          <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>{allSessions.length} sesiones encontradas</span>
          <button className="btn btn-secondary btn-icon" onClick={loadData} disabled={loading} title="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={filtered.length === 0} title="Exportar CSV Completo">
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando registros...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {allSessions.map((session) => (
            <div key={session.key} className="card">
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{session.asignatura}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Prof. {session.docente?.nombre || 'Desconocido'}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  <Calendar size={13} />
                  <span>Fecha: <strong style={{ color: 'var(--text-secondary)' }}>{session.fecha}</strong></span>
                </div>
              </div>
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', letterSpacing: -1 }}>{session.count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estudiantes</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderLeft: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>{session.sala?.nombre || 'S/E'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sala / Espacio</div>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setSelectedSessionKey(session.key)}>
                  <Users size={14} style={{ marginRight: 6 }}/> Ver Lista de Asistencia
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
                {selectedSessionData.docente?.hora_inicio && selectedSessionData.docente?.hora_fin && (
                  <div>Horario: <strong>{selectedSessionData.docente.hora_inicio.slice(0,5)} - {selectedSessionData.docente.hora_fin.slice(0,5)}</strong></div>
                )}
                <div>Total Presentes: <strong style={{ color: 'var(--primary)' }}>{selectedSessionData.count}</strong></div>
              </div>
              <div className="table-wrapper" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
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
