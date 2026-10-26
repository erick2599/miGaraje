import { useEffect, useState } from 'react'
import type { AuthError, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AuthResult = { error?: string }

function friendlyError(error: AuthError): string {
  const message = error.message.toLowerCase()
  if (message.includes('security purposes') || message.includes('rate limit')) {
    return 'Esperá un minuto antes de pedir otro código.'
  }
  if (message.includes('invalid email') || message.includes('unable to validate email')) {
    return 'Ese email no parece válido.'
  }
  if (message.includes('expired') || message.includes('token') || message.includes('otp')) {
    return 'El código no es válido o venció. Pedí uno nuevo.'
  }
  return error.message
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string): Promise<AuthResult> {
    if (!supabase) return { error: 'Supabase no está configurado.' }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    })
    return error ? { error: friendlyError(error) } : {}
  }

  /**
   * Verifica el código de 6 dígitos del email. Es el camino recomendado en
   * iPhone: el enlace abriría Safari y la sesión no quedaría en la app instalada.
   */
  async function verifyCode(email: string, token: string): Promise<AuthResult> {
    if (!supabase) return { error: 'Supabase no está configurado.' }
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    return error ? { error: friendlyError(error) } : {}
  }

  async function signOut(): Promise<AuthResult> {
    if (!supabase) return {}
    // scope local: cierra solo este dispositivo y no necesita red.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    return error ? { error: error.message } : {}
  }

  return {
    configured: supabase !== null,
    loading,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    signIn,
    verifyCode,
    signOut,
  }
}
