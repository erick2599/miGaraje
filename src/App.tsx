import { useMemo, useState } from 'react'
import { AccountDialog, SYNC_LABEL } from './components/AccountDialog'
import { Guide } from './components/Guide'
import { InstallCard } from './components/InstallCard'
import { ItemCard } from './components/ItemCard'
import { ItemDialog } from './components/ItemDialog'
import { ServiceDialog } from './components/ServiceDialog'
import { SetupScreen } from './components/SetupScreen'
import { VehicleDialog } from './components/VehicleDialog'
import { formatDistanceValue, getDue, remainingText, sortByUrgency } from './maintenance'
import { useAuth } from './useAuth'
import { useGarage } from './useGarage'
import type { Filter, ItemDraft, MaintenanceItem, ServiceDraft } from './types'

type DialogState =
  | { kind: 'none' }
  | { kind: 'vehicle'; id?: string }
  | { kind: 'add-vehicle' }
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
  const auth = useAuth()
  const {
    garage,
    start,
    updateVehicle,
    addVehicle,
    setActiveVehicle,
    addItem,
    updateItem,
    removeItem,
    registerService,
    updateHistoryRecord,
    removeHistoryRecord,
    importGarage,
    reset,
    clearLocalCache,
    syncNow,
    cacheReady,
    syncStatus,
    lastSyncedAt,
    syncError,
  } = useGarage(auth.userId)

  const [filter, setFilter] = useState<Filter>('all')
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const [accountOpen, setAccountOpen] = useState(false)

  const view = useMemo(() => {
    if (!garage) return null
    const vehicle = garage.vehicles.find(v => v.id === garage.activeVehicleId) ?? garage.vehicles[0]
    if (!vehicle) return null
    const items = garage.items.filter(i => i.vehicleId === vehicle.id)
    const unit = vehicle.distanceUnit
    const enriched = sortByUrgency(items, vehicle.currentKm, unit).map(item => ({
      item,
      due: getDue(item, vehicle.currentKm, unit),
    }))
    const counts = { overdue: 0, soon: 0, ok: 0 }
    for (const entry of enriched) {
      if (entry.due.status !== 'unset') counts[entry.due.status] += 1
    }
    const priority =
      enriched.find(entry => entry.due.status === 'overdue') ??
      enriched.find(entry => entry.due.status === 'soon') ??
      null
    return { vehicle, enriched, counts, priority }
  }, [garage])

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

  async function handleReset() {
    const message = auth.email
      ? '¿Borrar todos los datos del garaje? También se borra la copia en la nube.'
      : '¿Borrar todos los datos del garaje y empezar de nuevo?'
    if (!window.confirm(message)) return
    const ok = await reset()
    if (!ok) {
      window.alert(
        'No se pudo borrar el garaje de la nube. Revisá la conexión e intentá de nuevo.',
      )
      return
    }
    setAccountOpen(false)
  }

  async function handleSignOut() {
    if (
      !window.confirm(
        '¿Cerrar sesión? Se borra la copia local de este dispositivo; tus datos quedan en la nube.',
      )
    ) {
      return
    }
    try {
      await syncNow()
    } catch {}
    const result = await auth.signOut()
    if (result.error) {
      window.alert(result.error)
    }
    clearLocalCache()
    setAccountOpen(false)
    window.location.reload()
  }

  const accountLabel = !auth.configured
    ? 'Solo local'
    : auth.loading
      ? 'Cuenta'
      : !auth.email
        ? 'Iniciar sesión'
        : SYNC_LABEL[syncStatus]

  const accountDot = auth.configured && auth.email ? syncStatus : 'local'

  const accountButton = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button
        type="button"
        className="account"
        onClick={() => setAccountOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Cuenta y sincronización — ${accountLabel}`}
      >
        <span className={`account__dot account__dot--${accountDot}`} aria-hidden="true" />
        <span className="account__label">{accountLabel}</span>
      </button>
      {auth.configured && auth.email && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => void handleSignOut()}
          title="Cerrar sesión"
        >
          Cerrar sesión
        </button>
      )}
    </div>
  )

  const accountDialog = accountOpen ? (
    <AccountDialog
      configured={auth.configured}
      email={auth.email}
      syncStatus={syncStatus}
      lastSyncedAt={lastSyncedAt}
      syncError={syncError}
      onClose={() => setAccountOpen(false)}
      onSignIn={email => auth.signIn(email)}
      onVerifyCode={(email, code) => auth.verifyCode(email, code)}
      onSignOut={handleSignOut}
      onSyncNow={() => {
        void syncNow()
      }}
    />
  ) : null

  // Si hay sesión pero todavía no llegó la nube, esperamos antes de mostrar el
  // onboarding: evita el parpadeo de "empezar de cero" y ediciones pisadas.
  const waitingForAccount =
    auth.configured && (auth.loading || (!!auth.email && !garage && syncStatus === 'loading'))

  if (!cacheReady || waitingForAccount) {
    return (
      <div className="boot" role="status" aria-live="polite">
        <span className="boot__spinner" aria-hidden="true" />
        <span>{waitingForAccount ? 'Conectando con tu cuenta…' : 'Cargando tu garaje…'}</span>
      </div>
    )
  }

  if (!garage || !view) {
    return (
      <>
        <div className="setup-account">{accountButton}</div>
        <SetupScreen onStart={start} />
        {accountDialog}
      </>
    )
  }

  const { vehicle, counts, priority } = view
  const visible = filter === 'all' ? view.enriched : view.enriched.filter(entry => entry.due.status === filter)
  const totalItems = view.enriched.length

  function countFor(id: Filter) {
    return id === 'all' ? totalItems : counts[id]
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="topbar__id">
          <p className="eyebrow">Garaje</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {garage.vehicles.length > 1 ? (
              <select
                className="input"
                value={vehicle.id}
                onChange={e => setActiveVehicle(e.target.value)}
                aria-label="Seleccionar vehículo"
                style={{ minWidth: '160px' }}
              >
                {garage.vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="title">{vehicle.name}</h1>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setDialog({ kind: 'add-vehicle' })}
            >
              + Añadir vehículo
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setDialog({ kind: 'vehicle', id: vehicle.id })}
            >
              Editar
            </button>
          </div>
        </div>
        <div className="topbar__actions">
          {accountButton}
          <button
            type="button"
            className="odo"
            onClick={() => setDialog({ kind: 'vehicle', id: vehicle.id })}
            title="Actualizar nombre, tipo, unidad y odómetro"
          >
            <span className="odo__value">
              {formatDistanceValue(vehicle.currentKm, vehicle.distanceUnit)}{' '}
              <small>{vehicle.distanceUnit}</small>
            </span>
            <span className="odo__action">Actualizar odómetro</span>
          </button>
        </div>
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
            <p className="banner__text">
              {remainingText(priority.due, vehicle.distanceUnit)}
            </p>
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
                Actualizá el odómetro seguido para que los cálculos sigan siendo reales.
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

      <InstallCard />

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
              unit={vehicle.distanceUnit}
              onRegister={item => setDialog({ kind: 'service', item })}
              onEdit={item => setDialog({ kind: 'edit-item', item })}
              onDelete={handleDelete}
              onEditHistory={(itemId, recordId, patch) => updateHistoryRecord(itemId, recordId, patch)}
              onDeleteHistory={(itemId, recordId) => removeHistoryRecord(itemId, recordId)}
            />
          ))}
        </section>
      )}

      <Guide vehicleType={vehicle.type} distanceUnit={vehicle.distanceUnit} />

      <footer className="footer">
        <p>
          Los datos se guardan en este dispositivo y se sincronizan si tenés cuenta. ·{' '}
          <a className="link" href="/privacidad.html">
            Privacidad
          </a>
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="link"
            onClick={() => {
              if (!garage) return
              const blob = new Blob([JSON.stringify(garage, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `garaje-backup-${new Date().toISOString().slice(0, 10)}.json`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}
          >
            Descargar copia JSON
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'application/json'
              input.onchange = async e => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const data = JSON.parse(text)
                  const ok = importGarage(data)
                  if (!ok) window.alert('No se pudo importar el archivo.')
                  else window.alert('Datos importados correctamente.')
                } catch {
                  window.alert('Archivo inválido.')
                }
              }
              input.click()
            }}
          >
            Importar datos
          </button>
          <button type="button" className="link" onClick={() => void handleReset()}>
            Reiniciar garaje
          </button>
        </div>
      </footer>

      {(dialog.kind === 'vehicle' || dialog.kind === 'add-vehicle') && (
        <VehicleDialog
          vehicle={dialog.kind === 'add-vehicle' ? undefined : (garage.vehicles.find(v => v.id === dialog.id) ?? vehicle)}
          mode={dialog.kind === 'add-vehicle' ? 'add' : 'edit'}
          onClose={() => setDialog({ kind: 'none' })}
          onSave={(patch, mode) => {
            if (mode === 'add') {
              addVehicle(
                patch.name ?? '',
                patch.currentKm ?? 0,
                patch.type ?? 'car',
                patch.distanceUnit ?? 'km',
              )
            } else {
              updateVehicle(patch)
            }
          }}
        />
      )}

      {dialog.kind === 'new-item' && (
        <ItemDialog
          key="new-item"
          defaultKm={vehicle.currentKm}
          unit={vehicle.distanceUnit}
          onClose={() => setDialog({ kind: 'none' })}
          onSubmit={handleItemSubmit}
        />
      )}

      {dialog.kind === 'edit-item' && (
        <ItemDialog
          key={dialog.item.id}
          item={dialog.item}
          defaultKm={vehicle.currentKm}
          unit={vehicle.distanceUnit}
          onClose={() => setDialog({ kind: 'none' })}
          onSubmit={handleItemSubmit}
        />
      )}

      {dialog.kind === 'service' && (
        <ServiceDialog
          key={dialog.item.id}
          item={dialog.item}
          currentKm={vehicle.currentKm}
          unit={vehicle.distanceUnit}
          onClose={() => setDialog({ kind: 'none' })}
          onSubmit={handleServiceSubmit}
        />
      )}

      {accountDialog}
    </main>
  )
}
