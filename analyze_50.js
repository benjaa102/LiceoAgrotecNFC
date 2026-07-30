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

async function run() {
  // 1. Get the 50 students without dirección
  const { data: sinDir } = await supabase.from('estudiantes').select('*')
    .or('direccion.is.null,direccion.eq.')
    .order('nombre')
  
  console.log(`\n═══ ${sinDir.length} ESTUDIANTES SIN DIRECCIÓN - ANÁLISIS DETALLADO ═══\n`)

  // 2. Read all Excel names
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
        curso: (row.getCell(2).value || '').toString().trim(),
        regimen: (row.getCell(4).value || '').toString().trim(),
        recorrido: (row.getCell(5).value || '').toString().trim(),
        correccion: (row.getCell(7).value || '').toString().trim(),
        hoja: ws.name
      })
    })
  })

  console.log(`Total nombres en Excel: ${excelStudents.length}\n`)

  // 3. For each of the 50, do a deep search
  for (let i = 0; i < sinDir.length; i++) {
    const est = sinDir[i]
    const dbNorm = normalize(est.nombre)
    const dbWords = dbNorm.split(' ').filter(w => w.length > 2)
    
    console.log(`─── ${i+1}. ${est.nombre} (DB) ───`)
    console.log(`   DB normalizado: "${dbNorm}"`)
    
    // Try exact match first
    let exactMatch = excelStudents.find(e => normalize(e.nombre) === dbNorm)
    if (exactMatch) {
      console.log(`   ✅ MATCH EXACTO: "${exactMatch.nombre}" | ${exactMatch.regimen} | ${exactMatch.recorrido}`)
      console.log(`   ⚠ ¿Por qué no lo detectó antes? Revisar...`)
      continue
    }
    
    // Try with at least 3 words matching
    let candidates = excelStudents.filter(e => {
      const excNorm = normalize(e.nombre)
      const excWords = excNorm.split(' ').filter(w => w.length > 2)
      const matchingWords = dbWords.filter(w => excWords.some(ew => ew === w || ew.includes(w) || w.includes(ew)))
      return matchingWords.length >= 2
    })
    
    if (candidates.length > 0) {
      // Score them
      candidates = candidates.map(c => {
        const excNorm = normalize(c.nombre)
        const excWords = excNorm.split(' ').filter(w => w.length > 2)
        const matchingWords = dbWords.filter(w => excWords.some(ew => ew === w || ew.includes(w) || w.includes(ew)))
        return { ...c, score: matchingWords.length, excNorm }
      }).sort((a, b) => b.score - a.score)
      
      const best = candidates[0]
      console.log(`   🔍 MEJOR CANDIDATO (${best.score} palabras coinciden):`)
      console.log(`      Excel: "${best.nombre}"`)
      console.log(`      Excel normalizado: "${best.excNorm}"`)
      console.log(`      Régimen: ${best.regimen} | Recorrido: ${best.recorrido}`)
      if (best.correccion) console.log(`      Corrección: ${best.correccion}`)
      
      // Show the diff
      const excWords = best.excNorm.split(' ').filter(w => w.length > 0)
      const dbW = dbNorm.split(' ').filter(w => w.length > 0)
      const missing = dbW.filter(w => !excWords.includes(w))
      const extra = excWords.filter(w => !dbW.includes(w))
      if (missing.length) console.log(`      Palabras en DB que faltan en Excel: [${missing.join(', ')}]`)
      if (extra.length) console.log(`      Palabras en Excel que faltan en DB: [${extra.join(', ')}]`)
    } else {
      console.log(`   ❌ SIN CANDIDATOS en el Excel`)
      // Try with just 1 word (apellido)
      const firstWord = dbWords[0]
      const looseMatches = excelStudents.filter(e => normalize(e.nombre).includes(firstWord))
      if (looseMatches.length > 0 && looseMatches.length < 10) {
        console.log(`      Nombres con apellido "${firstWord}":`)
        looseMatches.forEach(m => console.log(`        - ${m.nombre}`))
      }
    }
    console.log('')
  }
}

run()
