import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Using service role key to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan las credenciales de Supabase en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Importar los datos reales
const dataPath = path.join(__dirname, 'estudiantes_consolidados.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const estudiantesBase = JSON.parse(rawData);

// Formatear RUTs
const formatRut = (rut) => {
    let clean = rut.replace(/[^0-9Kk]/g, '').toUpperCase();
    if (clean.length >= 8) {
        let dv = clean.slice(-1);
        let num = clean.slice(0, -1);
        return Number(num).toLocaleString('es-CL') + '-' + dv;
    }
    return rut;
};

const estudiantesTransformados = estudiantesBase.map((s, index) => ({
    id: `e${index + 100}`,
    nombre: s.nombre,
    rut: formatRut(s.rut),
    curso: s.curso,
    sexo: s.sexo,
    matricula: s.numero_lista ? String(s.numero_lista).trim() : `2026${String(index + 1).padStart(3, '0')}`,
    tipo: 'INTERNO', // Por defecto todos internos hasta que se asigne lo contrario
    id_recorrido: null,
    estado_autorizacion: 'ACTIVO',
    direccion: null
}));

const recorridos = [
  { id: 'r1', nombre: 'Mashue', destino: 'Mashue', horario_salida: '16:00', estado: 'ACTIVO' },
  { id: 'r2', nombre: 'Futrono - Lago Ranco', destino: 'Futrono - Lago Ranco', horario_salida: '16:00', estado: 'ACTIVO' },
  { id: 'r3', nombre: 'San Pablo', destino: 'San Pablo', horario_salida: '16:00', estado: 'ACTIVO' },
  { id: 'r4', nombre: 'Osorno', destino: 'Osorno', horario_salida: '16:00', estado: 'ACTIVO' },
  { id: 'r5', nombre: 'Daiber, Maitén', destino: 'Daiber, Maitén', horario_salida: '16:00', estado: 'ACTIVO' },
  { id: 'r6', nombre: 'Río Bueno Centro/Pob. (1)', destino: 'Río Bueno Centro y Población', horario_salida: '16:00', estado: 'ACTIVO' },
  { id: 'r7', nombre: 'Río Bueno Centro/Pob. (2)', destino: 'Río Bueno Centro y Población', horario_salida: '16:00', estado: 'ACTIVO' },
  { id: 'r8', nombre: 'Caupolicán, Centro', destino: 'Caupolicán, Centro', horario_salida: '16:00', estado: 'ACTIVO' },
];

const supervisores = [
  { id: 's1', nombre: 'Jacob Caman', rut: '11.111.111-1', cargo: 'Chofer Furgón', id_credencial: null, estado: 'ACTIVO' },
  { id: 's2', nombre: 'Maximiliano Chavarría', rut: '22.222.222-2', cargo: 'Chofer Furgón', id_credencial: null, estado: 'ACTIVO' },
  { id: 's3', nombre: 'Marco Henriquez', rut: '33.333.333-3', cargo: 'Chofer Bus', id_credencial: null, estado: 'ACTIVO' },
  { id: 's4', nombre: 'Jaime Arguelle', rut: '44.444.444-4', cargo: 'Chofer Bus', id_credencial: null, estado: 'ACTIVO' },
  { id: 's5', nombre: 'Carlos Azocar', rut: '55.555.555-5', cargo: 'Chofer Bus', id_credencial: null, estado: 'ACTIVO' },
  { id: 's6', nombre: 'Héctor Yañez', rut: '66.666.666-6', cargo: 'Chofer Bus', id_credencial: null, estado: 'ACTIVO' },
  { id: 's7', nombre: 'Armin Perz', rut: '77.777.777-7', cargo: 'Chofer Bus', id_credencial: null, estado: 'ACTIVO' },
  { id: 's8', nombre: 'Blas Henriquez', rut: '88.888.888-8', cargo: 'Chofer Bus', id_credencial: null, estado: 'ACTIVO' },
];

const buses = [
  { id: 'b1', numero_bus: 'Furgón 1', patente: 'TH-LF-74', id_recorrido: 'r1', id_supervisor: 's1', estado: 'ACTIVO' },
  { id: 'b2', numero_bus: 'Furgón 2', patente: 'TW-RG-86', id_recorrido: 'r2', id_supervisor: 's2', estado: 'ACTIVO' },
  { id: 'b3', numero_bus: 'Bus 1', patente: 'GY-RB-78', id_recorrido: 'r3', id_supervisor: 's3', estado: 'ACTIVO' },
  { id: 'b4', numero_bus: 'Bus 2', patente: 'BY-CY-45', id_recorrido: 'r4', id_supervisor: 's4', estado: 'ACTIVO' },
  { id: 'b5', numero_bus: 'Bus 3', patente: 'YR-54-33', id_recorrido: 'r5', id_supervisor: 's5', estado: 'ACTIVO' },
  { id: 'b6', numero_bus: 'Bus 4', patente: 'FY-BW-40', id_recorrido: 'r6', id_supervisor: 's6', estado: 'ACTIVO' },
  { id: 'b7', numero_bus: 'Bus 5', patente: 'GZ-SP-42', id_recorrido: 'r7', id_supervisor: 's7', estado: 'ACTIVO' },
  { id: 'b8', numero_bus: 'Bus 6', patente: 'GX-BG-75', id_recorrido: 'r8', id_supervisor: 's8', estado: 'ACTIVO' },
];

async function uploadData() {
  console.log('Subiendo Recorridos...');
  await supabase.from('recorridos').upsert(recorridos);
  
  console.log('Subiendo Supervisores (Choferes)...');
  await supabase.from('supervisores').upsert(supervisores);
  
  console.log('Subiendo Buses...');
  await supabase.from('buses').upsert(buses);
  
  console.log(`Subiendo ${estudiantesTransformados.length} estudiantes en lotes...`);
  const BATCH_SIZE = 100;
  for (let i = 0; i < estudiantesTransformados.length; i += BATCH_SIZE) {
      const batch = estudiantesTransformados.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('estudiantes').upsert(batch);
      if (error) {
          console.error(`Error en el lote ${i}:`, error);
      } else {
          console.log(`Lote ${i/BATCH_SIZE + 1} subido con éxito.`);
      }
  }

  console.log('✅ Migración completada. Datos listos en Supabase.');
}

uploadData();
