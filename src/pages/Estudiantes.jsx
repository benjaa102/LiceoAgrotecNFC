import React, { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, X, Users, RefreshCw, Save, Download, Folder, FolderOpen, User, ArrowUpCircle, GraduationCap, ChevronRight, AlertTriangle, CheckCircle2, UserX } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { exportBulkFichasPDF, exportFichasPorCursoZIP } from '../lib/exportUtils'

const TIPOS   = ['INTERNO', 'EXTERNO']
const ESTADOS = ['ACTIVO', 'PENDIENTE', 'REVOCADO']
const CURSOS  = ['7°', '8°', '1°A', '1°B', '1°C', '1°D', '2°A', '2°B', '2°C', '2°D', '3°A', '3°B', '3°C', '3°D', '4°A', '4°B', '4°C', '4°D']

// Mapa de promoción natural (curso actual → curso siguiente)
const PROMOCION_MAP = {
  '7°': '8°',
  '8°': '1°A', // Por defecto, se puede cambiar
  '1°A': '2°A', '1°B': '2°B', '1°C': '2°C', '1°D': '2°D',
  '2°A': '3°A', '2°B': '3°B', '2°C': '3°C', '2°D': '3°D',
  '3°A': '4°A', '3°B': '4°B', '3°C': '4°C', '3°D': '4°D',
}
const CURSOS_4MEDIO = ['4°A', '4°B', '4°C', '4°D']

