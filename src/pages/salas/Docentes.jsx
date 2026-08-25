import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, X, UserCheck, RefreshCw, Wifi, BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function Docentes() {
  const [data, setData] = useState([])
  const [credenciales, setCredenciales] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [nfcReading, setNfcReading] = useState(false)
  const uidRef = useRef(null)

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

  const openNew = () => { setForm({ estado: 'ACTIVO' }); setModal('new') }
  const openEdit = (rec) => { 
    const cred = credenciales.find(c => c.id_usuario === rec.id)
    setForm({ ...rec, uid_nfc: cred?.uid_nfc || '', cred_id: cred?.id || null })
    setModal(rec) 
  }
  const closeModal = () => { setModal(null); setForm({}) }

  const save = async () => {
    let docenteId = form.id;

    if (modal === 'new') {
      docenteId = 'd_' + Date.now()
      const payload = { ...form, id: docenteId }
      delete payload.uid_nfc
      delete payload.cred_id
      await supabase.from('docentes').insert([payload])
    } else {
      const payload = { ...form }
      delete payload.uid_nfc
      delete payload.cred_id
      await supabase.from('docentes').update(payload).eq('id', docenteId)
    }

    // Handle Credential linking
    const uidUpper = form.uid_nfc ? form.uid_nfc.toUpperCase() : ''
    
    if (uidUpper) {
      if (form.cred_id) {
        await supabase.from('credenciales').update({ uid_nfc: uidUpper }).eq('id', form.cred_id)
      } else {
        await supabase.from('credenciales').insert([{
          uid_nfc: uidUpper,
          id_usuario: docenteId,
          tipo_usuario: 'DOCENTE',
          estado: 'ACTIVA'
        }])
      }
    } else if (form.cred_id) {
      // If cleared, delete credential
      await supabase.from('credenciales').delete().eq('id', form.cred_id)
    }

    // Refresh everything
    loadData()
    closeModal()
  }

  const deleteRecord = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este docente? Se borrará todo su historial.')) return
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="input-with-icon" style={{ minWidth: 260 }}>
            <Search size={16} />
            <input className="input" placeholder="Buscar docente..." value={search} onChange={e => setSearch(e.target.value)} />
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
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando docentes...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre Completo</th>
                  <th>RUT</th>
                  <th>Asignatura Principal</th>
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
          <div className="modal fade-in">
            <div className="modal-header">
              <h3>{modal === 'new' ? 'Agregar Docente' : 'Editar Docente'}</h3>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
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
                <label>Asignatura / Módulo que Imparte</label>
                <input className="input" value={form.asignatura || ''} onChange={e => setForm({...form, asignatura: e.target.value})} placeholder="Ej: Electivo Biología, Taller Computación..." />
              </div>

              <div style={{ padding: 12, background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <Wifi size={14} style={{ color: 'var(--primary)' }}/> Vincular Credencial NFC (Opcional)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    ref={uidRef}
                    className="input" 
                    value={form.uid_nfc || ''} 
                    onChange={e => setForm({...form, uid_nfc: e.target.value})}
                    placeholder="UID de la tarjeta..."
                    style={{ fontFamily: 'monospace' }}
                  />
                  <button className={`btn ${nfcReading ? 'btn-danger' : 'btn-secondary'}`} onClick={startNfcRead}>
                    {nfcReading ? 'Leyendo...' : 'Leer NFC'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  El docente usará esta tarjeta para abrir las sesiones en las salas.
                </div>
              </div>

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
