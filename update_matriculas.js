import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const est4C = [
  { mat: '218', rut: '22955720-3' }, // Fixed typo in transcription
  { mat: '219', rut: '22988467-0' },
  { mat: '220', rut: '22704809-3' },
  { mat: '221', rut: '22876882-0' },
  { mat: '222', rut: '23036184-3' },
  { mat: '223', rut: '22759629-5' }, // Fixed typo
  { mat: '224', rut: '23049948-9' },
  { mat: '225', rut: '23049935-7' },
  { mat: '226', rut: '23057275-5' },
  { mat: '227', rut: '22733129-1' }, // Fixed typo
  { mat: '228', rut: '23069668-3' },
  { mat: '229', rut: '22783818-3' },
  { mat: '230', rut: '22950383-9' },
  { mat: '231', rut: '23060109-7' },
  { mat: '232', rut: '22997917-5' },
  { mat: '233', rut: '22914370-0' },
  { mat: '234', rut: '22826881-K' },
  { mat: '235', rut: '22981443-5' },
  { mat: '236', rut: '22991564-9' },
  { mat: '238', rut: '23012249-6' },
  { mat: '239', rut: '22802480-5' },
  { mat: '240', rut: '22918832-1' },
  { mat: '241', rut: '22842107-3' },
  { mat: '242', rut: '22731577-6' },
  { mat: '243', rut: '22916442-2' },
  { mat: '244', rut: '22873858-1' },
  { mat: '245', rut: '22855233-K' },
  { mat: '246', rut: '22976115-3' },
  { mat: '247', rut: '22846902-5' },
  { mat: '248', rut: '22849499-2' },
  { mat: '249', rut: '22958667-K' },
  { mat: '250', rut: '22810199-9' },
  { mat: '251', rut: '22571866-0' },
  { mat: '252', rut: '22937119-3' },
  { mat: '253', rut: '22720862-7' },
  { mat: '254', rut: '22788412-6' },
  { mat: '402', rut: '22876109-5' }, // Fixed typo
  { mat: '255', rut: '23058783-3' },
  { mat: '256', rut: '22792713-5' },
  { mat: '257', rut: '22927531-3' },
  { mat: '258', rut: '22932401-2' },
  { mat: '259', rut: '22841283-K' },
  { mat: '260', rut: '22832303-9' },
  { mat: '814', rut: '22834721-3' }
]

const est4D = [
  { mat: '261', rut: '22736650-8' },
  { mat: '262', rut: '22860952-8' },
  { mat: '263', rut: '22855624-6' },
  { mat: '264', rut: '22982064-8' },
  { mat: '265', rut: '22477418-4' },
  { mat: '266', rut: '23001215-6' },
  { mat: '801', rut: '22325390-3' },
  { mat: '268', rut: '22933782-3' },
  { mat: '269', rut: '22909305-3' },
  { mat: '270', rut: '22684067-2' },
  { mat: '271', rut: '22859281-1' },
  { mat: '272', rut: '22890893-2' },
  { mat: '273', rut: '22886450-1' },
  { mat: '274', rut: '22978234-7' },
  { mat: '275', rut: '22982540-2' },
  { mat: '276', rut: '22919084-9' },
  { mat: '277', rut: '22799538-6' },
  { mat: '278', rut: '22964766-0' },
  { mat: '279', rut: '22766051-1' },
  { mat: '280', rut: '22738961-3' },
  { mat: '281', rut: '22889640-3' },
  { mat: '282', rut: '22849537-9' },
  { mat: '283', rut: '22909770-9' },
  { mat: '284', rut: '22803181-K' },
  { mat: '285', rut: '22811285-2' },
  { mat: '286', rut: '22821517-1' },
  { mat: '287', rut: '22995725-2' },
  { mat: '288', rut: '23035686-6' },
  { mat: '289', rut: '22814366-9' },
  { mat: '290', rut: '22845309-9' },
  { mat: '291', rut: '23059603-4' },
  { mat: '292', rut: '22802163-6' },
  { mat: '293', rut: '22903433-2' },
  { mat: '294', rut: '22995407-5' },
  { mat: '295', rut: '22710178-4' },
  { mat: '296', rut: '22857130-K' },
  { mat: '297', rut: '22758327-4' },
  { mat: '298', rut: '22997812-8' },
  { mat: '299', rut: '23067443-4' },
  { mat: '300', rut: '22830830-7' },
  { mat: '301', rut: '23062050-4' },
  { mat: '302', rut: '23030975-2' },
  { mat: '303', rut: '22848330-3' },
  { mat: '304', rut: '22477682-9' },
  { mat: '305', rut: '23056844-8' }
]

