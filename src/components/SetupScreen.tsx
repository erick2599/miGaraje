import { useState, type FormEvent } from 'react'

type Props = {
  onStart: (name: string, km: number) => void
}

export function SetupScreen({ onStart }: Props) {
  const [name, setName] = useState('')
  const [km, setKm] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(km.replace(/[^\d]/g, ''))
    if (!Number.isFinite(parsed) || km.trim() === '') {
      setError('Ingresá el kilometraje actual del carro.')
      return
    }
    onStart(name, parsed)
  }

  return (
    <main className="setup">
      <div className="setup__intro">
        <p className="eyebrow">Garaje</p>
        <h1 className="setup__title">Tu carro, al día</h1>
        <p className="setup__text">
          Cargá el kilometraje actual y la app arma un plan de mantenimiento con los servicios más
          comunes: aceite, llantas, frenos, revisiones y más. Después podés ajustar cada intervalo.
        </p>
        <ul className="setup__bullets">
          <li>Te avisa qué está vencido y qué viene pronto.</li>
          <li>Calcula el próximo servicio por kilómetros y por meses.</li>
          <li>Guarda el historial de cada trabajo.</li>
        </ul>
      </div>

      <form className="card setup__form" onSubmit={handleSubmit}>
        <h2 className="setup__form-title">Empezar</h2>

        <label className="field">
          <span className="field__label">Nombre del carro (opcional)</span>
          <input
            className="input"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Ej: Toyota Corolla 2018"
            maxLength={60}
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
              placeholder="Ej: 85000"
              aria-invalid={error ? true : undefined}
            />
            <span className="input-group__suffix">km</span>
          </div>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn--primary btn--block">
          Crear garaje
        </button>
        <p className="setup__hint">
          Los intervalos iniciales son orientativos. Revisá el manual de tu carro y editalos.
        </p>
      </form>
    </main>
  )
}
