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

async function run() {
  const { data: dbStudents } = await supabase.from('estudiantes').select('id, rut, matricula, nombre, curso, sexo');
  
  let report = `# 🔍 Análisis Profundo DB vs PDFs\n\n`;
  
  const updatesNeeded = [];
  
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
    
    report += `## ${cursoDB}\n`;
    
    let matchedDBIds = new Set();
    
    for (const pdf of pdfStudents) {
      const pdfRutClean = pdf.rut.replace(/[.\-]/g, '').toUpperCase();
      const pdfBody = pdfRutClean.slice(0, -1);
      
      // Try to find by RUT body or exact RUT
      let match = dbCourseStudents.find(db => {
         if (!db.rut) return false;
         const dbr = db.rut.replace(/[.\-]/g, '').toUpperCase();
         return dbr === pdfRutClean || dbr.slice(0, -1) === pdfBody;
      });
      
      // If not found by RUT, try to find by Name strictly
      if (!match) {
        const parts = pdf.nombres.split(' ');
        const pdfLast1 = parts[0].toUpperCase();
        const pdfLast2 = parts.length > 1 ? parts[1].toUpperCase() : '';
        const pdfFirst = parts.length > 2 ? parts[2].toUpperCase() : '';
        match = dbCourseStudents.find(db => {
           if (!db.nombre) return false;
           const dbn = db.nombre.toUpperCase();
           // Require at least two matching parts to avoid false positives
           return dbn.includes(pdfLast1) && (dbn.includes(pdfLast2) || dbn.includes(pdfFirst));
        });
      }
      
      if (match) {
        matchedDBIds.add(match.id);
        
        let diffs = [];
        const formattedPdfRut = formatRut(pdf.rut);
        const dbRutCleaned = match.rut ? match.rut.trim() : '';
        
        if (dbRutCleaned !== formattedPdfRut) {
           diffs.push(`RUT: DB[${dbRutCleaned}] -> PDF[${formattedPdfRut}]`);
        }
        if (String(match.matricula) !== String(pdf.matricula)) {
           diffs.push(`MATRICULA: DB[${match.matricula}] -> PDF[${pdf.matricula}]`);
        }
        
        if (diffs.length > 0) {
          report += `- 🔄 **${pdf.nombres}**: ${diffs.join(' | ')}\n`;
          updatesNeeded.push({
            id: match.id,
            rut: formattedPdfRut,
            matricula: pdf.matricula
          });
        }
      } else {
        report += `- ❌ **Falta en DB**: ${pdf.nombres} (RUT: ${pdf.rut}, Matrícula: ${pdf.matricula})\n`;
      }
    }
    
    const missingInPdf = dbCourseStudents.filter(db => !matchedDBIds.has(db.id));
    if (missingInPdf.length > 0) {
      report += `\n**En DB pero no en PDF (¿Retirados?):**\n`;
      missingInPdf.forEach(db => {
        report += `- ❓ ${db.nombre} (RUT: ${db.rut}, Mat: ${db.matricula})\n`;
      });
    }
    
    report += `\n---\n`;
  }
  
  fs.writeFileSync('C:/Users/benja/.gemini/antigravity-ide/brain/019bfa4c-b74c-46e3-8940-e74e2d9adb72/analisis_profundo_rut_matricula.md', report);
  fs.writeFileSync('C:/Users/benja/.gemini/antigravity-ide/brain/019bfa4c-b74c-46e3-8940-e74e2d9adb72/scratch/updates_needed.json', JSON.stringify(updatesNeeded, null, 2));
  console.log(`Report generated. Found ${updatesNeeded.length} discrepancies to fix.`);
}

run();
