import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Cargar perfil del usuario desde la tabla 'usuarios_sistema'
  const loadProfile = async (sessionUser) => {
    try {
      let { data } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('auth_id', sessionUser.id)
        .maybeSingle()

      if (!data && sessionUser.email) {
        // Buscar por email para linkear la cuenta
        const { data: dataByEmail } = await supabase
          .from('usuarios_sistema')
          .select('*')
          .eq('email', sessionUser.email)
          .maybeSingle()
        
        if (dataByEmail) {
          // Linkear auth_id
          await supabase.from('usuarios_sistema').update({ auth_id: sessionUser.id }).eq('id', dataByEmail.id)
          data = { ...dataByEmail, auth_id: sessionUser.id }
        }
      }
      setProfile(data || null)
    } catch (err) {
      console.warn("Error cargando perfil:", err)
      setProfile(null)
    }
  }

  useEffect(() => {
    // Verificar sesión existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user)
      setLoading(false)
    })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
