const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const cursosDir = path.join(__dirname, 'cursos');

async function parseAll() {
  const files = fs.readdirSync(cursosDir).filter(f => f.endsWith('.pdf'));
  
  for (const file of files) {
    const filePath = path.join(cursosDir, file);
    const dataBuffer = fs.readFileSync(filePath);
    
    try {
      const data = await pdf(dataBuffer);
      console.log(`\n=== ${file} ===`);
      
      const lines = data.text.split('\n');
      for (const line of lines) {
        // Look for lines that look like a student entry: N° Lista, Matrícula, Names..., Sexo, Fecha, RUT
        // E.g. "01 24 AMPUERO LEAL DIEGO AGUSTIN H 27/07/2012 24021871-2"
        if (/^\s*\d{2}\s+\d+\s+/.test(line)) {
            console.log(line.trim());
        }
      }
    } catch (err) {
      console.error(`Error with ${file}:`, err);
    }
  }
}

parseAll();
