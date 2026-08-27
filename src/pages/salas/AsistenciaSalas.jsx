import { useState, useEffect } from 'react'
import { ClipboardList, Search, RefreshCw, Calendar, Download } from 'lucide-react'
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

  const sessionCounts = filtered.reduce((acc, curr) => {
    const doc = getDocente(curr.id_docente)
    const sala = salas.find(s => s.id === curr.id_sala)
    const key = `${curr.id_docente}_${curr.fecha}_${curr.id_sala || 'none'}`
    if (!acc[key]) acc[key] = { docente: doc?.nombre, asignatura: doc?.asignatura, fecha: curr.fecha, sala: sala?.nombre || 'S/E', count: 0 }
    acc[key].count++
    return acc
  }, {})
  
  const topSessions = Object.values(sessionCounts).sort((a,b) => b.count - a.count).slice(0, 4)

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
          <button className="btn btn-secondary btn-icon" onClick={loadData} disabled={loading} title="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={filtered.length === 0} title="Exportar CSV">
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {topSessions.length > 0 && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {topSessions.map((ts, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{ts.fecha}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{ts.asignatura}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Prof. {ts.docente}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ts.sala}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{ts.count} <span style={{fontSize: 12, color: 'var(--text-muted)', fontWeight: 600}}>alumnos</span></div>
            </div>
          ))}
        </div>
      )}

      {/* Main Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><ClipboardList size={16} /> Registros de Asistencia Salas</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="text-muted text-sm">{filtered.length} registros (últimos 500)</span>
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando registros...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Curso Orig.</th>
                  <th>Asignatura / Módulo</th>
                  <th>Profesor</th>
                  <th>Sala / Espacio</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><ClipboardList size={32} /><p>No se encontraron registros</p></div></td></tr>
                )}
                {filtered.map(reg => {
                  const est = getEstudiante(reg.id_estudiante)
                  const doc = getDocente(reg.id_docente)
                  const sala = salas.find(s => s.id === reg.id_sala)
                  return (
                    <tr key={reg.id}>
                      <td><strong>{est?.nombre || 'Desconocido'}</strong> <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{est?.rut}</div></td>
                      <td><span className="chip">{est?.curso || 'S/C'}</span></td>
                      <td><strong style={{ color: 'var(--primary)' }}>{doc?.asignatura || 'Desconocida'}</strong></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{doc?.nombre || 'Desconocido'}</td>
                      <td><span className="badge badge-secondary">{sala?.nombre || 'S/E'}</span></td>
                      <td>{reg.fecha}</td>
                      <td style={{ fontWeight: 600 }}>{reg.hora.slice(0,5)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
