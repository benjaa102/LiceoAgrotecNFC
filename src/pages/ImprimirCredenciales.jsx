import { useState, useEffect } from 'react'
import { Printer, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'

const CURSOS = ['7° Básico', '8° Básico', '1°A', '1°B', '1°C', '1°D', '2°A', '2°B', '2°C', '2°D', '3°A', '3°B', '3°C', '3°D', '4°A', '4°B', '4°C', '4°D']

export default function ImprimirCredenciales() {
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCurso, setFilterCurso] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('estudiantes').select('id, nombre, rut, curso, tipo, estado_autorizacion').order('curso').order('nombre')
      if (data) setEstudiantes(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = estudiantes.filter(e => {
    if (filterCurso && e.curso !== filterCurso) return false
    return true
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            <Printer size={24} style={{ color: 'var(--primary)' }} />
            Generador de Credenciales QR
          </h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Genera e imprime códigos QR masivos para credenciales físicas
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="input" value={filterCurso} onChange={e => setFilterCurso(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">Todos los cursos</option>
            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir {filtered.length} Credenciales
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando estudiantes...</div>
      ) : (
        <div className="print-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 20,
          marginTop: 20
        }}>
          {filtered.map(est => {
            const isActivo = est.estado_autorizacion === 'ACTIVO'
            return (
              <div key={est.id} style={{
                background: 'white',
                border: `2px solid ${isActivo ? '#10b981' : '#ef4444'}`,
                borderRadius: 12,
                padding: 16,
                textAlign: 'center',
                color: '#0f172a',
                pageBreakInside: 'avoid',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {est.nombre}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, fontWeight: 600 }}>
                  {est.rut} • {est.curso}
                </div>
                
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, display: 'inline-block' }}>
                  <QRCodeSVG 
                    value={`${window.location.origin}/perfil/${est.id}`} 
                    size={120} 
                  />
                </div>
                
                <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: isActivo ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
                  Liceo Bicentenario Agrotecnológico
                </div>
              </div>
            )
          })}
          
          {filtered.length === 0 && (
            <div className="no-print" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              No se encontraron estudiantes en este curso.
            </div>
          )}
        </div>
      )}

      {/* Estilos adicionales solo para esta pantalla para manejar la grilla de impresión */}
      <style>{`
        @media print {
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 15px !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
