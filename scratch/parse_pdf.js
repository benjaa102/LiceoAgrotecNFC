const fs = require('fs');

const text = fs.readFileSync('cursos/estadisticas.txt', 'utf8');
const lines = text.split(/\r?\n/);
console.log('Total lines:', lines.length);

let totalEstudiantes = 0;
let internadosEncontrados = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Extraer el nombre principal de la línea que contiene "Internado"
  if (line.includes('Internado')) {
    const parts = line.split(/\s{2,}/); // Dividir por 2 o más espacios
    let lastNamePart = parts[0].trim();
    
    // Buscar si la línea anterior tiene el nombre(s) adicional(es)
    let extraNames = '';
    if (i > 0) {
      const prevLine = lines[i-1];
      // Si la línea anterior no empieza con espacios y no tiene "Internado", 
      // podría contener el primer nombre (o nombres)
      if (!prevLine.startsWith(' ') && !prevLine.includes('Internado') && !prevLine.includes('Page') && !prevLine.includes('Generado')) {
         const prevParts = prevLine.split(/\s{2,}/);
         extraNames = prevParts[0].trim();
      }
    }
    
    const fullName = `${lastNamePart} ${extraNames}`.trim();
    internadosEncontrados.push(fullName);
  }
}

console.log('Total internados listados:', internadosEncontrados.length);
console.log(internadosEncontrados.slice(0, 10));

// Escribir a un archivo para verlo mejor
fs.writeFileSync('cursos/internados_extraidos.txt', internadosEncontrados.join('\n'));
