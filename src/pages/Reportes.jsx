import { useState, useEffect } from 'react'
import { BarChart3, Download, FileSpreadsheet, FileText, TrendingUp, Users } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { supabase } from '../lib/supabase'
import { formatFecha, makeFilename } from '../lib/csvExport'
import { exportToExcel, exportToPDF } from '../lib/exportUtils'

const CURSOS = ['7°', '8°', '1°A', '1°B', '1°C', '1°D', '2°A', '2°B', '2°C', '2°D', '3°A', '3°B', '3°C', '3°D', '4°A', '4°B', '4°C', '4°D']

const COLORS_PIE = ['#4f8ef7', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>
  )
}

export default function Reportes() {
  const [estudiantes, setEstudiantes] = useState([])
  const [recorridos, setRecorridos] = useState([])
  const [buses, setBuses] = useState([])
  const [asistencia, setAsistencia] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterBus, setFB]     = useState('')
  const [filterFecha, setFF]   = useState('')
  const [filterCurso, setFC]   = useState('')
  const [filterCursoEst, setFCE] = useState('')
  const [filterTipoEst, setFTE] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [resEst, resRec, resBus, resAsis] = await Promise.all([
        supabase.from('estudiantes').select('*').order('curso').order('nombre'),
        supabase.from('recorridos').select('*'),
        supabase.from('buses').select('*'),
        supabase.from('asistencia_buses').select('*').order('fecha', { ascending: false }).limit(500)
      ])
      if (resEst.data) setEstudiantes(resEst.data)
      if (resRec.data) setRecorridos(resRec.data)
      if (resBus.data) setBuses(resBus.data)
      if (resAsis.data) setAsistencia(resAsis.data)
      setLoading(false)
    }
    loadData()
  }, [])

  const getRecorridoById = (id) => recorridos.find(r => r.id === id)
  const getEstudianteById = (id) => estudiantes.find(e => e.id === id)

  // Charts data
  const byBus = buses.map(bus => {
    const regs = asistencia.filter(a => a.id_bus === bus.id)
    return {
      name: bus.numero_bus || bus.nombre || bus.id,
      Presentes: regs.filter(a => a.estado === 'PRESENTE').length,
      Ausentes:  regs.filter(a => a.estado === 'AUSENTE').length,
      Rechazos:  regs.filter(a => a.estado === 'RECHAZO').length,
    }
  })

  const pieData = [
    { name: 'Presentes', value: asistencia.filter(a => a.estado === 'PRESENTE').length },
    { name: 'Ausentes',  value: asistencia.filter(a => a.estado === 'AUSENTE').length },
    { name: 'Rechazos',  value: asistencia.filter(a => a.estado === 'RECHAZO').length },
  ]

  const porRecorrido = recorridos.map(r => {
    const ests = estudiantes.filter(e => e.id_recorrido === r.id)
    const regs = asistencia.filter(a => ests.some(e => e.id === a.id_estudiante))
    const presRate = regs.length > 0 ? Math.round((regs.filter(a => a.estado === 'PRESENTE').length / regs.length) * 100) : 0
    return { name: r.nombre?.replace('Recorrido ', '') || r.destino || r.id, tasa: presRate, total: ests.length }
  })

  const fechas = [...new Set(asistencia.map(a => a.fecha))].sort().reverse()

  const colsAsistencia = [
    { header: 'Nombre Estudiante', key: 'nombre', width: 35, align: 'left' },
    { header: 'RUT', key: 'rut', width: 15, align: 'center' },
    { header: 'Curso', key: 'curso', width: 10, align: 'center' },
    { header: 'Bus', key: 'bus', width: 8, align: 'center' },
    { header: 'Fecha', key: 'fecha', width: 12, align: 'center' },
    { header: 'Hora', key: 'hora', width: 8, align: 'center' },
    { header: 'Estado', key: 'estado', width: 12, align: 'center' },
    { header: 'Tipo Registro', key: 'tipo', width: 12, align: 'center' },
    { header: 'Sincronizado', key: 'sincronizado', width: 12, align: 'center' },
  ]

  const getRowsAsistencia = () => {
    return asistencia
      .filter(a => {
        const est = getEstudianteById(a.id_estudiante)
        return (!filterBus || a.id_bus === filterBus) &&
               (!filterFecha || a.fecha === filterFecha) &&
               (!filterCurso || est?.curso === filterCurso)
      })
      .map(a => {
        const est = getEstudianteById(a.id_estudiante)
        return {
          nombre: est?.nombre ?? '',
          rut: est?.rut ?? '',
          curso: est?.curso ?? '',
          bus: buses.find(b => b.id === a.id_bus)?.numero_bus ?? '',
          fecha: formatFecha(a.fecha),
          hora: a.hora,
          estado: a.estado,
          tipo: a.tipo_registro,
          sincronizado: a.sincronizado ? 'Sí' : 'No',
        }
      })
  }

  const handleExportAsistenciaExcel = () => {
    exportToExcel(getRowsAsistencia(), colsAsistencia, makeFilename('reporte_asistencia', { curso: filterCurso, fecha: filterFecha }), 'Reporte de Asistencia Buses')
  }

  const handleExportAsistenciaPDF = () => {
    exportToPDF(getRowsAsistencia(), colsAsistencia, makeFilename('reporte_asistencia', { curso: filterCurso, fecha: filterFecha }), 'Reporte de Asistencia Buses')
  }

  const colsEstudiantes = [
    { header: 'Nombre Completo', key: 'nombre', width: 35, align: 'left' },
    { header: 'RUT', key: 'rut', width: 15, align: 'center' },
    { header: 'Matrícula', key: 'matricula', width: 12, align: 'center' },
    { header: 'Curso', key: 'curso', width: 10, align: 'center' },
    { header: 'Tipo (Int/Ext)', key: 'tipo', width: 15, align: 'center' },
    { header: 'Recorrido Asignado', key: 'recorrido', width: 25, align: 'left' },
    { header: 'Estado Autorización', key: 'estado', width: 20, align: 'center' },
  ]

  const getRowsEstudiantes = () => {
    return estudiantes
      .filter(e => {
        const matchCurso = !filterCursoEst || e.curso === filterCursoEst
        const matchTipo = !filterTipoEst || e.tipo === filterTipoEst
        return matchCurso && matchTipo
      })
      .map(e => ({
        nombre: e.nombre,
        rut: e.rut,
        matricula: e.matricula,
        curso: e.curso,
        tipo: e.tipo,
        recorrido: getRecorridoById(e.id_recorrido)?.nombre ?? e.direccion ?? '',
        estado: e.estado_autorizacion,
      }))
  }

  const handleExportEstudiantesExcel = () => {
    exportToExcel(getRowsEstudiantes(), colsEstudiantes, makeFilename('nomina_estudiantes', { curso: filterCursoEst }), 'Nómina de Estudiantes')
  }

  const handleExportEstudiantesPDF = () => {
    exportToPDF(getRowsEstudiantes(), colsEstudiantes, makeFilename('nomina_estudiantes', { curso: filterCursoEst }), 'Nómina de Estudiantes')
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos desde Supabase...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Exportar */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Download size={16} /> Exportar Datos</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Exportar asistencia */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileSpreadsheet size={18} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Asistencia</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Exportar registros filtrados</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input 
                  type="date" 
                  className="input" 
                  style={{ flex: 1 }} 
                  value={filterFecha} 
                  onChange={e => setFF(e.target.value)}
                  title="Seleccionar fecha"
                />
                <select className="input" style={{ flex: 1 }} value={filterBus} onChange={e => setFB(e.target.value)}>
                  <option value="">Todos los buses</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.numero_bus || b.nombre}</option>)}
                </select>
                <select className="input" style={{ flex: 1 }} value={filterCurso} onChange={e => setFC(e.target.value)}>
                  <option value="">Todos los cursos</option>
                  {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success w-full" id="btn-export-asistencia-excel" onClick={handleExportAsistenciaExcel} style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: 'white' }}>
                  <Download size={14} /> Excel
                </button>
                <button className="btn btn-danger w-full" id="btn-export-asistencia-pdf" onClick={handleExportAsistenciaPDF} style={{ backgroundColor: '#d13438', borderColor: '#d13438', color: 'white' }}>
                  <Download size={14} /> PDF
                </button>
              </div>
            </div>

            {/* Exportar estudiantes */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Lista de Estudiantes</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nómina completa con datos</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select className="input" style={{ flex: 1 }} value={filterCursoEst} onChange={e => setFCE(e.target.value)}>
                  <option value="">Todos los cursos</option>
                  {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input" style={{ flex: 1 }} value={filterTipoEst} onChange={e => setFTE(e.target.value)}>
                  <option value="">Internos y Externos</option>
                  <option value="INTERNO">Solo Internos</option>
                  <option value="EXTERNO">Solo Externos</option>
                </select>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Exporta {filterTipoEst ? (filterTipoEst === 'INTERNO' ? 'internos' : 'externos') : 'estudiantes'} {filterCursoEst ? `del curso ${filterCursoEst}` : 'de todos los cursos'} con recorrido, curso y estado.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success w-full" id="btn-export-estudiantes-excel" onClick={handleExportEstudiantesExcel} style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: 'white' }}>
                  <Download size={14} /> Excel
                </button>
                <button className="btn btn-danger w-full" id="btn-export-estudiantes-pdf" onClick={handleExportEstudiantesPDF} style={{ backgroundColor: '#d13438', borderColor: '#d13438', color: 'white' }}>
                  <Download size={14} /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title"><BarChart3 size={16} /> Asistencia por Bus</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBus}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,142,247,0.05)' }} />
                  <Bar dataKey="Presentes" fill="var(--primary)" radius={[4,4,0,0]} />
                  <Bar dataKey="Ausentes"  fill="var(--warning)" radius={[4,4,0,0]} />
                  <Bar dataKey="Rechazos"  fill="var(--danger)"  radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp size={16} /> Distribución General</span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS_PIE[i], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS_PIE[i] }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tasa por recorrido */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><TrendingUp size={16} /> Tasa de Asistencia por Recorrido</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {porRecorrido.map(r => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 110, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>{r.name}</div>
              <div style={{ flex: 1 }}>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${r.tasa}%` }} />
                </div>
              </div>
              <div style={{ width: 50, textAlign: 'right', fontSize: 13, fontWeight: 700, color: r.tasa >= 80 ? 'var(--success)' : 'var(--warning)' }}>{r.tasa}%</div>
              <div style={{ width: 60, fontSize: 11, color: 'var(--text-muted)' }}>{r.total} est.</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
