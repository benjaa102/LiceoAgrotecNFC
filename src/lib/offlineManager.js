/**
 * offlineManager.js — Manejo de modo offline para LiceoControl NFC
 * 
 * Funcionalidades:
 * 1. Detectar conexión online/offline
 * 2. Cachear datos de lectura (estudiantes, credenciales, etc.) en localStorage
 * 3. Encolar escrituras pendientes cuando no hay internet
 * 4. Sincronizar automáticamente al recuperar conexión
 */

import { supabase } from './supabase'

// ─── Keys para localStorage ───
const CACHE_PREFIX = 'lc_cache_'
const QUEUE_KEY = 'lc_pending_queue'
const LAST_SYNC_KEY = 'lc_last_sync'

// ─── Estado reactivo ───
let _online = navigator.onLine
let _syncing = false
const _listeners = new Set()

// ─── Event listeners para detectar conexión ───
window.addEventListener('online', () => {
  _online = true
  _notify()
  // Auto-sync cuando vuelve la conexión
  syncPendingWrites()
})

window.addEventListener('offline', () => {
  _online = false
  _notify()
})

// Notificar a todos los suscriptores
function _notify() {
  _listeners.forEach(fn => fn({ online: _online, syncing: _syncing, pendingCount: getPendingCount() }))
}

// ─── API Pública ───

/** Suscribirse a cambios de estado (online/offline/syncing) */
export function subscribe(callback) {
  _listeners.add(callback)
  // Notificar estado actual inmediatamente
  callback({ online: _online, syncing: _syncing, pendingCount: getPendingCount() })
  return () => _listeners.delete(callback)
}

/** ¿Está online? */
export function isOnline() {
  return _online
}

/** ¿Está sincronizando? */
export function isSyncing() {
  return _syncing
}

// ─── Caché de datos de lectura ───

/** Guardar datos en caché local */
export function cacheData(tableName, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + tableName, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.warn('[Offline] Error caching data:', e)
  }
}

/** Leer datos del caché */
export function getCachedData(tableName) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + tableName)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.data
  } catch (e) {
    console.warn('[Offline] Error reading cache:', e)
    return null
  }
}

/** Obtener timestamp del último caché */
export function getCacheTimestamp(tableName) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + tableName)
    if (!raw) return null
    return JSON.parse(raw).timestamp
  } catch {
    return null
  }
}

// ─── Cola de escritura offline ───

/** Obtener la cola pendiente */
function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Guardar la cola */
function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('[Offline] Error saving queue:', e)
  }
}

/** Encolar un registro para sincronizar después */
export function queueWrite(tableName, record) {
  const queue = getQueue()
  queue.push({
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    tableName,
    record,
    timestamp: Date.now(),
    attempts: 0
  })
  saveQueue(queue)
  _notify()
  console.log(`[Offline] Queued write for ${tableName}. Total pending: ${queue.length}`)
}

/** Número de registros pendientes */
export function getPendingCount() {
  return getQueue().length
}

/** Sincronizar todos los registros pendientes */
export async function syncPendingWrites() {
  const queue = getQueue()
  if (queue.length === 0 || _syncing || !_online) return

  _syncing = true
  _notify()
  console.log(`[Offline] Syncing ${queue.length} pending records...`)

  const failed = []
  let synced = 0

  for (const item of queue) {
    try {
      const { error } = await supabase.from(item.tableName).insert([item.record])
      if (error) {
        // Si es error de duplicado, considerar como éxito (ya se sincronizó antes)
        if (error.code === '23505') {
          console.log(`[Offline] Record already exists, skipping: ${item.record.id}`)
          synced++
        } else {
          console.error(`[Offline] Sync error for ${item.tableName}:`, error)
          item.attempts++
          if (item.attempts < 5) {
            failed.push(item)
          } else {
            console.error(`[Offline] Record dropped after 5 attempts:`, item)
          }
        }
      } else {
        synced++
        console.log(`[Offline] Synced record: ${item.record.id}`)
      }
    } catch (e) {
      console.error(`[Offline] Network error during sync:`, e)
      item.attempts++
      failed.push(item)
      // Si hay error de red, dejar de intentar
      break
    }
  }

  saveQueue(failed)
  _syncing = false

  if (synced > 0) {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
  }

  _notify()
  console.log(`[Offline] Sync complete. Synced: ${synced}, Failed: ${failed.length}`)
}

/** Cargar datos con fallback a caché */
export async function fetchWithCache(tableName, queryFn) {
  if (_online) {
    try {
      const result = await queryFn()
      if (result.data) {
        cacheData(tableName, result.data)
        return { data: result.data, fromCache: false }
      }
    } catch (e) {
      console.warn(`[Offline] Fetch failed for ${tableName}, using cache:`, e)
    }
  }

  // Fallback a caché
  const cached = getCachedData(tableName)
  if (cached) {
    console.log(`[Offline] Using cached data for ${tableName} (${cached.length} records)`)
    return { data: cached, fromCache: true }
  }

  return { data: [], fromCache: true }
}

/** Guardar registro: online → Supabase, offline → cola local */
export async function saveRecord(tableName, record) {
  if (_online) {
    try {
      const { error } = await supabase.from(tableName).insert([record])
      if (error) {
        console.error(`[Offline] Insert error, queueing:`, error)
        queueWrite(tableName, record)
        return { queued: true, error }
      }
      return { queued: false, error: null }
    } catch (e) {
      // Error de red → encolar
      queueWrite(tableName, record)
      return { queued: true, error: e }
    }
  } else {
    queueWrite(tableName, record)
    return { queued: true, error: null }
  }
}

// Intentar sync al cargar la página (por si quedaron pendientes)
if (_online) {
  setTimeout(() => syncPendingWrites(), 2000)
}
