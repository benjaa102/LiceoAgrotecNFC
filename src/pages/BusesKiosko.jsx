import { useState, useEffect, useRef, useCallback } from 'react'
import { Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle, Search, Clock, RotateCcw, Users, Bus, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchWithCache, saveRecord, subscribe as subscribeOffline, cacheData } from '../lib/offlineManager'

function getLocalToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

// Estado visual del resultado NFC
const ESTADOS = {
  idle:         { bg: 'transparent', border: 'var(--border-bright)', label: '' },
  reading:      { bg: 'rgba(79,142,247,0.07)', border: 'var(--primary)', label: '' },
  success:      { bg: 'rgba(34,197,94,0.08)',  border: 'var(--success)', label: '✓ REGISTRADO' },
  duplicate:    { bg: 'rgba(245,158,11,0.08)', border: 'var(--warning)', label: '⚠ YA REGISTRADO' },
  noRecorrido:  { bg: 'rgba(239,68,68,0.08)', border: 'var(--danger)',  label: '✗ NO PERTENECE A ESTE RECORRIDO' },
  unknown:      { bg: 'rgba(239,68,68,0.08)', border: 'var(--danger)',  label: '✗ TARJETA DESCONOCIDA' },
}

export default function BusesKiosko() {
  const HOY = getLocalToday()
  const HOY_DISPLAY = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const [recorridos, setRecorridos] = useState([])
  const [buses, setBuses] = useState([])
  const [recorridoSel, setRecorridoSel] = useState(null)
  const [resultado, setResultado] = useState('idle')
  const [estudiante, setEstudiante] = useState(null)
  const [registros, setRegistros] = useState([])
  const [horaReg, setHoraReg] = useState('')
  const [prevHora, setPrevHora] = useState('')
  const [modoManual, setModoManual] = useState(false)
  const [busqueda, setBusqueda] = useState({ rut: '', nombre: '', matricula: '' })
  const [resultManual, setResultManual] = useState(null)
  const [obsManual, setObsManual] = useState('')
  const [errorManual, setErrorManual] = useState('')
  const [horaActual, setHoraActual] = useState('')
  const [estudiantesDb, setEstudiantesDb] = useState([])
  const [credencialesDb, setCredencialesDb] = useState([])
  const [searchList, setSearchList] = useState('')
  const [showList, setShowList] = useState(false)
  const nfcRef = useRef(null)
  const timerRef = useRef(null)
  const bufferRef = useRef('')
  const procesarUIDRef = useRef(null)
  const recentScansRef = useRef({})
  const [isWebNfcReading, setIsWebNfcReading] = useState(false)
  const [offlineStatus, setOfflineStatus] = useState({ online: true, syncing: false, pendingCount: 0 })

  // Load data with offline cache
  useEffect(() => {
    fetchWithCache('estudiantes', () => supabase.from('estudiantes').select('*')).then(({ data }) => {
      if (data) setEstudiantesDb(data)
    })
    fetchWithCache('credenciales', () => supabase.from('credenciales').select('*')).then(({ data }) => {
      if (data) setCredencialesDb(data)
    })
    fetchWithCache('recorridos', () => supabase.from('recorridos').select('*').order('nombre')).then(({ data }) => {
      if (data) setRecorridos(data.filter(r => r.estado === 'ACTIVO'))
    })
    fetchWithCache('buses', () => supabase.from('buses').select('*')).then(({ data }) => {
      if (data) setBuses(data)
    })
    fetchWithCache('asistencia_buses_' + HOY, () => supabase.from('asistencia_buses').select('*').eq('fecha', HOY)).then(({ data }) => {
      if (data) {
        setRegistros(prev => {
          const ids = new Set(data.map(r => r.id))
          const pending = prev.filter(r => !ids.has(r.id))
          return [...data, ...pending]
        })
      }
    })

    const unsubOffline = subscribeOffline(setOfflineStatus)

    let channel = null
    if (navigator.onLine) {
      channel = supabase.channel('realtime_buses')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asistencia_buses' }, payload => {
          if (payload.new && payload.new.fecha === HOY) {
            setRegistros(prev => {
              const exists = prev.findIndex(r =>
                r.id_estudiante === payload.new.id_estudiante &&
                r.fecha === payload.new.fecha &&
                r.id_recorrido === payload.new.id_recorrido
              )
              if (exists >= 0) {
                const arr = [...prev]
                arr[exists] = payload.new
                return arr
              }
              return [...prev, payload.new]
            })
          }
        })
        .subscribe()
    }

    return () => {
      unsubOffline()
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  // Real time clock
  useEffect(() => {
    const tick = () => {
      setHoraActual(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Auto focus NFC input
  useEffect(() => {
    if (modoManual || isWebNfcReading || !recorridoSel) return
    const id = setInterval(() => nfcRef.current?.focus(), 600)
    return () => clearInterval(id)
  }, [modoManual, isWebNfcReading, recorridoSel])

  // Reset idle after 4s
  const resetIdle = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setResultado('idle')
      setEstudiante(null)
      setHoraReg('')
      setPrevHora('')
    }, 4000)
  }, [])

  // Get students for a route (same logic as Recorridos.jsx)
  const getStudentsForRoute = (routeId) => {
    return estudiantesDb.filter(e => {
      if (e.id_recorrido === routeId) return true
      // Exception: "La Unión" (r14) students can board "Daiber, Maitén" (r5) or "Caupolicán, Centro" (r8)
      if (e.id_recorrido === 'r14' && (routeId === 'r5' || routeId === 'r8')) return true
      return false
    })
  }

  // Process NFC UID
  const procesarUID = useCallback((uid) => {
    if (!recorridoSel) return
    const uid_upper = uid.trim().toUpperCase()
    const cred = credencialesDb.find(c => c.uid_nfc === uid_upper && c.tipo_usuario === 'ESTUDIANTE' && c.estado === 'ACTIVA')

    if (!cred) {
      setResultado('unknown')
      setEstudiante(null)
      resetIdle()
      return
    }

    const est = estudiantesDb.find(e => e.id === cred.id_usuario)
    setEstudiante(est)

    const nowMs = Date.now()
    if (recentScansRef.current[est.id] && nowMs - recentScansRef.current[est.id] < 5000) return
    recentScansRef.current[est.id] = nowMs

    // Check if student belongs to the selected route
    const routeStudents = getStudentsForRoute(recorridoSel.id)
    if (!routeStudents.find(s => s.id === est.id)) {
      setResultado('noRecorrido')
      resetIdle()
      return
    }

    // Check if already registered today for this route
    const yaReg = registros.find(r => r.id_estudiante === est.id && r.id_recorrido === recorridoSel.id && r.fecha === HOY)
    if (yaReg) {
      setResultado('duplicate')
      setPrevHora(yaReg.hora)
      resetIdle()
      return
    }

    const horaAhora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    setHoraReg(horaAhora)
    setResultado('success')

    const bus = buses.find(b => b.id_recorrido === recorridoSel.id)
    const newReg = {
      id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      id_estudiante: est.id,
      id_recorrido: recorridoSel.id,
      id_bus: bus?.id || null,
      tipo_registro: 'NFC',
      estado: 'PRESENTE',
      fecha: HOY,
      hora: horaAhora,
      metodo: 'NFC',
      observacion: null,
    }

    setRegistros(prev => [...prev, newReg])
    resetIdle()

    saveRecord('asistencia_buses', newReg).then(({ queued }) => {
      if (queued) console.log('[Offline] Bus NFC record queued')
    })
    cacheData('asistencia_buses_' + HOY, [...registros, newReg])
  }, [recorridoSel, registros, resetIdle, credencialesDb, estudiantesDb, buses])

  useEffect(() => {
    procesarUIDRef.current = procesarUID
  }, [procesarUID])

  // HID keyboard capture (NFC reader)
  const handleNFCKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (bufferRef.current.length >= 4) procesarUID(bufferRef.current)
      bufferRef.current = ''
    } else if (e.key.length === 1) {
      bufferRef.current += e.key
    }
  }

  // Web NFC API (mobile)
  const scanNFCWebAPI = async () => {
    if (!('NDEFReader' in window)) {
      alert("Tu navegador no soporta lectura NFC nativa. Usa Chrome en Android o un lector USB en PC.")
      return
    }
    try {
      setIsWebNfcReading(true)
      const ndef = new window.NDEFReader()
      ndef.onreading = event => {
        if (window.navigator.vibrate) window.navigator.vibrate(100)
        if (event.serialNumber) {
          const uid = event.serialNumber.replace(/:/g, '').toUpperCase()
          try { if (procesarUIDRef.current) procesarUIDRef.current(uid) } catch (err) { alert("Error: " + err.message) }
        }
      }
      ndef.onreadingerror = () => { if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]) }
      await ndef.scan()
    } catch (error) {
      alert("Error NFC: " + error.message)
      setIsWebNfcReading(false)
    }
  }

  // Normalize for search
  const normalize = (str) => {
    if (!str) return ''
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  }

  // Manual search
  const buscarManual = () => {
    setErrorManual('')
    const { rut, nombre, matricula } = busqueda
    if (!rut && !nombre && !matricula) return
    const routeStudents = recorridoSel ? getStudentsForRoute(recorridoSel.id) : estudiantesDb
    const searchWords = normalize(nombre).split(' ').filter(Boolean)
    const matches = routeStudents.filter(e => {
      const matchRut = rut && (e.rut || '').replace(/[^0-9Kk]/g, '').toLowerCase().includes(rut.replace(/[^0-9Kk]/g, '').toLowerCase())
      const matchNombre = nombre && searchWords.every(word => normalize(e.nombre).includes(word))
      const matchMatricula = matricula && (e.matricula || '').toLowerCase().includes(matricula.toLowerCase())
      return matchRut || matchNombre || matchMatricula
    })
    setResultManual(matches.length > 0 ? matches : 'NOT_FOUND')
  }

  // Manual register
  const registrarManual = (est) => {
    setErrorManual('')
    if (!est || !recorridoSel) return

    const yaReg = registros.find(r => r.id_estudiante === est.id && r.id_recorrido === recorridoSel.id && r.fecha === HOY)
    if (yaReg) {
      setErrorManual(`${est.nombre} ya fue registrado a las ${yaReg.hora}.`)
      return
    }

    const horaAhora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const bus = buses.find(b => b.id_recorrido === recorridoSel.id)
    const newReg = {
      id: 'ab_man_' + Date.now(),
      id_estudiante: est.id,
      id_recorrido: recorridoSel.id,
      id_bus: bus?.id || null,
      tipo_registro: 'MANUAL',
      estado: 'PRESENTE',
      fecha: HOY,
      hora: horaAhora,
      metodo: 'MANUAL',
      observacion: obsManual || null,
    }

    setRegistros(prev => [...prev, newReg])
    saveRecord('asistencia_buses', newReg).then(({ queued }) => {
      if (queued) console.log('[Offline] Bus manual record queued')
    })
    cacheData('asistencia_buses_' + HOY, [...registros, newReg])

    setBusqueda({ rut: '', nombre: '', matricula: '' })
    setObsManual('')
    setResultManual(null)
    setErrorManual('')
    setModoManual(false)
  }

  // Current route students and stats
  const routeStudents = recorridoSel ? getStudentsForRoute(recorridoSel.id) : []
  const regHoy = registros.filter(r => r.fecha === HOY && r.id_recorrido === recorridoSel?.id)
  const presenteIds = new Set(regHoy.map(r => r.id_estudiante))
  const totalPresentes = presenteIds.size
  const totalEsperados = routeStudents.length
  const busForRoute = recorridoSel ? buses.find(b => b.id_recorrido === recorridoSel.id) : null

  // Filter student list
  const filteredStudents = routeStudents
    .filter(e => {
      if (!searchList) return true
      const q = normalize(searchList)
      return normalize(e.nombre).includes(q) || (e.rut || '').includes(searchList) || (e.matricula || '').includes(searchList)
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const estadoInfo = ESTADOS[resultado] || ESTADOS.idle

  // ─── RENDER ───

  // If no route selected → show route selector
  if (!recorridoSel) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '20px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="kiosko-clock-selector">{horaActual}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{HOY_DISPLAY}</div>
        </div>

        <div className="kiosko-route-selector-container" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h3 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 18 }}>
            <MapPin size={20} style={{ color: 'var(--primary)' }} />
            Selecciona un Recorrido
          </h3>
          <div className="kiosko-route-selector">
            {recorridos.map(rec => {
              const bus = buses.find(b => b.id_recorrido === rec.id)
              const studentCount = getStudentsForRoute(rec.id).length
              const regsForRoute = registros.filter(r => r.fecha === HOY && r.id_recorrido === rec.id)
              const presentCount = new Set(regsForRoute.map(r => r.id_estudiante)).size
              return (
                <button
                  key={rec.id}
                  onClick={() => setRecorridoSel(rec)}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{rec.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span><Users size={12} /> {studentCount} alumnos</span>
                    {bus && <span><Bus size={12} /> {bus.numero_bus}</span>}
                  </div>
                  {presentCount > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                      ✓ {presentCount}/{studentCount} presentes hoy
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─── Route selected → show kiosk ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header with route info */}
      <div className="kiosko-header">
        <div className="kiosko-header-left">
          <button
            onClick={() => { setRecorridoSel(null); setModoManual(false); setResultado('idle') }}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}
          >
            ← Cambiar Recorrido
          </button>
          <div>
            <div className="kiosko-route-name">
              <MapPin size={18} style={{ color: 'var(--primary)' }} />
              {recorridoSel.nombre}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {busForRoute ? `${busForRoute.numero_bus} — ${busForRoute.patente}` : 'Sin bus asignado'}
              {' · '} Salida: {recorridoSel.horario_salida || '16:00'}
            </div>
          </div>
        </div>

        <div className="kiosko-header-right">
          <div className="kiosko-clock">{horaActual}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="kiosko-stat-box" style={{ background: 'var(--success-bg)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)' }}>
              <div className="kiosko-stat-number" style={{ color: 'var(--success)' }}>{totalPresentes}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Presentes</div>
            </div>
            <div className="kiosko-stat-box" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div className="kiosko-stat-number" style={{ color: 'var(--text-primary)' }}>{totalEsperados}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
            </div>
          </div>
        </div>
      </div>

      <div className="kiosko-grid">
        {/* Left: NFC zone + Manual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* NFC Zone */}
          <div className="kiosko-nfc-zone" style={{
            border: `2px solid ${estadoInfo.border}`,
            borderRadius: 'var(--radius)',
            textAlign: 'center',
            background: estadoInfo.bg,
            transition: 'all 0.3s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            position: 'relative'
          }}>
            <input
              ref={nfcRef}
              onKeyDown={handleNFCKeyDown}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              tabIndex={-1}
            />

            {resultado === 'idle' && (
              <>
                <Wifi size={40} style={{ color: 'var(--primary)', animation: 'pulse 2s ease-in-out infinite' }} />
                <div style={{ fontWeight: 700, fontSize: 18 }}>Acerque su credencial NFC</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Recorrido: <strong style={{ color: 'var(--primary)' }}>{recorridoSel.nombre}</strong></div>
              </>
            )}

            {resultado === 'success' && estudiante && (
              <>
                <CheckCircle size={48} style={{ color: 'var(--success)' }} />
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--success)' }}>✓ REGISTRADO</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{estudiante.nombre}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{estudiante.curso} · {horaReg}</div>
              </>
            )}

            {resultado === 'duplicate' && estudiante && (
              <>
                <AlertTriangle size={48} style={{ color: 'var(--warning)' }} />
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--warning)' }}>⚠ YA REGISTRADO</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{estudiante.nombre}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registrado a las {prevHora}</div>
              </>
            )}

            {resultado === 'noRecorrido' && estudiante && (
              <>
                <XCircle size={48} style={{ color: 'var(--danger)' }} />
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--danger)' }}>✗ NO PERTENECE A ESTE RECORRIDO</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{estudiante.nombre}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Este alumno no está asignado a {recorridoSel.nombre}</div>
              </>
            )}

            {resultado === 'unknown' && (
              <>
                <XCircle size={48} style={{ color: 'var(--danger)' }} />
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--danger)' }}>✗ TARJETA DESCONOCIDA</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Esta tarjeta no está registrada en el sistema</div>
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="kiosko-btns">
            <button className="btn" style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }} onClick={() => { setModoManual(!modoManual); setResultManual(null); setErrorManual('') }}>
              <Search size={15} /> {modoManual ? 'Cerrar Manual' : 'Registro Manual'}
            </button>
            {'NDEFReader' in window && (
              <button className="btn" style={{ background: isWebNfcReading ? 'var(--success)' : 'var(--primary)', border: 'none', color: 'white' }} onClick={scanNFCWebAPI} disabled={isWebNfcReading}>
                <Wifi size={15} /> {isWebNfcReading ? 'NFC Activo' : 'Activar lector del celular'}
              </button>
            )}
          </div>

          {/* Manual search */}
          {modoManual && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Registro Manual — {recorridoSel.nombre}</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <input className="input" placeholder="RUT" value={busqueda.rut} onChange={e => setBusqueda(b => ({ ...b, rut: e.target.value }))} style={{ flex: 1, minWidth: 80 }} />
                <input className="input" placeholder="Nombre" value={busqueda.nombre} onChange={e => setBusqueda(b => ({ ...b, nombre: e.target.value }))} style={{ flex: 2, minWidth: 120 }} />
                <button className="btn btn-primary" onClick={buscarManual} style={{ width: '100%' }}><Search size={14} /> Buscar</button>
              </div>

              {errorManual && <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 6, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{errorManual}</div>}

              {resultManual && resultManual !== 'NOT_FOUND' && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {resultManual.map(est => {
                    const yaReg = registros.find(r => r.id_estudiante === est.id && r.id_recorrido === recorridoSel.id && r.fecha === HOY)
                    return (
                      <div key={est.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border)', gap: 8, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{est.nombre}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{est.curso} · {est.rut}</div>
                        </div>
                        {yaReg ? (
                          <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>Ya registrado ({yaReg.hora})</span>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => registrarManual(est)}>Registrar</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {resultManual === 'NOT_FOUND' && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 12, fontSize: 13 }}>No se encontraron estudiantes</div>}

              {resultManual && resultManual !== 'NOT_FOUND' && (
                <div style={{ marginTop: 8 }}>
                  <input className="input" placeholder="Observación (opcional)" value={obsManual} onChange={e => setObsManual(e.target.value)} style={{ width: '100%' }} />
                </div>
              )}
            </div>
          )}

          {/* Mobile toggle for student list */}
          <button className="kiosko-list-toggle" onClick={() => setShowList(!showList)}>
            {showList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showList ? 'Ocultar Lista' : `Ver Lista (${totalPresentes}/${totalEsperados})`}
          </button>
        </div>

        {/* Right: Student list for this route */}
        <div className={`kiosko-student-panel ${showList ? 'show' : ''}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} /> Lista — {recorridoSel.nombre}
            </h4>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{totalPresentes}/{totalEsperados} presentes</span>
          </div>

          {/* Search within list */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                placeholder="Buscar alumno..."
                value={searchList}
                onChange={e => setSearchList(e.target.value)}
                style={{ width: '100%', paddingLeft: 32, fontSize: 12, height: 30 }}
              />
            </div>
          </div>

          {/* Student rows */}
          <div className="kiosko-student-list">
            {filteredStudents.map(est => {
              const isPresente = presenteIds.has(est.id)
              const reg = regHoy.find(r => r.id_estudiante === est.id)
              return (
                <div
                  key={est.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: isPresente ? 'rgba(34,197,94,0.06)' : 'transparent',
                    transition: 'background 0.3s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: isPresente ? 'var(--success)' : 'var(--bg-elevated)',
                      color: isPresente ? 'white' : 'var(--text-muted)',
                      border: isPresente ? 'none' : '1px solid var(--border)',
                      flexShrink: 0
                    }}>
                      {isPresente ? '✓' : '—'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{est.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{est.curso} · {est.rut}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: isPresente ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                    {isPresente ? `${reg?.hora || ''} · ${reg?.metodo || ''}` : 'Pendiente'}
                  </div>
                </div>
              )
            })}
            {filteredStudents.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {searchList ? 'No se encontraron estudiantes' : 'No hay estudiantes asignados a este recorrido'}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Progreso de embarque</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: totalPresentes === totalEsperados && totalEsperados > 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                {totalEsperados > 0 ? Math.round((totalPresentes / totalEsperados) * 100) : 0}%
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${totalEsperados > 0 ? (totalPresentes / totalEsperados) * 100 : 0}%`,
                height: '100%',
                background: totalPresentes === totalEsperados && totalEsperados > 0 ? 'var(--success)' : 'var(--primary)',
                borderRadius: 3,
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

