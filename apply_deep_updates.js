import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const data = JSON.parse(fs.readFileSync('extracted_students.json', 'utf8'));

function formatRut(rutStr) {
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
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 3) {
    const lastName1 = parts[0];
    const lastName2 = parts[1];
    const rest = parts.slice(2).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    return `${lastName1} ${lastName2}, ${rest}`;
  }
  return fullName;
}

async function run() {
  const { data: dbStudents } = await supabase.from('estudiantes').select('id, rut, matricula, nombre, curso, sexo');
  
  let updates = 0;
  let inserts = 0;
  let deletes = 0;
  
  for (const [cursoRaw, pdfStudents] of Object.entries(data)) {
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
    
    if (!cursoDB) continue;
    
    const dbCourseStudents = dbStudents.filter(s => s.curso === cursoDB);
    let matchedDBIds = new Set();
    
    for (const pdf of pdfStudents) {
      const pdfRutClean = pdf.rut.replace(/[.\-]/g, '').toUpperCase();
      const pdfBody = pdfRutClean.slice(0, -1);
      
      let match = dbCourseStudents.find(db => {
         if (!db.rut) return false;
         const dbr = db.rut.replace(/[.\-]/g, '').toUpperCase();
         return dbr === pdfRutClean || dbr.slice(0, -1) === pdfBody;
      });
      
      if (!match) {
        const parts = pdf.nombres.split(' ');
        const pdfLast1 = parts[0].toUpperCase();
        const pdfLast2 = parts.length > 1 ? parts[1].toUpperCase() : '';
        const pdfFirst = parts.length > 2 ? parts[2].toUpperCase() : '';
        match = dbCourseStudents.find(db => {
           if (!db.nombre) return false;
           const dbn = db.nombre.toUpperCase();
           return dbn.includes(pdfLast1) && (dbn.includes(pdfLast2) || dbn.includes(pdfFirst));
        });
      }
      
      if (match) {
        matchedDBIds.add(match.id);
        const formattedPdfRut = formatRut(pdf.rut);
        const dbRutCleaned = match.rut ? match.rut.trim() : '';
        
        if (dbRutCleaned !== formattedPdfRut || String(match.matricula) !== String(pdf.matricula)) {
          await supabase.from('estudiantes').update({ 
            rut: formattedPdfRut, 
            matricula: pdf.matricula 
          }).eq('id', match.id);
          updates++;
        }
      } else {
        // Insert missing
        await supabase.from('estudiantes').insert({
          id: `e_miss_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          nombre: formatName(pdf.nombres),
          rut: formatRut(pdf.rut),
          curso: cursoDB,
          sexo: pdf.sexo,
          matricula: pdf.matricula,
          tipo: 'EXTERNO'
        });
        inserts++;
      }
    }
    
    // Delete missing in PDF
    const missingInPdf = dbCourseStudents.filter(db => !matchedDBIds.has(db.id));
    for (const db of missingInPdf) {
      await supabase.from('estudiantes').delete().eq('id', db.id);
      deletes++;
    }
  }
  
  console.log(`✅ Applied fixes: ${updates} updated, ${inserts} inserted, ${deletes} deleted (retirados).`);
}

run();
