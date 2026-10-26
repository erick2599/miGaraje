import { useEffect, useState } from 'react'
import type { Note } from './types'

const STORAGE_KEY = 'notas.v1'

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false
  const note = value as Record<string, unknown>
  return (
    typeof note.id === 'string' &&
    typeof note.text === 'string' &&
    typeof note.done === 'boolean' &&
    typeof note.createdAt === 'number' &&
    typeof note.updatedAt === 'number'
  )
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isNote)
  } catch {
    return []
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(loadNotes)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    } catch {
      // Sin espacio o almacenamiento bloqueado: la app sigue funcionando en memoria.
    }
  }, [notes])

  function add(text: string) {
    const clean = text.trim()
    if (!clean) return
    const now = Date.now()
    setNotes(prev => [
      { id: newId(), text: clean, done: false, createdAt: now, updatedAt: now },
      ...prev,
    ])
  }

  function toggle(id: string) {
    setNotes(prev =>
      prev.map(note =>
        note.id === id ? { ...note, done: !note.done, updatedAt: Date.now() } : note,
      ),
    )
  }

  function update(id: string, text: string) {
    const clean = text.trim()
    if (!clean) return
    setNotes(prev =>
      prev.map(note =>
        note.id === id ? { ...note, text: clean, updatedAt: Date.now() } : note,
      ),
    )
  }

  function remove(id: string) {
    setNotes(prev => prev.filter(note => note.id !== id))
  }

  function clearCompleted() {
    setNotes(prev => prev.filter(note => !note.done))
  }

  return { notes, add, toggle, update, remove, clearCompleted }
}