export default function Estudiantes() {
  const navigate = useNavigate()
  const [data, setData]         = useState([])
  const [recorridos, setRecorridos] = useState([])
  const [loading, setLoading]   = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [search, setSearch]     = useState('')
  const [filterEstado, setFE]   = useState('')
  const [filterRecorrido, setFR] = useState('')
  const [filterCurso, setFC]     = useState('')
  const [filterTipo, setFT]      = useState('')
  const [modal, setModal]       = useState(null) // null | 'new' | {record}
  const [form, setForm]         = useState({})
  const [collapsedCursos, setCollapsedCursos] = useState(() => {
    const init = {}
    CURSOS.forEach(c => init[c] = true)
    return init
  })
  const [showGestionModal, setShowGestionModal] = useState(null) // null | 'promocion' | 'egreso'
  const [promoCursoOrigen, setPromoCursoOrigen] = useState('')
  const [promoCursoDestino, setPromoCursoDestino] = useState('')
  const [promoProcessing, setPromoProcessing] = useState(false)
  const [promoResult, setPromoResult] = useState(null)
  const [egresoAction, setEgresoAction] = useState('desactivar') // 'desactivar' | 'eliminar'
  const [egresoProcessing, setEgresoProcessing] = useState(false)
  const [egresoResult, setEgresoResult] = useState(null)
  const [egresoSelectedCursos, setEgresoSelectedCursos] = useState([...CURSOS_4MEDIO])

  // Auto-expandir carpetas si el usuario usa el buscador o filtro de curso
  useEffect(() => {
    if (search || filterCurso) {
      setCollapsedCursos({}) // Expandir todos (al no estar en el objeto, isCollapsed = false)
    } else {
      const init = {}
      CURSOS.forEach(c => init[c] = true)
      setCollapsedCursos(init)
    }
  }, [search, filterCurso])

  const loadData = async () => {
    setLoading(true)
    const [resEst, resRec] = await Promise.all([
      supabase.from('estudiantes').select('*').order('curso').order('nombre'),
      supabase.from('recorridos').select('*')
    ])
    if (resEst.data) setData(resEst.data)
    if (resRec.data) setRecorridos(resRec.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = data.filter(e => {
    const q = search.toLowerCase()
    const matchQ = !q || e.nombre.toLowerCase().includes(q) || e.rut?.toLowerCase().includes(q) || e.matricula?.toLowerCase().includes(q)
    const matchE = !filterEstado    || e.estado_autorizacion === filterEstado
    const matchR = !filterRecorrido || e.id_recorrido === filterRecorrido
    const matchC = !filterCurso     || e.curso === filterCurso
    const matchT = !filterTipo      || e.tipo === filterTipo
    return matchQ && matchE && matchR && matchC && matchT
  })

  const [downloadProgress, setDownloadProgress] = useState('')

  const handleDownloadFichas = async (studentsToDownload = filtered, groupName = '', separadas = true) => {
    if (studentsToDownload.length === 0) return alert('No hay estudiantes para descargar.')
    
    // Safety check to prevent Out of Memory browser crashes
    if (studentsToDownload.length > 80) {
      return alert('⚠️ LÍMITE SUPERADO\n\nEstás intentando generar más de 80 fichas PDF simultáneamente. Esto causará que tu navegador se quede sin memoria y se congele.\n\nPor favor, descarga las fichas curso por curso. Usa el botón de descarga 📥 que aparece al lado de cada curso en la tabla de abajo, o usa el filtro superior para seleccionar un curso en específico.')
    }

    if (!window.confirm(`¿Descargar las fichas de los ${studentsToDownload.length} estudiantes ${groupName ? `de ${groupName}` : 'visibles'}? (Mes actual)\n\nSe generará un PDF por cada alumno dentro de un archivo ZIP.`)) return
    
    setIsDownloading(true)
    setDownloadProgress('Cargando registros...')
    try {
      const studentIds = studentsToDownload.map(e => e.id)
      
      const now = new Date()
      const month = now.getMonth()
      const year = now.getFullYear()
      const datePrefix = `${year}-${String(month + 1).padStart(2, '0')}`

      const [resComedor, resBuses] = await Promise.all([
        supabase.from('registros_comedor').select('*').in('id_estudiante', studentIds).like('fecha', `${datePrefix}%`),
        supabase.from('asistencia_buses').select('*').in('id_estudiante', studentIds).like('fecha', `${datePrefix}%`)
      ])

      if (resComedor.error) console.warn("Error fetching registros_comedor:", resComedor.error)
      if (resBuses.error) console.warn("Error fetching asistencia_buses:", resBuses.error)

      if (separadas) {
        await exportFichasPorCursoZIP(
          studentsToDownload, resComedor.data || [], resBuses.data || [], month, year,
          (done, total, curso) => setDownloadProgress(`Generando ${curso}... (${done}/${total})`)
        )
      } else {
        await exportBulkFichasPDF(studentsToDownload, resComedor.data || [], resBuses.data || [], month, year)
      }
    } catch (err) {
      console.error(err)
      alert('Error descargando las fichas: ' + err.message)
    } finally {
      setIsDownloading(false)
      setDownloadProgress('')
    }
  }

  const openNew  = () => { setForm({ tipo: 'INTERNO', estado_autorizacion: 'ACTIVO' }); setModal('new') }
  const openEdit = (rec) => { setForm({ ...rec }); setModal(rec) }
  const closeModal = () => { setModal(null); setForm({}) }

  const downloadQR = () => {
    const svg = document.getElementById("qr-code-estudiante");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      // Add some padding and white background
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${form.nombre.replace(/\\s+/g, '_')}_${form.rut}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  const save = async () => {
    const payload = { ...form }
    if (payload.id_recorrido === '') payload.id_recorrido = null

    if (modal === 'new') {
      payload.id = 'e_' + Date.now()
      const { data: newRow, error } = await supabase.from('estudiantes').insert([payload]).select().single()
      if (error) alert('Error al crear estudiante: ' + error.message)
      if (!error && newRow) setData(d => [newRow, ...d])
    } else {
      const { error } = await supabase.from('estudiantes').update(payload).eq('id', payload.id)
      if (error) alert('Error al actualizar estudiante: ' + error.message)
      if (!error) setData(d => d.map(e => e.id === payload.id ? payload : e))
    }
    if (!payload.error) closeModal()
  }

  const remove = async (id) => {
    if(!window.confirm('¿Eliminar estudiante?')) return
    const { error } = await supabase.from('estudiantes').delete().eq('id', id)
    if (!error) setData(d => d.filter(e => e.id !== id))
  }

  const quickUpdate = async (id, field, value) => {
    const finalValue = value === '' ? null : value;
    setData(d => d.map(e => e.id === id ? { ...e, [field]: finalValue } : e)) // Optimistic UI
    const { error } = await supabase.from('estudiantes').update({ [field]: finalValue }).eq('id', id)
    if (error) {
      alert('Error al guardar el cambio: ' + error.message)
      loadData() // Revertir en caso de error
    } else {
      // Pequeño feedback visual (opcional, pero útil)
      const tr = document.getElementById(`row-${id}`)
      if (tr) {
        tr.style.background = 'rgba(34, 197, 94, 0.1)'
        setTimeout(() => tr.style.background = '', 600)
      }
    }
  }

  const estadoBadge = (e) => {
    const map = { ACTIVO: 'success', PENDIENTE: 'warning', REVOCADO: 'danger' }
    return <span className={`badge badge-${map[e]}`}>{e}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="input-group" style={{ maxWidth: 280 }}>
            <Search size={15} className="input-group-icon" />
            <input className="input" placeholder="Buscar nombre, RUT o matrícula…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 150 }} value={filterCurso} onChange={e => setFC(e.target.value)}>
            <option value="">Todos los cursos</option>
            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" style={{ width: 160 }} value={filterEstado} onChange={e => setFE(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" style={{ width: 180 }} value={filterRecorrido} onChange={e => setFR(e.target.value)}>
            <option value="">Todos los recorridos</option>
            {recorridos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <select className="input" style={{ width: 160 }} value={filterTipo} onChange={e => setFT(e.target.value)}>
            <option value="">Internos y Externos</option>
            <option value="INTERNO">Solo Internos</option>
            <option value="EXTERNO">Solo Externos</option>
          </select>
        </div>
        <div className="toolbar-right">
          <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>{filtered.length} estudiantes</span>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-secondary" onClick={() => setShowGestionModal('promocion')} style={{ borderColor: 'var(--info)', color: 'var(--info)' }}>
            <ArrowUpCircle size={15} /> Promover Curso
          </button>
          <button className="btn btn-secondary" onClick={() => setShowGestionModal('egreso')} style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
            <GraduationCap size={15} /> Egreso 4° Medio
          </button>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={15} /> Nuevo Estudiante
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Users size={16} /> Base de Datos de Estudiantes</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos desde Supabase...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Matrícula</th>
                  <th>Curso</th>
                  <th>Tipo</th>
                  <th>Recorrido</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9}><div className="empty-state"><Users size={32} /><p>No se encontraron estudiantes</p></div></td></tr>
                )}
                
                {(() => {
                  const groupedEstudiantes = filtered.reduce((acc, est) => {
                    const c = est.curso || 'Sin Curso'
                    if (!acc[c]) acc[c] = []
                    acc[c].push(est)
                    return acc
                  }, {})
                  
                  const sortedCursos = Object.keys(groupedEstudiantes).sort((a, b) => {
                    const idxA = CURSOS.indexOf(a)
                    const idxB = CURSOS.indexOf(b)
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB
                    if (idxA !== -1) return -1
                    if (idxB !== -1) return 1
                    return a.localeCompare(b)
                  })

                  return sortedCursos.map(curso => {
                    const isCollapsed = collapsedCursos[curso]
                    return (
                    <Fragment key={curso}>
                      <tr onClick={() => {
                        setCollapsedCursos(prev => {
                          const isCurrentlyCollapsed = prev[curso] !== false; // true if collapsed or undefined
                          if (isCurrentlyCollapsed) {
                            // Expand this one, collapse all others
                            const newState = {};
                            CURSOS.forEach(c => newState[c] = true);
                            newState[curso] = false;
                            return newState;
                          } else {
                            // Collapse this one
                            return { ...prev, [curso]: true };
                          }
                        })
                      }} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td colSpan={9} style={{ background: 'var(--bg-elevated)', padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isCollapsed ? <Folder size={18} style={{ color: 'var(--primary)' }} /> : <FolderOpen size={18} style={{ color: 'var(--primary)' }} />}
                            <span className="chip" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>{curso}</span>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{groupedEstudiantes[curso].length} estudiantes</span>
                            <button 
                              className="btn btn-secondary btn-sm btn-icon" 
                              title={`Descargar Fichas de ${curso}`}
                              style={{ background: 'transparent', border: '1px solid var(--border)' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownloadFichas(groupedEstudiantes[curso], curso)
                              }}
                              disabled={isDownloading}
                            >
                              <Download size={14} className={isDownloading ? 'spin' : ''} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && groupedEstudiantes[curso].map(est => (
                        <tr key={est.id} id={`row-${est.id}`} style={{ transition: 'background 0.5s' }}>
                          <td style={{ whiteSpace: 'nowrap', minWidth: 180, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}><strong>{est.nombre}</strong></td>
                          <td className="font-mono" style={{ fontSize: 13 }}>{est.rut}</td>
                          <td className="font-mono" style={{ fontSize: 13 }}>{est.matricula}</td>
                          <td>
                            <select className="input" style={{ padding: '4px 28px 4px 10px', fontSize: 12, height: '28px', background: 'var(--primary-glow)', color: 'var(--primary)', border: 'none', fontWeight: 600, minWidth: 70 }} value={est.curso || ''} onChange={e => quickUpdate(est.id, 'curso', e.target.value)}>
                              {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td>
                            <select className="input" style={{ padding: '4px 28px 4px 10px', fontSize: 12, height: '28px', background: est.tipo === 'INTERNO' ? 'var(--info-bg)' : 'var(--purple-bg)', color: est.tipo === 'INTERNO' ? 'var(--info)' : 'var(--purple)', border: 'none', fontWeight: 600, minWidth: 100 }} value={est.tipo} onChange={e => quickUpdate(est.id, 'tipo', e.target.value)}>
                              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td>
                             <select className="input" style={{ padding: '4px 24px 4px 10px', fontSize: 12, height: '28px', minWidth: 130 }} value={est.id_recorrido || ''} onChange={e => quickUpdate(est.id, 'id_recorrido', e.target.value)}>
                              <option value="">Sin recorrido asignado</option>
                              {recorridos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                            </select>
                          </td>
                          <td style={{ maxWidth: 150 }}>
                            <input className="input" style={{ padding: '4px 10px', fontSize: 12, height: '28px', width: '100%', minWidth: 110 }} value={est.direccion || ''} placeholder="Ej: Sector..." 
                              onChange={e => {
                                // Optimistic local update only for typing, save on blur
                                setData(d => d.map(x => x.id === est.id ? { ...x, direccion: e.target.value } : x))
                              }}
                              onBlur={e => quickUpdate(est.id, 'direccion', e.target.value)}
                            />
                          </td>
                          <td>{estadoBadge(est.estado_autorizacion)}</td>
                          <td style={{ minWidth: 140 }}>
                            <div className="d-flex gap-2" style={{ justifyContent: 'center' }}>
                              <button className="btn btn-primary btn-sm btn-icon" onClick={() => navigate(`/estudiante/${est.id}`)} title="Ver Perfil"><User size={13} /></button>
                              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(est)} title="Editar Detalles"><Pencil size={13} /></button>
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(est.id)} title="Eliminar"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )})
                })()}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title"><Pencil size={18} /> {modal === 'new' ? 'Nuevo Estudiante' : 'Editar Estudiante'}</span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field full">
                  <label>Nombre Completo</label>
                  <input className="input" value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Valentina Soto" />
                </div>
                <div className="form-field">
                  <label>RUT</label>
                  <input className="input font-mono" value={form.rut || ''} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
                </div>
                <div className="form-field">
                  <label>Matrícula / N° Lista</label>
                  <input className="input font-mono" value={form.matricula || ''} onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))} placeholder="2024001" />
                </div>
                <div className="form-field">
                  <label>Curso</label>
                  <select className="input" value={form.curso || ''} onChange={e => setForm(f => ({ ...f, curso: e.target.value }))}>
                    <option value="">Seleccionar</option>
                    {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Tipo</label>
                  <select className="input" value={form.tipo || 'INTERNO'} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Recorrido</label>
                  <select className="input" value={form.id_recorrido || ''} onChange={e => setForm(f => ({ ...f, id_recorrido: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {recorridos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field full">
                  <label>Dirección / Sector</label>
                  <input className="input" value={form.direccion || ''} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} placeholder="Ej: Camino a Mashue Km 5" />
                </div>
                <div className="form-field">
                  <label>Estado Autorización</label>
                  <select className="input" value={form.estado_autorizacion || 'ACTIVO'} onChange={e => setForm(f => ({ ...f, estado_autorizacion: e.target.value }))}>
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {form.id && (
                <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-card)', border: '1px dashed var(--primary)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ background: 'white', padding: 8, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <QRCodeSVG 
                      id="qr-code-estudiante" 
                      value={`${window.location.origin}/perfil/${form.id}`} 
                      size={90} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--primary)', fontWeight: 700 }}>Código QR (Credencial)</h4>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Al escanearlo con cualquier cámara, enviará al perfil público de <strong>{form.nombre || 'este estudiante'}</strong>.
                    </p>
                    <button className="btn btn-secondary btn-sm" onClick={downloadQR} type="button">
                      <Download size={14} /> Descargar Imagen QR
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}><Save size={15} /> Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Gestión Masiva ─────────────────────────── */}
      {showGestionModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !promoProcessing && !egresoProcessing && (setShowGestionModal(null), setPromoResult(null), setEgresoResult(null))}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <span className="modal-title">
                {showGestionModal === 'promocion' 
                  ? <><ArrowUpCircle size={18} /> Promoción Masiva de Curso</>
                  : <><GraduationCap size={18} /> Egreso de 4° Medio</>
                }
              </span>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { if (!promoProcessing && !egresoProcessing) { setShowGestionModal(null); setPromoResult(null); setEgresoResult(null) } }}><X size={15} /></button>
            </div>
            <div className="modal-body" style={{ padding: 24 }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <button 
                  className={`btn ${showGestionModal === 'promocion' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setShowGestionModal('promocion'); setPromoResult(null); setEgresoResult(null) }}
                  style={{ flex: 1 }}
                >
                  <ArrowUpCircle size={15} /> Promover
                </button>
                <button 
                  className={`btn ${showGestionModal === 'egreso' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setShowGestionModal('egreso'); setPromoResult(null); setEgresoResult(null) }}
                  style={{ flex: 1 }}
                >
                  <GraduationCap size={15} /> Egreso
                </button>
              </div>

              {/* ── Tab: Promoción ─────────────────── */}
              {showGestionModal === 'promocion' && (
                <div>
                  {promoResult ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <CheckCircle2 size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
                      <h3 style={{ margin: '0 0 8px', color: 'var(--success)' }}>¡Promoción Exitosa!</h3>
                      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        Se promovieron <strong>{promoResult.count}</strong> estudiantes de <strong>{promoResult.from}</strong> a <strong>{promoResult.to}</strong>.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                        Selecciona el curso de origen y el curso de destino. <strong>Todos los estudiantes activos</strong> del curso origen serán movidos al curso destino de forma masiva.
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Curso Origen</label>
                          <select className="input" value={promoCursoOrigen} onChange={e => {
                            const val = e.target.value
                            setPromoCursoOrigen(val)
                            setPromoCursoDestino(PROMOCION_MAP[val] || '')
                          }}>
                            <option value="">Seleccionar curso...</option>
                            {CURSOS.filter(c => !CURSOS_4MEDIO.includes(c)).map(c => {
                              const count = data.filter(est => est.curso === c && est.estado_autorizacion === 'ACTIVO').length
                              return <option key={c} value={c}>{c} ({count} estudiantes)</option>
                            })}
                          </select>
                        </div>
                        <ChevronRight size={24} style={{ color: 'var(--primary)', marginTop: 18, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Curso Destino</label>
                          <select className="input" value={promoCursoDestino} onChange={e => setPromoCursoDestino(e.target.value)}>
                            <option value="">Seleccionar destino...</option>
                            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>

                      {promoCursoOrigen && promoCursoDestino && (
                        <div style={{ padding: '14px 16px', background: 'rgba(79, 142, 247, 0.08)', borderRadius: 12, border: '1px solid rgba(79, 142, 247, 0.15)', marginBottom: 20 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            <strong>{data.filter(est => est.curso === promoCursoOrigen && est.estado_autorizacion === 'ACTIVO').length}</strong> estudiantes activos de <strong>{promoCursoOrigen}</strong> serán promovidos a <strong>{promoCursoDestino}</strong>.
                          </div>
                        </div>
                      )}

                      <button 
                        className="btn btn-primary" 
                        style={{ width: '100%' }}
                        disabled={!promoCursoOrigen || !promoCursoDestino || promoCursoOrigen === promoCursoDestino || promoProcessing}
                        onClick={async () => {
                          const affected = data.filter(est => est.curso === promoCursoOrigen && est.estado_autorizacion === 'ACTIVO')
                          if (affected.length === 0) return alert('No hay estudiantes activos en ese curso.')
                          if (!window.confirm(`¿Confirmar promoción de ${affected.length} estudiantes de ${promoCursoOrigen} a ${promoCursoDestino}?\n\nEsta acción es irreversible.`)) return
                          
                          setPromoProcessing(true)
                          const ids = affected.map(e => e.id)
                          const { error } = await supabase.from('estudiantes').update({ curso: promoCursoDestino }).in('id', ids)
                          if (error) {
                            alert('Error: ' + error.message)
                          } else {
                            setPromoResult({ count: affected.length, from: promoCursoOrigen, to: promoCursoDestino })
                            setData(d => d.map(e => ids.includes(e.id) ? { ...e, curso: promoCursoDestino } : e))
                          }
                          setPromoProcessing(false)
                        }}
                      >
                        {promoProcessing ? <><RefreshCw size={15} className="spin" /> Procesando...</> : <><ArrowUpCircle size={15} /> Promover Estudiantes</>}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── Tab: Egreso ─────────────────── */}
              {showGestionModal === 'egreso' && (
                <div>
                  {egresoResult ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <CheckCircle2 size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
                      <h3 style={{ margin: '0 0 8px', color: 'var(--success)' }}>¡Egreso Completado!</h3>
                      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        {egresoResult.action === 'desactivar' 
                          ? <>Se desactivaron <strong>{egresoResult.count}</strong> estudiantes de 4° Medio.</>
                          : <>Se eliminaron <strong>{egresoResult.count}</strong> estudiantes y sus credenciales de 4° Medio.</>
                        }
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.15)', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          Los estudiantes de <strong>4° Medio</strong> son los que terminan su ciclo escolar. Puedes <strong>desactivarlos</strong> (se marcan como REVOCADO pero se conservan sus datos) o <strong>eliminarlos</strong> completamente.
                        </div>
                      </div>

                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Cursos a Egresar</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                        {CURSOS_4MEDIO.map(c => {
                          const count = data.filter(est => est.curso === c && est.estado_autorizacion === 'ACTIVO').length
                          const isSelected = egresoSelectedCursos.includes(c)
                          return (
                            <button 
                              key={c}
                              className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: 13 }}
                              onClick={() => {
                                setEgresoSelectedCursos(prev => 
                                  isSelected ? prev.filter(x => x !== c) : [...prev, c]
                                )
                              }}
                            >
                              {c} ({count})
                            </button>
                          )
                        })}
                      </div>

                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Acción</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                        <button 
                          className={`btn ${egresoAction === 'desactivar' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1 }}
                          onClick={() => setEgresoAction('desactivar')}
                        >
                          <UserX size={15} /> Desactivar
                        </button>
                        <button 
                          className={`btn ${egresoAction === 'eliminar' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, ...(egresoAction === 'eliminar' ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : {}) }}
                          onClick={() => setEgresoAction('eliminar')}
                        >
                          <Trash2 size={15} /> Eliminar Todo
                        </button>
                      </div>

                      {(() => {
                        const total = data.filter(est => egresoSelectedCursos.includes(est.curso) && est.estado_autorizacion === 'ACTIVO').length
                        return (
                          <div style={{ padding: '14px 16px', background: egresoAction === 'eliminar' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)', borderRadius: 12, border: `1px solid ${egresoAction === 'eliminar' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`, marginBottom: 20 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                              {egresoAction === 'desactivar' 
                                ? <>Se cambiarán <strong>{total}</strong> estudiantes a estado <strong>REVOCADO</strong>. Sus datos se conservarán.</>
                                : <>Se eliminarán permanentemente <strong>{total}</strong> estudiantes y todas sus credenciales NFC asociadas. <strong style={{ color: 'var(--danger)' }}>Esta acción NO se puede deshacer.</strong></>
                              }
                            </div>
                          </div>
                        )
                      })()}

                      <button 
                        className="btn" 
                        style={{ width: '100%', background: egresoAction === 'eliminar' ? 'var(--danger)' : 'var(--warning)', borderColor: egresoAction === 'eliminar' ? 'var(--danger)' : 'var(--warning)', color: 'white' }}
                        disabled={egresoSelectedCursos.length === 0 || egresoProcessing}
                        onClick={async () => {
                          const affected = data.filter(est => egresoSelectedCursos.includes(est.curso) && est.estado_autorizacion === 'ACTIVO')
                          if (affected.length === 0) return alert('No hay estudiantes activos en los cursos seleccionados.')
                          
                          const confirmMsg = egresoAction === 'desactivar'
                            ? `¿Desactivar ${affected.length} estudiantes de 4° Medio?\n\nSus datos se conservarán pero sus credenciales quedarán inactivas.`
                            : `⚠️ ¿ELIMINAR PERMANENTEMENTE ${affected.length} estudiantes de 4° Medio?\n\nSe borrarán todos sus datos, credenciales y registros de asistencia.\n\nEsta acción NO SE PUEDE DESHACER.`
                          
                          if (!window.confirm(confirmMsg)) return
                          if (egresoAction === 'eliminar' && !window.confirm('¿Estás COMPLETAMENTE SEGURO? Escribe OK para confirmar.')) return
                          
                          setEgresoProcessing(true)
                          const ids = affected.map(e => e.id)
                          
                          if (egresoAction === 'desactivar') {
                            const { error } = await supabase.from('estudiantes').update({ estado_autorizacion: 'REVOCADO' }).in('id', ids)
                            if (error) {
                              alert('Error: ' + error.message)
                            } else {
                              setEgresoResult({ count: affected.length, action: 'desactivar' })
                              setData(d => d.map(e => ids.includes(e.id) ? { ...e, estado_autorizacion: 'REVOCADO' } : e))
                            }
                          } else {
                            // Primero eliminar credenciales asociadas
                            await supabase.from('credenciales').delete().in('id_usuario', ids)
                            // Luego eliminar estudiantes
                            const { error } = await supabase.from('estudiantes').delete().in('id', ids)
                            if (error) {
                              alert('Error: ' + error.message)
                            } else {
                              setEgresoResult({ count: affected.length, action: 'eliminar' })
                              setData(d => d.filter(e => !ids.includes(e.id)))
                            }
                          }
                          setEgresoProcessing(false)
                        }}
                      >
                        {egresoProcessing 
                          ? <><RefreshCw size={15} className="spin" /> Procesando...</>
                          : egresoAction === 'desactivar' 
                            ? <><UserX size={15} /> Desactivar {egresoSelectedCursos.join(', ')}</>
                            : <><Trash2 size={15} /> Eliminar Permanentemente</>
                        }
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