const est4A = [
  { mat: '313', rut: '23057933-4' },
  { mat: '314', rut: '22829503-5' },
  { mat: '315', rut: '22929736-8' },
  { mat: '316', rut: '22910846-8' },
  { mat: '317', rut: '22941430-5' },
  { mat: '318', rut: '22784787-5' },
  { mat: '319', rut: '23001633-K' },
  { mat: '320', rut: '22764637-3' },
  { mat: '321', rut: '22806642-7' },
  { mat: '322', rut: '22818615-5' },
  { mat: '323', rut: '23052756-3' },
  { mat: '324', rut: '22725934-5' },
  { mat: '325', rut: '22693111-2' },
  { mat: '326', rut: '22616560-6' },
  { mat: '327', rut: '22887610-0' },
  { mat: '328', rut: '23022713-6' },
  { mat: '329', rut: '22853016-6' },
  { mat: '330', rut: '22854908-8' },
  { mat: '331', rut: '22989564-8' },
  { mat: '332', rut: '22939337-5' },
  { mat: '333', rut: '22957121-4' },
  { mat: '334', rut: '22935016-1' },
  { mat: '335', rut: '22917477-0' },
  { mat: '336', rut: '22886515-0' }, // Image had -0, DB has -0
  { mat: '337', rut: '22930151-9' },
  { mat: '338', rut: '22728859-0' },
  { mat: '339', rut: '22835414-7' },
  { mat: '340', rut: '22955749-1' },
  { mat: '341', rut: '23012916-9' },
  { mat: '342', rut: '22946979-7' },
  { mat: '343', rut: '22400770-1' },
  { mat: '344', rut: '22897834-5' },
  { mat: '345', rut: '22833037-K' },
  { mat: '346', rut: '100559598-K' },
  { mat: '347', rut: '22821313-6' },
  { mat: '348', rut: '22962914-K' },
  { mat: '367', rut: '22839107-7' },
  { mat: '390', rut: '22751171-0' },
  { mat: '394', rut: '22872403-3' }
]

const est7B = [
  { mat: '2', rut: '24529845-5' },
  { mat: '3', rut: '24291442-2' },
  { mat: '4', rut: '24302905-8' },
  { mat: '5', rut: '24292832-6' },
  { mat: '6', rut: '24427751-9' },
  { mat: '7', rut: '24183972-9' },
  { mat: '8', rut: '24531611-9' },
  { mat: '9', rut: '24355633-3' },
  { mat: '11', rut: '24613417-0' },
  { mat: '12', rut: '24431743-6' },
  { mat: '13', rut: '24311011-4' },
  { mat: '14', rut: '24505073-9' },
  { mat: '16', rut: '24384372-3' },
  { mat: '17', rut: '24422955-7' },
  { mat: '18', rut: '24492011-K' },
  { mat: '19', rut: '24491970-7' },
  { mat: '20', rut: '24558994-8' },
  { mat: '21', rut: '24312616-9' },
  { mat: '22', rut: '24526980-3' },
  { mat: '23', rut: '27831265-8' },
  { mat: '69', rut: '23762678-8' },
  { mat: '70', rut: '24471726-8' },
  { mat: '71', rut: '24471740-3' },
  { mat: '72', rut: '24394559-3' },
  { mat: '247', rut: '25797003-5' },
  { mat: '251', rut: '24261204-3' },
  { mat: '252', rut: '24424531-5' },
  { mat: '81', rut: '24375702-9' }
]

const allStudents = [...est4C, ...est4D, ...est4A, ...est7B]

function normalizeRUT(rut) {
  return rut.replace(/[.\-]/g, '').toUpperCase()
}

async function updateDB() {
  const { data: dbStudents, error } = await supabase.from('estudiantes').select('id, rut, matricula, nombre, curso')
  
  if (error) {
    console.error('Error fetching students:', error)
    return
  }

  let updatedCount = 0
  let notFoundCount = 0

  for (const s of allStudents) {
    const normRut = normalizeRUT(s.rut)
    // In db, some RUTs might have correct DV that differs from image, so let's match just the body if needed, or normalize DB rut
    const dbMatch = dbStudents.find(db => normalizeRUT(db.rut) === normRut)
    
    if (dbMatch) {
      if (dbMatch.matricula !== s.mat) {
        const { error: updErr } = await supabase.from('estudiantes').update({ matricula: s.mat }).eq('id', dbMatch.id)
        if (updErr) {
          console.error(`Failed to update ${dbMatch.nombre}:`, updErr)
        } else {
          updatedCount++
          console.log(`Updated ${dbMatch.nombre} (${dbMatch.curso}) -> Matrícula: ${s.mat}`)
        }
      }
    } else {
      // Try matching body only because of DV fixes
      const body = normRut.slice(0, -1)
      const dbMatchBody = dbStudents.find(db => normalizeRUT(db.rut).slice(0, -1) === body)
      if (dbMatchBody) {
        if (dbMatchBody.matricula !== s.mat) {
          const { error: updErr } = await supabase.from('estudiantes').update({ matricula: s.mat }).eq('id', dbMatchBody.id)
          if (updErr) {
            console.error(`Failed to update ${dbMatchBody.nombre}:`, updErr)
          } else {
            updatedCount++
            console.log(`Updated (by body) ${dbMatchBody.nombre} (${dbMatchBody.curso}) -> Matrícula: ${s.mat}`)
          }
        }
      } else {
        console.log(`⚠️ Not found in DB: RUT ${s.rut}`)
        notFoundCount++
      }
    }
  }

  console.log(`\n✅ Done! Updated ${updatedCount} records. Not found: ${notFoundCount}.`)
}

updateDB()
