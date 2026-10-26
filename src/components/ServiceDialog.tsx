import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { formatDate, formatKm, todayISO } from '../maintenance'
import type { MaintenanceItem, ServiceDraft } from '../types'

type Props = {
  item: MaintenanceItem
  currentKm: number
  onClose: () => void
  onSubmit: (draft: ServiceDraft) => void
}

export function ServiceDialog({ item, currentKm, onClose, onSubmit }: Props) {
  const [date, setDate] = useState(todayISO())
  const [km, setKm] = useState(String(currentKm))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!date) {
      setError('Elegí la fecha del servicio.')
      return
    }
    const parsed = Number(km.replace(/[^\d]/g, ''))
    if (km.trim() === '' || !Number.isFinite(parsed)) {
      setError('Ingresá el kilometraje al momento del servicio.')
      return
    }
    onSubmit({ date, km: parsed, note })
  }

  return (
    <Modal
      title="Registrar servicio"
      subtitle={item.name}
      onClose={onClose}
    >
      <div className="service-summary">
        <div>
          <span className="service-summary__label">Último registro</span>
          <strong>
            {item.lastKm !== null ? `${formatKm(item.lastKm)} km` : '—'}
          </strong>
        </div>
        <div>
          <span className="service-summary__label">Fecha</span>
          <strong>{formatDate(item.lastDate)}</strong>
        </div>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Fecha</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={event => {
                setDate(event.target.value)
                setError('')
              }}
            />
          </label>

          <label className="field">
            <span className="field__label">Kilometraje</span>
            <div className="input-group">
              <input
                className="input"
                value={km}
                onChange={event => {
                  setKm(event.target.value)
                  setError('')
                }}
                inputMode="numeric"
                placeholder={String(currentKm)}
              />
              <span className="input-group__suffix">km</span>
            </div>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Detalle (opcional)</span>
          <textarea
            className="input input--area"
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ej: aceite 5W-30 + filtro, taller X"
          />
        </label>

        <p className="form-hint">
          El próximo vencimiento se calcula desde estos datos. El kilometraje del carro se
          actualiza si es mayor al actual.
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            Guardar servicio
          </button>
        </div>
      </form>
    </Modal>
  )
}
