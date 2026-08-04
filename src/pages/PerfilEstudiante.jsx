import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Calendar as CalendarIcon, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function PerfilEstudiante() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [estudiante, setEstudiante] = useState(null)
  const [registrosComedor, setRegistrosComedor] = useState([])
  const [asistenciaBuses, setAsistenciaBuses] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('AMBOS') // 'AMBOS' | 'COMEDOR' | 'TRANSPORTE'

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const { data: estData } = await supabase.from('estudiantes').select('*').eq('id', id).single()
      if (estData) setEstudiante(estData)
        
      const { data: comData } = await supabase.from('registros_comedor').select('*').eq('id_estudiante', id)
      if (comData) setRegistrosComedor(comData)
        
      const { data: busData } = await supabase.from('asistencia_buses').select('*').eq('id_estudiante', id)
      if (busData) setAsistenciaBuses(busData)
        
      setLoading(false)
    }
    if (id) loadData()
  }, [id])

  const { month, year } = useMemo(() => {
    return { month: currentDate.getMonth(), year: currentDate.getFullYear() }
  }, [currentDate])

  const filteredRegistros = useMemo(() => {
    const combined = []
    if (viewMode === 'AMBOS' || viewMode === 'COMEDOR') {
      registrosComedor.forEach(r => combined.push({ ...r, _source: 'COMEDOR', _displayType: r.tipo_servicio }))
    }
    if (viewMode === 'AMBOS' || viewMode === 'TRANSPORTE') {
      asistenciaBuses.forEach(r => combined.push({ ...r, _source: 'TRANSPORTE', _displayType: r.tipo_registro }))
    }
    // Filter by current month
    const targetMonth = String(month + 1).padStart(2, '0')
    const targetYear = String(year)
    const filtered = combined.filter(r => r.fecha?.startsWith(`${targetYear}-${targetMonth}`))
    return filtered.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora))
  }, [registrosComedor, asistenciaBuses, month, year, viewMode])

  const metrics = useMemo(() => {
    const presentes = filteredRegistros.filter(r => r.estado !== 'AUSENTE' && r.estado !== 'RECHAZO').length
    const ausentes = filteredRegistros.filter(r => r.estado === 'AUSENTE' || r.estado === 'RECHAZO').length
    const total = presentes + ausentes
    const porcentaje = total === 0 ? 0 : Math.round((presentes / total) * 100)
    return { presentes, ausentes, porcentaje }
  }, [filteredRegistros])

  const getInitials = (name) => {
    if (!name) return ''
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase()
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

  // Calendar logic
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sunday, 1 = Monday
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1 // Make Monday = 0
  
  const daysArray = []
  for (let i = 0; i < startOffset; i++) daysArray.push(null)
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(i)

  const getDayStatus = (day) => {
    if (!day) return null
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const recs = filteredRegistros.filter(r => r.fecha === dateStr)
    if (recs.length === 0) return 'empty'
    if (recs.some(r => r.estado === 'RECHAZO')) return 'rechazo'
    if (recs.some(r => r.estado === 'AUSENTE')) return 'ausente'
    return 'presente'
  }

  const getBase64Image = async (url) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const downloadPDF = async () => {
    if (!estudiante) return
    const doc = new jsPDF()
    
    // Add Logo
    const logoBase64 = await getBase64Image('/logo-liceo.png')
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 14, 10, 20, 25)
    }

    doc.setFontSize(16)
    doc.setTextColor(40, 40, 40)
    doc.text('FICHA DE ASISTENCIA ESTUDIANTIL', 40, 20)
    
    doc.setFontSize(10)
    doc.text(`Liceo Bicentenario Agrícola Tecnológico`, 40, 26)
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-CL')}`, 40, 32)
    
    doc.setLineWidth(0.5)
    doc.line(14, 40, 196, 40)

    // Info Estudiante
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("DATOS DEL ESTUDIANTE", 14, 50)
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text(`Nombre: ${estudiante.nombre}`, 14, 58)
    doc.text(`RUT: ${estudiante.rut || 'N/A'}`, 120, 58)
    doc.text(`Curso: ${estudiante.curso || 'N/A'}`, 14, 64)
    doc.text(`Tipo: ${estudiante.tipo || 'N/A'}`, 120, 64)
    
    doc.setLineWidth(0.2)
    doc.line(14, 70, 196, 70)

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`REGISTROS DE ASISTENCIA - ${monthNames[month]} ${year}`, 14, 80)
    if (viewMode !== 'AMBOS') {
      doc.setFontSize(10)
      doc.text(`Filtro: ${viewMode}`, 14, 86)
    }

    const tableData = filteredRegistros.map(r => [
      r.fecha,
      r.hora,
      r._source,
      r._displayType,
      r.estado || 'PRESENTE'
    ])

    doc.autoTable({
      startY: viewMode !== 'AMBOS' ? 90 : 85,
      head: [['Fecha', 'Hora', 'Módulo', 'Servicio / Tipo', 'Estado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 }
    })

    doc.save(`Ficha_Asistencia_${estudiante.rut || estudiante.nombre.replace(/\s+/g, '_')}_${monthNames[month]}_${year}.pdf`)
  }

  if (loading || !estudiante) return <div style={{ padding: 40, color: 'white', textAlign: 'center' }}>Cargando perfil...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header / Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => navigate('/estudiantes')}>
        <ArrowLeft size={18} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>Volver a Estudiantes</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, alignItems: 'start' }}>
        
        {/* Top Col: Profile & Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: 15 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700 }}>
              {getInitials(estudiante.nombre)}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 5 }}>{estudiante.nombre}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{estudiante.curso}</div>
            </div>
            <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: 12 }}>{estudiante.estado_autorizacion}</span>
          </div>

          <div className="card">
            <div className="card-header" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 15 }}>
              <span className="card-title" style={{ fontSize: 12, color: 'var(--primary)', letterSpacing: 1 }}><FileText size={14} /> INFORMACIÓN PERSONAL</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>RUT</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{estudiante.rut || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>MATRÍCULA</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{estudiante.matricula || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>TIPO</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{estudiante.tipo || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>RECORRIDO</span>
                <span style={{ color: 'white', fontWeight: 600, textAlign: 'right' }}>{estudiante.id_recorrido ? 'Asignado' : 'Sin Asignar'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>DIRECCIÓN</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{estudiante.direccion || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Col: Metrics & Calendar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="btn-group" style={{ background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 4 }}>
              {['AMBOS', 'COMEDOR', 'TRANSPORTE'].map(tab => (
                <button 
                  key={tab} 
                  className={`btn btn-sm ${viewMode === tab ? 'btn-primary' : ''}`}
                  style={{ background: viewMode === tab ? 'var(--primary)' : 'transparent', color: viewMode === tab ? 'white' : 'var(--text-muted)', border: 'none', boxShadow: 'none' }}
                  onClick={() => setViewMode(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadPDF}>
              <Download size={14} /> Descargar Ficha
            </button>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15 }}>
            <div className="card" style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 5 }}>ASISTENCIA</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: metrics.porcentaje > 75 ? 'var(--success)' : metrics.porcentaje > 40 ? 'var(--warning)' : 'var(--danger)' }}>
                {metrics.porcentaje}%
              </div>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 5 }}>PRESENTES</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>{metrics.presentes}</div>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 5 }}>AUSENTES / RECHAZOS</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger)' }}>{metrics.ausentes}</div>
            </div>
          </div>

          {/* Calendar */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'white', fontWeight: 600 }}>
                <CalendarIcon size={16} /> Asistencia Mensual
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, background: 'var(--bg-body)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <button className="btn btn-icon btn-sm" style={{ border: 'none', background: 'transparent' }} onClick={prevMonth}>&lt;</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white', minWidth: 120, textAlign: 'center' }}>{monthNames[month]} {year}</span>
                <button className="btn btn-icon btn-sm" style={{ border: 'none', background: 'transparent' }} onClick={nextMonth}>&gt;</button>
              </div>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 15 }}>
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
                {daysArray.map((day, idx) => {
                  const status = getDayStatus(day)
                  let bg = 'var(--bg-body)'
                  let border = '1px solid var(--border)'
                  let color = 'var(--text-muted)'
                  
                  if (status === 'presente') { bg = 'rgba(34, 197, 94, 0.1)'; border = '1px solid var(--success)'; color = 'var(--success)' }
                  if (status === 'ausente')  { bg = 'rgba(245, 158, 11, 0.1)'; border = '1px solid var(--warning)'; color = 'var(--warning)' }
                  if (status === 'rechazo')  { bg = 'rgba(239, 68, 68, 0.1)'; border = '1px dashed var(--danger)'; color = 'var(--danger)' }
                  
                  if (!day) return <div key={idx} />
                  
                  return (
                    <div key={idx} style={{ aspectRatio: '1/1', background: bg, border: border, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, fontWeight: 600, fontSize: 14 }}>
                      {day}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ fontSize: 14 }}>Detalle de Registros ({filteredRegistros.length})</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>HORA</th>
                    <th>MÓDULO</th>
                    <th>SERVICIO / TIPO</th>
                    <th>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistros.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No hay registros este mes</td></tr>
                  )}
                  {filteredRegistros.map((r, i) => (
                    <tr key={i}>
                      <td className="font-mono">{r.fecha}</td>
                      <td className="font-mono">{r.hora}</td>
                      <td><span className={`chip ${r._source === 'COMEDOR' ? 'bg-primary' : 'bg-info'}`}>{r._source}</span></td>
                      <td><strong>{r._displayType}</strong></td>
                      <td>
                        <span className={`badge badge-${(!r.estado || r.estado === 'PRESENTE') ? 'success' : r.estado === 'AUSENTE' ? 'warning' : 'danger'}`}>
                          {r.estado || 'PRESENTE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
