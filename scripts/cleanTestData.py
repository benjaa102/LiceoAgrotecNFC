import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("=" * 60)
print("LIMPIEZA DE DATOS DE PRUEBA")
print("=" * 60)

# 1. Clean registros_comedor (fake attendance records)
print("\n1. Limpiando registros_comedor...")
res = supabase.table('registros_comedor').select('id', count='exact').execute()
count = len(res.data)
if count > 0:
    # Delete all records that have test IDs or all records
    supabase.table('registros_comedor').delete().neq('id', '___none___').execute()
    print(f"   Eliminados: {count} registros de comedor")
else:
    print("   Ya estaba vacio")

# 2. Clean inscripciones_comedor (fake enrollments)
print("\n2. Limpiando inscripciones_comedor...")
res = supabase.table('inscripciones_comedor').select('id', count='exact').execute()
count = len(res.data)
if count > 0:
    supabase.table('inscripciones_comedor').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print(f"   Eliminadas: {count} inscripciones de comedor")
else:
    print("   Ya estaba vacio")

# 3. Check credenciales for test data
print("\n3. Revisando credenciales...")
res = supabase.table('credenciales').select('*').execute()
test_creds = [c for c in res.data if c['id'].startswith('c_') or c['id'].startswith('test_')]
if test_creds:
    for c in test_creds:
        supabase.table('credenciales').delete().eq('id', c['id']).execute()
    print(f"   Eliminadas: {len(test_creds)} credenciales de prueba")
else:
    print("   Sin datos de prueba")

# 4. Verify final state
print("\n" + "=" * 60)
print("VERIFICACION FINAL")
print("=" * 60)

tables = ['registros_comedor', 'inscripciones_comedor', 'credenciales', 'estudiantes', 'supervisores', 'buses', 'recorridos']
for table in tables:
    try:
        res = supabase.table(table).select('id', count='exact').execute()
        print(f"  {table}: {len(res.data)} registros")
    except Exception as e:
        print(f"  {table}: Error - {e}")

print("\n[OK] Limpieza completada. El sistema esta listo para produccion.")
