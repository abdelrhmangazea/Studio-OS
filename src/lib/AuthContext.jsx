import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Holds who is signed in, and the three rows that describe their studio:
 * their profile, their workspace, and their studio settings.
 *
 * Because of Row Level Security, each of those queries can only ever
 * return this user's own rows. There is no workspace filter in the
 * JavaScript below, and there does not need to be — the database
 * refuses to return anyone else's data.
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const userId = session?.user?.id ?? null

  const loadStudio = useCallback(async (id) => {
    const [profileResult, workspaceResult, settingsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('workspaces').select('*').maybeSingle(),
      supabase.from('studio_settings').select('*').maybeSingle(),
    ])
    setProfile(profileResult.data ?? null)
    setWorkspace(workspaceResult.data ?? null)
    setSettings(settingsResult.data ?? null)
  }, [])

  // Track the session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setProfile(null)
        setWorkspace(null)
        setSettings(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Load the studio whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    loadStudio(userId).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId, loadStudio])

  const refresh = useCallback(async () => {
    if (userId) await loadStudio(userId)
  }, [userId, loadStudio])

  const value = {
    session,
    profile,
    workspace,
    settings,
    loading,
    refresh,
    isOwner: profile?.role === 'owner',

    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),

    // `data` lands in raw_user_meta_data, which the signup trigger reads
    // to name the workspace and the profile.
    signUp: (email, password, name, studioName) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { name, studio_name: studioName } },
      }),

    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
