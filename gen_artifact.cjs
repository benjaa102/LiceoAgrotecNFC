const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from('estudiantes')
    .select('nombre, rut, curso, sexo, matricula, direccion')
    .eq('tipo', 'INTERNO')
    .order('curso', {ascending: true})
    .order('nombre', {ascending: true});
    
  if (error) throw error;
  
  let md = '---\n';
  md += 'summary: "Nómina completa de alumnos internos actual"\n';
  md += 'user_facing: true\n';
  md += 'request_feedback: false\n';
  md += '---\n\n';
  md += '# Nómina de Internos 2026\n\n';
  md += `**Total de alumnos internos:** ${data.length}\n\n`;
  md += '| N° | Nombre | RUT | Curso | Sexo | Matrícula | Dirección/Recorrido |\n';
  md += '|---|---|---|---|---|---|---|\n';
  
  data.forEach((s, i) => {
    md += `| ${i+1} | ${s.nombre} | ${s.rut || '-'} | ${s.curso || '-'} | ${s.sexo || '-'} | ${s.matricula || '-'} | ${s.direccion || '-'} |\n`;
  });
  
  fs.writeFileSync('C:/Users/benja/.gemini/antigravity-ide/brain/8a095560-fb54-470c-931b-1a49297d2320/nomina_internos.md', md);
  console.log('Artifact created.');
}
main();
