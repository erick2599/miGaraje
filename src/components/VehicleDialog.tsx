import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { formatKm } from '../maintenance'
import type { Vehicle } from '../types'

type Props = {
  vehicle: Vehicle
  onClose: () => void
  onSave: (patch: Partial<Vehicle>) => void
}

export function VehicleDialog({ vehicle, onClose, onSave }: Props) {
  const [name, setName] = useState(vehicle.name)
  const [km, setKm] = useState(String(vehicle.currentKm))
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(km.replace(/[^\d]/g, ''))
    if (km.trim() === '' || !Number.isFinite(parsed)) {
      setError('Ingresá un kilometraje válido.')
      return
    }
    onSave({ name, currentKm: parsed })
    onClose()
  }

  return (
    <Modal title="Vehículo" subtitle="Actualizá el nombre y el kilometraje actual." onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Nombre</span>
          <input
            className="input"
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={60}
            placeholder="Mi carro"
          />
        </label>

        <label className="field">
          <span className="field__label">Kilometraje actual</span>
          <div className="input-group">
            <input
              className="input"
              value={km}
              onChange={event => {
                setKm(event.target.value)
                setError('')
              }}
              inputMode="numeric"
              aria-invalid={error ? true : undefined}
            />
            <span className="input-group__suffix">km</span>
          </div>
          <span className="field__hint">Último registro: {formatKm(vehicle.currentKm)} km</span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  )
}
