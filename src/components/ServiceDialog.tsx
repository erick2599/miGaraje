import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Modal } from './Modal'
import {
  formatDate,
  formatDistance,
  fromDisplayDistance,
  toDisplayDistance,
  todayISO,
} from '../maintenance'
import type { DistanceUnit, MaintenanceItem, ServiceAttachment, ServiceDraft } from '../types'

type Props = {
  item: MaintenanceItem
  currentKm: number
  unit: DistanceUnit
  onClose: () => void
  onSubmit: (draft: ServiceDraft) => void
}

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

export function ServiceDialog({ item, currentKm, unit, onClose, onSubmit }: Props) {
  const [date, setDate] = useState(todayISO())
  const [distance, setDistance] = useState(
    String(Math.round(toDisplayDistance(currentKm, unit))),
  )
  const [note, setNote] = useState('')
  const [partsCost, setPartsCost] = useState('')
  const [laborCost, setLaborCost] = useState('')
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
    if (!date) {
      setError('Elegí la fecha del servicio.')
      return
    }
    const parsed = Number(distance.replace(/[^\d]/g, ''))
    if (distance.trim() === '' || !Number.isFinite(parsed)) {
      setError('Ingresá el odómetro al momento del servicio.')
      return
    }

    const parts = parseCost(partsCost)
    const labor = parseCost(laborCost)
    const total = parts !== undefined || labor !== undefined ? (parts ?? 0) + (labor ?? 0) : undefined

    onSubmit({
      date,
      km: Math.round(fromDisplayDistance(parsed, unit)),
      note,
      partsCost: parts,
      laborCost: labor,
      totalCost: total,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  return (
    <Modal title="Registrar servicio" subtitle={item.name} onClose={onClose}>
      <div className="service-summary">
        <div>
          <span className="service-summary__label">Último registro</span>
          <strong>
            {item.lastKm !== null ? formatDistance(item.lastKm, unit) : '—'}
          </strong>
        </div>
        <div>
          <span className="service-summary__label">Fecha</span>
          <strong>{formatDate(item.lastDate)}</strong>
        </div>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Fecha</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={event => {
                setDate(event.target.value)
                setError('')
              }}
            />
          </label>

          <label className="field">
            <span className="field__label">Odómetro</span>
            <div className="input-group">
              <input
                className="input"
                value={distance}
                onChange={event => {
                  setDistance(event.target.value)
                  setError('')
                }}
                inputMode="numeric"
                placeholder={String(Math.round(toDisplayDistance(currentKm, unit)))}
              />
              <span className="input-group__suffix">{unit}</span>
            </div>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Costo de refacciones (USD, opcional)</span>
            <div className="input-group">
              <span className="input-group__suffix">$</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={partsCost}
                onChange={event => {
                  setPartsCost(event.target.value)
                  setError('')
                }}
                placeholder="0.00"
              />
            </div>
          </label>

          <label className="field">
            <span className="field__label">Costo de mano de obra (USD, opcional)</span>
            <div className="input-group">
              <span className="input-group__suffix">$</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={laborCost}
                onChange={event => {
                  setLaborCost(event.target.value)
                  setError('')
                }}
                placeholder="0.00"
              />
            </div>
          </label>
        </div>

        {(partsCost.trim() !== '' || laborCost.trim() !== '') && (
          <p className="form-hint">
            Costo total: ${(
              (parseCost(partsCost) ?? 0) + (parseCost(laborCost) ?? 0)
            ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}

        <label className="field">
          <span className="field__label">Detalle (opcional)</span>
          <textarea
            className="input input--area"
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ej: aceite 5W-30 + filtro, taller X"
          />
        </label>

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

        <p className="form-hint">
          El próximo vencimiento se calcula desde estos datos. El odómetro del vehículo se
          actualiza si es mayor al actual.
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={attaching}>
            Guardar servicio
          </button>
        </div>
      </form>
    </Modal>
  )
}
