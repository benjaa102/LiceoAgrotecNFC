import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const normalize = (str) => {
  if (!str) return ''
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, '')
    .replace(/\(.*?\)/g, '') // Quitar paréntesis y su contenido
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Mapa de correcciones manuales de recorrido extraídas del Excel
// "cambia a X" → usar X como recorrido real
function extractCorrectedRecorrido(correccion, recorridoOriginal) {
  if (!correccion) return recorridoOriginal
  const c = correccion.toString()
  
  // Filas tachadas completamente = estudiante retirado, ignorar
  if (c.includes('tachada completamente') || c.includes('Tachado completamente') || c.includes('Retirado') || c.includes('No existe')) {
    return recorridoOriginal // Mantener, no borrar
  }
  
  // "cambia a X"
  const cambiaMatch = c.match(/cambia a\s+([A-Za-záéíóúñÁÉÍÓÚÑü\s]+)/i)
  if (cambiaMatch) {
    return cambiaMatch[1].trim()
  }
  
  // "-> X" o "Escrito X"
  const flechaMatch = c.match(/(?:->|→)\s*([A-Za-záéíóúñÁÉÍÓÚÑü\s]+)/i)
  if (flechaMatch) {
    const val = flechaMatch[1].trim()
    if (val.length > 2 && !val.includes('Ver') && !val.includes('Particular')) {
      return val
    }
  }
  
  // "Escrito \"X\""
  const escritoMatch = c.match(/Escrito\s*"([^"]+)"/i)
  if (escritoMatch) {
    return escritoMatch[1].trim()
  }
  
  // "Flecha indicando cambia a X"
  const indicandoMatch = c.match(/indicando.*?(?:a|->)\s+([A-Za-záéíóúñÁÉÍÓÚÑü\s]+)/i)
  if (indicandoMatch) {
    return indicandoMatch[1].trim()
  }
  
  // Nota "interno" = marcar como interno (handled separately)
  return recorridoOriginal
}

async function run() {
  console.log("═══════════════════════════════════════════════════")
  console.log("  SINCRONIZACIÓN DEFINITIVA - NÓMINA COMPLETA")
  console.log("═══════════════════════════════════════════════════\n")

  // 1. Obtener todos los estudiantes de la DB
  const { data: estudiantesDb, error } = await supabase.from('estudiantes').select('*')
  if (error || !estudiantesDb) {
    console.error("Error al obtener estudiantes:", error)
    return
  }
  console.log(`✓ ${estudiantesDb.length} estudiantes en Supabase.\n`)

  // 2. Leer archivo Excel COMPLETO (todas las hojas)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile('cursos/Nomina_Completa_Colegio_Corregida.xlsx')

  // Primero, resetear TODOS a EXTERNO y sin recorrido asignado aún
  // Después, sólo marcar como INTERNO a los que el Excel diga "Interno"
  
  const updatesMap = new Map() // id -> { ...student, tipo, direccion }
  let totalFilas = 0
  let matchedCount = 0
  let missedCount = 0
  let internosCount = 0
  let externosCount = 0
  const missed = []

  workbook.worksheets.forEach(worksheet => {
    const sheetName = worksheet.name
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      
      const rawNombre = row.getCell(3).value
      if (!rawNombre) return
      
      const rawRegimen = (row.getCell(4).value || '').toString().trim()
      const rawRecorrido = (row.getCell(5).value || '').toString().trim()
      const rawCorreccion = (row.getCell(7).value || '').toString().trim()
      
      totalFilas++
      const searchName = normalize(rawNombre)
      
      // Buscar en BD - exacto primero
      let match = estudiantesDb.find(e => normalize(e.nombre) === searchName)
      
      // Si no hay match exacto, intentar búsqueda flexible
      if (!match) {
        const words = searchName.split(' ').filter(w => w.length > 2)
        if (words.length >= 2) {
          match = estudiantesDb.find(e => {
            const dbName = normalize(e.nombre)
            return words.every(w => dbName.includes(w)) && dbName.length > 5
          })
        }
      }
      
      if (match) {
        matchedCount++
        const isInterno = rawRegimen.toUpperCase().includes('INTERNO')
        const nuevoTipo = isInterno ? 'INTERNO' : 'EXTERNO'
        if (isInterno) internosCount++
        else externosCount++
        
        // Aplicar corrección manual de recorrido si existe
        let recorridoFinal = extractCorrectedRecorrido(rawCorreccion, rawRecorrido)
        
        // Si la corrección dice "interno" explícitamente
        if (rawCorreccion.toLowerCase().includes('interno') && !isInterno) {
          // Forzar a interno si la nota dice "interno"
          updatesMap.set(match.id, {
            ...match,
            tipo: 'INTERNO',
            direccion: recorridoFinal || match.direccion
          })
          internosCount++
          externosCount--
          return
        }
        
        updatesMap.set(match.id, {
          ...match,
          tipo: nuevoTipo,
          direccion: recorridoFinal || match.direccion
        })
      } else {
        missedCount++
        missed.push(rawNombre.toString().trim())
      }
    })
  })

  // Para estudiantes en DB que NO aparecen en el Excel, forzar a EXTERNO
  estudiantesDb.forEach(dbEst => {
    if (!updatesMap.has(dbEst.id)) {
      updatesMap.set(dbEst.id, {
        ...dbEst,
        tipo: 'EXTERNO'
      })
    }
  })

  // Contar cambios reales
  const allUpdates = Array.from(updatesMap.values())
  const realChanges = allUpdates.filter(u => {
    const orig = estudiantesDb.find(e => e.id === u.id)
    return orig && (orig.tipo !== u.tipo || orig.direccion !== u.direccion)
  })

  // Contar internos finales
  const finalInternos = allUpdates.filter(u => u.tipo === 'INTERNO').length

  console.log("═══════════════════════════════════════════════════")
  console.log("  RESULTADOS DEL ANÁLISIS")
  console.log("═══════════════════════════════════════════════════")
  console.log(`  Filas analizadas en Excel:     ${totalFilas}`)
  console.log(`  Emparejados con DB:            ${matchedCount}`)
  console.log(`  NO encontrados en DB:          ${missedCount}`)
  console.log(`  ─────────────────────────────────────────`)
  console.log(`  INTERNOS detectados:           ${finalInternos}`)
  console.log(`  EXTERNOS detectados:           ${allUpdates.length - finalInternos}`)
  console.log(`  Cambios a aplicar en DB:       ${realChanges.length}`)
  console.log("═══════════════════════════════════════════════════\n")

  if (missed.length > 0) {
    console.log(`\n⚠ Estudiantes del Excel NO encontrados en la DB (${missed.length}):`)
    missed.forEach(m => console.log(`  ✗ ${m}`))
  }

  // 3. Aplicar
  if (realChanges.length > 0) {
    console.log(`\n⏳ Inyectando ${realChanges.length} actualizaciones en Supabase...`)
    
    // Dividir en lotes de 100 para evitar errores
    const batchSize = 100
    for (let i = 0; i < realChanges.length; i += batchSize) {
      const batch = realChanges.slice(i, i + batchSize)
      const { error: upsertError } = await supabase.from('estudiantes').upsert(batch)
      if (upsertError) {
        console.error(`Error en lote ${i}-${i+batch.length}:`, upsertError)
      } else {
        console.log(`  ✓ Lote ${Math.floor(i/batchSize)+1} completado (${batch.length} registros)`)
      }
    }
    console.log("\n✅ ¡Sincronización completada exitosamente!")
  } else {
    console.log("✅ No hay cambios pendientes. La base de datos ya está al día.")
  }
}

run()
