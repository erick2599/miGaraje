import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Modal } from './Modal'
import { CATEGORIES, fromDisplayDistance, toDisplayDistance, todayISO } from '../maintenance'
import type { Category, DistanceUnit, ItemDraft, MaintenanceItem, ServiceAttachment } from '../types'

function parseCost(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const normalized = trimmed.replace(',', '.').replace(/[^0-9.]/g, '')
  if (normalized === '' || normalized === '.') return undefined
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.round(parsed * 100) / 100
}

function newAttachmentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

function compressImage(file: File, maxDim = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'))
      img.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })
}

async function fileToAttachment(file: File): Promise<ServiceAttachment> {
  const isImage = file.type.startsWith('image/')
  const dataUrl = isImage ? await compressImage(file) : await readFileAsDataUrl(file)
  return {
    id: newAttachmentId(),
    name: file.name || (isImage ? 'foto.jpg' : 'archivo.pdf'),
    type: isImage ? 'image/jpeg' : file.type || 'application/octet-stream',
    dataUrl,
  }
}

type Props = {
  item?: MaintenanceItem
  defaultKm: number
  unit: DistanceUnit
  onClose: () => void
  onSubmit: (draft: ItemDraft) => void
}

export function ItemDialog({ item, defaultKm, unit, onClose, onSubmit }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<Category>(item?.category ?? 'aceite')
  const [intervalDistance, setIntervalDistance] = useState(
    item?.intervalKm != null ? String(Math.round(toDisplayDistance(item.intervalKm, unit))) : '',
  )
  const [intervalMonths, setIntervalMonths] = useState(item?.intervalMonths?.toString() ?? '')
  const [lastDistance, setLastDistance] = useState(
    String(Math.round(toDisplayDistance(item?.lastKm ?? defaultKm, unit))),
  )
  const [lastDate, setLastDate] = useState(item?.lastDate ?? todayISO())
  const [note, setNote] = useState(item?.note ?? '')
  const [partsCost, setPartsCost] = useState('')
  const [laborCost, setLaborCost] = useState('')
  const [registerNow, setRegisterNow] = useState(!item)
  const [attachments, setAttachments] = useState<ServiceAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    const remaining = 5 - attachments.length
    if (remaining <= 0) {
      setError('Puedes adjuntar hasta 5 archivos por servicio.')
      return
    }
    const selected = files.slice(0, remaining)
    setAttaching(true)
    setError('')
    try {
      const next: ServiceAttachment[] = []
      for (const file of selected) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        const isImage = file.type.startsWith('image/')
        if (!isPdf && !isImage) {
          setError('Solo se permiten imágenes o archivos PDF.')
          continue
        }
        if (isPdf && file.size > 3 * 1024 * 1024) {
          setError(`El PDF "${file.name}" supera 3 MB. Usa uno más liviano.`)
          continue
        }
        next.push(await fileToAttachment(file))
      }
      if (next.length > 0) setAttachments(prev => [...prev, ...next])
    } catch {
      setError('No se pudo agregar uno de los archivos.')
    } finally {
      setAttaching(false)
    }
  }

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Poné un nombre para el servicio.')
      return
    }

    const distanceValue = intervalDistance.trim() === '' ? null : Number(intervalDistance)
    const monthsValue = intervalMonths.trim() === '' ? null : Number(intervalMonths)

    if (distanceValue !== null && (!Number.isFinite(distanceValue) || distanceValue <= 0)) {
      setError('El intervalo de distancia debe ser mayor a cero.')
      return
    }
    if (monthsValue !== null && (!Number.isFinite(monthsValue) || monthsValue <= 0)) {
      setError('El intervalo en meses debe ser mayor a cero.')
      return
    }
    if (distanceValue === null && monthsValue === null) {
      setError('Definí al menos un intervalo: distancia, meses o ambos.')
      return
    }

    let kmLast: number | null = null
    if (distanceValue !== null) {
      const parsed = Number(lastDistance.replace(/[^\d]/g, ''))
      if (lastDistance.trim() === '' || !Number.isFinite(parsed)) {
        setError('Indicá en qué odómetro se hizo el último servicio.')
        return
      }
      kmLast = Math.round(fromDisplayDistance(parsed, unit))
    }

    const dateLast = monthsValue !== null ? lastDate : lastDate || null
    if (monthsValue !== null && !dateLast) {
      setError('Indicá la fecha del último servicio.')
      return
    }

    const parts = parseCost(partsCost)
    const labor = parseCost(laborCost)
    const total = parts !== undefined || labor !== undefined ? (parts ?? 0) + (labor ?? 0) : undefined

    onSubmit({
      name: cleanName,
      category,
      intervalKm:
        distanceValue === null ? null : Math.round(fromDisplayDistance(distanceValue, unit)),
      intervalMonths: monthsValue === null ? null : Math.round(monthsValue),
      lastKm: kmLast,
      lastDate: dateLast,
      note: note.trim(),
      partsCost: parts,
      laborCost: labor,
      totalCost: total,
      registerNow: !item && registerNow,
      attachments: !item && registerNow && attachments.length > 0 ? attachments : undefined,
    })
  }

  return (
    <Modal
      title={item ? 'Editar servicio' : 'Nuevo servicio'}
      subtitle="Los intervalos son cada cuánto toca repetirlo."
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Nombre</span>
          <input
            className="input"
            value={name}
            onChange={event => {
              setName(event.target.value)
              setError('')
            }}
            placeholder="Ej: Cambio de aceite"
            maxLength={60}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Categoría</span>
          <select
            className="input"
            value={category}
            onChange={event => setCategory(event.target.value as Category)}
          >
            {CATEGORIES.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Cada</span>
            <div className="input-group">
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={intervalDistance}
                onChange={event => {
                  setIntervalDistance(event.target.value)
                  setError('')
                }}
                placeholder={unit === 'mi' ? '3000' : '5000'}
              />
              <span className="input-group__suffix">{unit}</span>
            </div>
          </label>

          <label className="field">
            <span className="field__label">o cada</span>
            <div className="input-group">
              <input
                className="input"
                type="number"
                min={0}
                max={120}
                step={1}
                value={intervalMonths}
                onChange={event => {
                  setIntervalMonths(event.target.value)
                  setError('')
                }}
                placeholder="6"
              />
              <span className="input-group__suffix">meses</span>
            </div>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Último servicio: odómetro</span>
            <div className="input-group">
              <input
                className="input"
                value={lastDistance}
                onChange={event => {
                  setLastDistance(event.target.value)
                  setError('')
                }}
                inputMode="numeric"
                placeholder={String(Math.round(toDisplayDistance(defaultKm, unit)))}
              />
              <span className="input-group__suffix">{unit}</span>
            </div>
          </label>

          <label className="field">
            <span className="field__label">Último servicio: fecha</span>
            <input
              className="input"
              type="date"
              value={lastDate}
              onChange={event => {
                setLastDate(event.target.value)
                setError('')
              }}
            />
          </label>
        </div>

        {!item && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={registerNow} onChange={e => setRegisterNow(e.target.checked)} />
              <span>Registrar este servicio ya (agregar al historial con costos)</span>
            </label>
            {registerNow && (
              <>
                <div className="field-row">
                  <label className="field">
                    <span className="field__label">Costo de refacciones (USD)</span>
                    <div className="input-group">
                      <span className="input-group__suffix">$</span>
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={partsCost}
                        onChange={event => setPartsCost(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span className="field__label">Costo de mano de obra (USD)</span>
                    <div className="input-group">
                      <span className="input-group__suffix">$</span>
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={laborCost}
                        onChange={event => setLaborCost(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </label>
                </div>
                {(partsCost.trim() !== '' || laborCost.trim() !== '') && (
                  <p className="form-hint">
                    Costo total: ${((parseCost(partsCost) ?? 0) + (parseCost(laborCost) ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}

                <div className="field">
                  <span className="field__label">Fotos o recibos (opcional)</span>
                  <p className="field__hint">Puedes agregar hasta 5 archivos: imágenes o PDF desde la galería o el almacenamiento.</p>
                  <input
                    className="input"
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    multiple
                    onChange={handleFiles}
                    disabled={attaching || attachments.length >= 5}
                  />
                  {attaching && <p className="form-hint">Procesando archivos…</p>}
                  {attachments.length > 0 && (
                    <ul className="attachments">
                      {attachments.map(att => (
                        <li key={att.id} className="attachment">
                          {att.type.startsWith('image/') ? (
                            <img className="attachment__thumb" src={att.dataUrl} alt={att.name} />
                          ) : (
                            <div className="attachment__file">PDF</div>
                          )}
                          <span className="attachment__name" title={att.name}>{att.name}</span>
                          <button type="button" className="link" onClick={() => removeAttachment(att.id)}>
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <label className="field">
          <span className="field__label">Nota (opcional)</span>
          <textarea
            className="input input--area"
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ej: usar aceite 5W-30 sintético"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={attaching}>
            {item ? 'Guardar cambios' : 'Agregar servicio'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
