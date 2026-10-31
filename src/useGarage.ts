import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { fromDisplayDistance, milesToKm, todayISO } from './maintenance'
import {
  clearCachedGarage,
  loadCachedGarage,
  loadLegacyGarage,
  requestPersistentStorage,
  saveCachedGarage,
  saveLegacyGarage,
} from './storage'
import type {
  DistanceUnit,
  Garage,
  ItemDraft,
  MaintenanceItem,
  ServiceDraft,
  ServiceRecord,
  Vehicle,
  VehicleType,
} from './types'

export type SyncStatus = 'local' | 'loading' | 'saving' | 'synced' | 'error'

type GarageRow = {
  data: unknown
  updated_at: string
  client_id: string | null
}

function syncErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : null
  return message
    ? `No se pudo conectar con Supabase: ${message}. Revisá la conexión e intentá de nuevo.`
    : 'No se pudo conectar con Supabase. Revisá la conexión e intentá de nuevo.'
}

function garageFormatSummary(value: unknown): string {
  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return 'La nube devolvió un valor que no es JSON.'
    }
  }
  if (typeof candidate !== 'object' || candidate === null) {
    return 'La nube no devolvió un objeto de garaje.'
  }

  const data = candidate as Record<string, unknown>
  const version =
    typeof data.version === 'string' || typeof data.version === 'number'
      ? String(data.version)
      : 'sin versión'
  const keys = Object.keys(data).slice(0, 12).join(', ') || 'sin campos'
  return `Formato remoto: versión ${version}; campos: ${keys}.`
}

type Preset = Pick<
  MaintenanceItem,
  'name' | 'category' | 'intervalKm' | 'intervalMonths' | 'note'
>

