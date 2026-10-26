import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { todayISO } from './maintenance'
import {
  clearCachedGarage,
  loadCachedGarage,
  loadLegacyGarage,
  requestPersistentStorage,
  saveCachedGarage,
  saveLegacyGarage,
} from './storage'
import type {
  Garage,
  ItemDraft,
  MaintenanceItem,
  ServiceDraft,
  ServiceRecord,
  Vehicle,
} from './types'

export type SyncStatus = 'local' | 'loading' | 'saving' | 'synced' | 'error'

type GarageRow = {
  data: unknown
  updated_at: string
  client_id: string | null
}

const PRESETS: ReadonlyArray<
  Pick<MaintenanceItem, 'name' | 'category' | 'intervalKm' | 'intervalMonths' | 'note'>
> = [
  {
    name: 'Cambio de aceite y filtro',
    category: 'aceite',
    intervalKm: 5000,
    intervalMonths: 6,
    note: 'Con aceite sintético puede estirarse: revisá el manual.',
  },
  {
    name: 'Rotación de llantas',
    category: 'llantas',
    intervalKm: 10000,
    intervalMonths: 6,
    note: 'Alternar delanteras y traseras.',
  },
  {
    name: 'Revisión de frenos',
    category: 'frenos',
    intervalKm: 20000,
    intervalMonths: 12,
    note: 'Pastillas, discos y líquido de frenos.',
  },
  {
    name: 'Revisión general',
    category: 'revision',
    intervalKm: 10000,
    intervalMonths: 12,
    note: 'Niveles, luces, suspensión, correas y escape.',
  },
  {
    name: 'Filtro de aire del motor',
    category: 'motor',
    intervalKm: 15000,
    intervalMonths: 12,
    note: '',
  },
  {
    name: 'Líquido refrigerante',
    category: 'motor',
    intervalKm: 40000,
    intervalMonths: 24,
    note: 'Revisar nivel y estado siempre con el motor frío.',
  },
  {
    name: 'Batería',
    category: 'electrico',
    intervalKm: null,
    intervalMonths: 48,
    note: 'Vida típica de 3 a 5 años. Revisar terminales.',
  },
  {
    name: 'Cambio de llantas',
    category: 'llantas',
    intervalKm: 40000,
    intervalMonths: 48,
    note: 'O antes si el dibujo baja de 1,6 mm.',
  },
]

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isRecord(value: unknown): value is ServiceRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.date === 'string' &&
    typeof record.km === 'number' &&
    typeof record.note === 'string'
  )
}

function isItem(value: unknown): value is MaintenanceItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.category === 'string' &&
    (item.intervalKm === null || typeof item.intervalKm === 'number') &&
    (item.intervalMonths === null || typeof item.intervalMonths === 'number') &&
    (item.lastKm === null || typeof item.lastKm === 'number') &&
    (item.lastDate === null || typeof item.lastDate === 'string') &&
    typeof item.note === 'string' &&
    Array.isArray(item.history) &&
    item.history.every(isRecord)
  )
}

export function parseGarage(value: unknown): Garage | null {
  if (typeof value !== 'object' || value === null) return null
  const data = value as Record<string, unknown>
  if (data.version !== 1) return null
  const vehicle = data.vehicle as Record<string, unknown> | undefined
  if (
    !vehicle ||
    typeof vehicle.name !== 'string' ||
    typeof vehicle.currentKm !== 'number' ||
    !Array.isArray(data.items)
  ) {
    return null
  }
  return {
    version: 1,
    vehicle: { name: vehicle.name, currentKm: vehicle.currentKm },
    items: data.items.filter(isItem),
  }
}

function buildDefaultItems(km: number): MaintenanceItem[] {
  const today = todayISO()
  return PRESETS.map(preset => ({
    ...preset,
    id: newId(),
    lastKm: km,
    lastDate: today,
    history: [],
  }))
}

