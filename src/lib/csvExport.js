/**
 * Utilidades para exportar datos a CSV con soporte correcto para Excel.
 * - Agrega BOM (Byte Order Mark) para que Excel reconozca UTF-8 (acentos, ñ, etc.)
 * - Escapa valores que contengan comas, comillas o saltos de línea
 * - Separa por punto y coma (;) que es más compatible con Excel en español
 */

// Escapa un valor individual para CSV
const escapeCSV = (value) => {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Si contiene separador, comillas o saltos de línea, envolver en comillas
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

/**
 * Exporta un array de objetos como archivo CSV.
 * @param {Object[]} rows - Array de objetos con los datos
 * @param {string} filename - Nombre del archivo (sin extensión se agrega .csv)
 * @param {Object} [options] - Opciones adicionales
 * @param {Object} [options.headerLabels] - Mapeo de claves a nombres de columna en español
 */
export const exportCSV = (rows, filename, options = {}) => {
  if (!rows.length) {
    alert('No hay datos para exportar con los filtros actuales.')
    return
  }

  const keys = Object.keys(rows[0])
  const headerLabels = options.headerLabels || {}
  
  // Generar encabezados (usar labels si existen, sino la key)
  const headers = keys.map(k => escapeCSV(headerLabels[k] || k)).join(';')
  
  // Generar filas
  const lines = rows.map(row => 
    keys.map(k => escapeCSV(row[k])).join(';')
  ).join('\r\n')

  // BOM + contenido (BOM = \uFEFF hace que Excel interprete UTF-8 correctamente)
  const bom = '\uFEFF'
  const csvContent = bom + headers + '\r\n' + lines

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const finalName = filename.endsWith('.csv') ? filename : filename + '.csv'
  const a = document.createElement('a')
  a.href = url
  a.download = finalName
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Formatea una fecha ISO a formato legible dd/mm/yyyy
 */
export const formatFecha = (fecha) => {
  if (!fecha) return ''
  const parts = fecha.split('-')
  if (parts.length !== 3) return fecha
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/**
 * Genera un nombre de archivo descriptivo con fecha actual
 */
export const makeFilename = (prefix, filters = {}) => {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const filterParts = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([, v]) => String(v).replace(/[°\s]/g, ''))
  const suffix = filterParts.length ? '_' + filterParts.join('_') : ''
  return `${prefix}${suffix}_${dateStr}`
}
