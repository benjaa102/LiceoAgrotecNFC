import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, Shield, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Si ya está autenticado, redirigir al dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])



  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.message?.includes('Invalid login')) {
        setError('Correo o contraseña incorrectos')
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.')
      } else {
        setError('Error al iniciar sesión. Verifica tus credenciales.')
      }
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="login-page">
      {/* Partículas flotantes decorativas */}
      <div className="login-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="login-particle" style={{ '--delay': `${i * 2}s`, '--x': `${15 + i * 14}%`, '--size': `${4 + i * 2}px` }} />
        ))}
      </div>

      {/* Fondo con gradiente animado */}
      <div className="login-bg" />

      <div className="login-container">
        {/* ─── Panel izquierdo: Branding ─── */}
        <div className="login-brand">
          <div className="login-brand-content">
            <img src="/logo-liceo.png" alt="Logo Liceo AGROTEC Werner Grob" className="login-brand-logo" />
            <h1 className="login-brand-title">Liceo AGROTEC<span> Werner Grob</span></h1>
            <p className="login-brand-subtitle">
              Sistema de Control de Asistencia NFC
            </p>

            <div className="login-brand-divider" />

            <div className="login-brand-features">
              <div className="login-feature">
                <div className="login-feature-icon">🚌</div>
                <div>
                  <div className="login-feature-title">Transporte Escolar</div>
                  <div className="login-feature-desc">Control NFC de buses y furgones</div>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">🍽</div>
                <div>
                  <div className="login-feature-title">Comedor Estudiantil</div>
                  <div className="login-feature-desc">Registro automático de alimentación</div>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">📊</div>
                <div>
                  <div className="login-feature-title">Reportes Avanzados</div>
                  <div className="login-feature-desc">Estadísticas y exportación CSV/PDF</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Panel derecho: Formulario ─── */}
        <div className="login-form-panel">
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-form-header">
              <div className="login-form-shield">
                <Shield size={22} />
              </div>
              <h2>Iniciar Sesión</h2>
              <p>Ingresa tus credenciales para acceder al panel</p>
            </div>

            {error && (
              <div className="login-error">
                <span>⚠</span> {error}
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-email">Correo Electrónico</label>
              <div className="login-input-wrap">
                <Mail size={18} className="login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="admin@liceo.cl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-input-wrap">
                <Lock size={18} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-pwd-toggle"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="login-spinner" />
                  Verificando...
                </>
              ) : (
                <>
                  <Lock size={16} />
                  Acceder al Panel
                </>
              )}
            </button>

            <div className="login-footer">
              <p>Acceso exclusivo para personal autorizado del establecimiento</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
