export type Category =
  | 'aceite'
  | 'llantas'
  | 'frenos'
  | 'revision'
  | 'motor'
  | 'electrico'
  | 'otro'

export type ServiceRecord = {
  id: string
  date: string
  km: number
  note: string
}

export type MaintenanceItem = {
  id: string
  name: string
  category: Category
  intervalKm: number | null
  intervalMonths: number | null
  lastKm: number | null
  lastDate: string | null
  note: string
  history: ServiceRecord[]
}

export type Vehicle = {
  name: string
  currentKm: number
}

export type Garage = {
  version: 1
  vehicle: Vehicle
  items: MaintenanceItem[]
}

export type Status = 'overdue' | 'soon' | 'ok' | 'unset'

export type Filter = 'all' | Exclude<Status, 'unset'>

export type ItemDraft = {
  name: string
  category: Category
  intervalKm: number | null
  intervalMonths: number | null
  lastKm: number | null
  lastDate: string | null
  note: string
}

export type ServiceDraft = {
  date: string
  km: number
  note: string
}
