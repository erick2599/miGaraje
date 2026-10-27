import { useState, type FormEvent } from 'react'
import type { DistanceUnit, VehicleType } from '../types'

type Props = {
  onStart: (name: string, distance: number, type: VehicleType, unit: DistanceUnit) => void
}

export function SetupScreen({ onStart }: Props) {
  const [name, setName] = useState('')
  const [distance, setDistance] = useState('')
  const [type, setType] = useState<VehicleType>('car')
  const [unit, setUnit] = useState<DistanceUnit>('km')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(distance.replace(/[^\d]/g, ''))
    if (!Number.isFinite(parsed) || distance.trim() === '') {
      setError('Ingresá el odómetro actual del vehículo.')
      return
    }
    onStart(name, parsed, type, unit)
  }

  return (
    <main className="setup">
      <div className="setup__intro">
        <p className="eyebrow">Garaje</p>
        <h1 className="setup__title">Tu carro o moto, al día</h1>
        <p className="setup__text">
          Cargá el odómetro actual y la app arma un plan de mantenimiento con los servicios más
          comunes para tu vehículo. Después podés ajustar cada intervalo.
        </p>
        <ul className="setup__bullets">
          <li>Elegí carro o moto y kilómetros o millas.</li>
          <li>Te avisa qué está vencido y qué viene pronto.</li>
          <li>Calcula el próximo servicio por distancia y por meses.</li>
          <li>Guarda el historial de cada trabajo.</li>
        </ul>
      </div>

      <form className="card setup__form" onSubmit={handleSubmit}>
        <h2 className="setup__form-title">Empezar</h2>

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
              onChange={event => setUnit(event.target.value as DistanceUnit)}
            >
              <option value="km">Kilómetros (km)</option>
              <option value="mi">Millas (mi)</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Nombre del vehículo (opcional)</span>
          <input
            className="input"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={type === 'motorcycle' ? 'Ej: Honda CB190 / Yamaha FZ' : 'Ej: Toyota Corolla 2018'}
            maxLength={60}
          />
        </label>

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
              placeholder={unit === 'mi' ? 'Ej: 53000' : 'Ej: 85000'}
              aria-invalid={error ? true : undefined}
            />
            <span className="input-group__suffix">{unit}</span>
          </div>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn--primary btn--block">
          Crear garaje
        </button>
        <p className="setup__hint">
          Los intervalos iniciales son orientativos. Revisá el manual de tu vehículo y editalos.
        </p>
      </form>
    </main>
  )
}
