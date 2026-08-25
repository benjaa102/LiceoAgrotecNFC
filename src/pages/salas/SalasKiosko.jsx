import { useState, useEffect, useRef } from 'react'
import { Monitor, Wifi, UserCheck, XCircle, LogOut, CheckCircle2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function SalasKiosko() {
  const [status, setStatus] = useState('waiting_teacher') // waiting_teacher | active
  const [activeDocente, setActiveDocente] = useState(null)
  const [lastScan, setLastScan] = useState(null) // { type: 'success' | 'error', title, desc }
  const [sessionStudents, setSessionStudents] = useState([])
  // Db caches
  const [credencialesDb, setCredencialesDb] = useState([])
  const [estudiantesDb, setEstudiantesDb] = useState([])
  const [docentesDb, setDocentesDb] = useState([])
  
  const [inputBuffer, setInputBuffer] = useState('')
  const [nfcActive, setNfcActive] = useState(false)
  const idleTimeout = useRef(null)

  useEffect(() => {
    const loadCaches = async () => {
      const [resC, resE, resD] = await Promise.all([
        supabase.from('credenciales').select('*'),
        supabase.from('estudiantes').select('*'),
        supabase.from('docentes').select('*')
      ])
      if (resC.data) setCredencialesDb(resC.data)
      if (resE.data) setEstudiantesDb(resE.data)
      if (resD.data) setDocentesDb(resD.data)
    }
    loadCaches()
    
    // Auto refresh every 5 mins to catch new credentials
    const intv = setInterval(loadCaches, 300000)
    
    // Refresh on tab focus
    const onFocus = () => {
      if (document.visibilityState === 'visible') loadCaches()
    }
    document.addEventListener('visibilitychange', onFocus)
    
    return () => {
      clearInterval(intv)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  const resetIdle = () => {
    if (idleTimeout.current) clearTimeout(idleTimeout.current)
    idleTimeout.current = setTimeout(() => {
      setLastScan(null)
    }, 5000)
  }

  const handleTeacherScan = (uid) => {
    const cred = credencialesDb.find(c => c.uid_nfc === uid && c.tipo_usuario === 'DOCENTE' && c.estado === 'ACTIVA')
    if (!cred) {
      setLastScan({ type: 'error', title: 'Tarjeta no autorizada', desc: 'No se encontró un docente asociado a esta credencial.' })
      resetIdle()
      return
    }
    const doc = docentesDb.find(d => d.id === cred.id_usuario)
    if (!doc || doc.estado !== 'ACTIVO') {
      setLastScan({ type: 'error', title: 'Docente Inactivo', desc: 'El docente está marcado como inactivo.' })
      resetIdle()
      return
    }
    // Fetch already registered students for this session (today)
    const loadSession = async () => {
      const now = new Date()
      const fecha = now.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
      const { data } = await supabase
        .from('asistencia_salas')
        .select('*')
        .eq('id_docente', doc.id)
        .eq('fecha', fecha)
        .order('hora', { ascending: false })
      
      if (data) {
        setSessionStudents(data)
      }
    }
    loadSession()

    // Activate session
    setActiveDocente(doc)
    setStatus('active')
    setLastScan(null)
  }

  const handleStudentScan = async (uid) => {
    if (status !== 'active' || !activeDocente) return

    const cred = credencialesDb.find(c => c.uid_nfc === uid && c.tipo_usuario === 'ESTUDIANTE' && c.estado === 'ACTIVA')
    if (!cred) {
      setLastScan({ type: 'error', title: 'Credencial inválida', desc: 'Esta tarjeta no pertenece a un estudiante activo.' })
      resetIdle()
      return
    }
    const est = estudiantesDb.find(e => e.id === cred.id_usuario)
    if (!est) return

    try {
      const now = new Date()
      const fecha = now.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
      const hora = now.toLocaleTimeString('en-GB', { timeZone: 'America/Santiago' })

      // Check if already registered today with this teacher
      const { data: exist } = await supabase
        .from('asistencia_salas')
        .select('id')
        .eq('id_docente', activeDocente.id)
        .eq('id_estudiante', est.id)
        .eq('fecha', fecha)
        .maybeSingle()

      if (exist) {
        setLastScan({ type: 'error', title: 'Ya registrado', desc: `${est.nombre} ya marcó asistencia en esta clase hoy.` })
        resetIdle()
        return
      }

      await supabase.from('asistencia_salas').insert([{
        id_docente: activeDocente.id,
        id_estudiante: est.id,
        fecha,
        hora,
        metodo: 'NFC'
      }])

      setLastScan({ type: 'success', title: 'Asistencia Registrada', desc: `${est.nombre} (${est.curso})` })
      setSessionStudents(prev => [{ id_estudiante: est.id, fecha, hora }, ...prev])
      resetIdle()

    } catch (e) {
      console.error(e)
      setLastScan({ type: 'error', title: 'Error de red', desc: 'No se pudo guardar la asistencia.' })
      resetIdle()
    }
  }

  const processScan = (uid) => {
    if (status === 'waiting_teacher') {
      handleTeacherScan(uid)
    } else {
      handleStudentScan(uid)
    }
  }

  // Keyboard emulation support (USB NFC readers)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (inputBuffer.length > 3) {
          processScan(inputBuffer.toUpperCase())
        }
        setInputBuffer('')
      } else if (e.key.length === 1) {
        setInputBuffer(prev => prev + e.key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inputBuffer, status, activeDocente, credencialesDb, estudiantesDb, docentesDb])

  // Native WebNFC support
  useEffect(() => {
    let ndef = null
    let abortController = new AbortController()

    const startNfc = async () => {
      if (!('NDEFReader' in window)) return
      try {
        ndef = new window.NDEFReader()
        await ndef.scan({ signal: abortController.signal })
        setNfcActive(true)
        
        ndef.onreading = event => {
          const uid = event.serialNumber.replace(/:/g, '').toUpperCase()
          processScan(uid)
        }
      } catch (error) {
        setNfcActive(false)
        console.error("NFC Error:", error)
      }
    }
    startNfc()
    
    return () => abortController.abort()
  }, [status, activeDocente, credencialesDb, estudiantesDb, docentesDb])

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={24} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, color: 'var(--text-primary)' }}>
              Terminal de Asistencia (Salas)
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Módulo Independiente
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {nfcActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--success-bg)', color: 'var(--success)', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
              <Wifi size={16} /> NFC Lector Activo
            </div>
          )}
          {status === 'active' && (
            <button className="btn btn-danger" onClick={() => { setStatus('waiting_teacher'); setActiveDocente(null); setLastScan(null); setSessionStudents([]) }}>
              <LogOut size={16} /> Cerrar Sesión
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal View */}
      <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        
        {/* Waiting for Teacher State */}
        {status === 'waiting_teacher' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', padding: 40 }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--bg-body)', border: '4px dashed var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite' }}>
              <UserCheck size={40} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 32, margin: '0 0 12px', color: 'var(--text-primary)' }}>Esperando Docente</h1>
              <p style={{ fontSize: 16, color: 'var(--text-muted)', margin: 0 }}>Por favor, acerca tu credencial de profesor al lector para abrir la clase.</p>
            </div>
            
            {/* Show scan feedback in waiting mode */}
            <div style={{ marginTop: 20, width: '100%', maxWidth: 500, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {lastScan && (
                <div className="fade-in" style={{ background: lastScan.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', border: `2px solid ${lastScan.type === 'success' ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 20, padding: 20, width: '100%', display: 'flex', alignItems: 'center', gap: 16, boxShadow: `0 10px 40px ${lastScan.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}` }}>
                  {lastScan.type === 'success' ? <CheckCircle2 size={32} style={{ color: 'var(--success)' }} /> : <XCircle size={32} style={{ color: 'var(--danger)' }} />}
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: lastScan.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{lastScan.title}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{lastScan.desc}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Class State */}
        {status === 'active' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', padding: 40 }}>
            <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Asistencia Abierta
            </div>
            <h1 style={{ fontSize: 40, margin: '10px 0', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {activeDocente.asignatura}
            </h1>
            <h2 style={{ fontSize: 24, margin: 0, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Prof. {activeDocente.nombre}
            </h2>
            
            <div style={{ marginTop: 40, width: '100%', maxWidth: 500, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!lastScan && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: 0.5 }}>
                  <Wifi size={48} className="pulse-fast" />
                  <span style={{ fontSize: 18, fontWeight: 500 }}>Esperando estudiantes...</span>
                </div>
              )}
              
              {lastScan && (
                <div className="fade-in" style={{ background: lastScan.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', border: `2px solid ${lastScan.type === 'success' ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 20, padding: 30, width: '100%', display: 'flex', alignItems: 'center', gap: 24, boxShadow: `0 10px 40px ${lastScan.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}` }}>
                  {lastScan.type === 'success' ? <CheckCircle2 size={48} style={{ color: 'var(--success)' }} /> : <XCircle size={48} style={{ color: 'var(--danger)' }} />}
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: lastScan.type === 'success' ? 'var(--success)' : 'var(--danger)', marginBottom: 6 }}>{lastScan.title}</div>
                    <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{lastScan.desc}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Alumnos Presentes */}
            <div style={{ marginTop: 40, width: '100%', maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={20} style={{ color: 'var(--primary)' }} />
                  Estudiantes Presentes
                </h3>
                <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 700 }}>
                  {sessionStudents.length} {sessionStudents.length === 1 ? 'alumno' : 'alumnos'}
                </div>
              </div>

              {sessionStudents.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-body)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                  Aún no hay estudiantes registrados en esta clase.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                  {sessionStudents.map((reg, idx) => {
                    const student = estudiantesDb.find(e => e.id === reg.id_estudiante)
                    if (!student) return null
                    return (
                      <div key={idx} className="fade-in" style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{student.nombre}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{student.curso}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {reg.hora.slice(0,5)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
