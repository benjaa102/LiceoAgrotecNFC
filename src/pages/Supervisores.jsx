import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Trash2, X, UserCheck, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

const CARGOS = ['Chofer Bus', 'Chofer Furgón', 'Supervisor Senior', 'Supervisor Titular', 'Supervisor Suplente']

export default function Supervisores() {
  const [data, setData] = useState([])
  const [credenciales, setCredenciales] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadData = async () => {
    setLoading(true)
    const [resSup, resCred] = await Promise.all([
      supabase.from('supervisores').select('*').order('nombre'),
      supabase.from('credenciales').select('*')
    ])
    if (resSup.data) setData(resSup.data)
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
    let supervisorId = form.id;
    let finalSupData = null;

    if (modal === 'new') {
      supervisorId = 's_' + Date.now()
      const payload = { ...form, id: supervisorId }
      delete payload.uid_nfc
      delete payload.cred_id
      const { data: newRow, error } = await supabase.from('supervisores').insert([payload]).select().single()
      if (!error && newRow) {
        setData(d => [...d, newRow])
        finalSupData = newRow
      }
      else return alert('Error al crear: ' + error.message)
    } else {
      const payload = { ...form }
      delete payload.uid_nfc
      delete payload.cred_id
      const { error } = await supabase.from('supervisores').update(payload).eq('id', supervisorId)
      if (!error) {
        setData(d => d.map(s => s.id === supervisorId ? { ...s, ...payload } : s))
        finalSupData = payload
      }
      else return alert('Error al actualizar: ' + error.message)
    }

    // Manejar credencial NFC asociada
    if (form.uid_nfc && form.uid_nfc.trim() !== '') {
      const uidUpper = form.uid_nfc.trim().toUpperCase()
      if (form.cred_id) {
        await supabase.from('credenciales').update({ uid_nfc: uidUpper }).eq('id', form.cred_id)
      } else {
        await supabase.from('credenciales').insert([{
          id: 'c_' + Date.now(),
          uid_nfc: uidUpper,
          tipo_usuario: 'SUPERVISOR',
          id_usuario: supervisorId,
          estado: 'ACTIVA',
          fecha_asignacion: new Date().toISOString().slice(0, 10)
        }])
      }
    } else if (form.cred_id) {
      await supabase.from('credenciales').delete().eq('id', form.cred_id)
    }

    // Refrescar credenciales en background
    supabase.from('credenciales').select('*').then(({ data }) => {
      if (data) setCredenciales(data)
    })

    closeModal()
  }

  const remove = async (id) => {
    if(!window.confirm('¿Seguro que quieres eliminar a este trabajador?')) return
    const { error } = await supabase.from('supervisores').delete().eq('id', id)
    if (!error) setData(d => d.filter(s => s.id !== id))
    else alert('No se puede eliminar. Probablemente esté asignado a un bus.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="input-group" style={{ maxWidth: 280 }}>
            <Search size={15} className="input-group-icon" />
            <input className="input" placeholder="Buscar por nombre o RUT…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="toolbar-right">
          <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>{filtered.length} trabajadores</span>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" id="btn-nuevo-supervisor" onClick={openNew}>
            <Plus size={15} /> Nuevo Trabajador
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><UserCheck size={16} /> Choferes y Supervisores</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos...</div>
          ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Cargo</th>
                <th>Credencial NFC</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><UserCheck size={32} /><p>Sin resultados</p></div></td></tr>
              )}
              {filtered.map(sup => {
                const cred = credenciales.find(c => c.id_usuario === sup.id)
                return (
                  <tr key={sup.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {sup.nombre ? sup.nombre.split(' ').map(n => n[0]).slice(0, 2).join('') : '👤'}
                        </div>
                        <strong style={{ whiteSpace: 'nowrap' }}>{sup.nombre}</strong>
                      </div>
                    </td>
                    <td className="font-mono">{sup.rut}</td>
                    <td><span className="chip">{sup.cargo}</span></td>
                    <td>
                      {cred
                        ? <span className={`badge badge-${cred.estado === 'ACTIVA' ? 'success' : cred.estado === 'BLOQUEADA' ? 'danger' : 'warning'}`}><span className="font-mono">{cred.uid_nfc}</span></span>
                        : <span className="text-muted text-sm">Sin asignar</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${sup.estado === 'ACTIVO' ? 'success' : 'muted'}`}>{sup.estado}</span>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(sup)}><Pencil size={13} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(sup.id)}><Trash2 size={13} /></button>
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

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title"><UserCheck size={18} /> {modal === 'new' ? 'Nuevo Trabajador' : 'Editar Trabajador'}</span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field full">
                  <label>Nombre Completo</label>
                  <input className="input" value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Carlos Fuentes" />
                </div>
                <div className="form-field">
                  <label>RUT</label>
                  <input className="input font-mono" value={form.rut || ''} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
                </div>
                <div className="form-field">
                  <label>Cargo</label>
                  <select className="input" value={form.cargo || ''} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}>
                    <option value="">Seleccionar</option>
                    {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Estado</label>
                  <select className="input" value={form.estado || 'ACTIVO'} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
                <div className="form-field full">
                  <label>Credencial NFC <span className="text-muted text-sm">— (Enfoca aquí y escanea la tarjeta)</span></label>
                  <input className="input font-mono" value={form.uid_nfc || ''} onChange={e => setForm(f => ({ ...f, uid_nfc: e.target.value }))} placeholder="Ej: A1:B2:C3:D4" />
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
