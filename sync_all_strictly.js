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

const mapCourseToDB = (raw) => {
  if (raw.includes('1a')) return '1°A';
  if (raw.includes('1b')) return '1°B';
  if (raw.includes('1c')) return '1°C';
  if (raw.includes('1d')) return '1°D';
  if (raw.includes('2a')) return '2°A';
  if (raw.includes('2b')) return '2°B';
  if (raw.includes('2c')) return '2°C';
  if (raw.includes('2d')) return '2°D';
  if (raw.includes('3a')) return '3°A';
  if (raw.includes('3b')) return '3°B';
  if (raw.includes('3c')) return '3°C';
  if (raw.includes('3d')) return '3°D';
  if (raw.includes('4a')) return '4°A';
  if (raw.includes('4b')) return '4°B';
  if (raw.includes('4c')) return '4°C';
  if (raw.includes('4d')) return '4°D';
  if (raw.includes('7_basico')) return '7° Básico';
  if (raw.includes('8_basico')) return '8° Básico';
  return '';
};

async function run() {
  const { data: dbStudents } = await supabase.from('estudiantes').select('id, rut, matricula, nombre, curso, sexo, tipo');
  
  let updates = 0;
  let inserts = 0;
  let deletes = 0;
  
  for (const [cursoRaw, pdfStudents] of Object.entries(data)) {
    const cursoDB = mapCourseToDB(cursoRaw);
    if (!cursoDB) continue;
    
    let dbCourseStudents = dbStudents.filter(s => s.curso === cursoDB);
    let matchedDBIds = new Set();
    
    for (const pdf of pdfStudents) {
      const pdfRutClean = pdf.rut.replace(/[.\-]/g, '').toUpperCase();
      const pdfBody = pdfRutClean.slice(0, -1);
      
      let match = dbCourseStudents.find(db => {
         if (matchedDBIds.has(db.id)) return false;
         if (!db.rut) return false;
         const dbr = db.rut.replace(/[.\-]/g, '').toUpperCase();
         return dbr === pdfRutClean || dbr.slice(0, -1) === pdfBody;
      });
      
      if (!match) {
        match = dbCourseStudents.find(db => {
           if (matchedDBIds.has(db.id)) return false;
           if (!db.nombre) return false;
           // We use strict formatName to check
           return db.nombre.toUpperCase().trim() === pdf.nombres.toUpperCase().trim() ||
                  db.nombre === formatName(pdf.nombres);
        });
      }
      
      if (match) {
        matchedDBIds.add(match.id);
        const formattedPdfRut = formatRut(pdf.rut);
        const formattedPdfName = formatName(pdf.nombres);
        
        const dbRut = match.rut ? match.rut.trim() : '';
        const dbMat = match.matricula ? String(match.matricula) : '';
        const pdfMat = String(pdf.matricula);
        
        if (dbRut !== formattedPdfRut || dbMat !== pdfMat || match.nombre !== formattedPdfName || match.sexo !== pdf.sexo) {
          await supabase.from('estudiantes').update({ 
            rut: formattedPdfRut, 
            matricula: pdf.matricula,
            nombre: formattedPdfName,
            sexo: pdf.sexo
          }).eq('id', match.id);
          updates++;
        }
      } else {
        // Insert missing
        await supabase.from('estudiantes').insert({
          id: `e_pdf_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
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
  
  console.log(`✅ Strict Sync Complete: ${updates} updated, ${inserts} inserted, ${deletes} deleted.`);
  
  const { count } = await supabase.from('estudiantes').select('*', { count: 'exact', head: true });
  console.log(`Final DB Count: ${count}`);
}

run();
