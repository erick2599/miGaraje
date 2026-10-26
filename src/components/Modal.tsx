import { useEffect, type ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, subtitle, onClose, children }: Props) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('has-modal')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('has-modal')
    }
  }, [onClose])

  return (
    <div
      className="overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
