import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'garaje.install.dismissedUntil'
const DISMISS_DAYS = 30

function isStandalone(): boolean {
  const displayMode = window.matchMedia('(display-mode: standalone)').matches
  const navigatorFlag = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return displayMode || navigatorFlag
}

function isIOS(): boolean {
  const ua = navigator.userAgent
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iphone|ipad|ipod/i.test(ua) || iPadOS
}

function isSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

export function InstallCard() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [ios] = useState(isIOS)

  useEffect(() => {
    if (isStandalone() || isSnoozed()) return

    function handlePrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    function handleInstalled() {
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)

    // iOS Safari no dispara beforeinstallprompt: mostramos las instrucciones.
    if (ios) setVisible(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [ios])

  if (!visible) return null

  function snooze() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000))
    } catch {
      // Sin almacenamiento: se oculta solo en esta sesión.
    }
    setVisible(false)
  }

  async function install() {
    if (!promptEvent) return
    setInstalling(true)
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') setVisible(false)
      else snooze()
    } finally {
      setInstalling(false)
      setPromptEvent(null)
    }
  }

  return (
    <section className="install" aria-label="Instalar Garaje">
      <div className="install__body">
        <p className="install__label">App instalable</p>
        <h2 className="install__title">
          {ios ? 'Llevá Garaje en tu iPhone' : 'Instalá Garaje en tu dispositivo'}
        </h2>
        {ios ? (
          <p className="install__text">
            Abrí esta página en <strong>Safari</strong>, tocá <strong>Compartir</strong> y elegí{' '}
            <strong>“Añadir a pantalla de inicio”</strong>. Se abre como una app y funciona sin
            conexión.
          </p>
        ) : (
          <p className="install__text">
            Se abre como una app, sin tiendas ni descargas. Funciona sin conexión y se actualiza
            sola.
          </p>
        )}
        <div className="install__actions">
          {!ios && promptEvent && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void install()}
              disabled={installing}
            >
              {installing ? 'Instalando…' : 'Instalar app'}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={snooze}>
            Ahora no
          </button>
        </div>
      </div>
    </section>
  )
}
