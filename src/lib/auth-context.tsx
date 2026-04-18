'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => {}, logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
    return unsub
  }, [])

  const login = async () => { await signInWithPopup(auth, googleProvider) }
  const logout = async () => { await signOut(auth) }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
