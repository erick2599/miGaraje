const DB_NAME = 'garaje'
const DB_VERSION = 1
const STORE = 'cache'
const KEY = 'garage'

/** Clave histórica de localStorage: se usa como espejo rápido y para migrar. */
const LEGACY_KEY = 'garaje.v1'

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDatabase()
  if (!db) return null
  return new Promise(resolve => {
    let settled = false
    const finish = (value: T | null) => {
      if (settled) return
      settled = true
      db.close()
      resolve(value)
    }
    try {
      const tx = db.transaction(STORE, mode)
      const request = operation(tx.objectStore(STORE))
      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish(null)
      tx.oncomplete = () => finish(null)
      tx.onerror = () => finish(null)
      tx.onabort = () => finish(null)
    } catch {
      finish(null)
    }
  })
}

export async function loadCachedGarage(): Promise<unknown> {
  const value = await run<unknown>('readonly', store => store.get(KEY))
  return value ?? null
}

export async function saveCachedGarage(value: unknown): Promise<void> {
  await run('readwrite', store => store.put(value, KEY))
}

export async function clearCachedGarage(): Promise<void> {
  await run('readwrite', store => store.delete(KEY))
}

export function loadLegacyGarage(): unknown {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveLegacyGarage(value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(LEGACY_KEY)
    else localStorage.setItem(LEGACY_KEY, JSON.stringify(value))
  } catch {
    // Sin espacio o almacenamiento bloqueado: IndexedDB sigue siendo la fuente.
  }
}

/** Pide al navegador que no borre el almacenamiento (clave en iOS). */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    // Algunos navegadores no lo soportan; no es bloqueante.
  }
}
