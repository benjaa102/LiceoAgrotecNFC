import { useState, useMemo, useEffect } from 'react'
import { BarChart3, Download, TrendingUp, Users, Filter, Calendar, Search } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatFecha, makeFilename } from '../../lib/csvExport'
import { exportToExcel, exportToPDF } from '../../lib/exportUtils'
import { supabase } from '../../lib/supabase'

const CURSOS = ['7°', '8°', '1°A', '1°B', '1°C', '1°D', '2°A', '2°B', '2°C', '2°D', '3°A', '3°B', '3°C', '3°D', '4°A', '4°B', '4°C', '4°D']
const DIAS_SEMANA_LABEL = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.fill ?? p.color }}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>
  )
}

const PIE_COLORS = ['#4f8ef7', '#a78bfa']

export default function ReportesComedor() {
  // ─── Filtros Globales (afectan stats, gráficos y exportación) ───
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filterCurso, setFC]       = useState('')
  const [filterServicio, setFS]    = useState('')
  const [filterMetodo, setFM]      = useState('')
  const [filterTipo, setFTipo]     = useState('')
  const [filterDiaSemana, setFDS]  = useState('')
  const [searchNombre, setSearch]  = useState('')

  // ─── Filtros del resumen por estudiante ───
  const [filterMes, setFilterMes]  = useState('2026-07')
  const [filterCursoRes, setFCRes] = useState('')

  // ─── Data State ───
  const [registrosComedor, setRegistrosComedor] = useState([])
  const [estudiantes, setEstudiantes] = useState([])

  useEffect(() => {
    supabase.from('registros_comedor').select('*').order('fecha', { ascending: false }).order('hora', { ascending: false }).then(({data}) => {
      if (data) setRegistrosComedor(data)
    })
    supabase.from('estudiantes').select('*').then(({data}) => {
      if (data) setEstudiantes(data)
    })
  }, [])

  const getEstudianteById = (id) => estudiantes.find(e => e.id === id)

  // ─── Filtrado global de registros ───
  const filteredRegs = useMemo(() => {
    return registrosComedor.filter(r => {
      const est = getEstudianteById(r.id_estudiante)
      if (!est) return false

      // Rango de fechas
      if (fechaDesde && r.fecha < fechaDesde) return false
      if (fechaHasta && r.fecha > fechaHasta) return false

      // Curso
      if (filterCurso && est.curso !== filterCurso) return false

      // Servicio
      if (filterServicio && (r.tipo_servicio || '').toUpperCase() !== filterServicio.toUpperCase()) return false

      // Método
      if (filterMetodo && r.metodo !== filterMetodo) return false

      // Tipo alumno
      if (filterTipo && est.tipo !== filterTipo) return false

      // Día de la semana (1=Lunes ... 5=Viernes)
      if (filterDiaSemana) {
        const dayOfWeek = new Date(r.fecha + 'T12:00:00').getDay()
        // JS: 0=Domingo, 1=Lunes, etc. Convertimos
        const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek
        if (String(isoDay) !== filterDiaSemana) return false
      }

      // Búsqueda nombre
      if (searchNombre) {
        const q = searchNombre.toLowerCase()
        if (!est.nombre.toLowerCase().includes(q) && !(est.rut || '').includes(q)) return false
      }

      return true
    })
  }, [fechaDesde, fechaHasta, filterCurso, filterServicio, filterMetodo, filterTipo, filterDiaSemana, searchNombre, registrosComedor, estudiantes])

  // ─── Stats calculados sobre los filtrados ───
  const totalRegs     = filteredRegs.length
  const totalAlmuerzo = filteredRegs.filter(r => (r.tipo_servicio || '').toUpperCase() === 'ALMUERZO').length
  const totalDesayuno = filteredRegs.filter(r => (r.tipo_servicio || '').toUpperCase() === 'DESAYUNO').length
  const totalCena     = filteredRegs.filter(r => (r.tipo_servicio || '').toUpperCase() === 'CENA').length
  const totalNFC      = filteredRegs.filter(r => r.metodo === 'NFC').length
  const totalManual   = filteredRegs.filter(r => r.metodo === 'MANUAL').length
  const pctNFC        = totalRegs > 0 ? Math.round((totalNFC / totalRegs) * 100) : 0

  // Datos para gráficos (basados en filtrados)
  const fechasUnicas = [...new Set(filteredRegs.map(r => r.fecha))].sort()
  const porDia = fechasUnicas.map(fecha => {
    const label = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })
    return {
      dia: label,
      Almuerzo: filteredRegs.filter(r => r.fecha === fecha && (r.tipo_servicio || '').toUpperCase() === 'ALMUERZO').length,
      Desayuno: filteredRegs.filter(r => r.fecha === fecha && (r.tipo_servicio || '').toUpperCase() === 'DESAYUNO').length,
      Cena:     filteredRegs.filter(r => r.fecha === fecha && (r.tipo_servicio || '').toUpperCase() === 'CENA').length,
    }
  })

  const pieMetodo = [
    { name: 'NFC', value: totalNFC },
    { name: 'Manual', value: totalManual },
  ]

  // Ranking filtrado
  const ranking = useMemo(() => {
    const map = {}
    filteredRegs.forEach(r => {
      if (!map[r.id_estudiante]) map[r.id_estudiante] = { alm: 0, des: 0, cen: 0 }
      if ((r.tipo_servicio || '').toUpperCase() === 'ALMUERZO') map[r.id_estudiante].alm++
      else if ((r.tipo_servicio || '').toUpperCase() === 'CENA') map[r.id_estudiante].cen++
      else map[r.id_estudiante].des++
    })
    return Object.entries(map)
      .map(([id, v]) => ({ est: getEstudianteById(id), ...v, total: v.alm + v.des + v.cen }))
      .filter(x => x.est)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [filteredRegs, estudiantes])

  // ─── Exportaciones ───
  const colsResumen = [
    { header: 'Nombre Completo', key: 'nombre', width: 35, align: 'left' },
    { header: 'RUT', key: 'rut', width: 15, align: 'center' },
    { header: 'Matrícula', key: 'matricula', width: 12, align: 'center' },
    { header: 'Curso', key: 'curso', width: 10, align: 'center' },
    { header: 'Tipo (Int/Ext)', key: 'tipo', width: 15, align: 'center' },
    { header: 'Días Almuerzo', key: 'dias_almuerzo', width: 15, align: 'center' },
    { header: 'Días Desayuno', key: 'dias_desayuno', width: 15, align: 'center' },
    { header: 'Días Cena', key: 'dias_cena', width: 15, align: 'center' },
    { header: 'Total Días', key: 'total', width: 15, align: 'center' },
  ]

  const getRowsResumen = () => {
    const filteredEst = filterCursoRes ? estudiantes.filter(e => e.curso === filterCursoRes) : estudiantes
    return filteredEst.map(e => {
      const regs = registrosComedor.filter(r => r.id_estudiante === e.id && r.fecha.startsWith(filterMes))
      const dias_alm = regs.filter(r => (r.tipo_servicio || '').toUpperCase() === 'ALMUERZO').length
      const dias_des = regs.filter(r => (r.tipo_servicio || '').toUpperCase() === 'DESAYUNO').length
      const dias_cen = regs.filter(r => (r.tipo_servicio || '').toUpperCase() === 'CENA').length
      return {
        nombre: e.nombre,
        rut: e.rut,
        matricula: e.matricula,
        curso: e.curso,
        tipo: e.tipo,
        dias_almuerzo: dias_alm,
        dias_desayuno: dias_des,
        dias_cena: dias_cen,
        total: dias_alm + dias_des + dias_cen,
      }
    })
  }

  const exportResumenEstudiantesExcel = () => {
    exportToExcel(getRowsResumen(), colsResumen, makeFilename('resumen_comedor', { mes: filterMes, curso: filterCursoRes }), `Resumen Comedor ${filterMes}`)
  }

  const exportResumenEstudiantesPDF = () => {
    exportToPDF(getRowsResumen(), colsResumen, makeFilename('resumen_comedor', { mes: filterMes, curso: filterCursoRes }), `Resumen Comedor ${filterMes}`)
  }

  const colsHistorico = [
    { header: 'Nombre Estudiante', key: 'nombre', width: 35, align: 'left' },
    { header: 'RUT', key: 'rut', width: 15, align: 'center' },
    { header: 'Matrícula', key: 'matricula', width: 12, align: 'center' },
    { header: 'Curso', key: 'curso', width: 10, align: 'center' },
    { header: 'Tipo Alumno', key: 'tipo_alumno', width: 15, align: 'center' },
    { header: 'Servicio', key: 'servicio', width: 15, align: 'center' },
    { header: 'Fecha', key: 'fecha', width: 15, align: 'center' },
    { header: 'Día de la Semana', key: 'dia_semana', width: 15, align: 'center' },
    { header: 'Hora', key: 'hora', width: 12, align: 'center' },
    { header: 'Método', key: 'metodo', width: 12, align: 'center' },
    { header: 'Observación', key: 'observacion', width: 20, align: 'left' },
  ]

  const getRowsHistorico = () => {
    return filteredRegs.map(r => {
      const e = getEstudianteById(r.id_estudiante)
      const fechaObj = new Date(r.fecha + 'T12:00:00')
      const diaSemana = fechaObj.toLocaleDateString('es-CL', { weekday: 'long' })
      return {
        nombre: e?.nombre ?? '',
        rut: e?.rut ?? '',
        matricula: e?.matricula ?? '',
        curso: e?.curso ?? '',
        tipo_alumno: e?.tipo ?? '',
        servicio: r.tipo_servicio === 'ALMUERZO' ? 'Almuerzo' : r.tipo_servicio === 'CENA' ? 'Cena' : 'Desayuno',
        fecha: r.fecha.split('-').reverse().join('/'),
        dia_semana: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
        hora: r.hora,
        metodo: r.metodo,
        observacion: r.observacion ?? '',
      }
    })
  }

  const exportHistoricoDetalladoExcel = () => {
    exportToExcel(getRowsHistorico(), colsHistorico, makeFilename('historico_comedor', { curso: filterCurso, desde: fechaDesde, hasta: fechaHasta }), 'Historial de Comedor')
  }

  const exportHistoricoDetalladoPDF = () => {
    exportToPDF(getRowsHistorico(), colsHistorico, makeFilename('historico_comedor', { curso: filterCurso, desde: fechaDesde, hasta: fechaHasta }), 'Historial de Comedor')
  }

  const limpiarFiltros = () => {
    setFechaDesde(''); setFechaHasta(''); setFC(''); setFS(''); setFM(''); setFTipo(''); setFDS(''); setSearch('')
  }

  const hayFiltrosActivos = fechaDesde || fechaHasta || filterCurso || filterServicio || filterMetodo || filterTipo || filterDiaSemana || searchNombre

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ─── Stats dinámicos ─── */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
        {[
          { label: 'Total',           v: totalRegs,     color: 'var(--text-primary)', icon: '📋' },
          { label: 'Almuerzos',       v: totalAlmuerzo, color: 'var(--primary)',       icon: '🍽' },
          { label: 'Desayunos',       v: totalDesayuno, color: 'var(--warning)',       icon: '☕' },
          { label: 'Cenas',           v: totalCena,     color: 'var(--purple)',        icon: '🍲' },
          { label: 'Tasa NFC',        v: pctNFC + '%',  color: 'var(--success)',       icon: '📡' },
          { label: 'Manuales',        v: totalManual,   color: 'var(--text-muted)',        icon: '✍️' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: -1 }}>{s.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Panel de Filtros Globales ─── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Filter size={16} /> Filtros del Historial</span>
          {hayFiltrosActivos && (
            <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros} style={{ fontSize: 11 }}>
              ✕ Limpiar Filtros
            </button>
          )}
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Fila 1: Búsqueda + Rango de fechas */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="input-group" style={{ maxWidth: 240 }}>
              <Search size={15} className="input-group-icon" />
              <input className="input" placeholder="Buscar estudiante…" value={searchNombre} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input className="input" type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ width: 148 }} title="Fecha desde" />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
              <input className="input" type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ width: 148 }} title="Fecha hasta" />
            </div>
          </div>

          {/* Fila 2: Filtros categóricos */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" style={{ width: 150 }} value={filterCurso} onChange={e => setFC(e.target.value)}>
              <option value="">Todos los cursos</option>
              {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" style={{ width: 150 }} value={filterServicio} onChange={e => setFS(e.target.value)}>
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
            <select className="input" style={{ width: 160 }} value={filterTipo} onChange={e => setFTipo(e.target.value)}>
              <option value="">Interno y Externo</option>
              <option value="INTERNO">Solo Internos</option>
              <option value="EXTERNO">Solo Externos</option>
            </select>
            <select className="input" style={{ width: 140 }} value={filterDiaSemana} onChange={e => setFDS(e.target.value)}>
              <option value="">Todos los días</option>
              {Object.entries(DIAS_SEMANA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Resumen de filtros activos */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--primary)' }}>{totalRegs}</strong> registros encontrados
              {hayFiltrosActivos && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--warning)' }}>⚡ Filtros activos</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success btn-sm" onClick={exportHistoricoDetalladoExcel} style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: 'white' }}>
                <Download size={14} /> Excel
              </button>
              <button className="btn btn-danger btn-sm" onClick={exportHistoricoDetalladoPDF} style={{ backgroundColor: '#d13438', borderColor: '#d13438', color: 'white' }}>
                <Download size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Exportar Resumen por Estudiante ─── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Download size={16} /> Resumen Mensual por Estudiante</span>
        </div>
        <div className="card-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Cuenta los días que cada alumno asistió al almuerzo y desayuno en un mes determinado. Ideal para informes a JUNAEB.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Mes:</label>
            <input className="input" type="month" value={filterMes} onChange={e => setFilterMes(e.target.value)} style={{ width: 160 }} />
            <select className="input" style={{ width: 150 }} value={filterCursoRes} onChange={e => setFCRes(e.target.value)}>
              <option value="">Todos los cursos</option>
              {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success" onClick={exportResumenEstudiantesExcel} style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: 'white' }}>
                <Download size={14} /> Resumen Excel
              </button>
              <button className="btn btn-danger" onClick={exportResumenEstudiantesPDF} style={{ backgroundColor: '#d13438', borderColor: '#d13438', color: 'white' }}>
                <Download size={14} /> Resumen PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Charts ─── */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title"><BarChart3 size={16} /> Asistencia Diaria {hayFiltrosActivos ? '(Filtrada)' : ''}</span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porDia} barGap={4}>
                  <XAxis dataKey="dia" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,142,247,0.05)' }} />
                  <Bar dataKey="Almuerzo" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Desayuno" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp size={16} /> Método de Registro</span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={pieMetodo} cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={4} dataKey="value">
                    {pieMetodo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {pieMetodo.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                    <span style={{ fontWeight: 800, color: PIE_COLORS[i] }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Ranking ─── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Users size={16} /> Ranking por Asistencia {hayFiltrosActivos ? '(Filtrado)' : ''}</span>
          <span className="text-muted text-sm">Top 10 estudiantes con más registros</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>#</th><th>Estudiante</th><th>Curso</th><th>Tipo</th><th>Almuerzos</th><th>Desayunos</th><th>Total</th><th>Asistencia</th></tr>
            </thead>
            <tbody>
              {ranking.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><Users size={32} /><p>No hay datos para los filtros seleccionados</p></div></td></tr>
              )}
              {ranking.map((item, idx) => {
                const maxDias = fechasUnicas.length || 1
                const pct = Math.round((item.total / (maxDias * 2)) * 100)
                return (
                  <tr key={item.est.id}>
                    <td style={{ fontWeight: 800, color: idx === 0 ? 'gold' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--text-muted)', fontSize: 15 }}>#{idx + 1}</td>
                    <td><strong>{item.est.nombre}</strong></td>
                    <td><span className="chip">{item.est.curso}</span></td>
                    <td><span className={`badge badge-${item.est.tipo === 'INTERNO' ? 'info' : 'purple'}`}>{item.est.tipo}</span></td>
                    <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{item.alm}</td>
                    <td style={{ color: 'var(--warning)', fontWeight: 700 }}>{item.des}</td>
                    <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.total}</td>
                    <td style={{ minWidth: 120 }}>
                      <div className="progress-bar" style={{ height: 8 }}>
                        <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </td>
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
