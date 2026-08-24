import { useState, useEffect } from 'react'
import { ClipboardList, Search, Filter, Download, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatFecha, makeFilename } from '../lib/csvExport'
import { exportToExcel, exportToPDF } from '../lib/exportUtils'

const CURSOS = ['7°', '8°', '1°A', '1°B', '1°C', '1°D', '2°A', '2°B', '2°C', '2°D', '3°A', '3°B', '3°C', '3°D', '4°A', '4°B', '4°C', '4°D']

export default function Asistencia() {
  const [asistencia, setAsistencia] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [buses, setBuses] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]       = useState('')
  const [filterFecha, setFF]      = useState('')
  const [filterBus, setFB]        = useState('')
  const [filterEstado, setFE]     = useState('')
  const [filterTipo, setFT]       = useState('')
  const [filterCurso, setFC]      = useState('')

  const loadData = async () => {
    setLoading(true)
    const [resAsis, resEst, resBus, resSup] = await Promise.all([
      supabase.from('asistencia_buses').select('*').order('fecha', { ascending: false }).order('hora', { ascending: false }).limit(500),
      supabase.from('estudiantes').select('*'),
      supabase.from('buses').select('*'),
      supabase.from('supervisores').select('*')
    ])
    if (resAsis.data) setAsistencia(resAsis.data)
    if (resEst.data) setEstudiantes(resEst.data)
    if (resBus.data) setBuses(resBus.data)
    if (resSup.data) setSupervisores(resSup.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const getEstudianteById = (id) => estudiantes.find(e => e.id === id)
  const getBusById = (id) => buses.find(b => b.id === id)
  const getSupervisorById = (id) => supervisores.find(s => s.id === id)

  const filtered = asistencia.filter(reg => {
    const est = getEstudianteById(reg.id_estudiante)
    const q = search.toLowerCase()
    const matchQ = !q || est?.nombre.toLowerCase().includes(q) || est?.rut?.includes(q)
    const matchF = !filterFecha  || reg.fecha === filterFecha
    const matchB = !filterBus    || reg.id_bus === filterBus
    const matchE = !filterEstado || reg.estado === filterEstado
    const matchT = !filterTipo   || reg.tipo_registro === filterTipo
    const matchC = !filterCurso  || est?.curso === filterCurso
    return matchQ && matchF && matchB && matchE && matchT && matchC
  })

  const estadoColor = { PRESENTE: 'success', AUSENTE: 'muted', RECHAZO: 'danger' }
  const tipoColor   = { NFC: 'info', MANUAL: 'purple' }

  // Stats
  const total     = filtered.length
  const presentes = filtered.filter(a => a.estado === 'PRESENTE').length
  const ausentes  = filtered.filter(a => a.estado === 'AUSENTE').length
  const rechazos  = filtered.filter(a => a.estado === 'RECHAZO').length
  const sinSync   = filtered.filter(a => !a.sincronizado).length

  const columns = [
    { header: 'Estudiante', key: 'nombre', width: 35, align: 'left' },
    { header: 'RUT', key: 'rut', width: 15, align: 'center' },
    { header: 'Curso', key: 'curso', width: 10, align: 'center' },
    { header: 'Bus', key: 'bus', width: 15, align: 'center' },
    { header: 'Supervisor', key: 'supervisor', width: 20, align: 'left' },
    { header: 'Fecha', key: 'fecha', width: 15, align: 'center' },
    { header: 'Hora', key: 'hora', width: 12, align: 'center' },
    { header: 'Estado', key: 'estado', width: 15, align: 'center' }
  ]

  const getExportRows = () => {
    return filtered.map(reg => {
      const est = getEstudianteById(reg.id_estudiante)
      const bus = getBusById(reg.id_bus)
      const sup = getSupervisorById(reg.id_supervisor)
      return {
        nombre: est?.nombre ?? '',
        rut: est?.rut ?? '',
        curso: est?.curso ?? '',
        bus: bus?.numero_bus ?? '',
        supervisor: sup?.nombre ?? '',
        fecha: formatFecha(reg.fecha),
        hora: reg.hora,
        estado: reg.estado
      }
    })
  }

  const handleExportExcel = () => {
    const rows = getExportRows()
    exportToExcel(rows, columns, makeFilename('asistencia_buses', { curso: filterCurso, fecha: filterFecha }), 'Reporte Asistencia Buses')
  }

  const handleExportPDF = () => {
    const rows = getExportRows()
    exportToPDF(rows, columns, makeFilename('asistencia_buses', { curso: filterCurso, fecha: filterFecha }), 'Reporte Asistencia Buses')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mini stats */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total',       v: total,     color: 'var(--text-primary)' },
          { label: 'Presentes',   v: presentes, color: 'var(--success)' },
          { label: 'Ausentes',    v: ausentes,  color: 'var(--text-muted)' },
          { label: 'Rechazos',    v: rechazos,  color: 'var(--danger)' },
          { label: 'Sin Sync',    v: sinSync,   color: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: -1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="input-group" style={{ maxWidth: 240 }}>
          <Search size={15} className="input-group-icon" />
          <input className="input" placeholder="Buscar estudiante…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 150 }} value={filterCurso} onChange={e => setFC(e.target.value)}>
          <option value="">Todos los cursos</option>
          {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input 
          type="date" 
          className="input" 
          style={{ width: 160 }} 
          value={filterFecha} 
          onChange={e => setFF(e.target.value)}
          title="Seleccionar fecha"
        />
        <select className="input" style={{ width: 140 }} value={filterBus} onChange={e => setFB(e.target.value)}>
          <option value="">Todos los buses</option>
          {buses.map(b => <option key={b.id} value={b.id}>{b.numero_bus || b.nombre}</option>)}
        </select>
        <select className="input" style={{ width: 150 }} value={filterEstado} onChange={e => setFE(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PRESENTE">PRESENTE</option>
          <option value="AUSENTE">AUSENTE</option>
          <option value="RECHAZO">RECHAZO</option>
        </select>
        <select className="input" style={{ width: 140 }} value={filterTipo} onChange={e => setFT(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="NFC">NFC</option>
          <option value="MANUAL">MANUAL</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span className="text-muted text-sm" style={{ alignSelf: 'center', marginRight: 10 }}>{filtered.length} registros</span>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-success btn-sm" id="btn-export-excel" onClick={handleExportExcel} style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: 'white' }}>
            <Download size={14} /> Excel
          </button>
          <button className="btn btn-danger btn-sm" id="btn-export-pdf" onClick={handleExportPDF} style={{ backgroundColor: '#d13438', borderColor: '#d13438', color: 'white' }}>
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><ClipboardList size={16} /> Registros de Asistencia</span>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos desde Supabase...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Bus</th>
                  <th>Supervisor</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Sync</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9}><div className="empty-state"><ClipboardList size={32} /><p>No hay registros para los filtros seleccionados</p></div></td></tr>
                )}
                {filtered.map(reg => {
                  const est = getEstudianteById(reg.id_estudiante)
                  const bus = getBusById(reg.id_bus)
                  const sup = getSupervisorById(reg.id_supervisor)
                  return (
                    <tr key={reg.id}>
                      <td><strong>{est?.nombre ?? '—'}</strong></td>
                      <td><span className="chip">{est?.curso}</span></td>
                      <td>{bus?.numero_bus ?? bus?.nombre ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>{sup?.nombre ?? '—'}</td>
                      <td className="font-mono text-sm">{reg.fecha}</td>
                      <td className="font-mono">{reg.hora}</td>
                      <td><span className={`badge badge-${tipoColor[reg.tipo_registro]}`}>{reg.tipo_registro}</span></td>
                      <td>
                        <span className={`badge badge-${estadoColor[reg.estado]}`}>{reg.estado}</span>
                        {reg.motivo_rechazo && <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>{reg.motivo_rechazo}</div>}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: reg.sincronizado ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                          {reg.sincronizado ? '✓ Sync' : '⏳ Pendiente'}
                        </span>
                      </td>
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
