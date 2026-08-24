import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env')
s = create_client(os.environ['VITE_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

# Create asistencia_buses table
sql = """
CREATE TABLE IF NOT EXISTS public.asistencia_buses (
    id TEXT PRIMARY KEY,
    id_estudiante TEXT NOT NULL,
    id_recorrido TEXT,
    id_bus TEXT,
    tipo_registro TEXT DEFAULT 'NFC',
    estado TEXT DEFAULT 'PRESENTE',
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    metodo TEXT DEFAULT 'NFC',
    observacion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.asistencia_buses DISABLE ROW LEVEL SECURITY;
"""

try:
    result = s.postgrest.schema("public").rpc("", {}).execute()
except:
    pass

# Use raw SQL via the REST API
print("Creating asistencia_buses table via SQL...")
try:
    r = s.rpc('exec_sql', {'query': sql}).execute()
    print("Table created successfully!")
    print(r.data)
except Exception as e:
    print(f"RPC method not available: {e}")
    print("\nPlease run this SQL manually in Supabase SQL Editor:")
    print(sql)
