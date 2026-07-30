import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const data = JSON.parse(fs.readFileSync('extracted_students.json', 'utf8'));
const list1C = data['cursos\\\\lista_curso_1c_gastronomia'] || data['cursos\\lista_curso_1c_gastronomia'];

function formatRut(rutStr) {
  // e.g. "24021871-2" -> "24.021.871-2"
  const clean = rutStr.replace(/[.\-]/g, '').toUpperCase();
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let formattedBody = '';
  for (let i = 0; i < body.length; i++) {
    if (i > 0 && (body.length - i) % 3 === 0) formattedBody += '.';
    formattedBody += body[i];
  }
  return `${formattedBody}-${dv}`;
}

function formatName(fullName) {
  // "PATERNO MATERNO NOMBRES" -> "PATERNO MATERNO, Nombres..."
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 3) {
    const lastName1 = parts[0];
    const lastName2 = parts[1];
    const rest = parts.slice(2).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    return `${lastName1} ${lastName2}, ${rest}`;
  }
  return fullName; // fallback
}

async function run() {
  const toInsert = list1C.map((s, i) => {
    return {
      id: `e1c_${Date.now()}_${i}`,
      nombre: formatName(s.nombres),
      rut: formatRut(s.rut),
      curso: '1°C',
      sexo: s.sexo,
      matricula: s.matricula,
      tipo: 'EXTERNO' // We can set this to EXTERNO by default until the user provides the internal/external list
    };
  });

  const { error } = await supabase.from('estudiantes').insert(toInsert);
  
  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log(`✅ Successfully inserted ${toInsert.length} students into 1°C!`);
  }
}

run();
