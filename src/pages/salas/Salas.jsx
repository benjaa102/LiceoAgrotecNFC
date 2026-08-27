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
          <div className="input-group" style={{ maxWidth: 280 }}>
            <Search size={15} className="input-group-icon" />
            <input className="input" placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} title="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Agregar Sala
        </button>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando salas...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(sala => (
            <div key={sala.id} className="card fade-in" style={{ overflow: 'hidden', position: 'relative', border: `1px solid ${sala.estado === 'ACTIVA' ? 'var(--border-bright)' : 'var(--border)'}`, transition: 'all 0.3s ease' }}>
              {/* Subtle background glow */}
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: sala.estado === 'ACTIVA' ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: sala.estado === 'ACTIVA' ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.02))' : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.02))', border: `1px solid ${sala.estado === 'ACTIVA' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: sala.estado === 'ACTIVA' ? '0 0 20px rgba(34,197,94,0.1)' : '0 0 20px rgba(239,68,68,0.1)' }}>
                      <Box size={26} color={sala.estado === 'ACTIVA' ? 'var(--success)' : 'var(--danger)'} />
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{sala.nombre}</div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: sala.estado === 'ACTIVA' ? 'var(--success)' : 'var(--danger)', boxShadow: `0 0 10px ${sala.estado === 'ACTIVA' ? 'var(--success)' : 'var(--danger)'}` }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: sala.estado === 'ACTIVA' ? 'var(--success)' : 'var(--danger)', letterSpacing: '0.05em' }}>
                          {sala.estado}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-icon" style={{ borderRadius: '50%', width: 36, height: 36, border: 'none', background: 'var(--bg-surface)' }} onClick={() => openEdit(sala)} title="Editar"><Pencil size={16} style={{ color: 'var(--text-secondary)' }} /></button>
                    <button className="btn btn-danger btn-icon" style={{ borderRadius: '50%', width: 36, height: 36, border: 'none', background: 'var(--danger-bg)' }} onClick={() => deleteRecord(sala.id)} title="Eliminar"><Trash2 size={16} style={{ color: 'var(--danger)' }} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="empty-state"><Box size={48} /><p>No hay salas registradas</p></div>
            </div>
          )}
        </div>
      )}

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
