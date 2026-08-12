import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: insc, error: err1 } = await supabase.from('inscripciones_comedor').select('*')
  console.log('Inscripciones (ANON KEY):', insc?.length, 'Error:', err1)

  const { data: reg, error: err2 } = await supabase.from('registros_comedor').select('*')
  console.log('Registros (ANON KEY):', reg?.length, 'Error:', err2)
}

check()