const CAR_KM: ReadonlyArray<Preset> = [
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

const CAR_MI: ReadonlyArray<Preset> = [
  {
    name: 'Cambio de aceite y filtro',
    category: 'aceite',
    intervalKm: milesToKm(5000),
    intervalMonths: 6,
    note: 'Con aceite sintético puede estirarse: revisá el manual.',
  },
  {
    name: 'Rotación de llantas',
    category: 'llantas',
    intervalKm: milesToKm(7500),
    intervalMonths: 6,
    note: 'Alternar delanteras y traseras.',
  },
  {
    name: 'Revisión de frenos',
    category: 'frenos',
    intervalKm: milesToKm(20000),
    intervalMonths: 12,
    note: 'Pastillas, discos y líquido de frenos.',
  },
  {
    name: 'Revisión general',
    category: 'revision',
    intervalKm: milesToKm(10000),
    intervalMonths: 12,
    note: 'Niveles, luces, suspensión, correas y escape.',
  },
  {
    name: 'Filtro de aire del motor',
    category: 'motor',
    intervalKm: milesToKm(15000),
    intervalMonths: 12,
    note: '',
  },
  {
    name: 'Líquido refrigerante',
    category: 'motor',
    intervalKm: milesToKm(30000),
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
    intervalKm: milesToKm(40000),
    intervalMonths: 48,
    note: 'O antes si el dibujo baja de 1,6 mm.',
  },
]

const MOTORCYCLE_KM: ReadonlyArray<Preset> = [
  {
    name: 'Cambio de aceite y filtro',
    category: 'aceite',
    intervalKm: 4000,
    intervalMonths: 6,
    note: 'Con aceite sintético puede estirarse: revisá el manual. Controlá el nivel seguido.',
  },
  {
    name: 'Lubricación y tensión de cadena',
    category: 'motor',
    intervalKm: 800,
    intervalMonths: 1,
    note: 'Limpiá, lubricá y revisá la tensión. Si es scooter con correa, revisá la correa y los rodillos.',
  },
  {
    name: 'Revisión de frenos',
    category: 'frenos',
    intervalKm: 10000,
    intervalMonths: 12,
    note: 'Pastillas, discos y líquido de frenos. Revisá también el freno trasero.',
  },
  {
    name: 'Revisión de llantas',
    category: 'llantas',
    intervalKm: 5000,
    intervalMonths: 12,
    note: 'Presión en frío cada 2 semanas; dibujo, grietas y desgaste irregular.',
  },
  {
    name: 'Filtro de aire',
    category: 'motor',
    intervalKm: 12000,
    intervalMonths: 12,
    note: 'Más seguido si andás por tierra.',
  },
  {
    name: 'Bujías',
    category: 'motor',
    intervalKm: 12000,
    intervalMonths: 24,
    note: 'Revisá el color y la separación; cambiá según el manual.',
  },
  {
    name: 'Líquido refrigerante',
    category: 'motor',
    intervalKm: 24000,
    intervalMonths: 24,
    note: 'Solo si es refrigerada por líquido. Revisá con el motor frío.',
  },
  {
    name: 'Cambio de llantas',
    category: 'llantas',
    intervalKm: 15000,
    intervalMonths: 48,
    note: 'O antes si el dibujo llega al mínimo o aparecen grietas.',
  },
  {
    name: 'Revisión general',
    category: 'revision',
    intervalKm: 10000,
    intervalMonths: 12,
    note: 'Niveles, luces, cables, suspensión, dirección, cadena y frenos.',
  },
]

const MOTORCYCLE_MI: ReadonlyArray<Preset> = [
  {
    name: 'Cambio de aceite y filtro',
    category: 'aceite',
    intervalKm: milesToKm(2500),
    intervalMonths: 6,
    note: 'Con aceite sintético puede estirarse: revisá el manual. Controlá el nivel seguido.',
  },
  {
    name: 'Lubricación y tensión de cadena',
    category: 'motor',
    intervalKm: milesToKm(500),
    intervalMonths: 1,
    note: 'Limpiá, lubricá y revisá la tensión. Si es scooter con correa, revisá la correa y los rodillos.',
  },
  {
    name: 'Revisión de frenos',
    category: 'frenos',
    intervalKm: milesToKm(6000),
    intervalMonths: 12,
    note: 'Pastillas, discos y líquido de frenos. Revisá también el freno trasero.',
  },
  {
    name: 'Revisión de llantas',
    category: 'llantas',
    intervalKm: milesToKm(3000),
    intervalMonths: 12,
    note: 'Presión en frío cada 2 semanas; dibujo, grietas y desgaste irregular.',
  },
  {
    name: 'Filtro de aire',
    category: 'motor',
    intervalKm: milesToKm(7500),
    intervalMonths: 12,
    note: 'Más seguido si andás por tierra.',
  },
  {
    name: 'Bujías',
    category: 'motor',
    intervalKm: milesToKm(7500),
    intervalMonths: 24,
    note: 'Revisá el color y la separación; cambiá según el manual.',
  },
  {
    name: 'Líquido refrigerante',
    category: 'motor',
    intervalKm: milesToKm(15000),
    intervalMonths: 24,
    note: 'Solo si es refrigerada por líquido. Revisá con el motor frío.',
  },
  {
    name: 'Cambio de llantas',
    category: 'llantas',
    intervalKm: milesToKm(8000),
    intervalMonths: 48,
    note: 'O antes si el dibujo llega al mínimo o aparecen grietas.',
  },
  {
    name: 'Revisión general',
    category: 'revision',
    intervalKm: milesToKm(6000),
    intervalMonths: 12,
    note: 'Niveles, luces, cables, suspensión, dirección, cadena y frenos.',
  },
]

const PRESETS: Record<VehicleType, Record<DistanceUnit, ReadonlyArray<Preset>>> = {
  car: { km: CAR_KM, mi: CAR_MI },
  motorcycle: { km: MOTORCYCLE_KM, mi: MOTORCYCLE_MI },
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseServiceRecord(value: unknown): ServiceRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.date !== 'string' ||
    typeof record.km !== 'number' ||
    typeof record.note !== 'string'
  ) {
    return null
  }

  const partsCost = record.partsCost ?? record.coste_refaccion
  const laborCost = record.laborCost ?? record.costo_mano_obra
  const totalCost = record.totalCost
  const isValidCost = (cost: unknown) =>
    cost === undefined ||
    cost === null ||
    (typeof cost === 'string' && cost.trim() === '') ||
    (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) ||
    (typeof cost === 'string' && Number.isFinite(Number(cost)) && Number(cost) >= 0)
  if (
    !isValidCost(partsCost) ||
    !isValidCost(laborCost) ||
    !isValidCost(totalCost)
  ) {
    return null
  }

  const normalizeCost = (cost: unknown) => {
    if (cost === undefined || cost === null || (typeof cost === 'string' && cost.trim() === '')) {
      return undefined
    }
    const parsed = typeof cost === 'number' ? cost : Number(cost)
    return Math.round(parsed * 100) / 100
  }

  return {
    id: record.id,
    date: record.date,
    km: record.km,
    note: record.note,
    partsCost: normalizeCost(partsCost),
    laborCost: normalizeCost(laborCost),
    totalCost: normalizeCost(totalCost),
  }
}

