import { useState, useEffect } from 'react'
import { ClipboardList, Search, Filter, Download } from 'lucide-react'
import { exportCSV, formatFecha, makeFilename } from '../../lib/csvExport'
import { exportToExcel, exportToPDF } from '../../lib/exportUtils'
import { supabase } from '../../lib/supabase'

const CURSOS = ['7° Básico', '8° Básico', '1°A', '1°B', '1°C', '1°D', '2°A', '2°B', '2°C', '2°D', '3°A', '3°B', '3°C', '3°D', '4°A', '4°B', '4°C', '4°D']

export default function AsistenciaComedor() {
  const [filterFecha, setFF]    = useState('')
  const [filterServ, setFS]     = useState('')
  const [filterMetodo, setFM]   = useState('')
  const [filterTipo, setFT]     = useState('')
  const [filterCurso, setFC]    = useState('')
  const [search, setSearch]     = useState('')
  
  const [registrosComedor, setRegistrosComedor] = useState([])
  const [estudiantesDb, setEstudiantesDb] = useState([])
  const [usuariosSistema, setUsuariosSistema] = useState([])

  useEffect(() => {
    supabase.from('registros_comedor').select('*').order('fecha', { ascending: false }).order('hora', { ascending: false }).then(({data}) => {
      if (data) setRegistrosComedor(data)
    })
    supabase.from('estudiantes').select('*').then(({data}) => {
      if (data) setEstudiantesDb(data)
    })
    supabase.from('supervisores').select('*').then(({data}) => {
      if (data) setUsuariosSistema(data)
    })
  }, [])
  
  const fechas = [...new Set(registrosComedor.map(r => r.fecha))].sort().reverse()

  const getEstudianteById = (id) => estudiantesDb.find(e => e.id === id)

  const filtered = registrosComedor.filter(r => {
    const est = getEstudianteById(r.id_estudiante)
    const q = search.toLowerCase()
    return (
      (!filterFecha  || r.fecha === filterFecha) &&
      (!filterServ   || r.tipo_servicio === filterServ) &&
      (!filterMetodo || r.metodo === filterMetodo) &&
      (!filterTipo   || est?.tipo === filterTipo) &&
      (!filterCurso  || est?.curso === filterCurso) &&
      (!q || est?.nombre.toLowerCase().includes(q) || est?.rut?.includes(q) || est?.matricula?.includes(q))
    )
  })

  const columns = [
    { header: 'Estudiante', key: 'nombre', width: 35, align: 'left' },
    { header: 'RUT', key: 'rut', width: 15, align: 'center' },
    { header: 'Matrícula', key: 'matricula', width: 12, align: 'center' },
    { header: 'Curso', key: 'curso', width: 10, align: 'center' },
    { header: 'Tipo Alumno', key: 'tipo_alumno', width: 15, align: 'center' },
    { header: 'Servicio', key: 'servicio', width: 15, align: 'center' },
    { header: 'Fecha', key: 'fecha', width: 15, align: 'center' },
    { header: 'Hora', key: 'hora', width: 12, align: 'center' },
    { header: 'Método', key: 'metodo', width: 12, align: 'center' },
    { header: 'Resp/Obs', key: 'responsable', width: 25, align: 'left' }
  ]

  const handleExportExcel = () => {
    const rows = getExportRows()
    exportToExcel(rows, columns, makeFilename('asistencia_comedor', { curso: filterCurso, servicio: filterServ }), 'Reporte de Asistencia Comedor')
  }

  const handleExportPDF = () => {
    const rows = getExportRows()
    exportToPDF(rows, columns, makeFilename('asistencia_comedor', { curso: filterCurso, servicio: filterServ }), 'Reporte de Asistencia Comedor')
  }

  const getExportRows = () => {
    return filtered.map(r => {
      const est = getEstudianteById(r.id_estudiante)
      const resp = usuariosSistema.find(u => u.id === r.id_usuario_resp)
      return {
        nombre: est?.nombre ?? '',
        rut: est?.rut ?? '',
        matricula: est?.matricula ?? '',
        curso: est?.curso ?? '',
        tipo_alumno: est?.tipo ?? '',
        servicio: r.tipo_servicio === 'ALMUERZO' ? 'Almuerzo' : r.tipo_servicio === 'CENA' ? 'Cena' : 'Desayuno',
        fecha: formatFecha(r.fecha),
        hora: r.hora,
        metodo: r.metodo,
        responsable: resp?.nombre ? `${resp.nombre} (${r.observacion || ''})` : (r.observacion || '')
      }
    })
  }

  // Stats rápidos
  const total    = filtered.length
  const nfc      = filtered.filter(r => r.metodo === 'NFC').length
  const manual   = filtered.filter(r => r.metodo === 'MANUAL').length
  const totalAlmuerzos = registrosComedor.filter(r => r.tipo_servicio === 'ALMUERZO').length
  const totalDesayunos = registrosComedor.filter(r => r.tipo_servicio === 'DESAYUNO').length
  const totalCenas     = registrosComedor.filter(r => r.tipo_servicio === 'CENA').length
  const totalNFC       = registrosComedor.filter(r => r.metodo === 'NFC').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {[
          { label: 'Total', v: total,    color: 'var(--text-primary)' },
          { label: 'Almuerzo', v: totalAlmuerzos, color: 'var(--primary)', icon: '🍽' },
          { label: 'Desayuno', v: totalDesayunos, color: 'var(--warning)', icon: '☕' },
          { label: 'Cena',     v: totalCenas,     color: 'var(--purple)',  icon: '🍲' },
          { label: 'NFC',      v: totalNFC,       color: 'var(--success)' },
          { label: 'Manual', v: manual,  color: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: -1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="input-group" style={{ maxWidth: 240 }}>
          <Search size={15} className="input-group-icon" />
          <input className="input" placeholder="Buscar estudiante…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 150 }} value={filterCurso} onChange={e => setFC(e.target.value)}>
          <option value="">Todos los cursos</option>
          {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" style={{ width: 160 }} value={filterFecha} onChange={e => setFF(e.target.value)}>
          <option value="">Todas las fechas</option>
          {fechas.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="input" style={{ width: 150 }} value={filterServ} onChange={e => setFS(e.target.value)}>
          <option value="">Todos los servicios</option>
          <option value="ALMUERZO">🍽 Almuerzo</option>
          <option value="DESAYUNO">☕ Desayuno</option>
          <option value="CENA">🍲 Cena</option>
        </select>
        <select className="input" style={{ width: 140 }} value={filterMetodo} onChange={e => setFM(e.target.value)}>
          <option value="">Todos los métodos</option>
          <option value="NFC">NFC</option>
          <option value="MANUAL">Manual</option>
        </select>
        <select className="input" style={{ width: 140 }} value={filterTipo} onChange={e => setFT(e.target.value)}>
          <option value="">Interno / Externo</option>
          <option value="INTERNO">Interno</option>
          <option value="EXTERNO">Externo</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span className="text-muted text-sm" style={{ alignSelf: 'center', marginRight: 10 }}>{filtered.length} registros</span>
          <button className="btn btn-success btn-sm" id="btn-export-excel" onClick={handleExportExcel} style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: 'white' }}>
            <Download size={14} /> Excel
          </button>
          <button className="btn btn-danger btn-sm" id="btn-export-pdf" onClick={handleExportPDF} style={{ backgroundColor: '#d13438', borderColor: '#d13438', color: 'white' }}>
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><ClipboardList size={16} /> Registros de Asistencia — Comedor</span>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>RUT</th>
                <th>Curso</th>
                <th>Tipo Alumno</th>
                <th>Servicio</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Método</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9}><div className="empty-state"><ClipboardList size={32} /><p>Sin registros para los filtros seleccionados</p></div></td></tr>
              )}
              {[...filtered].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora)).map(r => {
                const est = getEstudianteById(r.id_estudiante)
                const resp = usuariosSistema.find(u => u.id === r.id_usuario_resp)
                return (
                  <tr key={r.id}>
                    <td><strong>{est?.nombre ?? '—'}</strong></td>
                    <td className="font-mono text-sm">{est?.rut}</td>
                    <td><span className="chip">{est?.curso}</span></td>
                    <td><span className={`badge badge-${est?.tipo === 'INTERNO' ? 'info' : 'purple'}`}>{est?.tipo}</span></td>
                    <td>
                      <span className={`badge badge-${r.tipo_servicio === 'ALMUERZO' ? 'info' : r.tipo_servicio === 'CENA' ? 'purple' : 'warning'}`}>
                        {r.tipo_servicio === 'ALMUERZO' ? '🍽 Almuerzo' : r.tipo_servicio === 'CENA' ? '🍲 Cena' : '☕ Desayuno'}
                      </span>
                    </td>
                    <td className="font-mono text-sm">{r.fecha}</td>
                    <td className="font-mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{r.hora}</td>
                    <td>
                      <span className={`badge badge-${r.metodo === 'NFC' ? 'success' : 'purple'}`}>{r.metodo}</span>
                      {r.metodo === 'MANUAL' && resp && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{resp.nombre}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160 }}>{r.observacion ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
