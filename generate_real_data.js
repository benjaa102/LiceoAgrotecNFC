import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'estudiantes_consolidados.json');
const students = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

let realStudents = students.map((s, index) => {
    let cleanRut = s.rut.replace(/[^0-9Kk]/g, '').toUpperCase();
    let formattedRut = s.rut;
    if (cleanRut.length >= 8) {
        let dv = cleanRut.slice(-1);
        let num = cleanRut.slice(0, -1);
        formattedRut = Number(num).toLocaleString('es-CL') + '-' + dv;
    }

  return {
    id: `e${index + 100}`, // Start from e100 to avoid conflicts if any
    nombre: s.nombre,
    rut: formattedRut,
    curso: s.curso,
    sexo: s.sexo,
    matricula: s.numero_lista ? s.numero_lista.trim() : `2026${String(index + 1).padStart(3, '0')}`,
    tipo: 'INTERNO',
    id_recorrido: null,
    id_credencial: null,
    estado_autorizacion: 'ACTIVO'
  };
});

const fileContent = `// Archivo generado automáticamente a partir de las listas de curso 2026
// Total estudiantes: ${realStudents.length}

export const estudiantesReales = ${JSON.stringify(realStudents, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, 'src', 'data', 'estudiantesReal.js'), fileContent);
console.log('estudiantesReal.js generado exitosamente con ' + realStudents.length + ' estudiantes.');
