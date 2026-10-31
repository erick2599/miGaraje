import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { CATEGORIES, fromDisplayDistance, toDisplayDistance, todayISO } from '../maintenance'
import type { Category, DistanceUnit, ItemDraft, MaintenanceItem } from '../types'

function parseCost(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const normalized = trimmed.replace(',', '.').replace(/[^0-9.]/g, '')
  if (normalized === '' || normalized === '.') return undefined
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.round(parsed * 100) / 100
}

type Props = {
  item?: MaintenanceItem
  defaultKm: number
  unit: DistanceUnit
  onClose: () => void
  onSubmit: (draft: ItemDraft) => void
}

export function ItemDialog({ item, defaultKm, unit, onClose, onSubmit }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<Category>(item?.category ?? 'aceite')
  const [intervalDistance, setIntervalDistance] = useState(
    item?.intervalKm != null ? String(Math.round(toDisplayDistance(item.intervalKm, unit))) : '',
  )
  const [intervalMonths, setIntervalMonths] = useState(item?.intervalMonths?.toString() ?? '')
  const [lastDistance, setLastDistance] = useState(
    String(Math.round(toDisplayDistance(item?.lastKm ?? defaultKm, unit))),
  )
  const [lastDate, setLastDate] = useState(item?.lastDate ?? todayISO())
  const [note, setNote] = useState(item?.note ?? '')
  const [partsCost, setPartsCost] = useState('')
  const [laborCost, setLaborCost] = useState('')
  const [registerNow, setRegisterNow] = useState(!item)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Poné un nombre para el servicio.')
      return
    }

    const distanceValue = intervalDistance.trim() === '' ? null : Number(intervalDistance)
    const monthsValue = intervalMonths.trim() === '' ? null : Number(intervalMonths)

    if (distanceValue !== null && (!Number.isFinite(distanceValue) || distanceValue <= 0)) {
      setError('El intervalo de distancia debe ser mayor a cero.')
      return
    }
    if (monthsValue !== null && (!Number.isFinite(monthsValue) || monthsValue <= 0)) {
      setError('El intervalo en meses debe ser mayor a cero.')
      return
    }
    if (distanceValue === null && monthsValue === null) {
      setError('Definí al menos un intervalo: distancia, meses o ambos.')
      return
    }

    let kmLast: number | null = null
    if (distanceValue !== null) {
      const parsed = Number(lastDistance.replace(/[^\d]/g, ''))
      if (lastDistance.trim() === '' || !Number.isFinite(parsed)) {
        setError('Indicá en qué odómetro se hizo el último servicio.')
        return
      }
      kmLast = Math.round(fromDisplayDistance(parsed, unit))
    }

    const dateLast = monthsValue !== null ? lastDate : lastDate || null
    if (monthsValue !== null && !dateLast) {
      setError('Indicá la fecha del último servicio.')
      return
    }

    const parts = parseCost(partsCost)
    const labor = parseCost(laborCost)
    const total = parts !== undefined || labor !== undefined ? (parts ?? 0) + (labor ?? 0) : undefined

    onSubmit({
      name: cleanName,
      category,
      intervalKm:
        distanceValue === null ? null : Math.round(fromDisplayDistance(distanceValue, unit)),
      intervalMonths: monthsValue === null ? null : Math.round(monthsValue),
      lastKm: kmLast,
      lastDate: dateLast,
      note: note.trim(),
      partsCost: parts,
      laborCost: labor,
      totalCost: total,
      registerNow: !item && registerNow,
    })
  }

  return (
    <Modal
      title={item ? 'Editar servicio' : 'Nuevo servicio'}
      subtitle="Los intervalos son cada cuánto toca repetirlo."
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Nombre</span>
          <input
            className="input"
            value={name}
            onChange={event => {
              setName(event.target.value)
              setError('')
            }}
            placeholder="Ej: Cambio de aceite"
            maxLength={60}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Categoría</span>
          <select
            className="input"
            value={category}
            onChange={event => setCategory(event.target.value as Category)}
          >
            {CATEGORIES.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Cada</span>
            <div className="input-group">
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={intervalDistance}
                onChange={event => {
                  setIntervalDistance(event.target.value)
                  setError('')
                }}
                placeholder={unit === 'mi' ? '3000' : '5000'}
              />
              <span className="input-group__suffix">{unit}</span>
            </div>
          </label>

          <label className="field">
            <span className="field__label">o cada</span>
            <div className="input-group">
              <input
                className="input"
                type="number"
                min={0}
                max={120}
                step={1}
                value={intervalMonths}
                onChange={event => {
                  setIntervalMonths(event.target.value)
                  setError('')
                }}
                placeholder="6"
              />
              <span className="input-group__suffix">meses</span>
            </div>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Último servicio: odómetro</span>
            <div className="input-group">
              <input
                className="input"
                value={lastDistance}
                onChange={event => {
                  setLastDistance(event.target.value)
                  setError('')
                }}
                inputMode="numeric"
                placeholder={String(Math.round(toDisplayDistance(defaultKm, unit)))}
              />
              <span className="input-group__suffix">{unit}</span>
            </div>
          </label>

          <label className="field">
            <span className="field__label">Último servicio: fecha</span>
            <input
              className="input"
              type="date"
              value={lastDate}
              onChange={event => {
                setLastDate(event.target.value)
                setError('')
              }}
            />
          </label>
        </div>

        {!item && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={registerNow} onChange={e => setRegisterNow(e.target.checked)} />
              <span>Registrar este servicio ya (agregar al historial con costos)</span>
            </label>
            {registerNow && (
              <>
                <div className="field-row">
                  <label className="field">
                    <span className="field__label">Costo de refacciones (USD)</span>
                    <div className="input-group">
                      <span className="input-group__suffix">$</span>
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={partsCost}
                        onChange={event => setPartsCost(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span className="field__label">Costo de mano de obra (USD)</span>
                    <div className="input-group">
                      <span className="input-group__suffix">$</span>
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={laborCost}
                        onChange={event => setLaborCost(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </label>
                </div>
                {(partsCost.trim() !== '' || laborCost.trim() !== '') && (
                  <p className="form-hint">
                    Costo total: ${((parseCost(partsCost) ?? 0) + (parseCost(laborCost) ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </>
            )}
          </>
        )}

        <label className="field">
          <span className="field__label">Nota (opcional)</span>
          <textarea
            className="input input--area"
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ej: usar aceite 5W-30 sintético"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            {item ? 'Guardar cambios' : 'Agregar servicio'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
