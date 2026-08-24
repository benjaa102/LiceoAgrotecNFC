import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShieldCheck, ShieldAlert, Bus, MapPin, Hash, BookOpen, AlertTriangle } from 'lucide-react'

export default function PublicProfile() {
  const { id } = useParams()
  const [estudiante, setEstudiante] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      // Fetch student and join with recorridos to get the name
      const { data, error } = await supabase
        .from('estudiantes')
        .select(`
          *,
          recorridos ( nombre )
        `)
        .eq('id', id)
        .single()
      
      if (!error && data) {
        setEstudiante(data)
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
        <div className="spin" style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
      </div>
    )
  }

  if (!estudiante) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white', padding: 20, textAlign: 'center' }}>
        <AlertTriangle size={64} style={{ color: '#ef4444', marginBottom: 20 }} />
        <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 800 }}>Perfil no encontrado</h1>
        <p style={{ margin: 0, color: '#94a3b8' }}>El código QR escaneado no es válido o el estudiante ya no existe en el sistema.</p>
      </div>
    )
  }

  const isActivo = estudiante.estado_autorizacion === 'ACTIVO'

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Card Header */}
        <div style={{ 
          background: isActivo ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          padding: '40px 20px',
          textAlign: 'center',
          color: 'white',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'rgba(255,255,255,0.2)',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backdropFilter: 'blur(4px)'
          }}>
            {isActivo ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
            {estudiante.estado_autorizacion}
          </div>
          
          <div style={{
            width: 80,
            height: 80,
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '50%',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 800,
            color: isActivo ? '#059669' : '#dc2626',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
          }}>
            {estudiante.nombre.slice(0, 2).toUpperCase()}
          </div>
          
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>{estudiante.nombre}</h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.9, fontWeight: 500 }}>{estudiante.rut}</p>
        </div>

        {/* Card Body */}
        <div style={{ padding: '24px 24px 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, marginBottom: 6 }}><BookOpen size={14} /> Curso</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{estudiante.curso}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, marginBottom: 6 }}><Hash size={14} /> Matrícula</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{estudiante.matricula}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: 10, borderRadius: 12 }}>
                <Bus size={20} />
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Recorrido Asignado</div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{estudiante.recorridos?.nombre || 'Sin recorrido'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: 10, borderRadius: 12 }}>
                <MapPin size={20} />
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Dirección / Sector</div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{estudiante.direccion || 'No especificada'}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Liceo Agrotec
          </div>
        </div>
      </div>
    </div>
  )
}
