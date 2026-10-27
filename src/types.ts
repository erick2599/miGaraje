export type Category =
  | 'aceite'
  | 'llantas'
  | 'frenos'
  | 'revision'
  | 'motor'
  | 'electrico'
  | 'otro'

export type DistanceUnit = 'km' | 'mi'

export type VehicleType = 'car' | 'motorcycle'

/**
 * Las distancias se guardan siempre en kilómetros (unidad canónica).
 * `distanceUnit` solo define cómo se muestran y se ingresan.
 */
export type ServiceRecord = {
  id: string
  date: string
  /** Kilómetros al momento del servicio. */
  km: number
  note: string
}

export type MaintenanceItem = {
  id: string
  name: string
  category: Category
  /** Intervalo en kilómetros. */
  intervalKm: number | null
  intervalMonths: number | null
  /** Odómetro (en kilómetros) del último servicio. */
  lastKm: number | null
  lastDate: string | null
  note: string
  history: ServiceRecord[]
}

export type Vehicle = {
  name: string
  /** Odómetro actual, siempre en kilómetros. */
  currentKm: number
  type: VehicleType
  distanceUnit: DistanceUnit
}

export type Garage = {
  version: 2
  vehicle: Vehicle
  items: MaintenanceItem[]
}

export type Status = 'overdue' | 'soon' | 'ok' | 'unset'

export type Filter = 'all' | Exclude<Status, 'unset'>

export type ItemDraft = {
  name: string
  category: Category
  /** Intervalo en kilómetros. */
  intervalKm: number | null
  intervalMonths: number | null
  /** Odómetro del último servicio, en kilómetros. */
  lastKm: number | null
  lastDate: string | null
  note: string
}

export type ServiceDraft = {
  date: string
  /** Odómetro del servicio, en kilómetros. */
  km: number
  note: string
}
