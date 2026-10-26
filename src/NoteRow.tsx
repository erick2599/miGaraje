import { useEffect, useRef, useState } from 'react'
import type { Note } from './types'

type Props = {
  note: Note
  editing: boolean
  onToggle: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onRemove: (id: string) => void
  onStartEdit: (id: string) => void
  onStopEdit: () => void
}

const dateFormatter = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
})

export function NoteRow({
  note,
  editing,
  onToggle,
  onUpdate,
  onRemove,
  onStartEdit,
  onStopEdit,
}: Props) {
  const [draft, setDraft] = useState(note.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) return
    setDraft(note.text)
    const input = inputRef.current
    input?.focus()
    input?.select()
  }, [editing, note.text])

  function commit() {
    const clean = draft.trim()
    if (clean && clean !== note.text) onUpdate(note.id, clean)
    onStopEdit()
  }

  if (editing) {
    return (
      <li className="note note--editing">
        <input
          ref={inputRef}
          className="note__edit"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') onStopEdit()
          }}
          aria-label="Editar nota"
        />
        <span className="note__hint">Enter guarda · Esc cancela</span>
      </li>
    )
  }

  return (
    <li className={note.done ? 'note note--done' : 'note'}>
      <label className="note__check">
        <input
          type="checkbox"
          checked={note.done}
          onChange={() => onToggle(note.id)}
          aria-label={note.done ? 'Marcar como pendiente' : 'Marcar como completada'}
        />
        <span className="note__box" aria-hidden="true" />
      </label>

      <button
        type="button"
        className="note__text"
        onClick={() => onStartEdit(note.id)}
        title="Editar nota"
      >
        <span className="note__label">{note.text}</span>
        <span className="note__date">{dateFormatter.format(note.createdAt)}</span>
      </button>

      <button
        type="button"
        className="note__remove"
        onClick={() => onRemove(note.id)}
        aria-label={`Eliminar "${note.text}"`}
        title="Eliminar"
      >
        ×
      </button>
    </li>
  )
}
