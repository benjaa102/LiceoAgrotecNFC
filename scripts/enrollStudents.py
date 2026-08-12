import os
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
svc_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, svc_key)

print("Iniciando actualizacion masiva...")

# 1. Update all students to ACTIVO
print("\n1. Activando a todos los estudiantes...")
# Get students that are not active
res_inactivos = supabase.table('estudiantes').select('id, nombre, estado_autorizacion').neq('estado_autorizacion', 'ACTIVO').execute()
if res_inactivos.data:
    print(f"  Se encontraron {len(res_inactivos.data)} estudiantes inactivos. Activando...")
    for est in res_inactivos.data:
        supabase.table('estudiantes').update({'estado_autorizacion': 'ACTIVO'}).eq('id', est['id']).execute()
    print("  Todos los estudiantes ahora estan activos.")
else:
    print("  Todos los estudiantes ya estaban activos.")

# Get all students to enroll them
res_estudiantes = supabase.table('estudiantes').select('id, tipo, nombre').execute()
estudiantes = res_estudiantes.data
print(f"\n2. Inscribiendo a {len(estudiantes)} estudiantes en el comedor...")

# Get existing enrollments to avoid duplicates
res_insc = supabase.table('inscripciones_comedor').select('id_estudiante, tipo_servicio').execute()
existing_insc = set((r['id_estudiante'], r['tipo_servicio']) for r in res_insc.data)

new_enrollments = []
for est in estudiantes:
    servicios_a_inscribir = ['DESAYUNO', 'ALMUERZO']
    if est.get('tipo') == 'INTERNO':
        servicios_a_inscribir.append('CENA')
        
    for servicio in servicios_a_inscribir:
        if (est['id'], servicio) not in existing_insc:
            new_enrollments.append({
                'id': str(uuid.uuid4()),
                'id_estudiante': est['id'],
                'tipo_servicio': servicio,
                'activo': True
            })

# Batch insert in chunks of 500
if new_enrollments:
    print(f"  Preparando {len(new_enrollments)} nuevas inscripciones...")
    chunk_size = 500
    for i in range(0, len(new_enrollments), chunk_size):
        chunk = new_enrollments[i:i + chunk_size]
        try:
            supabase.table('inscripciones_comedor').insert(chunk).execute()
            print(f"  Insertados {i + len(chunk)} / {len(new_enrollments)}...")
        except Exception as e:
            print(f"  Error insertando chunk: {e}")
    print("  Inscripciones completadas con exito.")
else:
    print("  Todos los estudiantes ya estaban inscritos correctamente.")

# Resumen final
res_final = supabase.table('inscripciones_comedor').select('id', count='exact').execute()
print(f"\nResumen: Hay {len(res_final.data)} inscripciones activas en total en el sistema.")
