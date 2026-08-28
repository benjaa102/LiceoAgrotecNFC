import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, X, UserCheck, RefreshCw, Wifi, BookOpen, Calendar, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function Docentes() {
  const [data, setData] = useState([])
  const [credenciales, setCredenciales] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [activeTab, setActiveTab] = useState('datos')
  const [nfcReading, setNfcReading] = useState(false)
  const uidRef = useRef(null)

  const HORARIO_BLOQUES = [
    { id: 'ingreso', label: 'ING', time: '8:10 - 8:30', isBreak: false },
    { id: '1', label: '1', time: '08:30 - 09:15', isBreak: false },
    { id: '2', label: '2', time: '09:15 - 10:00', isBreak: false },
    { id: 'r1', label: 'R', time: '10:00 - 10:15', isBreak: true },
    { id: '3', label: '3', time: '10:15 - 11:00', isBreak: false },
    { id: '4', label: '4', time: '11:00 - 11:45', isBreak: false },
    { id: 'r2', label: 'R', time: '11:45 - 11:55', isBreak: true },
    { id: '5', label: '5', time: '11:55 - 12:40', isBreak: false },
    { id: '6', label: '6', time: '12:40 - 13:25', isBreak: false },
    { id: 'ingreso2', label: 'ING', time: '14:00', isBreak: false },
    { id: '7', label: '7', time: '14:15 - 15:00', isBreak: false },
    { id: '8', label: '8', time: '15:00 - 15:45', isBreak: false },
    { id: 'r3', label: 'R', time: '15:45 - 16:00', isBreak: true },
    { id: '9', label: '9', time: '16:00 - 16:45', isBreak: false },
    { id: '10', label: '10', time: '16:45 - 17:30', isBreak: false },
    { id: '11', label: '11', time: '17:30 - 18:15', isBreak: false },
  ]
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

  const loadData = async () => {
    setLoading(true)
    const [resDoc, resCred] = await Promise.all([
      supabase.from('docentes').select('*').order('nombre'),
      supabase.from('credenciales').select('*').eq('tipo_usuario', 'DOCENTE')
    ])
    if (resDoc.data) setData(resDoc.data)
    if (resCred.data) setCredenciales(resCred.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filtered = data.filter(s => {
    const q = search.toLowerCase()
    return !q || (s.nombre && s.nombre.toLowerCase().includes(q)) || (s.rut && s.rut.includes(q))
  })

  const openNew = () => { setActiveTab('datos'); setForm({ estado: 'ACTIVO', horarioMap: {} }); setModal('new') }
  const openEdit = (rec) => { 
    const cred = credenciales.find(c => c.id_usuario === rec.id)
    const horarioMap = {}
    if (Array.isArray(rec.horario)) {
      rec.horario.forEach(h => { horarioMap[`${h.dia}-${h.bloque}`] = h })
    }
    setActiveTab('datos')
    setForm({ ...rec, uid_nfc: cred?.uid_nfc || '', cred_id: cred?.id || null, horarioMap })
    setModal(rec) 
  }
  const closeModal = () => { setModal(null); setForm({}) }

  const updateHorario = (dia, bloqueId, field, value) => {
    setForm(prev => {
      const key = `${dia}-${bloqueId}`
      const map = { ...prev.horarioMap }
      if (!map[key]) map[key] = { dia, bloque: bloqueId, actividad: '', curso: '' }
      map[key][field] = value
      return { ...prev, horarioMap: map }
    })
  }

  const save = async () => {
    let docenteId = form.id;

    if (modal === 'new') {
      docenteId = 'd_' + Date.now()
      const horarioArr = Object.values(form.horarioMap || {}).filter(h => h.actividad || h.curso)
      const payload = { ...form, id: docenteId, horario: horarioArr }
      delete payload.uid_nfc
      delete payload.cred_id
      delete payload.horarioMap
      const { error } = await supabase.from('docentes').insert([payload])
      if (error) { alert('Error insertando docente: ' + error.message); return; }
    } else {
      const horarioArr = Object.values(form.horarioMap || {}).filter(h => h.actividad || h.curso)
      const payload = { ...form, horario: horarioArr }
      delete payload.uid_nfc
      delete payload.cred_id
      delete payload.horarioMap
      const { error } = await supabase.from('docentes').update(payload).eq('id', docenteId)
      if (error) { alert('Error actualizando docente: ' + error.message); return; }
    }

    // Handle Credential linking
    const uidUpper = form.uid_nfc ? form.uid_nfc.toUpperCase() : ''
    
    if (uidUpper) {
      if (form.cred_id) {
        const { error } = await supabase.from('credenciales').update({ uid_nfc: uidUpper }).eq('id', form.cred_id)
        if (error) alert('Error actualizando credencial: ' + error.message)
      } else {
        const credId = 'c_' + Date.now()
        const { error } = await supabase.from('credenciales').insert([{
          id: credId,
          uid_nfc: uidUpper,
          id_usuario: docenteId,
          tipo_usuario: 'DOCENTE',
          estado: 'ACTIVA'
        }])
        if (error) alert('Error insertando credencial: ' + error.message)
      }
    } else if (form.cred_id) {
      // If cleared, delete credential
      const { error } = await supabase.from('credenciales').delete().eq('id', form.cred_id)
      if (error) alert('Error eliminando credencial: ' + error.message)
    }

    // Refresh everything
    loadData()
    closeModal()
  }

  const deleteRecord = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este docente? Se borrará todo su historial y credenciales.')) return
    // Delete associated credentials first
    await supabase.from('credenciales').delete().eq('id_usuario', id).eq('tipo_usuario', 'DOCENTE')
    await supabase.from('docentes').delete().eq('id', id)
    loadData()
  }

  // NFC Reading Simulation/Integration
  const startNfcRead = async () => {
    if (!('NDEFReader' in window)) {
      alert('Tu navegador no soporta lectura NFC directa. Puedes usar un lector USB e ingresar el código manualmente.')
      uidRef.current?.focus()
      return
    }
    try {
      setNfcReading(true)
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.onreading = event => {
        const uid = event.serialNumber.replace(/:/g, '').toUpperCase()
        setForm(prev => ({ ...prev, uid_nfc: uid }))
        setNfcReading(false)
      }
      ndef.onreadingerror = () => {
        alert('Error al leer NFC')
        setNfcReading(false)
      }
    } catch (error) {
      console.error(error)
      alert('Error iniciando NFC: ' + error)
      setNfcReading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Controls */}
      <div className="responsive-controls-bar">
        <div className="responsive-controls-group">
          <div className="input-group" style={{ maxWidth: 280, width: '100%' }}>
            <Search size={15} className="input-group-icon" />
            <input className="input" placeholder="Buscar por nombre o RUT..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} title="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Agregar Docente
        </button>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><BookOpen size={16} /> Docentes Registrados</span>
          <span className="text-muted text-sm">{filtered.length} docentes</span>
        </div>
        <div className="table-responsive-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando docentes...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre Completo</th>
                  <th>RUT</th>
                  <th>Asignatura Principal</th>
                  <th>Bloques Agendados</th>
                  <th>Estado</th>
                  <th>Credencial NFC</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><BookOpen size={32} /><p>No hay docentes registrados</p></div></td></tr>
                )}
                {filtered.map(doc => {
                  const cred = credenciales.find(c => c.id_usuario === doc.id)
                  return (
                    <tr key={doc.id}>
                      <td><strong>{doc.nombre}</strong></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{doc.rut}</td>
                      <td><span className="chip">{doc.asignatura}</span></td>
                      <td>
                        <span className="badge badge-info">{Array.isArray(doc.horario) ? doc.horario.length : 0} bloques</span>
                      </td>
                      <td>
                        <span className={`badge badge-${doc.estado === 'ACTIVO' ? 'success' : 'danger'}`}>
                          {doc.estado}
                        </span>
                      </td>
                      <td>
                        {cred?.uid_nfc ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)' }}>
                            <Wifi size={12} /> {cred.uid_nfc}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin credencial</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '6px', marginRight: 6 }} onClick={() => openEdit(doc)} title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => deleteRecord(doc.id)} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal fade-in" style={{ maxWidth: activeTab === 'horario' ? 900 : 500, width: '100%', transition: 'max-width 0.3s ease' }}>
            <div className="modal-header">
              <h3>{modal === 'new' ? 'Agregar Docente' : 'Editar Docente'}</h3>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <button 
                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'datos' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'datos' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'datos' ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => setActiveTab('datos')}
              >
                <User size={16} /> Datos Personales
              </button>
              <button 
                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'horario' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'horario' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'horario' ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => setActiveTab('horario')}
              >
                <Calendar size={16} /> Horario Semanal
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto' }}>
              
              {activeTab === 'datos' && (
                <>
                  <div className="form-group">
                    <label>Nombre Completo</label>
                    <input className="input" value={form.nombre || ''} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej: Juan Pérez" />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>RUT</label>
                      <input className="input" value={form.rut || ''} onChange={e => setForm({...form, rut: e.target.value})} placeholder="12345678-9" />
                    </div>
                    <div className="form-group">
                      <label>Estado</label>
                      <select className="input" value={form.estado || 'ACTIVO'} onChange={e => setForm({...form, estado: e.target.value})}>
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Asignatura / Módulo que Imparte (General)</label>
                    <input className="input" value={form.asignatura || ''} onChange={e => setForm({...form, asignatura: e.target.value})} placeholder="Ej: Electivo Biología, Taller Computación..." />
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px dashed var(--primary)', position: 'relative' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Wifi size={14} style={{ color: 'var(--primary)' }}/> UID NFC de la Tarjeta (Opcional)
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={startNfcRead} disabled={nfcReading}>
                          <Wifi size={14} /> Leer con Celular
                        </button>
                      </div>
                    </label>
                    <input 
                      ref={uidRef}
                      className="input font-mono" 
                      style={{ fontSize: 20, textAlign: 'center', letterSpacing: 2, padding: 12, background: nfcReading ? 'var(--primary-glow)' : 'var(--bg-input)' }} 
                      value={form.uid_nfc || ''} 
                      onChange={e => setForm({...form, uid_nfc: e.target.value.toUpperCase()})}
                      placeholder="Ej: A1B2C3D4" 
                    />
                    {nfcReading && <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--primary)', marginTop: 8 }}>Acerca la tarjeta a tu celular o usa el lector USB...</div>}
                    {!nfcReading && <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>El docente usará esta tarjeta para abrir las sesiones en las salas.</div>}
                  </div>
                </>
              )}

              {activeTab === 'horario' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', border: '1px solid var(--border)', width: 80, textAlign: 'center' }}>Horas</th>
                        {DIAS.map(d => <th key={d} style={{ padding: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {HORARIO_BLOQUES.map(b => (
                        <tr key={b.id} style={{ background: b.isBreak ? 'var(--bg-surface)' : 'transparent' }}>
                          <td style={{ padding: '4px', border: '1px solid var(--border)', textAlign: 'center', background: 'var(--bg-surface)' }}>
                            <strong style={{ fontSize: 14 }}>{b.label}</strong><br/>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{b.time}</span>
                          </td>
                          {DIAS.map(d => {
                            if (b.isBreak) return <td key={d} style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}></td>;
                            const cell = form.horarioMap?.[`${d}-${b.id}`] || { actividad: '', curso: '' }
                            return (
                              <td key={d} style={{ padding: '4px', border: '1px solid var(--border)', verticalAlign: 'top' }}>
                                <input 
                                  placeholder="Actividad/Materia" 
                                  value={cell.actividad}
                                  onChange={e => updateHorario(d, b.id, 'actividad', e.target.value)}
                                  style={{ width: '100%', marginBottom: 4, fontSize: 11, padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
                                />
                                <input 
                                  placeholder="Curso (Ej: 2°B-D)" 
                                  value={cell.curso}
                                  onChange={e => updateHorario(d, b.id, 'curso', e.target.value)}
                                  style={{ width: '100%', fontSize: 11, padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.nombre || !form.rut || !form.asignatura}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
