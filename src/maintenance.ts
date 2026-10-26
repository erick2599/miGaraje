import type { Category, MaintenanceItem, Status } from './types'

const DAY = 86_400_000

export function todayISO(): string {
  return toISO(new Date())
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parsea YYYY-MM-DD como fecha local a mediodía, para evitar saltos por zona horaria. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12)
}

export function addMonths(iso: string, months: number): string {
  const date = parseISO(iso)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return toISO(date)
}

export function daysBetween(fromISO: string, toISOValue: string): number {
  return Math.round((parseISO(toISOValue).getTime() - parseISO(fromISO).getTime()) / DAY)
}

export function formatKm(km: number): string {
  return new Intl.NumberFormat('es').format(Math.round(km))
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = parseISO(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export type DueInfo = {
  status: Status
  dueKm: number | null
  kmLeft: number | null
  dueDate: string | null
  daysLeft: number | null
  /** 0 a 1: porción del intervalo ya consumida. */
  progress: number
}

export function getDue(item: MaintenanceItem, currentKm: number): DueInfo {
  const dueKm =
    item.intervalKm !== null && item.lastKm !== null ? item.lastKm + item.intervalKm : null
  const kmLeft = dueKm !== null ? dueKm - currentKm : null

  const dueDate =
    item.intervalMonths !== null && item.lastDate !== null
      ? addMonths(item.lastDate, item.intervalMonths)
      : null
  const daysLeft = dueDate !== null ? daysBetween(todayISO(), dueDate) : null

  if (kmLeft === null && daysLeft === null) {
    return { status: 'unset', dueKm, kmLeft, dueDate, daysLeft, progress: 0 }
  }

  const overdue = (kmLeft !== null && kmLeft < 0) || (daysLeft !== null && daysLeft < 0)
  const soonKm = item.intervalKm !== null ? Math.max(300, item.intervalKm * 0.1) : 0
  const soon = (kmLeft !== null && kmLeft <= soonKm) || (daysLeft !== null && daysLeft <= 30)

  const ratios: number[] = []
  if (item.intervalKm && item.lastKm !== null) {
    ratios.push((currentKm - item.lastKm) / item.intervalKm)
  }
  if (item.intervalMonths && item.lastDate) {
    ratios.push(daysBetween(item.lastDate, todayISO()) / (item.intervalMonths * 30.44))
  }
  const progress = Math.min(1, Math.max(0, ratios.length ? Math.max(...ratios) : 0))

  return {
    status: overdue ? 'overdue' : soon ? 'soon' : 'ok',
    dueKm,
    kmLeft,
    dueDate,
    daysLeft,
    progress,
  }
}

export const STATUS_ORDER: Record<Status, number> = {
  overdue: 0,
  soon: 1,
  ok: 2,
  unset: 3,
}

export const STATUS_LABEL: Record<Status, string> = {
  overdue: 'Vencido',
  soon: 'Próximo',
  ok: 'Al día',
  unset: 'Sin datos',
}

export function sortByUrgency(
  items: MaintenanceItem[],
  currentKm: number,
): MaintenanceItem[] {
  return [...items].sort((a, b) => {
    const dueA = getDue(a, currentKm)
    const dueB = getDue(b, currentKm)
    const byStatus = STATUS_ORDER[dueA.status] - STATUS_ORDER[dueB.status]
    if (byStatus !== 0) return byStatus
    const byProgress = dueB.progress - dueA.progress
    if (byProgress !== 0) return byProgress
    return a.name.localeCompare(b.name, 'es')
  })
}

export function kmText(kmLeft: number | null): string | null {
  if (kmLeft === null) return null
  if (kmLeft < 0) return `vencido por ${formatKm(Math.abs(kmLeft))} km`
  if (kmLeft === 0) return 'vence hoy'
  return `faltan ${formatKm(kmLeft)} km`
}

export function daysText(daysLeft: number | null): string | null {
  if (daysLeft === null) return null
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft)
    return `vencido hace ${days} ${days === 1 ? 'día' : 'días'}`
  }
  if (daysLeft === 0) return 'vence hoy'
  return `en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`
}

export function remainingText(due: DueInfo): string {
  const km = kmText(due.kmLeft)
  const days = daysText(due.daysLeft)

  if (due.status === 'overdue') {
    const exceeded = [
      due.kmLeft !== null && due.kmLeft < 0 ? km : null,
      due.daysLeft !== null && due.daysLeft < 0 ? days : null,
    ].filter((value): value is string => value !== null)
    if (exceeded.length > 0) return exceeded.join(' · ')
  }

  const parts = [km, days].filter((value): value is string => value !== null)
  return parts.length > 0 ? parts.join(' · ') : 'Sin datos suficientes'
}

export const CATEGORIES: ReadonlyArray<{ id: Category; label: string; icon: string }> = [
  { id: 'aceite', label: 'Aceite', icon: '🛢️' },
  { id: 'llantas', label: 'Llantas', icon: '🛞' },
  { id: 'frenos', label: 'Frenos', icon: '🛑' },
  { id: 'revision', label: 'Revisión', icon: '🔍' },
  { id: 'motor', label: 'Motor', icon: '⚙️' },
  { id: 'electrico', label: 'Eléctrico', icon: '🔋' },
  { id: 'otro', label: 'Otro', icon: '🔧' },
]

export function categoryMeta(id: Category) {
  return CATEGORIES.find(category => category.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}
