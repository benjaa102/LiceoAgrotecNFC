import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanCoursesAgain() {
    const { data: students, error } = await supabase.from('estudiantes').select('id, curso');
    if (error) throw error;
    
    let updates = [];
    for (let s of students) {
        // Remover "Agropecuaria" y "Gastronomía"
        let clean = s.curso.replace(/Agropecuaria/gi, '').replace(/Gastronomía/gi, '').trim();
        
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

cleanCoursesAgain();
