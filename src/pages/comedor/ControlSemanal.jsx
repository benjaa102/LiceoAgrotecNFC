import { useState, useEffect } from 'react'
import { Calendar, RefreshCw, UtensilsCrossed, Coffee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { startOfWeek, addDays, format } from 'date-fns'
import { es } from 'date-fns/locale/es'

export default function ControlSemanal() {
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState([])

  // Calculate current week (Monday to Friday)
  const today = new Date()
  const start = startOfWeek(today, { weekStartsOn: 1 }) // Monday
  const DIAS_SEMANA = Array.from({ length: 5 }).map((_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
  const LABELS_DIAS = Array.from({ length: 5 }).map((_, i) => format(addDays(start, i), 'EEEE d', { locale: es }))

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('registros_comedor')
      .select('*')
      .gte('fecha', DIAS_SEMANA[0])
      .lte('fecha', DIAS_SEMANA[4])
      
    if (data) setRegistros(data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Helper to count attendees for a specific service and date
  const getCount = (servicio, fecha) => {
    return registros.filter(r => r.tipo_servicio === servicio && r.fecha === fecha).length
  }

  const SERVICIOS = [
    { id: 'DESAYUNO', label: 'Desayuno', icon: Coffee,          color: 'var(--warning)', bg: 'var(--warning-bg)' },
    { id: 'ALMUERZO', label: 'Almuerzo', icon: UtensilsCrossed, color: 'var(--primary)', bg: 'var(--primary-glow)' },
    { id: 'CENA',     label: 'Cena',     icon: UtensilsCrossed, color: 'var(--purple)',  bg: 'var(--purple-bg)' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
          <Calendar size={18} style={{ color: 'var(--primary)' }} /> 
          Semana del {format(start, 'd', { locale: es })} al {format(addDays(start, 4), "d 'de' MMMM yyyy", { locale: es })}
        </div>

        <button className="btn btn-secondary" onClick={loadData} disabled={loading} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Actualizar Datos
        </button>
      </div>

      {/* Main Aggregated Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><UtensilsCrossed size={16} /> Asistencia General de la Semana</span>
        </div>
        
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando control semanal...</div>
          ) : (
            <table style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160, padding: '16px 20px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Servicio
                  </th>
                  {LABELS_DIAS.map((lbl) => (
                    <th key={lbl} style={{ textAlign: 'center', padding: '16px 12px', fontSize: 13, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                      {lbl}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '16px 12px', fontSize: 13, color: 'var(--text-primary)' }}>
                    Total Semanal
                  </th>
                </tr>
              </thead>
              <tbody>
                {SERVICIOS.map(serv => {
                  let totalSemana = 0;
                  return (
                    <tr key={serv.id}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: serv.bg, border: `1px solid ${serv.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: serv.color }}>
                            <serv.icon size={18} />
                          </div>
                          <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>{serv.label}</strong>
                        </div>
                      </td>
                      
                      {DIAS_SEMANA.map((fecha, idx) => {
                        const count = getCount(serv.id, fecha)
                        totalSemana += count
                        // Si es cena y es viernes, mostrar "-" ya que no hay cena los viernes.
                        const esCenaViernes = serv.id === 'CENA' && LABELS_DIAS[idx].toLowerCase().startsWith('viernes')
                        
                        return (
                          <td key={fecha} style={{ textAlign: 'center', padding: '16px 12px' }}>
                            {esCenaViernes ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>-</span>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 32, borderRadius: 8, background: count > 0 ? `${serv.color}20` : 'transparent', color: count > 0 ? serv.color : 'var(--text-muted)', fontWeight: count > 0 ? 800 : 500, fontSize: 16 }}>
                                {count}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      
                      <td style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 16px', borderRadius: 20, background: serv.bg, border: `1px solid ${serv.color}40`, color: serv.color, fontWeight: 800, fontSize: 16 }}>
                          {totalSemana}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Cards resumen */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          {SERVICIOS.map(serv => {
            const total = DIAS_SEMANA.reduce((sum, fecha) => sum + getCount(serv.id, fecha), 0)
            return (
              <div key={serv.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: serv.bg, color: serv.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <serv.icon size={24} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Total {serv.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{total}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