function normalizeVehicle(value: unknown, fallbackId: string): Vehicle | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const type: VehicleType = raw.type === 'motorcycle' ? 'motorcycle' : 'car'
  const currentKm = Number(raw.currentKm)
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : fallbackId,
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name
        : type === 'motorcycle'
          ? 'Mi moto'
          : 'Mi carro',
    currentKm: Number.isFinite(currentKm) ? Math.max(0, Math.round(currentKm)) : 0,
    type,
    distanceUnit: raw.distanceUnit === 'mi' ? 'mi' : 'km',
  }
}

function normalizeItems(rawItems: unknown[], vehicleIds: Set<string>, fallbackVehicleId: string) {
  return rawItems
    .map(item => {
      if (typeof item !== 'object' || item === null) return null
      const base = item as Record<string, unknown>
      if (typeof base.id !== 'string' || typeof base.name !== 'string' || typeof base.category !== 'string') {
        return null
      }

      const vehicleId =
        typeof base.vehicleId === 'string' && vehicleIds.has(base.vehicleId)
          ? base.vehicleId
          : fallbackVehicleId
      const history = Array.isArray(base.history)
        ? base.history
            .map(parseServiceRecord)
            .filter((record): record is ServiceRecord => record !== null)
        : []
      return {
        id: base.id,
        vehicleId,
        name: base.name,
        category: base.category as MaintenanceItem['category'],
        intervalKm:
          typeof base.intervalKm === 'number' || base.intervalKm === null
            ? base.intervalKm
            : null,
        intervalMonths:
          typeof base.intervalMonths === 'number' || base.intervalMonths === null
            ? base.intervalMonths
            : null,
        lastKm: typeof base.lastKm === 'number' || base.lastKm === null ? base.lastKm : null,
        lastDate:
          typeof base.lastDate === 'string' || base.lastDate === null ? base.lastDate : null,
        note: typeof base.note === 'string' ? base.note : '',
        history,
      } satisfies MaintenanceItem
    })
    .filter((item): item is MaintenanceItem => item !== null)
}

