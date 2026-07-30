import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const brainDir = path.join(__dirname, '..', '..', 'brain', '019bfa4c-b74c-46e3-8940-e74e2d9adb72');

const files = [
  'analisis_listas_cursos.md',
  'analisis_1ro_medio.md',
  'revision_final_listas.md',
  'analisis_2do_medio.md',
  'analisis_3ro_medio.md',
  'analisis_4to_medio.md'
];

let allStudents = [];
let rutSet = new Set();

function parseMarkdownTable(content, courseName) {
  // Find the "### ✅ Activos" section for this course
  const courseSectionRegex = new RegExp(`## ${courseName}[\\s\\S]*?### ✅ Activos.*?\\n([\\s\\S]*?)(?:\\n## |$)`, 'i');
  const courseMatch = content.match(courseSectionRegex);
  
  if (!courseMatch) return;

  const tableText = courseMatch[1];
  const lines = tableText.split('\n').filter(l => l.trim().startsWith('|'));
  
  // Skip header and separator
  if (lines.length > 2) {
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split('|').map(c => c.trim());
      if (cols.length >= 4) {
        let nombre = cols[2]; 
        let rut = cols[3];    
        let s = cols[4];      
        
        if (nombre && rut && rut !== 'RUT' && rut !== '---' && !nombre.includes('Nombre')) {
            nombre = nombre.replace(/✅/g, '').replace(/\*/g, '').trim();
            rut = rut.replace(/✅/g, '').replace(/\(confirmar.*?\)/g, '').replace(/\?/g, '').trim();
            rut = rut.replace(/[^0-9Kk\-]/g, '').toUpperCase();

            if (nombre.length > 5 && rut.length >= 8) {
                allStudents.push({
                    nombre,
                    rut,
                    curso: courseName.replace(/✅/g, '').trim(),
                    sexo: s ? s.replace(/✅/g, '').trim() : ''
                });
            }
        }
      }
    }
  }
}

// Read and parse files
files.forEach(filename => {
  const filepath = path.join(brainDir, filename);
  if (fs.existsSync(filepath)) {
    const content = fs.readFileSync(filepath, 'utf-8');
    
    const lines = content.split('\n');
    let currentCourse = null;
    let inActivos = false;
    
    for (let line of lines) {
      if (line.startsWith('## ') && !line.includes('RESUMEN') && !line.includes('TOTAL') && !line.includes('Confirmar')) {
        currentCourse = line.replace('##', '').replace(/✅/g, '').trim();
        inActivos = false;
        console.log(`Found course: ${currentCourse}`);
      } else if (line.startsWith('### ✅ Activos') || line.includes('Activos (') || line.includes('INCLUIR') || line.includes('Matriculados nuevos')) {
        inActivos = true;
        console.log(`  -> Activos section found`);
      } else if (inActivos && line.startsWith('|') && !line.includes('| Nombre |') && !line.includes('|---|') && !line.includes('| # |')) {
        const cols = line.split('|').map(c => c.trim());
        if (cols.length >= 4) {
          let numero_lista = cols[1]; // Column 1 is N° Lista
          let nombre = cols[2];
          let rut = cols[3];
          let s = cols[4];
          
          if (nombre && rut && !nombre.includes('Apellidos/nombre no legible')) {
            nombre = nombre.replace(/✅/g, '').replace(/\*/g, '').trim();
            rut = rut.replace(/✅/g, '').replace(/\(confirmar.*?\)/g, '').replace(/\?/g, '').trim();
            rut = rut.replace(/[^0-9Kk\-]/g, '').toUpperCase();
            
            // Clean numero_lista
            numero_lista = numero_lista.replace(/[^0-9]/g, '');

            if (nombre.length > 5 && rut.length >= 8 && !rutSet.has(rut)) {
                rutSet.add(rut);
                allStudents.push({
                    numero_lista,
                    nombre,
                    rut,
                    curso: currentCourse,
                    sexo: s ? s.replace(/✅/g, '').trim() : ''
                });
            }
          }
        }
      } else if (inActivos && (line.startsWith('## ') || line.startsWith('### ❌'))) {
        inActivos = false;
      }
    }
  }
});

console.log(`Total students parsed: ${allStudents.length}`);
fs.writeFileSync(path.join(__dirname, 'estudiantes_consolidados.json'), JSON.stringify(allStudents, null, 2));
console.log('Saved to estudiantes_consolidados.json');
