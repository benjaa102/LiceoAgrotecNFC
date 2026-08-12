import { useState, useEffect, useRef } from 'react'
import { Plus, CreditCard, Lock, X, Wifi, Search, Pencil, Trash2, RefreshCw, CheckCircle, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ESTADOS = ['ACTIVA', 'BLOQUEADA', 'PERDIDA']
const estadoColor = { ACTIVA: 'success', BLOQUEADA: 'danger', PERDIDA: 'warning' }
const tipoColor   = { ESTUDIANTE: 'info', SUPERVISOR: 'purple' }

export default function CredencialesNFC() {
  const [data, setData] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch]       = useState('')
  const [filterTipo, setFT]       = useState('')
  const [filterEstado, setFE]     = useState('')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [userSearch, setUserSearch] = useState('')
  const [nfcReading, setNfcReading] = useState(false)
  const [selectedCurso, setSelectedCurso] = useState('')
  const uidRef = useRef(null)

  const loadData = async () => {
    setLoading(true)
    const [resCred, resEst, resSup] = await Promise.all([
      supabase.from('credenciales').select('*').order('fecha_asignacion', { ascending: false }),
      supabase.from('estudiantes').select('id, nombre, rut, curso, matricula'),
      supabase.from('supervisores').select('id, nombre, rut')
    ])
    if (resCred.data) setData(resCred.data)
    if (resEst.data) setEstudiantes(resEst.data)
    if (resSup.data) setSupervisores(resSup.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const getUsuarioNombre = (tipo, id) => {
    if (tipo === 'ESTUDIANTE') return estudiantes.find(e => e.id === id)?.nombre ?? '—'
    return supervisores.find(s => s.id === id)?.nombre ?? '—'
  }

  const filtered = data.filter(c => {
    const q = search.toLowerCase()
    const usuario = getUsuarioNombre(c.tipo_usuario, c.id_usuario)
    const matchQ = !q || c.uid_nfc.toLowerCase().includes(q) || (usuario && usuario.toLowerCase().includes(q))
    const matchT = !filterTipo   || c.tipo_usuario === filterTipo
    const matchE = !filterEstado || c.estado === filterEstado
    return matchQ && matchT && matchE
  })

  const openNew  = () => { setForm({ estado: 'ACTIVA', tipo_usuario: 'ESTUDIANTE', fecha_asignacion: new Date().toISOString().slice(0, 10) }); setModal('new'); setUserSearch(''); setSelectedCurso('') }
  const openEdit = (rec) => { 
    setForm({ ...rec }); 
    setModal(rec); 
    setUserSearch(getUsuarioNombre(rec.tipo_usuario, rec.id_usuario)); 
    setSelectedCurso('')
  }
  const closeModal = () => { setModal(null); setForm({}); setNfcReading(false); setUserSearch(''); setSelectedCurso('') }

  // Get unique sorted courses
  const cursos = [...new Set(estudiantes.map(e => e.curso).filter(Boolean))].sort((a, b) => {
    const numA = parseInt(a); const numB = parseInt(b)
    if (numA !== numB) return numA - numB
    return a.localeCompare(b)
  })

  const save = async () => {
    if (modal === 'new') {
      const id = 'c_' + Date.now()
      const payload = { ...form, id }
      if (!payload.id_usuario) payload.id_usuario = null
      
      const { data: newRow, error } = await supabase.from('credenciales').insert([payload]).select().single()
      if (!error && newRow) setData(d => [newRow, ...d])
      else if(error) alert('Error al crear: ' + error.message)
    } else {
      const payload = { ...form }
      if (!payload.id_usuario) payload.id_usuario = null
      
      const { error } = await supabase.from('credenciales').update(payload).eq('id', form.id)
      if (!error) setData(d => d.map(c => c.id === form.id ? form : c))
      else alert('Error al actualizar: ' + error.message)
    }
    closeModal()
  }

  const remove = async (id) => {
    if(!window.confirm('¿Seguro que quieres eliminar esta credencial?')) return
    const { error } = await supabase.from('credenciales').delete().eq('id', id)
    if (!error) setData(d => d.filter(c => c.id !== id))
    else alert('Error al eliminar.')
  }



  // Lectura Nativa con Celular (Web NFC API)
  const scanNFCWebAPI = async () => {
    if (!('NDEFReader' in window)) {
      alert("Tu navegador no soporta lectura NFC nativa. Usa Chrome en Android o un lector USB en PC.")
      return
    }
    
    try {
      setNfcReading(true)
      const ndef = new window.NDEFReader()
      await ndef.scan()
      
      ndef.onreading = event => {
        if (event.serialNumber) {
          const uid = event.serialNumber.replace(/:/g, '').toUpperCase()
          setForm(f => ({ ...f, uid_nfc: uid }))
        } else {
          // Fallback if serialNumber is not present
          alert("Tarjeta leída, pero no se detectó un UID (serialNumber).")
        }
        setNfcReading(false)
      }
      
      ndef.onreadingerror = () => {
        alert("Acercaste la tarjeta pero no se pudo leer correctamente. Intenta de nuevo.")
        setNfcReading(false)
      }
    } catch (error) {
      alert("Error al iniciar el sensor NFC: " + error.message)
      setNfcReading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Info banner YARONGTECH */}
      <div style={{ background: 'rgba(79,142,247,0.07)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <Wifi size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--primary-light)' }}>Lector YARONGTECH USB</strong> — Conecta el lector al PC, haz clic en "Leer tarjeta" y acerca la tarjeta NTAG213.
          El UID se capturará automáticamente.
        </span>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="input-group" style={{ maxWidth: 260 }}>
            <Search size={15} className="input-group-icon" />
            <input className="input" placeholder="Buscar UID o nombre…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 150 }} value={filterTipo} onChange={e => setFT(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="ESTUDIANTE">ESTUDIANTE</option>
            <option value="SUPERVISOR">SUPERVISOR</option>
          </select>
          <select className="input" style={{ width: 150 }} value={filterEstado} onChange={e => setFE(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>{filtered.length} credenciales</span>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" id="btn-nueva-credencial" onClick={openNew}><Plus size={15} /> Nueva Credencial</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><CreditCard size={16} /> Credenciales NFC Registradas</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando credenciales...</div>
          ) : (
          <table>
            <thead>
              <tr>
                <th>UID NFC</th>
                <th>Usuario Asignado</th>
                <th>Tipo Usuario</th>
                <th>Fecha Asignación</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><CreditCard size={32} /><p>No se encontraron credenciales</p></div></td></tr>
              )}
              {filtered.map(cred => (
                <tr key={cred.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={13} style={{ color: 'var(--text-muted)' }} />
                      <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>{cred.uid_nfc}</strong>
                    </div>
                  </td>
                  <td><strong>{getUsuarioNombre(cred.tipo_usuario, cred.id_usuario)}</strong></td>
                  <td><span className={`badge badge-${tipoColor[cred.tipo_usuario]}`}>{cred.tipo_usuario}</span></td>
                  <td>{new Date(cred.fecha_asignacion).toLocaleDateString('es-CL')}</td>
                  <td><span className={`badge badge-${estadoColor[cred.estado]}`}>{cred.estado}</span></td>
                  <td>
                    <div className="d-flex gap-2">
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(cred)}><Pencil size={13} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(cred.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title"><CreditCard size={18} /> {modal === 'new' ? 'Asignar Nueva Credencial' : 'Editar Credencial'}</span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field full" style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px dashed var(--primary)', position: 'relative' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span>UID NFC de la Tarjeta</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={scanNFCWebAPI} disabled={nfcReading}>
                        <Wifi size={14} /> Leer con Celular
                      </button>
                    </div>
                  </label>
                  <input 
                    autoFocus
                    ref={uidRef}
                    className="input font-mono" 
                    style={{ fontSize: 20, textAlign: 'center', letterSpacing: 2, padding: 12, background: nfcReading ? 'var(--primary-glow)' : 'var(--bg-input)' }} 
                    value={form.uid_nfc || ''} 
                    onChange={e => setForm(f => ({ ...f, uid_nfc: e.target.value.toUpperCase() }))} 
                    placeholder="Ej: A1B2C3D4" 
                  />
                  {nfcReading && <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--primary)', marginTop: 8 }}>Acerca la tarjeta a tu celular o usa el lector USB...</div>}
                </div>

                <div className="form-field">
                  <label>Tipo de Usuario</label>
                  <select className="input" value={form.tipo_usuario || 'ESTUDIANTE'} onChange={e => {
                    setForm(f => ({ ...f, tipo_usuario: e.target.value, id_usuario: '' }));
                    setUserSearch('');
                  }}>
                    <option value="ESTUDIANTE">ESTUDIANTE</option>
                    <option value="SUPERVISOR">SUPERVISOR (Chofer)</option>
                  </select>
                </div>

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Buscar y Seleccionar Usuario</label>
                  
                  {/* Selected user indicator */}
                  {form.id_usuario && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 8, marginBottom: 10 }}>
                      <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{userSearch}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Seleccionado</div>
                      </div>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setForm(f => ({ ...f, id_usuario: '' })); setUserSearch(''); setSelectedCurso('') }}><X size={13} /></button>
                    </div>
                  )}

                  {!form.id_usuario && (
                    <>
                      {/* Course selector (only for students) */}
                      {form.tipo_usuario === 'ESTUDIANTE' && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {cursos.map(c => (
                              <button key={c} onClick={() => setSelectedCurso(sc => sc === c ? '' : c)}
                                style={{
                                  padding: '5px 12px', borderRadius: 6, border: '1px solid ' + (selectedCurso === c ? 'var(--primary)' : 'var(--border)'),
                                  background: selectedCurso === c ? 'var(--primary)' : 'var(--bg-input)', color: selectedCurso === c ? 'white' : 'var(--text-secondary)',
                                  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s'
                                }}>
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Search input - shown when a course is selected or for supervisors */}
                      {(selectedCurso || form.tipo_usuario === 'SUPERVISOR') && (
                        <div style={{ position: 'relative', marginBottom: 10 }}>
                          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input 
                            type="text" 
                            className="input" 
                            style={{ paddingLeft: 34 }}
                            placeholder={form.tipo_usuario === 'ESTUDIANTE' ? `Buscar en ${selectedCurso} por nombre, RUT o N° matrícula...` : 'Buscar por nombre o RUT...'}
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                          />
                          {userSearch && (
                            <button onClick={() => setUserSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Results list */}
                      {(() => {
                        const norm = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
                        let results = []

                        if (form.tipo_usuario === 'SUPERVISOR') {
                          if (userSearch) {
                            const tokens = norm(userSearch).split(/\s+/).filter(Boolean)
                            results = supervisores.filter(u => {
                              const txt = norm(u.nombre + ' ' + (u.rut || ''))
                              return tokens.every(t => txt.includes(t))
                            })
                          }
                        } else {
                          if (selectedCurso) {
                            // Filter by course first, then by search if provided
                            results = estudiantes.filter(e => e.curso === selectedCurso)
                            if (userSearch) {
                              const tokens = norm(userSearch).split(/\s+/).filter(Boolean)
                              results = results.filter(u => {
                                const txt = norm(u.nombre + ' ' + (u.rut || '') + ' ' + (u.matricula || ''))
                                return tokens.every(t => txt.includes(t))
                              })
                            }
                            results.sort((a, b) => a.nombre.localeCompare(b.nombre))
                          }
                        }

                        if (!selectedCurso && form.tipo_usuario === 'ESTUDIANTE') return null
                        if (!userSearch && form.tipo_usuario === 'SUPERVISOR') return null

                        return (
                          <div style={{
                            background: 'var(--bg-app)', border: '1px solid var(--border)',
                            borderRadius: 8, maxHeight: 220, overflowY: 'auto'
                          }}>
                            {selectedCurso && !userSearch && (
                              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                                <Users size={13} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{selectedCurso}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {results.length} estudiantes</span>
                              </div>
                            )}
                            {results.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No se encontraron resultados</div>}
                            {results.map(u => (
                              <div key={u.id}
                                onClick={() => {
                                  setForm(f => ({ ...f, id_usuario: u.id }))
                                  setUserSearch(u.nombre + (u.curso ? ` (${u.curso})` : ''))
                                }}
                                style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-bright)', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: 10 }}
                                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card)'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                  {u.nombre ? u.nombre.split(' ').map(n => n[0]).slice(0, 2).join('') : '?'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                                    <span className="font-mono">{u.rut || 'Sin RUT'}</span>
                                    {u.curso && <span>• {u.curso}</span>}
                                    {u.matricula && <span>• Mat: {u.matricula}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>

                <div className="form-field">
                  <label>Fecha de Asignación</label>
                  <input className="input" type="date" value={form.fecha_asignacion ? form.fecha_asignacion.split('T')[0] : ''} onChange={e => setForm(f => ({ ...f, fecha_asignacion: e.target.value }))} />
                </div>
                
                <div className="form-field">
                  <label>Estado de Credencial</label>
                  <select className="input" value={form.estado || 'ACTIVA'} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
