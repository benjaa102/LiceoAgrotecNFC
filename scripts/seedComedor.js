import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Fetching students...')
  const { data: students } = await supabase.from('estudiantes').select('*').limit(15)
  if (!students || students.length === 0) return console.log('No students found.')

  console.log(`Enrolling ${students.length} students in ALMUERZO...`)
  
  // Clear old test data for clean slate
  await supabase.from('inscripciones_comedor').delete().eq('tipo_servicio', 'ALMUERZO')
  await supabase.from('registros_comedor').delete().eq('tipo_servicio', 'ALMUERZO')

  const enrollments = students.map(s => ({
    id_estudiante: s.id,
    tipo_servicio: 'ALMUERZO',
    activo: true
  }))

  const { error: insErr } = await supabase.from('inscripciones_comedor').insert(enrollments)
  if (insErr) return console.error('Error in enrollments:', insErr)

  console.log('Generating fake attendance records for Aug 3, Aug 4, and Aug 5...')
  
  const dates = ['2026-08-03', '2026-08-04', '2026-08-05']
  const methods = ['NFC', 'MANUAL']
  const records = []

  students.forEach(s => {
    dates.forEach(date => {
      // 80% chance to attend
      if (Math.random() > 0.2) {
        records.push({
          id: 'test_' + Math.random().toString(36).substr(2, 9) + Date.now(),
          id_estudiante: s.id,
          tipo_servicio: 'ALMUERZO',
          fecha: date,
          hora: '13:00:00',
          metodo: methods[Math.floor(Math.random() * methods.length)]
        })
      }
    })
  })

  const { error: regErr } = await supabase.from('registros_comedor').insert(records)
  if (regErr) return console.error('Error in records:', regErr)

  console.log(`Successfully inserted ${records.length} attendance records.`)
}

seed()
