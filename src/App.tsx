import { useMemo, useState } from 'react'
import { Guide } from './components/Guide'
import { ItemCard } from './components/ItemCard'
import { ItemDialog } from './components/ItemDialog'
import { ServiceDialog } from './components/ServiceDialog'
import { SetupScreen } from './components/SetupScreen'
import { VehicleDialog } from './components/VehicleDialog'
import { formatKm, getDue, remainingText, sortByUrgency } from './maintenance'
import { useGarage } from './useGarage'
import type { Filter, ItemDraft, MaintenanceItem, ServiceDraft } from './types'

type DialogState =
  | { kind: 'none' }
  | { kind: 'vehicle' }
  | { kind: 'new-item' }
  | { kind: 'edit-item'; item: MaintenanceItem }
  | { kind: 'service'; item: MaintenanceItem }

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'overdue', label: 'Vencidos' },
  { id: 'soon', label: 'Próximos' },
  { id: 'ok', label: 'Al día' },
]

export default function App() {
  const { garage, start, updateVehicle, addItem, updateItem, removeItem, registerService, reset } =
    useGarage()
  const [filter, setFilter] = useState<Filter>('all')
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })

  const view = useMemo(() => {
    if (!garage) return null
    const enriched = sortByUrgency(garage.items, garage.vehicle.currentKm).map(item => ({
      item,
      due: getDue(item, garage.vehicle.currentKm),
    }))
    const counts = { overdue: 0, soon: 0, ok: 0 }
    for (const entry of enriched) {
      if (entry.due.status !== 'unset') counts[entry.due.status] += 1
    }
    const priority =
      enriched.find(entry => entry.due.status === 'overdue') ??
      enriched.find(entry => entry.due.status === 'soon') ??
      null
    return { enriched, counts, priority }
  }, [garage])

  if (!garage || !view) return <SetupScreen onStart={start} />

  const { vehicle } = garage
  const { enriched, counts, priority } = view
  const visible = filter === 'all' ? enriched : enriched.filter(entry => entry.due.status === filter)

  function countFor(id: Filter) {
    if (!view) return 0
    return id === 'all' ? garage!.items.length : view.counts[id]
  }

  function handleItemSubmit(draft: ItemDraft) {
    if (dialog.kind === 'edit-item') updateItem(dialog.item.id, draft)
    else addItem(draft)
    setDialog({ kind: 'none' })
  }

  function handleServiceSubmit(draft: ServiceDraft) {
    if (dialog.kind === 'service') registerService(dialog.item.id, draft)
    setDialog({ kind: 'none' })
  }

  function handleDelete(item: MaintenanceItem) {
    if (window.confirm(`¿Eliminar "${item.name}" del plan de mantenimiento?`)) {
      removeItem(item.id)
    }
  }

  function handleReset() {
    if (window.confirm('¿Borrar todos los datos del garaje y empezar de nuevo?')) reset()
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="topbar__id">
          <p className="eyebrow">Garaje</p>
          <h1 className="title">{vehicle.name}</h1>
        </div>
        <button
          type="button"
          className="odo"
          onClick={() => setDialog({ kind: 'vehicle' })}
          title="Actualizar nombre y kilometraje"
        >
          <span className="odo__value">
            {formatKm(vehicle.currentKm)} <small>km</small>
          </span>
          <span className="odo__action">Actualizar kilometraje</span>
        </button>
      </header>

      <section className="stats" aria-label="Resumen del estado">
        {(['overdue', 'soon', 'ok'] as const).map(id => (
          <button
            key={id}
            type="button"
            className={`stat stat--${id}${filter === id ? ' is-active' : ''}`}
            onClick={() => setFilter(current => (current === id ? 'all' : id))}
            aria-pressed={filter === id}
          >
            <span className="stat__value">{counts[id]}</span>
            <span className="stat__label">
              {id === 'overdue' ? 'Vencidos' : id === 'soon' ? 'Próximos' : 'Al día'}
            </span>
          </button>
        ))}
      </section>

      {priority ? (
        <section className={`banner banner--${priority.due.status}`}>
          <div className="banner__body">
            <p className="banner__label">
              {priority.due.status === 'overdue' ? 'Necesita atención' : 'Próximo servicio'}
            </p>
            <h2 className="banner__title">{priority.item.name}</h2>
            <p className="banner__text">{remainingText(priority.due)}</p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setDialog({ kind: 'service', item: priority.item })}
          >
            Registrar
          </button>
        </section>
      ) : (
        garage.items.length > 0 && (
          <section className="banner banner--ok">
            <div className="banner__body">
              <p className="banner__label">Todo al día</p>
              <h2 className="banner__title">No hay servicios pendientes</h2>
              <p className="banner__text">
                Actualizá el kilometraje seguido para que los cálculos sigan siendo reales.
              </p>
            </div>
          </section>
        )
      )}

      <div className="toolbar">
        <div className="filters" role="group" aria-label="Filtrar servicios">
          {FILTERS.map(option => (
            <button
              key={option.id}
              type="button"
              className={`filter${filter === option.id ? ' is-active' : ''}`}
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
            >
              {option.label}
              <span className="filter__count">{countFor(option.id)}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setDialog({ kind: 'new-item' })}
        >
          + Añadir servicio
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="empty">
          {filter === 'all'
            ? 'Todavía no hay servicios. Agregá el primero con el botón de arriba.'
            : `No hay servicios en estado "${
                FILTERS.find(option => option.id === filter)?.label ?? ''
              }".`}
        </p>
      ) : (
        <section className="items" aria-label="Servicios de mantenimiento">
          {visible.map(entry => (
            <ItemCard
              key={entry.item.id}
              item={entry.item}
              currentKm={vehicle.currentKm}
              onRegister={item => setDialog({ kind: 'service', item })}
              onEdit={item => setDialog({ kind: 'edit-item', item })}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      <Guide />

      <footer className="footer">
        <p>Los datos se guardan solo en este navegador.</p>
        <button type="button" className="link" onClick={handleReset}>
          Reiniciar garaje
        </button>
      </footer>

      {dialog.kind === 'vehicle' && (
        <VehicleDialog
          vehicle={vehicle}
          onClose={() => setDialog({ kind: 'none' })}
          onSave={updateVehicle}
        />
      )}

      {dialog.kind === 'new-item' && (
        <ItemDialog
          key="new-item"
          defaultKm={vehicle.currentKm}
          onClose={() => setDialog({ kind: 'none' })}
          onSubmit={handleItemSubmit}
        />
      )}

      {dialog.kind === 'edit-item' && (
        <ItemDialog
          key={dialog.item.id}
          item={dialog.item}
          defaultKm={vehicle.currentKm}
          onClose={() => setDialog({ kind: 'none' })}
          onSubmit={handleItemSubmit}
        />
      )}

      {dialog.kind === 'service' && (
        <ServiceDialog
          key={dialog.item.id}
          item={dialog.item}
          currentKm={vehicle.currentKm}
          onClose={() => setDialog({ kind: 'none' })}
          onSubmit={handleServiceSubmit}
        />
      )}
    </main>
  )
}
