import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { formatDistance, fromDisplayDistance, toDisplayDistance } from '../maintenance'
import type { DistanceUnit, Vehicle, VehicleType } from '../types'

type Props = {
  vehicle: Vehicle
  onClose: () => void
  onSave: (patch: Partial<Vehicle>) => void
}

export function VehicleDialog({ vehicle, onClose, onSave }: Props) {
  const [name, setName] = useState(vehicle.name)
  const [type, setType] = useState<VehicleType>(vehicle.type)
  const [unit, setUnit] = useState<DistanceUnit>(vehicle.distanceUnit)
  const [distance, setDistance] = useState(
    String(Math.round(toDisplayDistance(vehicle.currentKm, vehicle.distanceUnit))),
  )
  const [error, setError] = useState('')

  function handleUnitChange(next: DistanceUnit) {
    if (next === unit) return
    const parsed = Number(distance.replace(/[^\d]/g, ''))
    if (distance.trim() !== '' && Number.isFinite(parsed)) {
      const canonical = fromDisplayDistance(parsed, unit)
      setDistance(String(Math.round(toDisplayDistance(canonical, next))))
    }
    setUnit(next)
    setError('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(distance.replace(/[^\d]/g, ''))
    if (distance.trim() === '' || !Number.isFinite(parsed)) {
      setError('Ingresá un odómetro válido.')
      return
    }
    onSave({
      name,
      currentKm: Math.round(fromDisplayDistance(parsed, unit)),
      type,
      distanceUnit: unit,
    })
    onClose()
  }

  return (
    <Modal
      title="Vehículo"
      subtitle="Actualizá el nombre, el tipo, la unidad y el odómetro."
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Nombre</span>
          <input
            className="input"
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={60}
            placeholder={type === 'motorcycle' ? 'Mi moto' : 'Mi carro'}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Tipo de vehículo</span>
            <select
              className="input"
              value={type}
              onChange={event => setType(event.target.value as VehicleType)}
            >
              <option value="car">Carro / camioneta</option>
              <option value="motorcycle">Motocicleta</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">Unidad de distancia</span>
            <select
              className="input"
              value={unit}
              onChange={event => handleUnitChange(event.target.value as DistanceUnit)}
            >
              <option value="km">Kilómetros (km)</option>
              <option value="mi">Millas (mi)</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Odómetro actual</span>
          <div className="input-group">
            <input
              className="input"
              value={distance}
              onChange={event => {
                setDistance(event.target.value)
                setError('')
              }}
              inputMode="numeric"
              aria-invalid={error ? true : undefined}
            />
            <span className="input-group__suffix">{unit}</span>
          </div>
          <span className="field__hint">
            Odómetro guardado: {formatDistance(vehicle.currentKm, unit)}
          </span>
        </label>

        <p className="field__hint">
          El tipo se usa para la guía. Cambiarlo no borra ni modifica los servicios actuales.
        </p>

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
