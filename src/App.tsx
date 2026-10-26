import { useEffect, useMemo, useRef, useState } from 'react'
import { NoteRow } from './NoteRow'
import { useNotes } from './useNotes'
import type { Filter } from './types'

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Pendientes' },
  { id: 'done', label: 'Completadas' },
]

export default function App() {
  const { notes, add, toggle, update, remove, clearCompleted } = useNotes()
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const counts = useMemo(
    () => ({
      all: notes.length,
      active: notes.filter(note => !note.done).length,
      done: notes.filter(note => note.done).length,
    }),
    [notes],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter(note => {
        if (filter === 'active') return !note.done
        if (filter === 'done') return note.done
        return true
      })
      .filter(note => !q || note.text.toLowerCase().includes(q))
  }, [notes, filter, query])

  const progress = counts.all === 0 ? 0 : (counts.done / counts.all) * 100

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    add(text)
    setDraft('')
    setFilter('all')
    inputRef.current?.focus()
  }

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">Proyecto de práctica</p>
        <h1 className="app__title">Notas</h1>
        <p className="app__subtitle">
          Crea, edita y completa tareas. Todo se guarda en este navegador.
        </p>
      </header>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="composer__input"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="¿Qué necesitas hacer?"
          aria-label="Nueva nota"
          maxLength={200}
        />
        <button type="submit" className="composer__button" disabled={!draft.trim()}>
          Añadir
        </button>
      </form>

      <section className="toolbar" aria-label="Filtros y búsqueda">
        <div className="filters" role="tablist" aria-label="Filtrar notas">
          {FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? 'filter filter--active' : 'filter'}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span className="filter__count">{counts[item.id]}</span>
            </button>
          ))}
        </div>

        <input
          className="search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar notas"
        />
      </section>

      <div className="progress" aria-hidden="true">
        <span className="progress__bar" style={{ width: `${progress}%` }} />
      </div>

      {visible.length === 0 ? (
        <p className="empty">
          {query.trim()
            ? 'Ninguna nota coincide con la búsqueda.'
            : filter === 'done'
              ? 'Todavía no completaste ninguna nota.'
              : filter === 'active'
                ? 'No tienes pendientes. ¡Bien!'
                : 'Sin notas todavía. Escribe arriba para empezar.'}
        </p>
      ) : (
        <ul className="notes">
          {visible.map(note => (
            <NoteRow
              key={note.id}
              note={note}
              editing={editingId === note.id}
              onToggle={toggle}
              onUpdate={update}
              onRemove={remove}
              onStartEdit={setEditingId}
              onStopEdit={() => setEditingId(null)}
            />
          ))}
        </ul>
      )}

      <footer className="app__footer">
        <span>
          {counts.done} de {counts.all} completadas
        </span>
        {counts.done > 0 && (
          <button type="button" className="link" onClick={clearCompleted}>
            Borrar completadas
          </button>
        )}
      </footer>
    </main>
  )
}