export function useGarage(userId: string | null) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [cacheReady, setCacheReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    supabase && userId ? 'loading' : 'local',
  )
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [remoteLoaded, setRemoteLoaded] = useState(!supabase || !userId)

  const lastSyncedJson = useRef<string | null>(null)
  const clientId = useRef(newId())
  const garageRef = useRef(garage)
  garageRef.current = garage
  const activeUserRef = useRef(userId)
  activeUserRef.current = userId
  const loadSeq = useRef(0)
  // Serializa las subidas: si dos cambios se solapan, el último llega último.
  const pushChain = useRef<Promise<boolean>>(Promise.resolve(true))

  // Carga inicial del caché: IndexedDB manda; localStorage se usa para migrar.
  useEffect(() => {
    let active = true
    void (async () => {
      const stored = parseGarage(await loadCachedGarage())
      if (!active) return

      if (stored) {
        setGarage(stored)
      } else {
        const legacy = parseGarage(loadLegacyGarage())
        if (legacy) {
          setGarage(legacy)
          void saveCachedGarage(legacy)
        }
      }
      setCacheReady(true)
      void requestPersistentStorage()
    })()
    return () => {
      active = false
    }
  }, [])

  // Caché local: siempre se escribe, incluso sin conexión.
  useEffect(() => {
    if (!cacheReady || !garage) return
    saveLegacyGarage(garage)
    void saveCachedGarage(garage)
  }, [garage, cacheReady])

  function pushNow(data: Garage): Promise<boolean> {
    if (!supabase || !userId || !remoteLoaded) return Promise.resolve(false)
    const client = supabase
    const uid = userId

    const run = async (): Promise<boolean> => {
      if (activeUserRef.current !== uid) return false
      const json = JSON.stringify(data)
      setSyncStatus('saving')
      const { error } = await client.from('garages').upsert({
        user_id: uid,
        data,
        client_id: clientId.current,
        updated_at: new Date().toISOString(),
      })
      if (activeUserRef.current !== uid) return false
      if (error) {
        setSyncStatus('error')
        setSyncError(error.message)
        return false
      }
      lastSyncedJson.current = json
      setSyncStatus('synced')
      setSyncError(null)
      setLastSyncedAt(new Date().toISOString())
      return true
    }

    const next = pushChain.current.then(run, run)
    pushChain.current = next
    return next
  }

  // Lee el garaje de la nube. Si la cuenta está vacía, sube el local.
  // Devuelve true si el estado remoto quedó disponible.
  async function loadRemote(): Promise<boolean> {
    if (!supabase || !userId) {
      setRemoteLoaded(true)
      setSyncStatus('local')
      return true
    }

    const uid = userId
    const seq = ++loadSeq.current
    setRemoteLoaded(false)
    setSyncStatus('loading')
    setSyncError(null)

    const { data, error } = await supabase
      .from('garages')
      .select('data, updated_at')
      .eq('user_id', uid)
      .maybeSingle()

    // Otra carga más nueva (o un cierre de sesión) invalida esta respuesta.
    if (seq !== loadSeq.current || activeUserRef.current !== uid) return false

    if (error) {
      setSyncStatus('error')
      setSyncError(error.message)
      return false
    }

    if (data) {
      const parsed = parseGarage((data as GarageRow).data)
      if (!parsed) {
        setSyncStatus('error')
        setSyncError('Los datos de la nube no tienen el formato esperado.')
        return false
      }
      lastSyncedJson.current = JSON.stringify(parsed)
      setGarage(parsed)
      setLastSyncedAt((data as GarageRow).updated_at)
      setSyncStatus('synced')
      setRemoteLoaded(true)
      return true
    }

    // La cuenta no tiene garaje todavía: subimos el de este dispositivo.
    const local = garageRef.current
    if (local) {
      const json = JSON.stringify(local)
      const { error: uploadError } = await supabase.from('garages').upsert({
        user_id: uid,
        data: local,
        client_id: clientId.current,
        updated_at: new Date().toISOString(),
      })
      if (seq !== loadSeq.current || activeUserRef.current !== uid) return false
      if (uploadError) {
        setSyncStatus('error')
        setSyncError(uploadError.message)
        // Sabemos que la cuenta estaba vacía: es seguro reintentar la subida.
        setRemoteLoaded(true)
        return false
      }
      lastSyncedJson.current = json
      setLastSyncedAt(new Date().toISOString())
    }

    setSyncStatus('synced')
    setRemoteLoaded(true)
    return true
  }

  // Carga inicial desde la nube (o subida del garaje local si la cuenta está vacía).
  useEffect(() => {
    if (!cacheReady) return
    if (!supabase || !userId) {
      setRemoteLoaded(true)
      setSyncStatus('local')
      return
    }
    void loadRemote()
    return () => {
      // Invalida respuestas en vuelo al desmontar o cambiar de cuenta.
      loadSeq.current += 1
    }
    // loadRemote usa el userId del render; el efecto se re-ejecuta al cambiar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cacheReady])

  // Subida con debounce cuando cambia el garaje.
  useEffect(() => {
    if (!garage || !supabase || !userId || !remoteLoaded) return
    if (JSON.stringify(garage) === lastSyncedJson.current) return
    const timer = window.setTimeout(() => {
      void pushNow(garage)
    }, 700)
    return () => window.clearTimeout(timer)
    // pushNow se recrea en cada render; el disparador real es el contenido del garaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garage, userId, remoteLoaded])

  // Reintento al recuperar conexión.
  useEffect(() => {
    if (!supabase || !userId) return
    function handleOnline() {
      // Si la lectura inicial falló, primero recuperamos la nube: nunca
      // pisamos datos remotos con una copia local sin haberlos leído.
      if (!remoteLoaded) {
        void loadRemote()
        return
      }
      const current = garageRef.current
      if (!current) return
      if (JSON.stringify(current) === lastSyncedJson.current) return
      void pushNow(current)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, remoteLoaded])

  // Cambios hechos en otro dispositivo.
  useEffect(() => {
    if (!supabase || !userId) return
    const channel = supabase
      .channel(`garage-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'garages', filter: `user_id=eq.${userId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            saveLegacyGarage(null)
            void clearCachedGarage()
            lastSyncedJson.current = null
            setGarage(null)
            setSyncStatus('synced')
            setSyncError(null)
            setRemoteLoaded(true)
            return
          }

          const row = payload.new as GarageRow
          if (row.client_id === clientId.current) {
            setRemoteLoaded(true)
            return
          }

          // Si hay cambios locales sin subir, no pisamos lo que estás editando.
          const current = garageRef.current
          if (current && JSON.stringify(current) !== lastSyncedJson.current) return

          const parsed = parseGarage(row.data)
          if (!parsed) return
          lastSyncedJson.current = JSON.stringify(parsed)
          setGarage(parsed)
          setLastSyncedAt(row.updated_at)
          setSyncStatus('synced')
          setSyncError(null)
          setRemoteLoaded(true)
        },
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [userId])

  function start(name: string, km: number) {
    setGarage({
      version: 1,
      vehicle: { name: name.trim() || 'Mi carro', currentKm: Math.max(0, Math.round(km)) },
      items: buildDefaultItems(Math.max(0, Math.round(km))),
    })
  }

  function updateVehicle(patch: Partial<Vehicle>) {
    setGarage(prev => {
      if (!prev) return prev
      const name = patch.name?.trim()
      return {
        ...prev,
        vehicle: {
          name: name || prev.vehicle.name,
          currentKm:
            patch.currentKm !== undefined
              ? Math.max(0, Math.round(patch.currentKm))
              : prev.vehicle.currentKm,
        },
      }
    })
  }

  function addItem(draft: ItemDraft) {
    setGarage(prev => {
      if (!prev) return prev
      const item: MaintenanceItem = { ...draft, id: newId(), history: [] }
      return { ...prev, items: [...prev.items, item] }
    })
  }

  function updateItem(id: string, draft: ItemDraft) {
    setGarage(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map(item => (item.id === id ? { ...item, ...draft } : item)),
      }
    })
  }

  function removeItem(id: string) {
    setGarage(prev => (prev ? { ...prev, items: prev.items.filter(item => item.id !== id) } : prev))
  }

  function registerService(id: string, draft: ServiceDraft) {
    setGarage(prev => {
      if (!prev) return prev
      const record: ServiceRecord = { ...draft, id: newId(), note: draft.note.trim() }
      const items = prev.items.map(item =>
        item.id === id
          ? {
              ...item,
              lastKm: record.km,
              lastDate: record.date,
              history: [record, ...item.history],
            }
          : item,
      )
      return {
        version: 1,
        vehicle: {
          ...prev.vehicle,
          currentKm: Math.max(prev.vehicle.currentKm, record.km),
        },
        items,
      }
    })
  }

  function clearLocalCache() {
    loadSeq.current += 1
    saveLegacyGarage(null)
    void clearCachedGarage()
    lastSyncedJson.current = null
    setGarage(null)
    setSyncStatus('local')
    setLastSyncedAt(null)
    setSyncError(null)
  }

  async function reset(): Promise<boolean> {
    if (supabase && userId) {
      const { error } = await supabase.from('garages').delete().eq('user_id', userId)
      if (error) {
        setSyncStatus('error')
        setSyncError(error.message)
        return false
      }
    }
    clearLocalCache()
    if (supabase && userId) setSyncStatus('synced')
    return true
  }

  async function syncNow(): Promise<boolean> {
    if (!supabase || !userId) return true
    // Si la lectura inicial había fallado, reintentar la lectura primero.
    if (!remoteLoaded) return loadRemote()
    const current = garageRef.current
    if (!current) return true
    return pushNow(current)
  }

  return {
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
  }
}
