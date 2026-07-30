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
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Levenshtein distance implementation
function levenshteinDistance(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1))
      }
    }
  }
  return matrix[b.length][a.length]
}

function extractCorrectedRecorrido(correccion, recorridoOriginal) {
  if (!correccion) return recorridoOriginal
  const c = correccion.toString()
  if (c.includes('tachada completamente') || c.includes('Tachado completamente') || c.includes('Retirado') || c.includes('No existe')) {
    return recorridoOriginal 
  }
  const cambiaMatch = c.match(/cambia a\s+([A-Za-záéíóúñÁÉÍÓÚÑü\s]+)/i)
  if (cambiaMatch) return cambiaMatch[1].trim()
  const flechaMatch = c.match(/(?:->|→)\s*([A-Za-záéíóúñÁÉÍÓÚÑü\s]+)/i)
  if (flechaMatch) {
    const val = flechaMatch[1].trim()
    if (val.length > 2 && !val.includes('Ver') && !val.includes('Particular')) return val
  }
  const escritoMatch = c.match(/Escrito\s*"([^"]+)"/i)
  if (escritoMatch) return escritoMatch[1].trim()
  const indicandoMatch = c.match(/indicando.*?(?:a|->)\s+([A-Za-záéíóúñÁÉÍÓÚÑü\s]+)/i)
  if (indicandoMatch) return indicandoMatch[1].trim()
  return recorridoOriginal
}

const direccionToRecorrido = {
  'Mashue': 'r1', 'Futrono': 'r2', 'Lago Ranco': 'r2', 'San Pablo': 'r3', 'San Pablo / Particular a veces': 'r3', 'Osorno': 'r4', 'Daiber': 'r5', 'Maitén': 'r5', 'Río Bueno Centro': 'r6', 'Río Bueno Población': 'r7', 'Río Bueno': 'r6', 'Caupolicán': 'r8', 'Centro': 'r8', 'Manzanal': 'r9', 'Puerto Nuevo': 'r10', 'Los Lagos': 'r11', 'Mariquina': 'r12', 'Paillaco': 'r13', 'La Unión': 'r14', 'Particular': 'r15',
}
const normalizeMap = {
  'DAIBER': 'Daiber', 'Maiten': 'Maitén', 'MAITEN': 'Maitén', 'MAITÉN': 'Maitén', 'Puerto nuevo': 'Puerto Nuevo', 'PUERTO NUEVO': 'Puerto Nuevo', 'LA UNIÓN': 'La Unión', 'Rio Bueno': 'Río Bueno', 'Río Bueno Poblacion o Viernes Paillaco': 'Río Bueno Población', 'Viernes San Pablo': 'San Pablo', 'Maitén / Centro La Unión': 'Maitén'
}

async function run() {
  const { data: dbEstudiantes } = await supabase.from('estudiantes').select('*').or('direccion.is.null,direccion.eq.')
  
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile('cursos/Nomina_Completa_Colegio_Corregida.xlsx')

  const excelStudents = []
  workbook.worksheets.forEach(ws => {
    ws.eachRow((row, n) => {
      if (n === 1) return
      const nombre = row.getCell(3).value
      if (!nombre) return
      excelStudents.push({
        nombre: nombre.toString().trim(),
        regimen: (row.getCell(4).value || '').toString().trim(),
        recorrido: (row.getCell(5).value || '').toString().trim(),
        correccion: (row.getCell(7).value || '').toString().trim()
      })
    })
  })

  console.log(`Intentando emparejar ${dbEstudiantes.length} estudiantes sin dirección con lógica Fuzzy (Errores tipográficos)...`)
  
  const updates = []
  const reallyMissing = []

  for (const est of dbEstudiantes) {
    const dbNorm = normalize(est.nombre)
    
    // Find best match in Excel
    let bestMatch = null
    let bestScore = 999
    
    for (const ex of excelStudents) {
      const exNorm = normalize(ex.nombre)
      const distance = levenshteinDistance(dbNorm, exNorm)
      
      // Calculate length ratio for accuracy
      const maxLength = Math.max(dbNorm.length, exNorm.length)
      const similarity = 1 - (distance / maxLength)
      
      if (similarity > 0.70 && distance < bestScore) { // 70% similar or better
        bestMatch = ex
        bestScore = distance
      }
    }
    
    if (bestMatch) {
      console.log(`✅ MATCH ENCONTRADO:`)
      console.log(`   DB:    ${est.nombre}`)
      console.log(`   Excel: ${bestMatch.nombre}`)
      
      const isInterno = bestMatch.regimen.toUpperCase().includes('INTERNO')
      const nuevoTipo = isInterno ? 'INTERNO' : 'EXTERNO'
      
      let recorridoFinal = extractCorrectedRecorrido(bestMatch.correccion, bestMatch.recorrido)
      if (normalizeMap[recorridoFinal]) recorridoFinal = normalizeMap[recorridoFinal]
      
      const idRecorrido = direccionToRecorrido[recorridoFinal] || null
      
      updates.push({
        ...est,
        tipo: nuevoTipo,
        direccion: recorridoFinal,
        id_recorrido: idRecorrido
      })
    } else {
      reallyMissing.push(est)
    }
  }

  if (updates.length > 0) {
    console.log(`\n⏳ Inyectando ${updates.length} matches difusos en Supabase...`)
    const { error } = await supabase.from('estudiantes').upsert(updates)
    if (error) console.error(error)
    else console.log(`✓ ¡Actualizados con éxito!`)
  }
  
  if (reallyMissing.length > 0) {
    console.log(`\n❌ ESTOS ESTUDIANTES DEFINITIVAMENTE NO ESTÁN EN EL EXCEL (${reallyMissing.length}):`)
    reallyMissing.forEach(r => console.log(`  - ${r.nombre} (Curso: ${r.curso})`))
  }
}

run()
