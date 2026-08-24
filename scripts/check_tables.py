import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env')
s = create_client(os.environ['VITE_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

# List all tables
tables = ['asistencia_buses', 'registros_buses', 'asistencia', 'registro_buses']
for t in tables:
    try:
        r = s.table(t).select('*').limit(1).execute()
        print(f"Table '{t}' EXISTS. Sample: {r.data}")
    except Exception as e:
        print(f"Table '{t}' NOT FOUND: {e}")

# Try recorridos
try:
    r = s.table('recorridos').select('*').limit(2).execute()
    print(f"\nRecorridos sample: {r.data}")
except Exception as e:
    print(f"recorridos error: {e}")

# Try buses  
try:
    r = s.table('buses').select('*').limit(2).execute()
    print(f"\nBuses sample: {r.data}")
except Exception as e:
    print(f"buses error: {e}")
