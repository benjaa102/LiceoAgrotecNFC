import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Bus, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ESTADOS = ['ACTIVO', 'MANTENIMIENTO', 'INACTIVO']
const estadoColors = { ACTIVO: 'success', MANTENIMIENTO: 'warning', INACTIVO: 'danger' }

export default function Buses() {
  const [data, setData] = useState([])
  const [recorridos, setRecorridos] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadData = async () => {
    setLoading(true)
    const [resBuses, resRec, resSup] = await Promise.all([
      supabase.from('buses').select('*').order('numero_bus'),
      supabase.from('recorridos').select('id, nombre, destino, horario_salida'),
      supabase.from('supervisores').select('id, nombre, estado')
    ])
    if (resBuses.data) setData(resBuses.data)
    if (resRec.data) setRecorridos(resRec.data)
    if (resSup.data) setSupervisores(resSup.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openNew = () => { setForm({ estado: 'ACTIVO' }); setModal('new') }
  const openEdit = (rec) => { setForm({ ...rec, id_recorrido_viernes: Array.isArray(rec.id_recorrido_viernes) ? rec.id_recorrido_viernes : (rec.id_recorrido_viernes ? [rec.id_recorrido_viernes] : []) }); setModal(rec) }
  const closeModal = () => { setModal(null); setForm({}) }

  const save = async () => {
    if (modal === 'new') {
      const id = 'b_' + Date.now()
      const { data: newRow, error } = await supabase.from('buses').insert([{ ...form, id }]).select().single()
      if (!error && newRow) setData(d => [...d, newRow])
      else if (error) alert('Error al crear: ' + error.message)
    } else {
      const { error } = await supabase.from('buses').update(form).eq('id', form.id)
      if (!error) setData(d => d.map(b => b.id === form.id ? form : b))
      else alert('Error al actualizar: ' + error.message)
    }
    closeModal()
  }

  const remove = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar este bus?')) return
    const { error } = await supabase.from('buses').delete().eq('id', id)
    if (!error) setData(d => d.filter(b => b.id !== id))
    else alert('Error al eliminar.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="toolbar">
        <div className="toolbar-left" />
        <div className="toolbar-right">
          <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>{data.length} buses</span>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" id="btn-nuevo-bus" onClick={openNew}>
            <Plus size={15} /> Nuevo Bus
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {data.map(bus => {
            const rec = recorridos.find(r => r.id === bus.id_recorrido)
            const sup = supervisores.find(s => s.id === bus.id_supervisor)
            const color = estadoColors[bus.estado] ?? 'muted'
            return (
              <div key={bus.id} className="card" style={{ overflow: 'visible' }}>
                <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-glow)' }}>
                      <Bus size={22} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{bus.numero_bus}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Patente: <span className="font-mono">{bus.patente}</span></div>
                    </div>
                  </div>
                  <span className={`badge badge-${color}`}>{bus.estado}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <InfoRow label="Recorrido (Lun-Jue)" value={rec?.nombre ?? 'Sin asignar'} />
                  {bus.id_recorrido_viernes && bus.id_recorrido_viernes.length > 0 && (
                    <InfoRow label="Recorrido (Viernes)" value={
                      Array.isArray(bus.id_recorrido_viernes) 
                        ? bus.id_recorrido_viernes.map(id => recorridos.find(r => r.id === id)?.nombre).filter(Boolean).join(' + ')
                        : recorridos.find(r => r.id === bus.id_recorrido_viernes)?.nombre
                    } />
                  )}
                  <InfoRow label="Chofer" value={sup?.nombre ?? <span style={{ color: 'var(--warning)' }}>Sin asignar</span>} />
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(bus)}><Pencil size={13} /> Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(bus.id)}><Trash2 size={13} /> Eliminar</button>
                </div>
              </div>
            )
          })}
          {data.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No hay buses registrados.</div>
          )}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title"><Bus size={18} /> {modal === 'new' ? 'Nuevo Bus' : 'Editar Bus'}</span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field">
                  <label>Número de Bus / Nombre</label>
                  <input className="input" value={form.numero_bus || ''} onChange={e => setForm(f => ({ ...f, numero_bus: e.target.value }))} placeholder="BUS-06" />
                </div>
                <div className="form-field">
                  <label>Patente</label>
                  <input className="input font-mono" value={form.patente || ''} onChange={e => setForm(f => ({ ...f, patente: e.target.value }))} placeholder="ABCD-12" />
                </div>
                <div className="form-field">
                  <label>Recorrido (Lunes a Jueves)</label>
                  <select className="input" value={form.id_recorrido || ''} onChange={e => setForm(f => ({ ...f, id_recorrido: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {recorridos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Recorridos (Viernes) <span className="text-muted text-sm">— Opcional</span></label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', padding: '10px 14px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 6 }}>
                    {recorridos.map(r => {
                      const currentArr = Array.isArray(form.id_recorrido_viernes) ? form.id_recorrido_viernes : (form.id_recorrido_viernes ? [form.id_recorrido_viernes] : []);
                      const isChecked = currentArr.includes(r.id);
                      return (
                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked 
                                ? [...currentArr, r.id] 
                                : currentArr.filter(id => id !== r.id);
                              setForm(f => ({ ...f, id_recorrido_viernes: next.length > 0 ? next : null }));
                            }}
                          />
                          {r.nombre}
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div className="form-field">
                  <label>Chofer asignado</label>
                  <select className="input" value={form.id_supervisor || ''} onChange={e => setForm(f => ({ ...f, id_supervisor: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {supervisores.filter(s => s.estado === 'ACTIVO').map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field full">
                  <label>Estado</label>
                  <select className="input" value={form.estado || 'ACTIVO'} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
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

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <strong style={{ color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</strong>
    </div>
  )
}
