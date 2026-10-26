import { useMemo, useState } from 'react'
import { AccountDialog, SYNC_LABEL } from './components/AccountDialog'
import { Guide } from './components/Guide'
import { InstallCard } from './components/InstallCard'
import { ItemCard } from './components/ItemCard'
import { ItemDialog } from './components/ItemDialog'
import { ServiceDialog } from './components/ServiceDialog'
import { SetupScreen } from './components/SetupScreen'
import { VehicleDialog } from './components/VehicleDialog'
import { formatKm, getDue, remainingText, sortByUrgency } from './maintenance'
import { useAuth } from './useAuth'
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
  const auth = useAuth()
  const {
    garage,
    start,
    updateVehicle,
    addItem,
    updateItem,
    removeItem,
    registerService,
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
    const saved = await syncNow()
    if (
      !saved &&
      !window.confirm(
        'No se pudo sincronizar. Si cerrás sesión ahora, los cambios de este dispositivo que no llegaron a la nube se pierden. ¿Cerrar sesión igual?',
      )
    ) {
      return
    }
    const result = await auth.signOut()
    if (result.error) {
      window.alert(result.error)
      return
    }
    clearLocalCache()
    setAccountOpen(false)
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

  const { vehicle } = garage
  const { counts, priority } = view
  const visible = filter === 'all' ? view.enriched : view.enriched.filter(entry => entry.due.status === filter)
  const totalItems = garage.items.length

  function countFor(id: Filter) {
    return id === 'all' ? totalItems : counts[id]
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="topbar__id">
          <p className="eyebrow">Garaje</p>
          <h1 className="title">{vehicle.name}</h1>
        </div>
        <div className="topbar__actions">
          {accountButton}
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
              onRegister={item => setDialog({ kind: 'service', item })}
              onEdit={item => setDialog({ kind: 'edit-item', item })}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      <Guide />

      <footer className="footer">
        <p>
          Los datos se guardan en este dispositivo y se sincronizan si tenés cuenta. ·{' '}
          <a className="link" href="/privacidad.html">
            Privacidad
          </a>
        </p>
        <button type="button" className="link" onClick={() => void handleReset()}>
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

      {accountDialog}
    </main>
  )
}