export function parseGarage(value: unknown): Garage | null {
  if (typeof value === 'string') {
    try {
      return parseGarage(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const data = value as Record<string, unknown>
  if (
    !Array.isArray(data.vehicles) &&
    !Array.isArray(data.items) &&
    typeof data.garage === 'object' &&
    data.garage !== null
  ) {
    return parseGarage(data.garage)
  }

  const rawItems = Array.isArray(data.items) ? data.items : []
  const vehicles = Array.isArray(data.vehicles)
    ? data.vehicles
        .map((vehicle, index) => normalizeVehicle(vehicle, `vehicle-${index + 1}`))
        .filter((vehicle): vehicle is Vehicle => vehicle !== null)
    : []
  if (vehicles.length > 0) {
    const activeVehicleId =
      typeof data.activeVehicleId === 'string' && vehicles.some(v => v.id === data.activeVehicleId)
        ? data.activeVehicleId
        : vehicles[0].id
    const items = normalizeItems(rawItems, new Set(vehicles.map(vehicle => vehicle.id)), activeVehicleId)
    return {
      version: 3,
      vehicles,
      activeVehicleId,
      items,
    }
  }

  // Acepta el formato de un solo vehículo aunque use una versión futura.
  const legacyVehicle = normalizeVehicle(data.vehicle, 'vehicle-1')
  if (legacyVehicle && Array.isArray(data.items)) {
    const items = normalizeItems(rawItems, new Set([legacyVehicle.id]), legacyVehicle.id)
    return {
      version: 3,
      vehicles: [legacyVehicle],
      activeVehicleId: legacyVehicle.id,
      items,
    }
  }

  if (typeof data.data === 'object' && data.data !== null) {
    return parseGarage(data.data)
  }

  /*
   * Legacy shape is also normalized above; unsupported payloads are left
   * untouched in the cloud so local edits cannot overwrite them automatically.
   */
  return null
}

function buildDefaultItems(vehicleId: string, km: number, type: VehicleType, unit: DistanceUnit): MaintenanceItem[] {
  const today = todayISO()
  return PRESETS[type][unit].map(preset => ({
    ...preset,
    id: newId(),
    vehicleId,
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
      let error: { message: string } | null
      try {
        const result = await client.from('garages').upsert({
          user_id: uid,
          data,
          client_id: clientId.current,
          updated_at: new Date().toISOString(),
        })
        error = result.error
      } catch (caught) {
        if (activeUserRef.current === uid) {
          setSyncStatus('error')
          setSyncError(syncErrorMessage(caught))
        }
        return false
      }
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

    let data: { data: unknown; updated_at: string } | null
    let error: { message: string } | null
    try {
      const result = await supabase
        .from('garages')
        .select('data, updated_at')
        .eq('user_id', uid)
        .maybeSingle()
      data = result.data
      error = result.error
    } catch (caught) {
      if (seq === loadSeq.current && activeUserRef.current === uid) {
        setSyncStatus('error')
        setSyncError(syncErrorMessage(caught))
      }
      return false
    }

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
        setSyncError(
          `${garageFormatSummary((data as GarageRow).data)} La copia local de este teléfono se conserva y no se sobrescribirá automáticamente.`,
        )
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
      let uploadError: { message: string } | null
      try {
        const result = await supabase.from('garages').upsert({
          user_id: uid,
          data: local,
          client_id: clientId.current,
          updated_at: new Date().toISOString(),
        })
        uploadError = result.error
      } catch (caught) {
        if (seq === loadSeq.current && activeUserRef.current === uid) {
          setSyncStatus('error')
          setSyncError(syncErrorMessage(caught))
          setRemoteLoaded(true)
        }
        return false
      }
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
          if (!parsed) {
            setSyncStatus('error')
            setSyncError(
              `${garageFormatSummary(row.data)} La copia local se conserva.`,
            )
            return
          }
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

  function start(name: string, distance: number, type: VehicleType, unit: DistanceUnit) {
    const currentKm = Math.max(0, Math.round(fromDisplayDistance(distance, unit)))
    const vehicleId = newId()
    setGarage({
      version: 3,
      vehicles: [
        {
          id: vehicleId,
          name: name.trim() || (type === 'motorcycle' ? 'Mi moto' : 'Mi carro'),
          currentKm,
          type,
          distanceUnit: unit,
        },
      ],
      activeVehicleId: vehicleId,
      items: buildDefaultItems(vehicleId, currentKm, type, unit),
    })
  }

  function updateVehicle(patch: Partial<Vehicle> & { id?: string }) {
    setGarage(prev => {
      if (!prev) return prev
      const id = patch.id ?? prev.activeVehicleId
      return {
        ...prev,
        vehicles: prev.vehicles.map(v => {
          if (v.id !== id) return v
          const name = patch.name?.trim()
          return {
            ...v,
            name: name || v.name,
            currentKm:
              patch.currentKm !== undefined
                ? Math.max(0, Math.round(patch.currentKm))
                : v.currentKm,
            type: patch.type ?? v.type,
            distanceUnit: patch.distanceUnit ?? v.distanceUnit,
          }
        }),
      }
    })
  }

  function addVehicle(name: string, distance: number, type: VehicleType, unit: DistanceUnit) {
    const currentKm = Math.max(0, Math.round(fromDisplayDistance(distance, unit)))
    const vehicleId = newId()
    const vehicle: Vehicle = {
      id: vehicleId,
      name: name.trim() || (type === 'motorcycle' ? 'Mi moto' : 'Mi carro'),
      currentKm,
      type,
      distanceUnit: unit,
    }
    setGarage(prev => {
      if (!prev) return prev
      return {
        ...prev,
        vehicles: [...prev.vehicles, vehicle],
        activeVehicleId: vehicleId,
        items: [...prev.items, ...buildDefaultItems(vehicleId, currentKm, type, unit)],
      }
    })
  }

  function setActiveVehicle(id: string) {
    setGarage(prev => {
      if (!prev) return prev
      if (!prev.vehicles.some(v => v.id === id)) return prev
      return { ...prev, activeVehicleId: id }
    })
  }

  function addItem(draft: ItemDraft) {
    setGarage(prev => {
      if (!prev) return prev
      const item: MaintenanceItem = { ...draft, id: newId(), vehicleId: prev.activeVehicleId, history: [] }
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
      const item = prev.items.find(i => i.id === id)
      const vehicleId = item?.vehicleId ?? prev.activeVehicleId
      const record: ServiceRecord = {
        id: newId(),
        date: draft.date,
        km: draft.km,
        note: draft.note.trim(),
        partsCost: draft.partsCost,
        laborCost: draft.laborCost,
        totalCost: draft.totalCost,
      }
      const items = prev.items.map(i =>
        i.id === id
          ? {
              ...i,
              lastKm: record.km,
              lastDate: record.date,
              history: [record, ...i.history],
            }
          : i,
      )
      const vehicles = prev.vehicles.map(v =>
        v.id === vehicleId ? { ...v, currentKm: Math.max(v.currentKm, record.km) } : v,
      )
      return {
        ...prev,
        vehicles,
        items,
      }
    })
  }

  function updateHistoryRecord(itemId: string, recordId: string, patch: Partial<ServiceRecord>) {
    setGarage(prev => {
      if (!prev) return prev
      const items = prev.items.map(item => {
        if (item.id !== itemId) return item
        const history = item.history.map(record => {
          if (record.id !== recordId) return record
          const updated = { ...record, ...patch }
          const parts = updated.partsCost ?? 0
          const labor = updated.laborCost ?? 0
          if (updated.partsCost !== undefined || updated.laborCost !== undefined) {
            updated.totalCost = parts + labor
          }
          return updated
        })
        const latest = history[0]
        return {
          ...item,
          lastKm: latest?.km ?? item.lastKm,
          lastDate: latest?.date ?? item.lastDate,
          history,
        }
      })
      return { ...prev, items }
    })
  }

  function removeHistoryRecord(itemId: string, recordId: string) {
    setGarage(prev => {
      if (!prev) return prev
      const items = prev.items.map(item => {
        if (item.id !== itemId) return item
        const history = item.history.filter(record => record.id !== recordId)
        const latest = history[0]
        return {
          ...item,
          lastKm: latest?.km ?? null,
          lastDate: latest?.date ?? null,
          history,
        }
      })
      return { ...prev, items }
    })
  }

  function importGarage(data: unknown): boolean {
    const parsed = parseGarage(data)
    if (!parsed) return false
    // Asegurar que todos los items tengan vehicleId asignado al vehículo activo
    const vehicleId = parsed.activeVehicleId
    const fixed = {
      ...parsed,
      items: parsed.items.map(item => ({
        ...item,
        vehicleId: item.vehicleId || vehicleId,
      })),
    }
    lastSyncedJson.current = JSON.stringify(fixed)
    setGarage(fixed)
    setSyncStatus(supabase && userId ? 'saving' : 'local')
    setSyncError(null)
    if (supabase && userId) {
      void pushNow(fixed)
    }
    return true
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

  function forceSyncFromLocal() {
    const current = garageRef.current
    if (!current) return
    lastSyncedJson.current = JSON.stringify(current)
    setSyncStatus('saving')
    setSyncError(null)
    void pushNow(current)
  }

  void forceSyncFromLocal

  async function reset(): Promise<boolean> {
    if (supabase && userId) {
      let error: { message: string } | null
      try {
        const result = await supabase.from('garages').delete().eq('user_id', userId)
        error = result.error
      } catch (caught) {
        setSyncStatus('error')
        setSyncError(syncErrorMessage(caught))
        return false
      }
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
    forceSyncFromLocal,
    syncNow,
    cacheReady,
    syncStatus,
    lastSyncedAt,
    syncError,
  }
}
