import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { AppUser } from './supabase'

type AuthContextType = {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>
  signOut: () => void
  resetPassword: (email: string) => { error: string | null; hint?: string }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_KEY = 'pousada_session_v2'

function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

function setSession(email: string | null) {
  if (email) localStorage.setItem(SESSION_KEY, email)
  else localStorage.removeItem(SESSION_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getSession()
    if (stored) {
      // find user in data store
      try {
        const raw = localStorage.getItem('pousada_data_v2')
        if (raw) {
          const data = JSON.parse(raw)
          const found = (data.users || []).find((u: AppUser) => u.email === stored)
          if (found) setUser(found)
          else setSession(null)
        }
      } catch {
        setSession(null)
      }
    }
    setLoading(false)
  }, [])

  async function signIn(email: string, password: string) {
    try {
      const raw = localStorage.getItem('pousada_data_v2')
      const data = raw ? JSON.parse(raw) : { users: [] }
      const found = (data.users || []).find((u: AppUser) =>
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
      )
      if (!found) return { error: 'E-mail ou senha incorretos.' }
      setSession(found.email)
      setUser(found)
      return { error: null }
    } catch {
      return { error: 'Erro ao entrar. Tente novamente.' }
    }
  }

  async function signUp(email: string, password: string, name?: string) {
    try {
      const raw = localStorage.getItem('pousada_data_v2')
      const data = raw ? JSON.parse(raw) : { users: [] }
      if ((data.users || []).some((u: AppUser) => u.email.toLowerCase() === email.toLowerCase())) {
        return { error: 'Este e-mail já está cadastrado.' }
      }
      const newUser: AppUser = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: name || email.split('@')[0],
        email,
        password,
        created_at: new Date().toISOString(),
      }
      data.users = [...(data.users || []), newUser]
      localStorage.setItem('pousada_data_v2', JSON.stringify(data))
      setSession(email)
      setUser(newUser)
      return { error: null }
    } catch {
      return { error: 'Erro ao criar conta.' }
    }
  }

  function signOut() {
    setSession(null)
    setUser(null)
  }

  function resetPassword(email: string) {
    try {
      const raw = localStorage.getItem('pousada_data_v2')
      const data = raw ? JSON.parse(raw) : { users: [] }
      const found = (data.users || []).find((u: AppUser) => u.email.toLowerCase() === email.toLowerCase())
      if (!found) return { error: 'E-mail não encontrado.' }
      return {
        error: null,
        hint: `Olá ${found.name}! Sua senha é: ${found.password}. Anote e mantenha em local seguro. Você pode alterá-la no painel administrativo em Configurações > Usuários.`,
      }
    } catch {
      return { error: 'Erro ao buscar e-mail.' }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
