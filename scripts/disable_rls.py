import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env')
s = create_client(os.environ['VITE_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

sql = "ALTER TABLE public.asistencia_buses DISABLE ROW LEVEL SECURITY;"

try:
    s.rpc('exec_sql', {'query': sql}).execute()
except Exception as e:
    print(f"Could not use exec_sql: {e}")

# If we can't use exec_sql, we can't run DDL. 
