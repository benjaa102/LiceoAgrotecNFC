import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw, Check, CloudOff } from 'lucide-react'
import { subscribe, syncPendingWrites } from '../lib/offlineManager'

/**
 * ConnectionStatus — Indicador flotante de estado de conexión
 * Muestra: Conectado / Sin conexión / Sincronizando / Pendientes
 */
export default function ConnectionStatus() {
  const [status, setStatus] = useState({ online: true, syncing: false, pendingCount: 0 })
  const [visible, setVisible] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  useEffect(() => {
    let hideTimer = null

    const unsubscribe = subscribe((newStatus) => {
      setStatus(prev => {
        // Detectar si acabamos de terminar de sincronizar
        if (prev.syncing && !newStatus.syncing && newStatus.pendingCount === 0) {
          setJustSynced(true)
          setTimeout(() => setJustSynced(false), 3000)
        }
        return newStatus
      })

      // Mostrar el banner
      setVisible(true)

      // Si está online sin pendientes, ocultar después de 4s
      if (newStatus.online && newStatus.pendingCount === 0 && !newStatus.syncing) {
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => setVisible(false), 4000)
      }
    })

    return () => {
      unsubscribe()
      clearTimeout(hideTimer)
    }
  }, [])

  // No mostrar si todo está bien y no es visible
  if (!visible && status.online && status.pendingCount === 0) return null

  const getConfig = () => {
    if (justSynced) {
      return {
        icon: <Check size={14} />,
        text: '✓ Sincronización completa',
        bg: 'rgba(34, 197, 94, 0.15)',
        border: 'var(--success)',
        color: 'var(--success)'
      }
    }
    if (status.syncing) {
      return {
        icon: <RefreshCw size={14} className="spin" />,
        text: `Sincronizando ${status.pendingCount} registros...`,
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'var(--warning)',
        color: 'var(--warning)'
      }
    }
    if (!status.online) {
      return {
        icon: <WifiOff size={14} />,
        text: status.pendingCount > 0
          ? `Sin conexión — ${status.pendingCount} registro${status.pendingCount > 1 ? 's' : ''} pendiente${status.pendingCount > 1 ? 's' : ''}`
          : 'Sin conexión — Modo offline',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'var(--danger)',
        color: 'var(--danger)'
      }
    }
    if (status.pendingCount > 0) {
      return {
        icon: <CloudOff size={14} />,
        text: `${status.pendingCount} registro${status.pendingCount > 1 ? 's' : ''} pendiente${status.pendingCount > 1 ? 's' : ''} de sincronizar`,
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'var(--warning)',
        color: 'var(--warning)',
        action: true
      }
    }
    return {
      icon: <Wifi size={14} />,
      text: 'Conectado',
      bg: 'rgba(34, 197, 94, 0.15)',
      border: 'var(--success)',
      color: 'var(--success)'
    }
  }

  const config = getConfig()

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      borderRadius: 10,
      background: config.bg,
      border: `1px solid ${config.border}`,
      color: config.color,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'inherit',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      animation: 'fadeIn 0.3s ease',
      transition: 'all 0.3s ease'
    }}>
      {config.icon}
      <span>{config.text}</span>
      {config.action && (
        <button
          onClick={() => syncPendingWrites()}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            padding: '3px 8px',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'inherit'
          }}
        >
          Sincronizar
        </button>
      )}
    </div>
  )
}
