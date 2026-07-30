const fs = require('fs');
const text = fs.readFileSync('cursos/estadisticas.txt', 'utf8');
const lines = text.split(/\r?\n/);
let internadosEncontrados = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('Internado')) {
    const parts = line.split(/\s{2,}/);
    let lastNamePart = parts[0].trim();
    let extraNames = '';
    
    if (i > 0) {
      const prevLine = lines[i-1];
      if (!prevLine.startsWith(' ') && !prevLine.includes('Internado') && !prevLine.includes('Page') && !prevLine.includes('Generado') && !prevLine.includes('Estudiante')) {
         const prevParts = prevLine.split(/\s{2,}/);
         // If it's a single letter like "C" or "A" it's probably the course letter from the previous student block
         if (prevParts[0].trim().length > 1) {
            extraNames = prevParts[0].trim();
         }
      }
    }
    const fullName = `${lastNamePart} ${extraNames}`.trim();
    internadosEncontrados.push(fullName);
  }
}

console.log('Total internados:', internadosEncontrados.length);
fs.writeFileSync('cursos/internados_extraidos.txt', internadosEncontrados.join('\n'));
