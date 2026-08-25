import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Trash2, X, RefreshCw, Box } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function Salas() {
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadData = async () => {
    setLoading(true)
    const { data: res } = await supabase.from('salas').select('*').order('nombre')
    if (res) setData(res)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filtered = data.filter(s => {
    const q = search.toLowerCase()
    return !q || (s.nombre && s.nombre.toLowerCase().includes(q))
  })

  const openNew = () => { setForm({ estado: 'ACTIVA' }); setModal('new') }
  const openEdit = (rec) => { setForm({ ...rec }); setModal(rec) }
  const closeModal = () => { setModal(null); setForm({}) }

  const save = async () => {
    let salaId = form.id;

    if (modal === 'new') {
      salaId = 'sala_' + Date.now()
      const payload = { ...form, id: salaId }
      const { error } = await supabase.from('salas').insert([payload])
      if (error) { alert('Error insertando sala: ' + error.message); return; }
    } else {
      const payload = { ...form }
      const { error } = await supabase.from('salas').update(payload).eq('id', salaId)
      if (error) { alert('Error actualizando sala: ' + error.message); return; }
    }

    loadData()
    closeModal()
  }

  const deleteRecord = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta sala?')) return
    await supabase.from('salas').delete().eq('id', id)
    loadData()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="input-with-icon" style={{ minWidth: 260 }}>
            <Search size={16} />
            <input className="input" placeholder="Buscar sala..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} title="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Agregar Sala
        </button>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Box size={16} /> Salas Físicas</span>
          <span className="text-muted text-sm">{filtered.length} salas</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando salas...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre de Sala / Espacio</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><Box size={32} /><p>No hay salas registradas</p></div></td></tr>
                )}
                {filtered.map(sala => (
                  <tr key={sala.id}>
                    <td><strong>{sala.nombre}</strong></td>
                    <td>
                      <span className={`badge badge-${sala.estado === 'ACTIVA' ? 'success' : 'danger'}`}>
                        {sala.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '6px', marginRight: 6 }} onClick={() => openEdit(sala)} title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => deleteRecord(sala.id)} title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
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
              <h3>{modal === 'new' ? 'Agregar Sala' : 'Editar Sala'}</h3>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              <div className="form-group">
                <label>Nombre de la Sala / Espacio</label>
                <input className="input" value={form.nombre || ''} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej: Laboratorio 1, Sala 2A, Taller Cocina..." />
              </div>
              
              <div className="form-group">
                <label>Estado</label>
                <select className="input" value={form.estado || 'ACTIVA'} onChange={e => setForm({...form, estado: e.target.value})}>
                  <option value="ACTIVA">ACTIVA</option>
                  <option value="INACTIVA">INACTIVA</option>
                </select>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.nombre}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
