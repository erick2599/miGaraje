import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import {
  formatDate,
  formatDistance,
  fromDisplayDistance,
  toDisplayDistance,
  todayISO,
} from '../maintenance'
import type { DistanceUnit, MaintenanceItem, ServiceDraft } from '../types'

type Props = {
  item: MaintenanceItem
  currentKm: number
  unit: DistanceUnit
  onClose: () => void
  onSubmit: (draft: ServiceDraft) => void
}

function parseCost(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const normalized = trimmed.replace(',', '.').replace(/[^0-9.]/g, '')
  if (normalized === '' || normalized === '.') return undefined
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.round(parsed * 100) / 100
}

export function ServiceDialog({ item, currentKm, unit, onClose, onSubmit }: Props) {
  const [date, setDate] = useState(todayISO())
  const [distance, setDistance] = useState(
    String(Math.round(toDisplayDistance(currentKm, unit))),
  )
  const [note, setNote] = useState('')
  const [partsCost, setPartsCost] = useState('')
  const [laborCost, setLaborCost] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!date) {
      setError('Elegí la fecha del servicio.')
      return
    }
    const parsed = Number(distance.replace(/[^\d]/g, ''))
    if (distance.trim() === '' || !Number.isFinite(parsed)) {
      setError('Ingresá el odómetro al momento del servicio.')
      return
    }

    const parts = parseCost(partsCost)
    const labor = parseCost(laborCost)
    const total = parts !== undefined || labor !== undefined ? (parts ?? 0) + (labor ?? 0) : undefined

    onSubmit({
      date,
      km: Math.round(fromDisplayDistance(parsed, unit)),
      note,
      partsCost: parts,
      laborCost: labor,
      totalCost: total,
    })
  }

  return (
    <Modal title="Registrar servicio" subtitle={item.name} onClose={onClose}>
      <div className="service-summary">
        <div>
          <span className="service-summary__label">Último registro</span>
          <strong>
            {item.lastKm !== null ? formatDistance(item.lastKm, unit) : '—'}
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
            <span className="field__label">Odómetro</span>
            <div className="input-group">
              <input
                className="input"
                value={distance}
                onChange={event => {
                  setDistance(event.target.value)
                  setError('')
                }}
                inputMode="numeric"
                placeholder={String(Math.round(toDisplayDistance(currentKm, unit)))}
              />
              <span className="input-group__suffix">{unit}</span>
            </div>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Costo de refacciones (USD, opcional)</span>
            <div className="input-group">
              <span className="input-group__suffix">$</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={partsCost}
                onChange={event => {
                  setPartsCost(event.target.value)
                  setError('')
                }}
                placeholder="0.00"
              />
            </div>
          </label>

          <label className="field">
            <span className="field__label">Costo de mano de obra (USD, opcional)</span>
            <div className="input-group">
              <span className="input-group__suffix">$</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={laborCost}
                onChange={event => {
                  setLaborCost(event.target.value)
                  setError('')
                }}
                placeholder="0.00"
              />
            </div>
          </label>
        </div>

        {(partsCost.trim() !== '' || laborCost.trim() !== '') && (
          <p className="form-hint">
            Costo total: ${(
              (parseCost(partsCost) ?? 0) + (parseCost(laborCost) ?? 0)
            ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}

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
          El próximo vencimiento se calcula desde estos datos. El odómetro del vehículo se
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
