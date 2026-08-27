import { useState, useEffect, useRef, useCallback } from 'react'
import { Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle, Search, Clock, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchWithCache, saveRecord, subscribe as subscribeOffline, getPendingCount, cacheData } from '../../lib/offlineManager'

function getLocalToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const serviciosComedor = [
  { id: 'sv1', nombre: 'Desayuno', hora_inicio: '06:00', hora_fin: '11:30', color: '#f59e0b', activo: true },
  { id: 'sv2', nombre: 'Almuerzo', hora_inicio: '12:00', hora_fin: '15:00', color: '#4f8ef7', activo: true },
  { id: 'sv3', nombre: 'Cena',     hora_inicio: '17:00', hora_fin: '21:00', color: '#8b5cf6', activo: true },
]

// Detecta el servicio activo según la hora actual
function getServicioActivo() {
  const now = new Date()
  
  // Los viernes (5) solo hay Desayuno, no hay Almuerzo ni Cena
  if (now.getDay() === 5) return 'Desayuno'

  const h = now.getHours()
  const m = now.getMinutes()
  const mins = h * 60 + m
  if (mins >= 6 * 60 && mins < 11 * 60 + 30) return 'Desayuno'
  if (mins >= 12 * 60 && mins < 15 * 60) return 'Almuerzo'
  if (mins >= 17 * 60 && mins <= 21 * 60) return 'Cena'
  // Transiciones y fuera de horario
  if (mins >= 11 * 60 + 30 && mins < 12 * 60) return 'Almuerzo'
  if (mins >= 15 * 60 && mins < 17 * 60) return 'Cena'
  return 'Desayuno'
}

// Estado visual del resultado
const ESTADOS = {
  idle:         { bg: 'transparent', border: 'var(--border-bright)', label: '' },
  reading:      { bg: 'rgba(79,142,247,0.07)', border: 'var(--primary)', label: '' },
  success:      { bg: 'rgba(34,197,94,0.08)',  border: 'var(--success)', label: '✓ REGISTRADO' },
  duplicate:    { bg: 'rgba(245,158,11,0.08)', border: 'var(--warning)', label: '⚠ YA REGISTRADO' },
  noInscripto:  { bg: 'rgba(239,68,68,0.08)', border: 'var(--danger)',  label: '✗ SIN INSCRIPCIÓN' },
  unknown:      { bg: 'rgba(239,68,68,0.08)', border: 'var(--danger)',  label: '✗ TARJETA DESCONOCIDA' },
  revoked:      { bg: 'rgba(239,68,68,0.08)', border: 'var(--danger)',  label: '✗ CREDENCIAL REVOCADA' },
}

