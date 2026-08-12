import os
import time
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# Insert using the correct fields from the DB schema
print("--- Inserting AHUMADA UTRERA into 1A ---")
res1 = supabase.table('estudiantes').insert({
    'id': 'e' + str(int(time.time())),
    'nombre': 'AHUMADA UTRERA, Darcy Monserrat',
    'rut': '23.436.442-1',
    'curso': '1°A',
    'sexo': 'F',
    'matricula': '818',
    'tipo': 'INTERNO',
    'estado_autorizacion': 'ACTIVO'
}).execute()

if res1.data:
    print(f"  OK: {res1.data[0]['nombre']} -> {res1.data[0]['curso']}")

time.sleep(1)

print("\n--- Inserting PICHINTINI GUENTREPAN into 3A ---")
res2 = supabase.table('estudiantes').insert({
    'id': 'e' + str(int(time.time())),
    'nombre': 'PICHINTINI GUENTREPAN, Escarlett Anahi',
    'rut': '23.283.516-8',
    'curso': '3°A',
    'sexo': 'F',
    'matricula': '404',
    'tipo': 'INTERNO',
    'estado_autorizacion': 'ACTIVO'
}).execute()

if res2.data:
    print(f"  OK: {res2.data[0]['nombre']} -> {res2.data[0]['curso']}")

final = supabase.table('estudiantes').select('id', count='exact').execute()
print(f"\nTotal students now: {len(final.data)}")
