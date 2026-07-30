import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// Mapa de dirección → id_recorrido
const direccionToRecorrido = {
  'Mashue': 'r1',
  'Futrono': 'r2',
  'Lago Ranco': 'r2',
  'San Pablo': 'r3',
  'San Pablo / Particular a veces': 'r3',
  'Osorno': 'r4',
  'Daiber': 'r5',
  'Maitén': 'r5',
  'Río Bueno Centro': 'r6',
  'Río Bueno Población': 'r7',
  'Río Bueno': 'r6',
  'Caupolicán': 'r8',
  'Centro': 'r8',
  'Manzanal': 'r9',
  'Puerto Nuevo': 'r10',
  'Los Lagos': 'r11',
  'Mariquina': 'r12',
  'Paillaco': 'r13',
  'La Unión': 'r14',
  'Particular': 'r15',
}

async function run() {
  console.log("═══════════════════════════════════════════════════")
  console.log("  ASIGNACIÓN MASIVA DE RECORRIDOS")
  console.log("═══════════════════════════════════════════════════\n")

  const { data: estudiantes, error } = await supabase.from('estudiantes').select('*')
  if (error) { console.error(error); return }

  let asignados = 0
  let sinDireccion = 0
  let sinMatch = 0
  const updates = []
  const sinRecorridoList = []

  for (const est of estudiantes) {
    const dir = (est.direccion || '').trim()
    
    if (!dir) {
      sinDireccion++
      sinRecorridoList.push(est)
      continue
    }

    const recorridoId = direccionToRecorrido[dir]
    if (recorridoId) {
      if (est.id_recorrido !== recorridoId) {
        updates.push({ ...est, id_recorrido: recorridoId })
        asignados++
      }
    } else {
      sinMatch++
      console.log(`  ⚠ Dirección sin mapeo: "${dir}" (${est.nombre})`)
    }
  }

  console.log(`  Estudiantes a actualizar:  ${asignados}`)
  console.log(`  Sin dirección en DB:       ${sinDireccion}`)
  console.log(`  Dirección sin mapeo:       ${sinMatch}`)

  // Aplicar en lotes
  if (updates.length > 0) {
    console.log(`\n⏳ Inyectando ${updates.length} recorridos en Supabase...`)
    const batchSize = 100
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      const { error: err } = await supabase.from('estudiantes').upsert(batch)
      if (err) console.error(`  Error lote ${Math.floor(i/batchSize)+1}:`, err)
      else console.log(`  ✓ Lote ${Math.floor(i/batchSize)+1} (${batch.length} registros)`)
    }
  }

  // Mostrar los sin dirección
  if (sinRecorridoList.length > 0) {
    console.log(`\n═══════════════════════════════════════════════════`)
    console.log(`  ${sinRecorridoList.length} ESTUDIANTES SIN DIRECCIÓN/RECORRIDO:`)
    console.log(`═══════════════════════════════════════════════════`)
    sinRecorridoList.forEach((e, i) => {
      console.log(`  ${(i+1).toString().padStart(2)}. ${e.nombre.padEnd(45)} | ${(e.rut||'-').padEnd(14)} | ${(e.curso||'-').padEnd(10)} | ${e.tipo}`)
    })
  }

  console.log("\n✅ ¡Proceso completado!")
}

run()
