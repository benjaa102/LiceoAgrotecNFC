import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const data = JSON.parse(fs.readFileSync('extracted_students.json', 'utf8'));

function verificarRUT(rut) {
  const clean = rut.replace(/[.\-]/g, '').toUpperCase();
  const cuerpo = clean.slice(0, -1);
  const dvProvisto = clean.slice(-1);
  
  let sum = 0;
  let mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    sum += parseInt(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  
  const remainder = 11 - (sum % 11);
  let dvCalculado;
  if (remainder === 11) dvCalculado = '0';
  else if (remainder === 10) dvCalculado = 'K';
  else dvCalculado = String(remainder);
  
  return { rut, dvProvisto, dvCalculado, valido: dvProvisto === dvCalculado };
}

const mascNames = ['VÍCTOR', 'CRISTIAN', 'YOJAN', 'MAXIMILIANO', 'CARLOS', 'EDGARDO', 'BENJAMÍN', 'MATIAS', 'ALEXANDER', 'CRISTÓBAL', 'MARTÍN', 'AXEL', 'DARKO', 'RICARDO', 'LUCAS', 'CAMILO', 'FERNANDO', 'GASPAR', 'MIGUEL', 'FELIPE', 'AMARO', 'BRAYAN', 'CRISTOPHER', 'DEVIN', 'GONZALO', 'ESTEBAN', 'DIEGO', 'JUAN', 'PEDRO', 'JOAQUÍN', 'PABLO', 'IGNACIO', 'SEBASTIÁN', 'TOMAS', 'NICOLAS', 'GABRIEL', 'EMILIO', 'RENATO', 'VICENTE', 'MARCO', 'MÁXIMO', 'ALAN', 'ISAAC', 'DARIO', 'BASTIÁN', 'JAVIER', 'LUIS', 'JOSÉ', 'JORGE'];
const femNames = ['MARÍA', 'ANTONIA', 'CAMILA', 'VALENTINA', 'SOFÍA', 'ISIDORA', 'MARTINA', 'JAVIERA', 'FLORENCIA', 'EMILIA', 'JULIETA', 'ISABELLA', 'TRINIDAD', 'AGUSTINA', 'JOSEFA', 'AMANDA', 'DANIELA', 'CATALINA', 'CONSTANZA', 'PAULA', 'ANA', 'MACARENA', 'CAROLINA', 'ANDREA', 'BELÉN', 'ROCÍO', 'DAYANNE', 'ANGELINA'];

async function run() {
  const { data: dbStudents } = await supabase.from('estudiantes').select('id, rut, matricula, nombre, curso, sexo');
  
  let report = `# 📋 Análisis Masivo de Cursos (9 listas nuevas)\n\nHe analizado automáticamente los 9 PDFs de la carpeta \`cursos/\` y sincronizado sus matrículas con la base de datos oficial. Aquí tienes el resumen de hallazgos.\n\n`;
  let totalUpdated = 0;
  
  for (const [cursoRaw, students] of Object.entries(data)) {
    // Determine the DB equivalent of the course name
    // e.g. "lista_curso_2a_agropecuaria" -> "2°A"
    let cursoDB = '';
    if (cursoRaw.includes('1a')) cursoDB = '1°A';
    if (cursoRaw.includes('1b')) cursoDB = '1°B';
    if (cursoRaw.includes('1c')) cursoDB = '1°C';
    if (cursoRaw.includes('1d')) cursoDB = '1°D';
    if (cursoRaw.includes('2a')) cursoDB = '2°A';
    if (cursoRaw.includes('2b')) cursoDB = '2°B';
    if (cursoRaw.includes('2c')) cursoDB = '2°C';
    if (cursoRaw.includes('2d')) cursoDB = '2°D';
    if (cursoRaw.includes('3a')) cursoDB = '3°A';
    if (cursoRaw.includes('3b')) cursoDB = '3°B';
    if (cursoRaw.includes('3c')) cursoDB = '3°C';
    if (cursoRaw.includes('3d')) cursoDB = '3°D';
    if (cursoRaw.includes('8_basico')) cursoDB = '8° Básico';
    
    report += `## 📚 ${cursoDB} (${cursoRaw})\n`;
    report += `Total en lista PDF: ${students.length}\n\n`;
    
    let invalidos = [];
    let sexoSospechoso = [];
    let updatedMatriculas = 0;
    
    for (const s of students) {
      // 1. RUT Check
      // skip IPE for validation if we want, but let's check it anyway. IPEs start with 100M
      const isIPE = s.rut.startsWith('100');
      if (!isIPE) {
        const res = verificarRUT(s.rut);
        if (!res.valido) {
          invalidos.push({ ...s, expected: res.dvCalculado });
        }
      }
      
      // 2. Sex Check
      const firstNames = s.nombres.split(' ');
      const prim = firstNames[0].toUpperCase();
      if (s.sexo === 'M' && mascNames.includes(prim)) {
        sexoSospechoso.push(s);
      }
      if (s.sexo === 'H' && femNames.includes(prim)) {
        sexoSospechoso.push(s);
      }
      
      // 3. Database Update
      const normRut = s.rut.replace(/[.\-]/g, '').toUpperCase();
      const bodyRut = normRut.slice(0, -1);
      
      const dbMatch = dbStudents.find(db => {
         if (db.curso !== cursoDB) return false;
         if (!db.rut) return false;
         const dbr = db.rut.replace(/[.\-]/g, '').toUpperCase();
         return dbr === normRut || dbr.slice(0, -1) === bodyRut;
      });
      
      if (dbMatch) {
        if (dbMatch.matricula !== s.matricula) {
          await supabase.from('estudiantes').update({ matricula: s.matricula }).eq('id', dbMatch.id);
          updatedMatriculas++;
          totalUpdated++;
        }
      }
    }
    
    if (invalidos.length > 0) {
      report += `### 🔴 RUTs Inválidos en el PDF\n| N° Lista | Nombre | RUT | DV Esperado |\n|---|---|---|---|\n`;
      invalidos.forEach(i => {
        report += `| ${i.lista} | ${i.nombres} | ${i.rut} | **${i.expected}** |\n`;
      });
      report += `\n`;
    } else {
      report += `- ✅ Todos los RUTs son válidos.\n`;
    }
    
    if (sexoSospechoso.length > 0) {
      report += `### ⚠️ Posibles errores de sexo en PDF\n| N° Lista | Nombre | Sexo Impreso |\n|---|---|---|\n`;
      sexoSospechoso.forEach(i => {
        report += `| ${i.lista} | ${i.nombres} | ${i.sexo} |\n`;
      });
      report += `*(Nota: Se verificó el primer nombre, si es un nombre neutro u ortografía distinta, ignorar)*\n\n`;
    } else {
      report += `- ✅ Sin errores evidentes de sexo.\n`;
    }
    
    report += `- 🔄 **${updatedMatriculas}** matrículas actualizadas en la base de datos para coincidir con la lista.\n\n`;
    report += `---\n\n`;
  }
  
  report += `\n**Total Matrículas Sincronizadas:** ${totalUpdated}`;
  
  fs.writeFileSync('C:/Users/benja/.gemini/antigravity-ide/brain/019bfa4c-b74c-46e3-8940-e74e2d9adb72/analisis_masivo_9cursos.md', report);
  console.log("Analysis and update complete.");
}

run();
