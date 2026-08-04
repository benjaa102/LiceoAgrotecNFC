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
    try {
      const doc = new jsPDF()
      
      // Try to add Logo (won't fail if image can't load)
      try {
        const logoBase64 = await getBase64Image('/logo-liceo.png')
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 14, 10, 20, 25)
        }
      } catch (logoErr) {
        console.warn('Logo could not be loaded, continuing without it.')
      }

      doc.setFontSize(16)
      doc.setTextColor(40, 40, 40)
      doc.text('FICHA DE ASISTENCIA ESTUDIANTIL', 40, 20)
      
      doc.setFontSize(10)
      doc.text('Liceo Bicentenario Agricola Tecnologico', 40, 26)
      doc.text('Fecha de Emision: ' + new Date().toLocaleDateString('es-CL'), 40, 32)
      
      doc.setLineWidth(0.5)
      doc.line(14, 40, 196, 40)

      // Info Estudiante
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('DATOS DEL ESTUDIANTE', 14, 50)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Nombre: ' + (estudiante.nombre || ''), 14, 58)
      doc.text('RUT: ' + (estudiante.rut || 'N/A'), 120, 58)
      doc.text('Curso: ' + (estudiante.curso || 'N/A'), 14, 64)
      doc.text('Tipo: ' + (estudiante.tipo || 'N/A'), 120, 64)
      
      doc.setLineWidth(0.2)
      doc.line(14, 70, 196, 70)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('REGISTROS DE ASISTENCIA - ' + monthNames[month] + ' ' + year, 14, 80)
      let startY = 85
      if (viewMode !== 'AMBOS') {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('Filtro: ' + viewMode, 14, 86)
        startY = 90
      }

      const tableData = filteredRegistros.map(r => [
        r.fecha || '',
        r.hora || '',
        r._source || '',
        r._displayType || '',
        r.estado || 'PRESENTE'
      ])

      doc.autoTable({
        startY: startY,
        head: [['Fecha', 'Hora', 'Modulo', 'Servicio / Tipo', 'Estado']],
        body: tableData.length > 0 ? tableData : [['Sin registros', '', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 }
      })

      const filename = 'Ficha_Asistencia_' + (estudiante.rut || estudiante.nombre || 'estudiante').replace(/[^a-zA-Z0-9]/g, '_') + '_' + monthNames[month] + '_' + year + '.pdf'
      doc.save(filename)
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Error al generar el PDF: ' + err.message)
    }
  }

  if (loading || !estudiante) return <div style={{ padding: 40, color: 'white', textAlign: 'center' }}>Cargando perfil...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top bar: Back + Tabs + Download */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => navigate('/estudiantes')}>
          <ArrowLeft size={16} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Volver</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'var(--bg-card)', padding: 3, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 3 }}>
            {['AMBOS', 'COMEDOR', 'TRANSPORTE'].map(tab => (
              <button 
                key={tab} 
                className="btn btn-sm"
                style={{ background: viewMode === tab ? 'var(--primary)' : 'transparent', color: viewMode === tab ? 'white' : 'var(--text-muted)', border: 'none', boxShadow: 'none', fontSize: 11, padding: '5px 12px' }}
                onClick={() => setViewMode(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={downloadPDF} style={{ fontSize: 12 }}>
            <Download size={13} /> Descargar Ficha
          </button>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        
        {/* ===== LEFT SIDEBAR ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
          {/* Avatar Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
              {getInitials(estudiante.nombre)}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 3 }}>{estudiante.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{estudiante.curso}</div>
            </div>
            <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: 11 }}>{estudiante.estado_autorizacion}</span>
          </div>

          {/* Info Card */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <FileText size={13} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--primary)', letterSpacing: 1, fontWeight: 700 }}>INFORMACIÓN PERSONAL</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['RUT', estudiante.rut],
                ['MATRÍCULA', estudiante.matricula],
                ['TIPO', estudiante.tipo],
                ['RECORRIDO', estudiante.id_recorrido ? 'Asignado' : 'Sin Asignar'],
                ['DIRECCIÓN', estudiante.direccion],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'white', fontWeight: 600, textAlign: 'right', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== RIGHT CONTENT ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>ASISTENCIA</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: metrics.porcentaje > 75 ? 'var(--success)' : metrics.porcentaje > 40 ? 'var(--warning)' : 'var(--danger)' }}>
                {metrics.porcentaje}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{metrics.porcentaje > 75 ? 'Excelente' : metrics.porcentaje > 40 ? 'Regular' : 'Crítico'}</div>
            </div>
            <div className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>PRESENTES</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>{metrics.presentes}</div>
            </div>
            <div className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>AUS. JUSTIF.</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--warning)' }}>{filteredRegistros.filter(r => r.estado === 'AUSENTE').length}</div>
            </div>
            <div className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>AUSENTES</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)' }}>{metrics.ausentes}</div>
            </div>
          </div>

          {/* Calendar — compact, constrained width */}
          <div className="card" style={{ maxWidth: 520 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white', fontWeight: 600, fontSize: 13 }}>
                <CalendarIcon size={15} /> Asistencia Mensual
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-body)', padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <button className="btn btn-icon btn-sm" style={{ border: 'none', background: 'transparent', padding: 4 }} onClick={prevMonth}>&lt;</button>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'white', minWidth: 110, textAlign: 'center' }}>{monthNames[month]} {year}</span>
                <button className="btn btn-icon btn-sm" style={{ border: 'none', background: 'transparent', padding: 4 }} onClick={nextMonth}>&gt;</button>
              </div>
            </div>
            
            <div style={{ padding: '12px 16px 16px' }}>
              {/* Day labels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              {/* Day cells — compact, no aspect-ratio */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {daysArray.map((day, idx) => {
                  const status = getDayStatus(day)
                  let bg = 'var(--bg-body)'
                  let border = '1px solid var(--border)'
                  let color = 'var(--text-muted)'
                  
                  if (status === 'presente') { bg = 'rgba(34, 197, 94, 0.15)'; border = '1px solid var(--success)'; color = 'var(--success)' }
                  if (status === 'ausente')  { bg = 'rgba(245, 158, 11, 0.15)'; border = '1px solid var(--warning)'; color = 'var(--warning)' }
                  if (status === 'rechazo')  { bg = 'rgba(239, 68, 68, 0.15)'; border = '1px dashed var(--danger)'; color = 'var(--danger)' }
                  
                  if (!day) return <div key={idx} />
                  
                  const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
                  
                  return (
                    <div key={idx} style={{ 
                      height: 36, background: bg, border: border, borderRadius: 6, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      color: color, fontWeight: isToday ? 800 : 500, fontSize: 13,
                      boxShadow: isToday ? '0 0 0 2px var(--primary)' : 'none'
                    }}>
                      {day}
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                {[
                  { color: 'var(--success)', label: 'Presente' },
                  { color: 'var(--warning)', label: 'Ausente' },
                  { color: 'var(--danger)', label: 'Rechazo' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
