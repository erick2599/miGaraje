import { useState } from 'react'
import {
  categoryMeta,
  formatDate,
  formatDistance,
  getDue,
  remainingText,
  STATUS_LABEL,
} from '../maintenance'
import type { DistanceUnit, MaintenanceItem, ServiceRecord } from '../types'

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseOptionalCost(value: string): { valid: boolean; value?: number } {
  const trimmed = value.trim()
  if (trimmed === '') return { valid: true }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return { valid: false }
  return { valid: true, value: Math.round(parsed * 100) / 100 }
}

type Props = {
  item: MaintenanceItem
  currentKm: number
  unit: DistanceUnit
  onRegister: (item: MaintenanceItem) => void
  onEdit: (item: MaintenanceItem) => void
  onDelete: (item: MaintenanceItem) => void
  onEditHistory?: (itemId: string, recordId: string, patch: Partial<ServiceRecord>) => void
  onDeleteHistory?: (itemId: string, recordId: string) => void
}

type HistoryRecordRowProps = {
  itemId: string
  record: ServiceRecord
  unit: DistanceUnit
  onEditHistory?: Props['onEditHistory']
  onDeleteHistory?: Props['onDeleteHistory']
}

function HistoryRecordRow({
  itemId,
  record,
  unit,
  onEditHistory,
  onDeleteHistory,
}: HistoryRecordRowProps) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(record.date || '')
  const [km, setKm] = useState(String(Math.round(record.km || 0)))
  const [note, setNote] = useState(record.note || '')
  const [pCost, setPCost] = useState(
    typeof record.partsCost === 'number' ? record.partsCost.toString() : '',
  )
  const [lCost, setLCost] = useState(
    typeof record.laborCost === 'number' ? record.laborCost.toString() : '',
  )
  const [error, setError] = useState('')
  const parts = typeof record.partsCost === 'number' ? record.partsCost : 0
  const labor = typeof record.laborCost === 'number' ? record.laborCost : 0
  const total =
    typeof record.totalCost === 'number'
      ? record.totalCost
      : parts > 0 || labor > 0
        ? parts + labor
        : undefined
  const hasCost = typeof total === 'number' && total > 0

  if (!editing) {
    return (
      <li>
        <span className="item__history-main">
          {formatDate(record.date)} · {formatDistance(record.km, unit)}
          {hasCost && <span> · {formatCurrency(total)}</span>}
        </span>
        {hasCost && (
          <span className="item__history-note">
            Refacciones: {formatCurrency(parts)} · Mano de obra: {formatCurrency(labor)}
          </span>
        )}
        {record.note && <span className="item__history-note">{record.note}</span>}
        {(onEditHistory || onDeleteHistory) && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {onEditHistory && (
              <button type="button" className="link" onClick={() => setEditing(true)}>
                Editar
              </button>
            )}
            {onDeleteHistory && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  if (window.confirm('¿Eliminar este registro del historial?')) {
                    onDeleteHistory(itemId, record.id)
                  }
                }}
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </li>
    )
  }

  function save() {
    if (!onEditHistory) return
    const parsedKm = Number(km)
    if (km.trim() === '' || !Number.isFinite(parsedKm) || parsedKm < 0) {
      setError('Ingresá un odómetro válido.')
      return
    }

    const parsedParts = parseOptionalCost(pCost)
    const parsedLabor = parseOptionalCost(lCost)
    if (!parsedParts.valid || !parsedLabor.valid) {
      setError('Los costos deben ser valores mayores o iguales a cero, o quedar vacíos.')
      return
    }

    const totalCost =
      parsedParts.value !== undefined || parsedLabor.value !== undefined
        ? (parsedParts.value ?? 0) + (parsedLabor.value ?? 0)
        : undefined
    onEditHistory(itemId, record.id, {
      date,
      km: parsedKm,
      note,
      partsCost: parsedParts.value,
      laborCost: parsedLabor.value,
      totalCost,
    })
    setEditing(false)
    setError('')
  }

  return (
    <li>
      <div className="field-row">
        <label className="field">
          <span className="field__label">Fecha</span>
          <input
            className="input"
            type="date"
            value={date}
            onChange={event => setDate(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Km</span>
          <input
            className="input"
            type="number"
            min={0}
            value={km}
            onChange={event => setKm(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span className="field__label">Nota</span>
        <input className="input" value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field__label">Refacciones ($)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={pCost}
            onChange={event => {
              setPCost(event.target.value)
              setError('')
            }}
          />
        </label>
        <label className="field">
          <span className="field__label">Mano de obra ($)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={lCost}
            onChange={event => {
              setLCost(event.target.value)
              setError('')
            }}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={save}>
          Guardar
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setEditing(false)
            setError('')
          }}
        >
          Cancelar
        </button>
      </div>
    </li>
  )
}

export function ItemCard({ item, currentKm, unit, onRegister, onEdit, onDelete, onEditHistory, onDeleteHistory }: Props) {
  const due = getDue(item, currentKm, unit)
  const meta = categoryMeta(item.category)

  const nextParts: string[] = []
  if (due.dueKm !== null) nextParts.push(formatDistance(due.dueKm, unit))
  if (due.dueDate !== null) nextParts.push(formatDate(due.dueDate))

  const intervalParts: string[] = []
  if (item.intervalKm !== null) intervalParts.push(`cada ${formatDistance(item.intervalKm, unit)}`)
  if (item.intervalMonths !== null) {
    intervalParts.push(`cada ${item.intervalMonths} ${item.intervalMonths === 1 ? 'mes' : 'meses'}`)
  }

  return (
    <article className={`card item item--${due.status}`}>
      <div className="item__top">
        <span className="item__icon" aria-hidden="true">
          {meta.icon}
        </span>
        <div className="item__id">
          <h3 className="item__name">{item.name}</h3>
          <p className="item__meta">
            {meta.label}
            {intervalParts.length > 0 ? ` · ${intervalParts.join(' · ')}` : ''}
          </p>
        </div>
        <span className={`pill pill--${due.status}`}>{STATUS_LABEL[due.status]}</span>
      </div>

      <dl className="item__facts">
        <div>
          <dt>Último</dt>
          <dd>
            {item.lastKm !== null ? formatDistance(item.lastKm, unit) : '—'}
            <span className="item__sep"> · </span>
            {formatDate(item.lastDate)}
          </dd>
        </div>
        <div>
          <dt>Próximo</dt>
          <dd>{nextParts.length > 0 ? nextParts.join(' · ') : '—'}</dd>
        </div>
      </dl>

      {due.status !== 'unset' && (
        <div className="item__progress">
          <div className="bar" aria-hidden="true">
            <span className={`bar__fill bar__fill--${due.status}`} style={{ width: `${due.progress * 100}%` }} />
          </div>
          <p className="item__remaining">{remainingText(due, unit)}</p>
        </div>
      )}

      <div className="item__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onRegister(item)}>
          Registrar servicio
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(item)}>
          Editar
        </button>
        <button
          type="button"
          className="btn btn--danger-ghost btn--sm"
          onClick={() => onDelete(item)}
        >
          Eliminar
        </button>
      </div>

      {item.note && <p className="item__note">💡 {item.note}</p>}

      {item.history.length > 0 && (
        <details className="item__history">
          <summary>
            Historial             <span className="item__history-count">{item.history.length}</span>
          </summary>
          <ul>
            {item.history.map(record => (
              <HistoryRecordRow
                key={record.id}
                itemId={item.id}
                record={record}
                unit={unit}
                onEditHistory={onEditHistory}
                onDeleteHistory={onDeleteHistory}
              />
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}