export default function CocinaKiosko() {
  const HOY = getLocalToday()
  const HOY_DISPLAY = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [servicio, setServicio]     = useState(getServicioActivo)
  const [resultado, setResultado]   = useState('idle')
  const [estudiante, setEstudiante] = useState(null)
  const [registros, setRegistros]   = useState([])
  const [horaReg, setHoraReg]       = useState('')
  const [prevHora, setPrevHora]     = useState('')
  const [modoManual, setModoManual] = useState(false)
  const [busqueda, setBusqueda]     = useState({ rut: '', nombre: '', matricula: '' })
  const [resultManual, setResultManual] = useState(null)
  const [obsManual, setObsManual]   = useState('')
  const [errorManual, setErrorManual] = useState('')
  const [horaActual, setHoraActual] = useState('')
  const [estudiantesDb, setEstudiantesDb] = useState([])
  const [credencialesDb, setCredencialesDb] = useState([])
  const nfcRef    = useRef(null)
  const timerRef  = useRef(null)
  const bufferRef = useRef('')
  const procesarUIDRef = useRef(null)
  const recentScansRef = useRef({}) // { id_estudiante: timestamp }
  const [isWebNfcReading, setIsWebNfcReading] = useState(false)

  // Estado de conexión para mostrar en UI
  const [offlineStatus, setOfflineStatus] = useState({ online: true, syncing: false, pendingCount: 0 })

  useEffect(() => {
    // Cargar datos con soporte offline (caché automático)
    fetchWithCache('estudiantes', () => supabase.from('estudiantes').select('*')).then(({ data }) => {
      if (data) setEstudiantesDb(data)
    })
    fetchWithCache('credenciales', () => supabase.from('credenciales').select('*')).then(({ data }) => {
      if (data) setCredencialesDb(data)
    })
    fetchWithCache('registros_comedor_' + HOY, () => supabase.from('registros_comedor').select('*').eq('fecha', HOY)).then(({ data }) => {
      if (data) {
        // Merge con registros pendientes que están en localStorage
        setRegistros(prev => {
          const ids = new Set(data.map(r => r.id))
          const pending = prev.filter(r => !ids.has(r.id))
          return [...data, ...pending]
        })
      }
    })

    // Suscribirse a estado de conexión
    const unsubOffline = subscribeOffline(setOfflineStatus)

    // Realtime solo si hay conexión
    let channel = null
    if (navigator.onLine) {
      channel = supabase.channel('realtime_comedor')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registros_comedor' }, payload => {
          if (payload.new && payload.new.fecha === HOY) {
            setRegistros(prev => {
              const existsIndex = prev.findIndex(r => 
                r.id_estudiante === payload.new.id_estudiante && 
                r.tipo_servicio === payload.new.tipo_servicio && 
                r.fecha === payload.new.fecha
              )
              if (existsIndex >= 0) {
                const newArray = [...prev]
                newArray[existsIndex] = payload.new
                return newArray
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
  }, [HOY])

  // Hora en tiempo real y auto-cambio de servicio
  useEffect(() => {
    const tick = () => {
      setHoraActual(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      
      // Cambio automático de servicio
      const servicioCorrecto = getServicioActivo()
      setServicio(prev => {
        if (prev !== servicioCorrecto) return servicioCorrecto
        return prev
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-refoco del campo NFC (quiosco siempre activo)
  useEffect(() => {
    if (modoManual || isWebNfcReading) return
    const id = setInterval(() => nfcRef.current?.focus(), 600)
    return () => clearInterval(id)
  }, [modoManual, isWebNfcReading])

  // Resetear a idle después de 4s
  const resetIdle = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setResultado('idle')
      setEstudiante(null)
      setHoraReg('')
      setPrevHora('')
    }, 4000)
  }, [])

  const checkInscripcion = (est, srv) => {
    if (!est) return false;
    const srvUpper = srv.toUpperCase();
    const isViernes = new Date().getDay() === 5;
    
    // Los viernes solo hay desayuno
    if (isViernes && srvUpper !== 'DESAYUNO') return false;

    // Desayuno y Almuerzo: Internos y Externos
    if (srvUpper === 'DESAYUNO' || srvUpper === 'ALMUERZO') return true;
    
    // Cena: Solo Internos
    if (srvUpper === 'CENA') return est.tipo === 'INTERNO';
    
    return false;
  }

  // Procesar UID leído
  const procesarUID = useCallback((uid) => {
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

    if (est.estado_autorizacion === 'REVOCADO') {
      setResultado('revoked')
      resetIdle()
      return
    }

    const nowMs = Date.now()
    if (recentScansRef.current[est.id] && nowMs - recentScansRef.current[est.id] < 5000) {
      // Ignorar rebote del sensor NFC (doble lectura en menos de 5 segundos)
      return
    }
    recentScansRef.current[est.id] = nowMs

    if (!checkInscripcion(est, servicio)) {
      setResultado('noInscripto')
      resetIdle()
      return
    }

    const yaReg = registros.find(r => r.id_estudiante === est.id && (r.tipo_servicio || '').toUpperCase() === servicio.toUpperCase() && r.fecha === HOY)
    if (yaReg) {
      setResultado('duplicate')
      setPrevHora(yaReg.hora)
      resetIdle()
      return
    }

    const horaAhora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    setHoraReg(horaAhora)
    setResultado('success')
    
    const newReg = {
      id: 'rc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      id_estudiante: est.id,
      tipo_servicio: servicio.toUpperCase(),
      fecha: HOY,
      hora: horaAhora,
      metodo: 'NFC',
      id_usuario_resp: null,
      observacion: null,
    }
    
    // Optimistic UI update
    setRegistros(prev => [...prev, newReg])
    resetIdle()
    
    // Save to Supabase (or queue if offline)
    saveRecord('registros_comedor', newReg).then(({ queued }) => {
      if (queued) console.log('[Offline] NFC record queued for later sync')
    })
    // Update local cache
    cacheData('registros_comedor_' + HOY, [...registros, newReg])
  }, [servicio, registros, resetIdle, credencialesDb, estudiantesDb])

  useEffect(() => {
    procesarUIDRef.current = procesarUID
  }, [procesarUID])

  // Captura de HID teclado (YARONGTECH) — acumula chars y dispara al Enter/CR
  const handleNFCKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (bufferRef.current.length >= 4) procesarUID(bufferRef.current)
      bufferRef.current = ''
    } else if (e.key.length === 1) {
      bufferRef.current += e.key
    }
  }

  // Lectura Nativa con Celular (Web NFC API)
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
          try {
            if (procesarUIDRef.current) procesarUIDRef.current(uid)
          } catch (err) {
            alert("Error procesando tarjeta: " + err.message)
          }
        } else {
          alert("Tarjeta leída, pero no se detectó un UID (serialNumber).")
        }
      }
      
      ndef.onreadingerror = () => {
        if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100])
        console.warn("NFC read error")
      }

      await ndef.scan()
      
    } catch (error) {
      alert("Error al iniciar el sensor NFC: " + error.message)
      setIsWebNfcReading(false)
    }
  }

  // Normalizador para quitar tildes y pasar a minúsculas
  const normalize = (str) => {
    if (!str) return ''
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  }

  // Búsqueda manual — devuelve múltiples coincidencias
  const buscarManual = () => {
    setErrorManual('')
    const { rut, nombre, matricula } = busqueda
    if (!rut && !nombre && !matricula) return
    
    const searchWords = normalize(nombre).split(' ').filter(Boolean)

    const matches = estudiantesDb.filter(e => {
      const matchRut = rut && (e.rut || '').replace(/[^0-9Kk]/g,'').toLowerCase().includes(rut.replace(/[^0-9Kk]/g,'').toLowerCase())
      
      const matchNombre = nombre && searchWords.every(word => normalize(e.nombre).includes(word))
      
      const matchMatricula = matricula && (e.matricula || '').toLowerCase().includes(matricula.toLowerCase())
      
      return matchRut || matchNombre || matchMatricula
    })
    
    setResultManual(matches.length > 0 ? matches : 'NOT_FOUND')
  }

  const registrarManual = (est) => {
    setErrorManual('')
    if (!est) return
    if (!checkInscripcion(est, servicio)) {
      setErrorManual(`El estudiante ${est.nombre} no está inscrito en el servicio de ${servicio.toLowerCase()}.`)
      return
    }

    const yaReg = registros.find(r => r.id_estudiante === est.id && r.tipo_servicio === servicio.toUpperCase() && r.fecha === HOY)
    if (yaReg) {
      setErrorManual(`El estudiante ${est.nombre} ya registró su ${servicio.toLowerCase()} a las ${yaReg.hora}. No puede repetir ración.`)
      return
    }

    const horaAhora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    
    const newReg = {
      id: 'rc_man_' + Date.now(),
      id_estudiante: est.id,
      tipo_servicio: servicio.toUpperCase(),
      fecha: HOY,
      hora: horaAhora,
      metodo: 'MANUAL',
      id_usuario_resp: 'u1',
      observacion: obsManual || null,
    }
    
    // Optimistic update
    setRegistros(prev => [...prev, newReg])
    
    // Save to Supabase (or queue if offline)
    saveRecord('registros_comedor', newReg).then(({ queued }) => {
      if (queued) console.log('[Offline] Manual record queued for later sync')
    })
    // Update local cache
    cacheData('registros_comedor_' + HOY, [...registros, newReg])
    
    setBusqueda({ rut: '', nombre: '', matricula: '' })
    setObsManual('')
    setResultManual(null)
    setErrorManual('')
    setModoManual(false)
  }

  const regHoy = registros.filter(r => r.fecha === HOY && (r.tipo_servicio || '').toUpperCase() === servicio.toUpperCase())
  const totalInscritos = registros.filter(r => r.fecha === HOY && (r.tipo_servicio || '').toUpperCase() === servicio.toUpperCase()).length

  const servicioMeta = serviciosComedor.find(s => s.nombre === servicio)
  const servColor    = servicioMeta?.color ?? '#4f8ef7'
  const estado       = ESTADOS[resultado]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, margin: '0 auto' }}>

      {/* ── Header del quiosco ─── */}
      <div className="comedor-header-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 }}>
        {/* Selector de servicio */}
        <div className="comedor-services-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {serviciosComedor.map(s => {
            const esViernes = new Date().getDay() === 5
            const isDisabled = esViernes && s.nombre !== 'Desayuno'
            
            return (
              <button key={s.nombre} onClick={() => !isDisabled && setServicio(s.nombre)}
                disabled={isDisabled}
                style={{ 
                  padding: '8px 18px', borderRadius: 10, 
                  border: `2px solid ${servicio === s.nombre ? s.color : 'var(--border)'}`, 
                  background: servicio === s.nombre ? `${s.color}18` : 'var(--bg-card)', 
                  color: servicio === s.nombre ? s.color : 'var(--text-muted)', 
                  fontWeight: 700, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.2s',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.3 : 1
                }}>
                {s.nombre}
              </button>
            )
          })}
        </div>

        {/* Hora central */}
        <div style={{ textAlign: 'center' }}>
          <div className="comedor-clock" style={{ fontSize: 36, fontWeight: 800, letterSpacing: -2, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{horaActual}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{HOY_DISPLAY}</div>
        </div>

        {/* Contador del día */}
        <div className="comedor-stats-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: servColor }}>{regHoy.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Registrados hoy</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-muted)' }}>{regHoy.filter(r => r.metodo === 'MANUAL').length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manuales</div>
          </div>
        </div>
      </div>

      {/* ── Campo NFC oculto (captura HID) ─── */}
      {!modoManual && (
        <input
          ref={nfcRef}
          onKeyDown={handleNFCKeyDown}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
          readOnly
          aria-hidden="true"
          tabIndex={-1}
        />
      )}

      {/* ── Zona principal de resultado ─── */}
      {!modoManual ? (
        <div className="comedor-nfc-zone" style={{ border: `2px solid ${estado.border}`, borderRadius: 20, background: estado.bg, transition: 'all 0.3s ease', minHeight: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, position: 'relative', overflow: 'hidden' }}>

          {resultado === 'idle' && <IdleScreen servicio={servicio} servColor={servColor} isWebNfcReading={isWebNfcReading} />}
          {resultado === 'reading' && <ReadingScreen />}
          {resultado === 'success' && estudiante && <SuccessScreen est={estudiante} servicio={servicio} hora={horaReg} />}
          {resultado === 'duplicate' && estudiante && <DuplicateScreen est={estudiante} servicio={servicio} hora={prevHora} />}
          {resultado === 'noInscripto' && estudiante && <NoInscriptoScreen est={estudiante} servicio={servicio} />}
          {resultado === 'unknown' && <UnknownScreen />}
          {resultado === 'revoked' && <RevokedScreen />}
        </div>
      ) : (
        /* ── Modo Manual ─── */
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Search size={20} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Búsqueda Manual de Estudiante</span>
          </div>

          <div className="comedor-manual-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[['rut', 'RUT', 'Ej: 20.111.111-1'], ['nombre', 'Nombre', 'Ej: Valentina'], ['matricula', 'N° Matrícula', 'Ej: 2024001']].map(([k, lbl, ph]) => (
              <div className="form-field" key={k}>
                <label>{lbl}</label>
                <input className="input" placeholder={ph} value={busqueda[k]} onChange={e => setBusqueda(b => ({ ...b, [k]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && buscarManual()} />
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={buscarManual} style={{ padding: '10px 24px', fontSize: 15 }}><Search size={16} /> Buscar</button>

          {/* MENSAJE DE ERROR MANUAL */}
          {errorManual && (
            <div style={{ marginTop: 20, padding: 16, background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>{errorManual}</div>
            </div>
          )}

          {/* Resultados cero */}
          {resultManual === 'NOT_FOUND' && !errorManual && (
            <div style={{ padding: '14px 18px', background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
              No se encontró ningún estudiante con esos datos.
            </div>
          )}
          {/* Resultados múltiples */}
          {Array.isArray(resultManual) && resultManual.length > 0 && (
            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 4 }}>
                {resultManual.length} coincidencia(s) encontrada(s)
              </div>
              {resultManual.map(est => {
                const estInscripto = checkInscripcion(est, servicio)
                return (
                  <div key={est.id} className="comedor-manual-result-item" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>
                      {est.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{est.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {est.curso} · {est.tipo} · {est.rut} · N° Lista: {est.matricula}
                      </div>
                    </div>
                    {estInscripto ? (
                      <button onClick={() => registrarManual(est)}
                        style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                        Registrar
                      </button>
                    ) : (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', padding: '4px 10px', background: 'var(--danger-light)', borderRadius: 6 }}>
                        NO INSCRITO
                      </div>
                    )}
                  </div>
                )
              })}
              {resultManual.some(est => checkInscripcion(est, servicio)) && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>OBSERVACIÓN (OPCIONAL)</div>
                  <input type="text" value={obsManual} onChange={e => setObsManual(e.target.value)}
                    placeholder="Ej: Credencial olvidada..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Botón modo manual ─── */}
      <div className="comedor-btns-row" style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button className={`btn ${modoManual ? 'btn-secondary' : 'btn-warning'}`} onClick={() => { setModoManual(m => !m); setResultManual(null); setBusqueda({ rut: '', nombre: '', matricula: '' }) }}>
          {modoManual ? <><RotateCcw size={14} /> Volver a lectura NFC</> : <><Search size={14} /> Registro Manual</>}
        </button>
        {!modoManual && (
          <button className="btn btn-primary" onClick={scanNFCWebAPI} disabled={isWebNfcReading}>
            <Wifi size={14} /> {isWebNfcReading ? 'Lector de celular activo' : 'Activar lector del celular'}
          </button>
        )}
      </div>

      {/* ── Últimos registros del día ─── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Clock size={16} /> Últimos registros — {servicio}</span>
          <span className="text-muted text-sm">{regHoy.length} total hoy</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Hora</th><th>Estudiante</th><th>Curso</th><th>Tipo</th><th>Método</th><th>Obs.</th></tr>
            </thead>
            <tbody>
              {regHoy.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><Clock size={28} /><p>Sin registros hoy</p></div></td></tr>
              )}
              {[...regHoy].reverse().slice(0, 10).map(r => {
                const est = estudiantesDb.find(e => e.id === r.id_estudiante)
                return (
                  <tr key={r.id}>
                    <td className="font-mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{r.hora}</td>
                    <td><strong>{est?.nombre}</strong></td>
                    <td><span className="chip">{est?.curso}</span></td>
                    <td><span className={`badge badge-${est?.tipo === 'INTERNO' ? 'info' : 'purple'}`}>{est?.tipo}</span></td>
                    <td><span className={`badge badge-${r.metodo === 'NFC' ? 'success' : 'warning'}`}>{r.metodo}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.observacion ?? '—'}</td>
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

// ── Sub-pantallas ─────────────────────────────────────────────────────────────
function IdleScreen({ servicio, servColor, isWebNfcReading }) {
  return (
    <>
      <div style={{ position: 'relative', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: 'absolute', borderRadius: '50%', border: `2px solid ${servColor}`, animation: `nfc-expand 2.4s ease infinite`, animationDelay: `${i * 0.5}s`, opacity: 0,
            width: 44 + i * 22, height: 44 + i * 22 }} />
        ))}
        <Wifi size={40} style={{ color: servColor, position: 'relative', zIndex: 1 }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div className="nfc-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
          Acerque su credencial NFC
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Servicio activo: <span style={{ color: servColor, fontWeight: 700 }}>{servicio}</span>
        </div>
        {isWebNfcReading && (
          <div style={{ marginTop: 12, display: 'inline-block', padding: '6px 12px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
            Lector de celular (Web NFC) encendido y listo.
          </div>
        )}
      </div>
    </>
  )
}

function SuccessScreen({ est, servicio, hora }) {
  return (
    <>
      <CheckCircle size={56} style={{ color: 'var(--success)' }} />
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', letterSpacing: 1 }}>✓ {servicio} REGISTRADO</div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: '20px 32px', textAlign: 'center', minWidth: 280 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{est.nombre}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
          <Info label="Curso" value={est.curso} />
          <Info label="Tipo" value={est.tipo} />
          <Info label="Hora" value={hora} />
        </div>
      </div>
    </>
  )
}

function DuplicateScreen({ est, servicio, hora }) {
  return (
    <>
      <AlertTriangle size={52} style={{ color: 'var(--warning)' }} />
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>⚠ YA REGISTRADO HOY</div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 16, padding: '18px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{est.nombre}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Registrado en <strong style={{ color: 'var(--warning)' }}>{servicio}</strong> a las <strong style={{ color: 'var(--warning)' }}>{hora}</strong>
        </div>
      </div>
    </>
  )
}

function NoInscriptoScreen({ est, servicio }) {
  return (
    <>
      <XCircle size={52} style={{ color: 'var(--danger)' }} />
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>✗ SIN INSCRIPCIÓN</div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '18px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{est.nombre}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No está inscrito en el servicio de <strong style={{ color: 'var(--danger)' }}>{servicio}</strong></div>
      </div>
    </>
  )
}

function UnknownScreen() {
  return (
    <>
      <XCircle size={52} style={{ color: 'var(--danger)' }} />
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>✗ TARJETA DESCONOCIDA</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>El UID leído no está registrado en el sistema</div>
    </>
  )
}

function RevokedScreen() {
  return (
    <>
      <XCircle size={52} style={{ color: 'var(--danger)' }} />
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>✗ CREDENCIAL REVOCADA</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Esta credencial ha sido revocada en el sistema.</div>
    </>
  )
}

function Info({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>{value}</div>
    </div>
  )
}
