import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanCourses() {
    const { data: students, error } = await supabase.from('estudiantes').select('id, curso');
    if (error) throw error;
    
    let updates = [];
    for (let s of students) {
        let clean = s.curso.replace(/—.*$/g, '').replace(/✅/g, '').replace(/🆕.*$/g, '').trim();
        
        let parts = clean.split(' ');
        if (parts.length > 1) {
            clean = parts[0] + ' ' + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        } else {
            clean = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        }
        
        if (clean.includes("Básico") || clean.includes("básico")) {
            clean = clean.replace(/básico/i, 'Básico');
        }
        
        // Remove ' —' or anything weird at the end again just in case
        clean = clean.replace(/[^a-zA-Z0-9°áéíóúÁÉÍÓÚ ]/g, '').trim();

        if (clean !== s.curso) {
            updates.push({ id: s.id, curso: clean });
        }
    }
    
    console.log(`Updating ${updates.length} students...`);
    for (let u of updates) {
        await supabase.from('estudiantes').update({ curso: u.curso }).eq('id', u.id);
    }
    console.log("Done!");
}

cleanCourses();
