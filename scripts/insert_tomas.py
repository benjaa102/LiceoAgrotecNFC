import os
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
svc_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, svc_key)

student_id = f"e_{uuid.uuid4().hex[:8]}"

new_student = {
    'id': student_id,
    'nombre': 'ULLOA PICHICONA, Tómas Ignacio',
    'rut': '23.945.620-0',
    'curso': '1°C',
    'sexo': 'H',
    'matricula': '999',  # Default since we don't have it
    'tipo': 'EXTERNO',
    'estado_autorizacion': 'ACTIVO',
    'direccion': 'Sin registro'
}

print("Insertando a Tómas Ignacio Ulloa Pichicona...")
try:
    # 1. Check if he exists by RUT just in case
    check = supabase.table('estudiantes').select('*').eq('rut', '23.945.620-0').execute()
    if check.data:
        print("El estudiante ya existe en la base de datos.")
    else:
        # Insert student
        res = supabase.table('estudiantes').insert([new_student]).execute()
        print(f"Estudiante insertado exitosamente: {res.data[0]}")
        
        # Insert enrollments
        enrollments = [
            {'id': str(uuid.uuid4()), 'id_estudiante': student_id, 'tipo_servicio': 'DESAYUNO', 'activo': True},
            {'id': str(uuid.uuid4()), 'id_estudiante': student_id, 'tipo_servicio': 'ALMUERZO', 'activo': True}
        ]
        supabase.table('inscripciones_comedor').insert(enrollments).execute()
        print("Estudiante inscrito en Desayuno y Almuerzo exitosamente.")

except Exception as e:
    print(f"Error: {e}")
