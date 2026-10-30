import {
  categoryMeta,
  formatDate,
  formatDistance,
  getDue,
  remainingText,
  STATUS_LABEL,
} from '../maintenance'
import type { DistanceUnit, MaintenanceItem } from '../types'

function formatCurrency(value: number): string {
  return value.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Props = {
  item: MaintenanceItem
  currentKm: number
  unit: DistanceUnit
  onRegister: (item: MaintenanceItem) => void
  onEdit: (item: MaintenanceItem) => void
  onDelete: (item: MaintenanceItem) => void
}

export function ItemCard({ item, currentKm, unit, onRegister, onEdit, onDelete }: Props) {
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
            Historial <span className="item__history-count">{item.history.length}</span>
          </summary>
          <ul>
            {item.history.map(record => {
              const parts = record.partsCost ?? 0
              const labor = record.laborCost ?? 0
              const total = record.totalCost ?? (parts > 0 || labor > 0 ? parts + labor : undefined)
              const hasCost = total !== undefined && total > 0
              return (
                <li key={record.id}>
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
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </article>
  )
}
