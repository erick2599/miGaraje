import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { CATEGORIES, todayISO } from '../maintenance'
import type { Category, ItemDraft, MaintenanceItem } from '../types'

type Props = {
  item?: MaintenanceItem
  defaultKm: number
  onClose: () => void
  onSubmit: (draft: ItemDraft) => void
}

export function ItemDialog({ item, defaultKm, onClose, onSubmit }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<Category>(item?.category ?? 'aceite')
  const [intervalKm, setIntervalKm] = useState(item?.intervalKm?.toString() ?? '')
  const [intervalMonths, setIntervalMonths] = useState(item?.intervalMonths?.toString() ?? '')
  const [lastKm, setLastKm] = useState(String(item?.lastKm ?? defaultKm))
  const [lastDate, setLastDate] = useState(item?.lastDate ?? todayISO())
  const [note, setNote] = useState(item?.note ?? '')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Poné un nombre para el servicio.')
      return
    }

    const kmValue = intervalKm.trim() === '' ? null : Number(intervalKm)
    const monthsValue = intervalMonths.trim() === '' ? null : Number(intervalMonths)

    if (kmValue !== null && (!Number.isFinite(kmValue) || kmValue <= 0)) {
      setError('El intervalo en kilómetros debe ser mayor a cero.')
      return
    }
    if (monthsValue !== null && (!Number.isFinite(monthsValue) || monthsValue <= 0)) {
      setError('El intervalo en meses debe ser mayor a cero.')
      return
    }
    if (kmValue === null && monthsValue === null) {
      setError('Definí al menos un intervalo: kilómetros, meses o ambos.')
      return
    }

    let kmLast: number | null = null
    if (kmValue !== null) {
      const parsed = Number(lastKm.replace(/[^\d]/g, ''))
      if (lastKm.trim() === '' || !Number.isFinite(parsed)) {
        setError('Indicá en qué kilometraje se hizo el último servicio.')
        return
      }
      kmLast = parsed
    }

    const dateLast = monthsValue !== null ? lastDate : lastDate || null
    if (monthsValue !== null && !dateLast) {
      setError('Indicá la fecha del último servicio.')
      return
    }

    onSubmit({
      name: cleanName,
      category,
      intervalKm: kmValue === null ? null : Math.round(kmValue),
      intervalMonths: monthsValue === null ? null : Math.round(monthsValue),
      lastKm: kmLast,
      lastDate: dateLast,
      note: note.trim(),
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
                value={intervalKm}
                onChange={event => {
                  setIntervalKm(event.target.value)
                  setError('')
                }}
                placeholder="5000"
              />
              <span className="input-group__suffix">km</span>
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
            <span className="field__label">Último servicio: km</span>
            <div className="input-group">
              <input
                className="input"
                value={lastKm}
                onChange={event => {
                  setLastKm(event.target.value)
                  setError('')
                }}
                inputMode="numeric"
                placeholder={String(defaultKm)}
              />
              <span className="input-group__suffix">km</span>
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
