import { useEffect, useState } from 'react'
import { todayISO } from './maintenance'
import type {
  Garage,
  ItemDraft,
  MaintenanceItem,
  ServiceDraft,
  ServiceRecord,
  Vehicle,
} from './types'

const STORAGE_KEY = 'garaje.v1'

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

function loadGarage(): Garage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const data = parsed as Record<string, unknown>
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
  } catch {
    return null
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

export function useGarage() {
  const [garage, setGarage] = useState<Garage | null>(loadGarage)

  useEffect(() => {
    if (!garage) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(garage))
    } catch {
      // Sin espacio o almacenamiento bloqueado: la app sigue funcionando en memoria.
    }
  }, [garage])

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
      const item: MaintenanceItem = {
        ...draft,
        id: newId(),
        history: [],
      }
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

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignorar.
    }
    setGarage(null)
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
  }
}
