import { useState, useEffect, useRef } from 'react'
import { Monitor, Wifi, UserCheck, XCircle, LogOut, CheckCircle2, Users, Clock, ArrowRight, MessageSquare } from 'lucide-react'
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
  const [salasDb, setSalasDb] = useState([])
  
  const [selectedSalaId, setSelectedSalaId] = useState(localStorage.getItem('kiosko_sala_id') || '')
  const [activeClase, setActiveClase] = useState(null)
  const [observacion, setObservacion] = useState('')
  const [manualCurso, setManualCurso] = useState('')
  const [showObsModal, setShowObsModal] = useState(false)
  const [savingObs, setSavingObs] = useState(false)
  
  const [inputBuffer, setInputBuffer] = useState('')
  const [nfcActive, setNfcActive] = useState(false)
  const idleTimeout = useRef(null)

  useEffect(() => {
    const loadCaches = async () => {
      const [resC, resE, resD, resS] = await Promise.all([
        supabase.from('credenciales').select('*'),
        supabase.from('estudiantes').select('*'),
        supabase.from('docentes').select('*'),
        supabase.from('salas').select('*').eq('estado', 'ACTIVA')
      ])
      if (resC.data) setCredencialesDb(resC.data)
      if (resE.data) setEstudiantesDb(resE.data)
      if (resD.data) setDocentesDb(resD.data)
      if (resS.data) setSalasDb(resS.data)
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

    // Detect current class from schedule
    const now = new Date()
    const optionsDay = { weekday: 'long', timeZone: 'America/Santiago' }
    let currentDayStr = now.toLocaleDateString('es-ES', optionsDay)
    currentDayStr = currentDayStr.charAt(0).toUpperCase() + currentDayStr.slice(1)
    if (currentDayStr === 'Miercoles') currentDayStr = 'Miércoles' // Fix accent

    // Block logic
    const currHour = parseInt(now.toLocaleTimeString('es-CL', { hour: '2-digit', hour12: false, timeZone: 'America/Santiago' }))
    const currMin = parseInt(now.toLocaleTimeString('es-CL', { minute: '2-digit', timeZone: 'America/Santiago' }))
    const minutesSinceMidnight = currHour * 60 + currMin

    const bloques = [
      { id: 'ingreso', m: 8*60+10 }, { id: '1', m: 8*60+30 }, { id: '2', m: 9*60+15 },
      { id: '3', m: 10*60+15 }, { id: '4', m: 11*60+0 }, { id: '5', m: 11*60+55 },
      { id: '6', m: 12*60+40 }, { id: 'ingreso2', m: 14*60+0 }, { id: '7', m: 14*60+15 },
      { id: '8', m: 15*60+0 }, { id: '9', m: 16*60+0 }, { id: '10', m: 16*60+45 },
      { id: '11', m: 17*60+30 }
    ]

    let activeBlockId = null
    let minDiff = Infinity
    for (const b of bloques) {
      // Find the block that started most recently or starts in the next 15 mins
      const diff = minutesSinceMidnight - b.m
      if (diff >= -15 && diff < 45) {
        if (Math.abs(diff) < minDiff) {
          minDiff = Math.abs(diff)
          activeBlockId = b.id
        }
      }
    }

    let detectedClass = null
    if (activeBlockId && Array.isArray(doc.horario)) {
      const match = doc.horario.find(h => h.dia === currentDayStr && h.bloque === activeBlockId)
      if (match && (match.curso || match.actividad)) {
        detectedClass = match
      }
    }

    // Activate session
    setActiveDocente(doc)
    setActiveClase(detectedClass)
    setManualCurso(detectedClass?.curso || '')
    setObservacion('')
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

    if (est.estado_autorizacion === 'REVOCADO') {
      setLastScan({ type: 'error', title: 'Credencial Revocada', desc: 'Esta credencial ha sido revocada en el sistema.' })
      resetIdle()
      return
    }

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
        id_sala: selectedSalaId,
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
    if (!selectedSalaId) {
      alert("Por favor, selecciona una Sala en la parte superior antes de registrar asistencia.")
      return
    }
    if (status === 'waiting_teacher') {
      handleTeacherScan(uid)
    } else {
      handleStudentScan(uid)
    }
  }

  const saveObservacion = async () => {
    if (!activeDocente || !selectedSalaId) return
    setSavingObs(true)
    const now = new Date()
    const fecha = now.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    
    try {
      await supabase.from('observaciones_sesion').insert([{
        id_docente: activeDocente.id,
        id_sala: selectedSalaId,
        fecha,
        curso: manualCurso,
        comentario: observacion
      }])
      setActiveClase(prev => ({ ...prev, curso: manualCurso }))
      setShowObsModal(false)
      alert("Observación guardada correctamente.")
    } catch(e) {
      console.error(e)
      alert("Error al guardar la observación.")
    }
    setSavingObs(false)
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
  }, [inputBuffer, status, activeDocente, credencialesDb, estudiantesDb, docentesDb, selectedSalaId, salasDb])

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
  }, [status, activeDocente, credencialesDb, estudiantesDb, docentesDb, selectedSalaId, salasDb])

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

        <div className="kiosko-topbar-controls">
          <select 
            className="input" 
            style={{ width: 220, background: 'var(--bg-surface)', fontWeight: 600 }}
            value={selectedSalaId}
            onChange={e => {
              const val = e.target.value
              setSelectedSalaId(val)
              localStorage.setItem('kiosko_sala_id', val)
            }}
            disabled={status === 'active'}
          >
            <option value="">-- Seleccionar Sala --</option>
            {salasDb.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>

          {nfcActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--success-bg)', color: 'var(--success)', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
              <Wifi size={16} /> NFC Lector Activo
            </div>
          )}
          {status === 'active' && (
            <button className="btn btn-danger" onClick={() => { setStatus('waiting_teacher'); setActiveDocente(null); setActiveClase(null); setLastScan(null); setSessionStudents([]) }}>
              <LogOut size={16} /> Cerrar Sesión
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="ambient-glow" />
        
        {/* Waiting for Teacher State */}
        {status === 'waiting_teacher' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', padding: 40, zIndex: 1 }}>
            <div className="animate-radar" style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--primary-glow)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wifi size={40} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="glass-panel" style={{ padding: '30px 50px', borderRadius: 24, marginTop: 20 }}>
              <h1 style={{ fontSize: 32, margin: '0 0 12px', color: 'var(--text-primary)' }}>
                {selectedSalaId ? (salasDb.find(s => s.id === selectedSalaId)?.nombre || 'Esperando Docente') : 'Configuración Incompleta'}
              </h1>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0 }}>
                {selectedSalaId 
                  ? 'Acerca tu credencial de profesor al lector NFC para abrir la clase.' 
                  : 'Debes seleccionar una sala en el menú superior antes de comenzar.'}
              </p>
            </div>
            
            {/* Show scan feedback in waiting mode */}
            <div style={{ marginTop: 20, width: '100%', maxWidth: 500, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {lastScan && (
                <div className={lastScan.type === 'success' ? 'animate-slide-up' : 'animate-shake'} style={{ background: lastScan.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${lastScan.type === 'success' ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 20, padding: 20, width: '100%', display: 'flex', alignItems: 'center', gap: 16, backdropFilter: 'blur(10px)' }}>
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
          <div className="kiosko-layout">
            
            {/* Left Column: Info & Scanning Area */}
            <div className="kiosko-left">
              
              <div className="glass-panel" style={{ padding: '24px', borderRadius: 24, width: '100%', textAlign: 'center', marginBottom: 40 }}>
                <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'inline-block' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--success)', borderRadius: '50%', marginRight: 6, animation: 'pulse 2s infinite' }}></span>
                  Asistencia Abierta
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {salasDb.find(s => s.id === selectedSalaId)?.nombre || 'Sin sala'}
                </div>
                <h1 style={{ fontSize: 36, margin: '0 0 10px', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {activeClase?.actividad || activeDocente.asignatura}
                </h1>
                {activeClase?.curso && (
                  <h2 style={{ fontSize: 24, margin: '0 0 12px', color: 'var(--primary)', fontWeight: 800 }}>
                    Curso: {activeClase.curso}
                  </h2>
                )}
                <p style={{ fontSize: 18, color: 'var(--text-secondary)', margin: '0 0 16px', fontWeight: 500 }}>
                  Prof. {activeDocente.nombre}
                </p>
                
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {(activeClase || activeDocente.hora_inicio) && (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '6px 16px', borderRadius: 20, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} style={{ color: 'var(--primary)' }}/>
                      {activeClase ? 'Horario detectado' : `${activeDocente.hora_inicio.slice(0,5)} - ${activeDocente.hora_fin.slice(0,5)}`}
                    </div>
                  )}
                  <button className="btn btn-secondary btn-sm" style={{ borderRadius: 20, fontSize: 12 }} onClick={() => setShowObsModal(true)}>
                    <MessageSquare size={14} /> Observaciones
                  </button>
                </div>
              </div>
              
              <div style={{ width: '100%', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!lastScan && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                    <div className="animate-radar" style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-glow)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Wifi size={32} style={{ color: 'var(--primary)' }} />
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)' }}>Acerca tu tarjeta para ingresar...</span>
                  </div>
                )}
                
                {lastScan && (
                  <div className={lastScan.type === 'success' ? 'animate-slide-up' : 'animate-shake'} style={{ background: lastScan.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${lastScan.type === 'success' ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 20, padding: '24px 20px', width: '100%', display: 'flex', alignItems: 'center', gap: 20, backdropFilter: 'blur(10px)' }}>
                    {lastScan.type === 'success' ? <CheckCircle2 size={40} style={{ color: 'var(--success)' }} /> : <XCircle size={40} style={{ color: 'var(--danger)' }} />}
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: lastScan.type === 'success' ? 'var(--success)' : 'var(--danger)', marginBottom: 4 }}>{lastScan.title}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{lastScan.desc}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Present Students Grid */}
            <div className="kiosko-right">
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Users size={20} style={{ color: 'var(--primary)' }} />
                  Estudiantes Presentes
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Total:</span>
                  <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '4px 14px', borderRadius: 20, fontSize: 16, fontWeight: 800, border: '1px solid rgba(79, 142, 247, 0.3)' }}>
                    {sessionStudents.length}
                  </div>
                </div>
              </div>

              <div className="student-grid" style={{ flex: 1 }}>
                {sessionStudents.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', fontSize: 15, marginTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <Users size={48} style={{ opacity: 0.2 }} />
                    La sala está vacía.
                  </div>
                ) : (
                  sessionStudents.map((reg, idx) => {
                    const student = estudiantesDb.find(e => e.id === reg.id_estudiante)
                    if (!student) return null
                    // Get initials
                    const initials = student.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    
                    return (
                      <div key={idx} className="student-card-mini animate-slide-up" style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                            {initials}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 10 }}>
                            {reg.hora.slice(0,5)}
                          </div>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={student.nombre}>
                            {student.nombre}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--primary-light)', fontWeight: 600, marginTop: 2 }}>
                            {student.curso}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {showObsModal && (
        <div className="modal-overlay" onClick={() => setShowObsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Observaciones de Sesión</h2>
              <button className="btn btn-icon" onClick={() => setShowObsModal(false)}><XCircle size={20}/></button>
            </div>
            <div className="modal-body">
              <label className="label">Curso (Manual)</label>
              <input 
                className="input" 
                value={manualCurso}
                onChange={e => setManualCurso(e.target.value)}
                placeholder="Ej: 1°A-C, 3°D"
                style={{ marginBottom: 16 }}
              />
              <label className="label">Comentario (Ej: Reemplazo a otro profesor, Cambio de sala)</label>
              <textarea 
                className="input" 
                rows="4"
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                placeholder="Escribe la observación aquí..."
              ></textarea>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowObsModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveObservacion} disabled={savingObs || !observacion.trim()}>
                {savingObs ? 'Guardando...' : 'Guardar Observación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
