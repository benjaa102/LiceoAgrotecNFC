import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
svc_key = os.environ.get("SUPABASE_SERVICE_KEY")
anon_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
svc = create_client(url, svc_key)
anon = create_client(url, anon_key)

# Get a real student ID
est = svc.table('estudiantes').select('id, nombre').limit(1).execute()
real_id = est.data[0]['id']
print(f"Using real student: {est.data[0]['nombre']} (id: {real_id})")

# Try inserting with ANON key (this is what the website uses)
print("\nInserting with ANON key...")
try:
    res = anon.table('registros_comedor').insert({
        'id': 'test_anon_rls',
        'id_estudiante': real_id,
        'tipo_servicio': 'DESAYUNO',
        'fecha': '2026-08-12',
        'hora': '09:00:00',
        'metodo': 'MANUAL'
    }).execute()
    print(f"  OK! ANON insert succeeded: {len(res.data)} records")
except Exception as e:
    print(f"  FAILED! ANON insert blocked by RLS: {e}")

# Check if ANON can read
res2 = anon.table('registros_comedor').select('*').execute()
print(f"  ANON can read: {len(res2.data)} records")

# Cleanup
svc.table('registros_comedor').delete().eq('id', 'test_anon_rls').execute()
print("\nCleanup done.")
