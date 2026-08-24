import { useState, useEffect } from 'react'
import { Users, UserPlus, Shield, UserCog, Mail, Trash2, Key, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ email: '', nombre: '', cargo: 'Encargado Comedor' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchUsuarios = async () => {
    setLoading(true)
    const { data } = await supabase.from('usuarios_sistema').select('*').order('creado_en', { ascending: false })
    if (data) setUsuarios(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // IMPORTANTE: Al no tener un backend dedicado, registramos el perfil.
    // La cuenta real de Auth debe crearse en Supabase con este mismo correo,
    // o bien el usuario deberá registrarse y su auth_id se sincronizará.
    
    const { error } = await supabase.from('usuarios_sistema').insert([{
      email: formData.email,
      nombre: formData.nombre,
      cargo: formData.cargo
    }])

    if (!error) {
      alert('Perfil de usuario creado exitosamente.\n\nIMPORTANTE: Recuerda crear los credenciales (contraseña) para este correo directamente en el panel de Authentication de Supabase.')
      setFormData({ email: '', nombre: '', cargo: 'Encargado Comedor' })
      setShowModal(false)
      fetchUsuarios()
    } else {
      alert('Error al crear perfil: ' + error.message)
    }
    
    setIsSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar perfil de usuario? (Su cuenta de inicio de sesión Auth en Supabase deberá borrarse manualmente).')) {
      await supabase.from('usuarios_sistema').delete().eq('id', id)
      fetchUsuarios()
    }
  }

  const total = usuarios.length
  const admins = usuarios.filter(u => u.cargo === 'Administrador').length
  const encargados = usuarios.filter(u => u.cargo !== 'Administrador').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            <Users size={24} style={{ color: 'var(--primary)' }} />
            Gestión de Usuarios
          </h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {total} usuarios registrados en el sistema
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="users-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{admins}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Administradores</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>{encargados}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Encargados</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{total}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cuentas Activas</div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>USUARIO</th>
                <th>ROL</th>
                <th>ÚLTIMO ACCESO</th>
                <th>CREADO</th>
                <th style={{ width: 80, textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20 }}>Cargando usuarios...</td></tr>
              ) : usuarios.map(u => {
                const isAdmin = u.cargo === 'Administrador'
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: isAdmin ? 'var(--primary-bg)' : 'var(--success-bg)', color: isAdmin ? 'var(--primary)' : 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                          {u.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.nombre}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={10} /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: isAdmin ? 'var(--primary-bg)' : 'var(--success-bg)',
                        color: isAdmin ? 'var(--primary)' : 'var(--success)',
                        border: `1px solid ${isAdmin ? 'var(--primary)' : 'var(--success)'}40`
                      }}>
                        {isAdmin ? <Shield size={12} /> : <UserCog size={12} />}
                        {u.cargo.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-CL') : 'Nunca'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(u.creado_en).toLocaleDateString('es-CL')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-icon" onClick={() => handleDelete(u.id)} title="Eliminar">
                          <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {usuarios.length === 0 && !loading && (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No hay usuarios registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2><UserPlus size={18} /> Registrar Nuevo Perfil</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <div style={{ padding: '16px 24px', background: 'var(--warning-bg)', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Info size={20} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Aviso de Seguridad</strong><br />
                Por razones de seguridad, las contraseñas no se gestionan desde esta pantalla. Este formulario creará el perfil del usuario. Deberás asignar una contraseña para este correo directamente desde tu panel de Supabase (Sección Authentication).
              </div>
            </div>

            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label">Nombre Completo</label>
                  <input required className="input" style={{ width: '100%' }} value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej. Tía Juanita" />
                </div>
                <div>
                  <label className="label">Correo Electrónico (Login)</label>
                  <input required type="email" className="input" style={{ width: '100%' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="ejemplo@liceo.cl" />
                </div>
                <div>
                  <label className="label">Rol de Acceso</label>
                  <select required className="input" style={{ width: '100%' }} value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})}>
                    <option value="Encargado Comedor">Encargado Comedor (Solo módulo comedor)</option>
                    <option value="Administrador">Administrador (Acceso total)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Crear Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
