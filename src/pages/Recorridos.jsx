import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, MapPin, Clock, RefreshCw, Users, Download, Bus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { makeFilename } from '../lib/csvExport'
import { exportToExcel, exportToPDF } from '../lib/exportUtils'

export default function Recorridos() {
  const [data, setData] = useState([])
  const [busesData, setBusesData] = useState([])
  const [estudiantesData, setEstudiantesData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [selectedRecorrido, setSelectedRecorrido] = useState(null)
  const [searchEstudiante, setSearchEstudiante] = useState('')
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [searchNewEstudiante, setSearchNewEstudiante] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [resRec, resBus, resEst] = await Promise.all([
      supabase.from('recorridos').select('*').order('nombre'),
      supabase.from('buses').select('id, id_recorrido, numero_bus, patente'),
      supabase.from('estudiantes').select('id, id_recorrido, nombre, curso, rut').order('nombre')
    ])
    if (resRec.data) setData(resRec.data)
    if (resBus.data) setBusesData(resBus.data)
    if (resEst.data) setEstudiantesData(resEst.data)
    setLoading(false)
  }

  const getStudentsForRoute = (routeId) => {
    return estudiantesData.filter(e => {
      if (e.id_recorrido === routeId) return true;
      // Exception: "La Unión" (r14) students can board "Daiber, Maitén" (r5) or "Caupolicán, Centro" (r8)
      if (e.id_recorrido === 'r14' && (routeId === 'r5' || routeId === 'r8')) return true;
      return false;
    });
  }

  useEffect(() => {
    loadData()
  }, [])

  const openNew = () => { setForm({ estado: 'ACTIVO' }); setModal('new') }
  const openEdit = (rec) => { setForm({ ...rec }); setModal('edit') }
  const openStudents = (rec) => { setSelectedRecorrido(rec); setSearchEstudiante(''); setSearchNewEstudiante(''); setShowAddStudent(false); setModal('students') }
  const closeModal = () => { setModal(null); setForm({}); setSelectedRecorrido(null) }

  const save = async () => {
    if (modal === 'new') {
      const id = 'r_' + Date.now()
      const { data: newRow, error } = await supabase.from('recorridos').insert([{ ...form, id }]).select().single()
      if (!error && newRow) setData(d => [...d, newRow])
      else if(error) alert('Error al crear recorrido: ' + error.message)
    } else {
      const { error } = await supabase.from('recorridos').update(form).eq('id', form.id)
      if (!error) setData(d => d.map(r => r.id === form.id ? form : r))
      else alert('Error al actualizar: ' + error.message)
    }
    closeModal()
  }

  const remove = async (id) => {
    if(!window.confirm('¿Seguro que quieres eliminar este recorrido?')) return
    const { error } = await supabase.from('recorridos').delete().eq('id', id)
    if (!error) setData(d => d.filter(r => r.id !== id))
    else alert('No se puede eliminar. Es probable que haya buses o estudiantes vinculados a este recorrido.')
  }

  const updateRecorridoEstudiante = async (estId, newRecorridoId) => {
    const value = newRecorridoId || null;
    const { error } = await supabase.from('estudiantes').update({ id_recorrido: value }).eq('id', estId)
    if (!error) {
      setEstudiantesData(d => d.map(e => e.id === estId ? { ...e, id_recorrido: value } : e))
    } else {
      alert('Error al actualizar el estudiante: ' + error.message)
    }
  }

  const getExportData = () => {
    if (!selectedRecorrido) return []
    const estudiantes = getStudentsForRoute(selectedRecorrido.id).sort(sortEstudiantes)
    return estudiantes.map(e => ({ nombre: e.nombre, rut: e.rut, curso: e.curso }))
  }
  const exportCols = [
    { header: 'Nombre Estudiante', key: 'nombre', width: 40, align: 'left' },
    { header: 'RUT', key: 'rut', width: 20, align: 'center' },
    { header: 'Curso', key: 'curso', width: 15, align: 'center' }
  ]

  const handleExportExcel = () => {
    exportToExcel(getExportData(), exportCols, makeFilename('lista_recorrido', { recorrido: selectedRecorrido.nombre.replace(/\s+/g, '_') }), `Lista de Estudiantes - ${selectedRecorrido.nombre}`)
  }

  const handleExportPDF = () => {
    exportToPDF(getExportData(), exportCols, makeFilename('lista_recorrido', { recorrido: selectedRecorrido.nombre.replace(/\s+/g, '_') }), `Lista de Estudiantes - ${selectedRecorrido.nombre}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="toolbar">
        <div className="toolbar-left" />
        <div className="toolbar-right">
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" id="btn-nuevo-recorrido" onClick={openNew}>
            <Plus size={15} /> Nuevo Recorrido
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando recorridos...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {data.map(rec => {
            const busesCount = busesData.filter(b => b.id_recorrido === rec.id).length
            const estCount = getStudentsForRoute(rec.id).length
            return (
              <div key={rec.id} className="card">
                <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={18} style={{ color: 'var(--info)' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{rec.nombre}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rec.destino}</div>
                      </div>
                    </div>
                    <span className={`badge badge-${rec.estado === 'ACTIVO' ? 'success' : 'muted'}`}>{rec.estado}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Clock size={13} />
                    <span>Salida: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{rec.horario_salida}</span></span>
                  </div>
                </div>
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <StatMini label="Buses Asignados"  value={busesCount} color="var(--primary)" />
                    <StatMini label="Estudiantes"      value={estCount}   color="var(--success)" />
                  </div>
                  {busesCount > 0 && (
                    <div style={{ marginTop: 5 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Vehículos en ruta</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {busesData.filter(b => b.id_recorrido === rec.id).map(b => (
                          <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-app)', border: '1px solid var(--border-bright)', padding: '6px 12px', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: 4, borderRadius: 6, display: 'flex' }}>
                                <Bus size={14} />
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{b.numero_bus}</span>
                            </div>
                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>{b.patente}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openStudents(rec)} style={{ marginRight: 'auto' }}><Users size={13} /> Ver Lista</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(rec)}><Pencil size={13} /> Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(rec.id)}><Trash2 size={13} /> Eliminar</button>
                </div>
              </div>
            )
          })}
          {data.length === 0 && (
             <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No hay recorridos creados.</div>
          )}
        </div>
      )}

      {modal === 'new' || modal === 'edit' ? (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title"><MapPin size={18} /> {modal === 'new' ? 'Nuevo Recorrido' : 'Editar Recorrido'}</span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field full">
                  <label>Nombre del Recorrido</label>
                  <input className="input" value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Recorrido Norte" />
                </div>
                <div className="form-field full">
                  <label>Destino / Sector principal</label>
                  <input className="input" value={form.destino || ''} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} placeholder="Ej: Sector La Florida" />
                </div>
                <div className="form-field">
                  <label>Horario de Salida (Desde el Liceo)</label>
                  <input className="input font-mono" type="time" value={form.horario_salida || ''} onChange={e => setForm(f => ({ ...f, horario_salida: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Estado</label>
                  <select className="input" value={form.estado || 'ACTIVO'} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'students' && selectedRecorrido && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <span className="modal-title"><Users size={18} /> Estudiantes — {selectedRecorrido.nombre}</span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0, maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ padding: '14px 20px', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="🔍 Buscar en esta lista..." 
                  value={searchEstudiante}
                  onChange={e => setSearchEstudiante(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={() => setShowAddStudent(!showAddStudent)}>
                  {showAddStudent ? 'Cancelar' : '+ Agregar Estudiante'}
                </button>
              </div>

              {showAddStudent && (
                <div style={{ padding: '14px 20px', background: 'var(--info-bg)', borderBottom: '1px solid var(--info)', position: 'relative' }}>
                  <input 
                    type="text" 
                    className="input" 
                    autoFocus
                    placeholder="🔍 Escribe nombre o curso para buscar en todo el colegio..." 
                    value={searchNewEstudiante}
                    onChange={e => setSearchNewEstudiante(e.target.value)}
                    style={{ width: '100%', borderColor: 'var(--info)' }}
                  />
                  {searchNewEstudiante && (
                    <div style={{ position: 'absolute', top: 'calc(100% - 14px)', left: 20, right: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                      {estudiantesData
                        .filter(e => !getStudentsForRoute(selectedRecorrido.id).some(s => s.id === e.id))
                        .filter(e => e.nombre.toLowerCase().includes(searchNewEstudiante.toLowerCase()) || e.curso.toLowerCase().includes(searchNewEstudiante.toLowerCase()))
                        .sort(sortEstudiantes)
                        .slice(0, 30) // limit results
                        .map(e => (
                          <div key={e.id} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-bright)' }} 
                               onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-card-hover)'}
                               onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                               onClick={() => {
                                  updateRecorridoEstudiante(e.id, selectedRecorrido.id)
                                  setSearchNewEstudiante('')
                                  setShowAddStudent(false)
                               }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{e.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {e.curso} · {e.rut} · Recorrido actual: <strong style={{ color: e.id_recorrido ? 'var(--primary)' : 'inherit' }}>{e.id_recorrido ? (data.find(r => r.id === e.id_recorrido)?.nombre || 'Desconocido') : 'Ninguno'}</strong>
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="table-wrapper" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
                <table style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                    <tr>
                      <th>Nombre</th>
                      <th>RUT</th>
                      <th>Curso</th>
                      <th style={{ width: 140 }}>Recorrido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getStudentsForRoute(selectedRecorrido.id)
                      .filter(e => !searchEstudiante || e.nombre.toLowerCase().includes(searchEstudiante.toLowerCase()) || e.curso.toLowerCase().includes(searchEstudiante.toLowerCase()))
                      .sort(sortEstudiantes)
                      .map(est => (
                      <tr key={est.id}>
                        <td><strong>{est.nombre}</strong></td>
                        <td className="font-mono text-sm">{est.rut}</td>
                        <td><span className="chip">{est.curso}</span></td>
                        <td>
                          <select className="input" style={{ padding: '4px 8px', fontSize: 12, height: 'auto' }} value={est.id_recorrido || ''} onChange={e => updateRecorridoEstudiante(est.id, e.target.value)}>
                            <option value="">[Quitar]</option>
                            {data.map(r => (
                              <option key={r.id} value={r.id}>{r.nombre}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {estudiantesData.filter(e => e.id_recorrido === selectedRecorrido.id).length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                          No hay estudiantes asignados a este recorrido.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success btn-sm" onClick={handleExportExcel} style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: 'white' }}>
                  <Download size={14} /> Excel
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleExportPDF} style={{ backgroundColor: '#d13438', borderColor: '#d13438', color: 'white' }}>
                  <Download size={14} /> PDF
                </button>
              </div>
              <button className="btn btn-secondary" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatMini({ label, value, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

const courseWeight = (curso) => {
  if (!curso) return 99;
  const c = curso.toLowerCase();
  if (c.includes('7°') || c.includes('7º') || c.includes('7mo') || c.includes('7basico') || c.includes('7 basico')) return 7;
  if (c.includes('8°') || c.includes('8º') || c.includes('8vo') || c.includes('8basico') || c.includes('8 basico')) return 8;
  if (c.includes('1°') || c.includes('1º') || c.includes('1ro') || c.includes('1 medio') || c.includes('1medio')) return 11;
  if (c.includes('2°') || c.includes('2º') || c.includes('2do') || c.includes('2 medio') || c.includes('2medio')) return 12;
  if (c.includes('3°') || c.includes('3º') || c.includes('3ro') || c.includes('3 medio') || c.includes('3medio')) return 13;
  if (c.includes('4°') || c.includes('4º') || c.includes('4to') || c.includes('4 medio') || c.includes('4medio')) return 14;
  return 99;
}

const sortEstudiantes = (a, b) => {
  const wA = courseWeight(a.curso);
  const wB = courseWeight(b.curso);
  if (wA !== wB) return wA - wB;
  
  const cA = (a.curso || '').toLowerCase();
  const cB = (b.curso || '').toLowerCase();
  if (cA !== cB) return cA.localeCompare(cB);
  
  return (a.nombre || '').localeCompare(b.nombre || '');
}
