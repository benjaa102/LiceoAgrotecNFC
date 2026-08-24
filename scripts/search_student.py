import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
svc_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, svc_key)

print("Searching for student ULLOA PICHICONA...")
res = supabase.table('estudiantes').select('*').ilike('nombre', '%ULLOA%').execute()

print(f"Found {len(res.data)} matching students by name.")
for s in res.data:
    print(s)

print("\nSearching by RUT 23.945.620-0...")
res2 = supabase.table('estudiantes').select('*').eq('rut', '23.945.620-0').execute()
print(f"Found {len(res2.data)} matching students by RUT.")
for s in res2.data:
    print(s)
