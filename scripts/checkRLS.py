import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")

# Check with ANON key (what the website uses)
anon_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
anon = create_client(url, anon_key)

# Check with SERVICE key (bypass RLS)
svc_key = os.environ.get("SUPABASE_SERVICE_KEY")
svc = create_client(url, svc_key)

print("=== Checking registros_comedor ===")
res_anon = anon.table('registros_comedor').select('*').execute()
res_svc = svc.table('registros_comedor').select('*').execute()
print(f"  ANON key sees: {len(res_anon.data)} records")
print(f"  SERVICE key sees: {len(res_svc.data)} records")
if res_svc.data:
    for r in res_svc.data[:3]:
        print(f"    -> {r.get('id', '?')[:20]}... | {r.get('fecha')} | {r.get('tipo_servicio')}")

print("\n=== Checking inscripciones_comedor ===")
res_anon2 = anon.table('inscripciones_comedor').select('*').execute()
res_svc2 = svc.table('inscripciones_comedor').select('*').execute()
print(f"  ANON key sees: {len(res_anon2.data)} records")
print(f"  SERVICE key sees: {len(res_svc2.data)} records")

# Also check other critical tables
for table in ['credenciales', 'estudiantes', 'supervisores']:
    res_a = anon.table(table).select('id', count='exact').execute()
    res_s = svc.table(table).select('id', count='exact').execute()
    print(f"\n=== {table} ===")
    print(f"  ANON: {len(res_a.data)} | SERVICE: {len(res_s.data)}")
