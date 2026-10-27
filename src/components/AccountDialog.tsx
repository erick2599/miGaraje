import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import type { SyncStatus } from '../useGarage'

const PENDING_KEY = 'garaje.auth.pendingEmail'

export const SYNC_LABEL: Record<SyncStatus, string> = {
  local: 'Solo local',
  loading: 'Conectando…',
  saving: 'Guardando…',
  synced: 'Sincronizado',
  error: 'Error al sincronizar',
}

type Props = {
  configured: boolean
  email: string | null
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null
  onClose: () => void
  onSignIn: (email: string) => Promise<{ error?: string }>
  onVerifyCode: (email: string, code: string) => Promise<{ error?: string }>
  onSignOut: () => Promise<void>
  onSyncNow: () => void
}

function formatMoment(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function AccountDialog({
  configured,
  email,
  syncStatus,
  lastSyncedAt,
  syncError,
  onClose,
  onSignIn,
  onVerifyCode,
  onSignOut,
  onSyncNow,
}: Props) {
  const [inputEmail, setInputEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(PENDING_KEY)
    } catch {
      return null
    }
  })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!email) return
    try {
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      // Ignorar.
    }
  }, [email])

  function rememberPending(value: string | null) {
    try {
      if (value) sessionStorage.setItem(PENDING_KEY, value)
      else sessionStorage.removeItem(PENDING_KEY)
    } catch {
      // Sin almacenamiento: el formulario igual funciona en esta sesión.
    }
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    const clean = inputEmail.trim()
    if (!clean.includes('@') || clean.length < 5) {
      setError('Ingresá un email válido.')
      return
    }
    setBusy(true)
    setError('')
    const result = await onSignIn(clean)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      setCode('')
      setSentTo(clean)
      rememberPending(clean)
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault()
    if (!sentTo) return
    setVerifying(true)
    setError('')
    const result = await onVerifyCode(sentTo, code)
    setVerifying(false)
    if (result.error) setError(result.error)
    // Si el código es válido, la sesión llega por el padre y esta vista cambia sola.
  }

  const status: SyncStatus = !configured || !email ? 'local' : syncStatus

  return (
    <Modal
      title="Cuenta y sincronización"
      subtitle="Un solo garaje, en todos tus dispositivos."
      onClose={onClose}
    >
      {!configured ? (
        <div className="account">
          <p className="account__status">
            <span className="dot dot--local" /> Modo local
          </p>
          <p className="account__text">
            La app funciona sin cuenta y guarda los datos en este dispositivo. Para sincronizar
            entre el celular y la compu, conectá Supabase:
          </p>
          <ol className="account__steps">
            <li>Creá un proyecto en supabase.com.</li>
            <li>
              Ejecutá <code>supabase/schema.sql</code> en el SQL Editor del proyecto.
            </li>
            <li>
              Copiá <code>.env.example</code> a <code>.env.local</code> y completá la URL y la
              anon key.
            </li>
            <li>
              Reiniciá <code>npm run dev</code>.
            </li>
          </ol>
          <p className="account__hint">El paso a paso completo está en el README.</p>
        </div>
      ) : email ? (
        <div className="account">
          <p className={`account__status account__status--${status}`}>
            <span className={`dot dot--${status}`} /> {SYNC_LABEL[status]}
          </p>

          <dl className="account__meta">
            <div>
              <dt>Cuenta</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Última sincronización</dt>
              <dd>{lastSyncedAt ? formatMoment(lastSyncedAt) : '—'}</dd>
            </div>
          </dl>

          {syncError && <p className="form-error">{syncError}</p>}

          <div className="account__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onSyncNow}
              disabled={status === 'saving' || status === 'loading'}
            >
              Sincronizar ahora
            </button>
            <button type="button" className="btn btn--danger-ghost btn--sm" onClick={onSignOut}>
              Cerrar sesión
            </button>
          </div>

          <p className="account__hint">
            Al cerrar sesión se borra la copia local de este dispositivo. Tus datos siguen en la
            nube y vuelven al entrar de nuevo.
          </p>
        </div>
      ) : sentTo ? (
        <form className="form" onSubmit={handleVerify}>
          <p className="account__status">
            <span className="dot dot--synced" /> Código enviado
          </p>
          <p className="account__text">
            Te mandamos un email a <strong>{sentTo}</strong> con un enlace y un código de
            verificación.
          </p>
          <label className="field">
            <span className="field__label">Código de verificación</span>
            <input
              className="input account__code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              value={code}
              onChange={event => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 10))
                setError('')
              }}
              placeholder="00000000"
              autoFocus
            />
          </label>
          <p className="account__hint">
            Pegá el código completo: Supabase puede enviarlo de 6 a 10 dígitos.
          </p>
          {error && <p className="form-error">{error}</p>}
          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={verifying || code.length < 6}
          >
            {verifying ? 'Verificando…' : 'Entrar con código'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setSentTo(null)
              setCode('')
              setError('')
              rememberPending(null)
            }}
          >
            Usar otro email
          </button>
          <p className="account__hint">
            En iPhone, usá el código (no el enlace): el enlace abre Safari y la sesión no queda en
            la app instalada.
          </p>
        </form>
      ) : (
        <form className="form" onSubmit={handleSignIn}>
          <p className="account__text">
            Entrá con tu email. Te enviamos un código de verificación para que no tengas que
            recordar contraseñas.
          </p>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              value={inputEmail}
              onChange={event => {
                setInputEmail(event.target.value)
                setError('')
              }}
              placeholder="vos@ejemplo.com"
              autoComplete="email"
              autoFocus
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar código'}
          </button>
          <p className="account__hint">
            Si tu cuenta ya tiene un garaje guardado, se usa ese. Si está vacía, se sube el garaje
            de este dispositivo.
          </p>
        </form>
      )}
    </Modal>
  )
}
