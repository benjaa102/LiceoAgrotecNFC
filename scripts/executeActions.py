import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")  # Service key to bypass RLS
supabase: Client = create_client(url, key)

def normalize_rut(rut):
    return rut.upper().replace('.', '').replace('-', '').replace(' ', '').lstrip('0')

# ============================================================
# ACTION 1: Rename "7° Básico" -> "7°" and "8° Básico" -> "8°"
# ============================================================
print("=" * 60)
print("ACTION 1: Renaming courses 7 Basico -> 7 and 8 Basico -> 8")
print("=" * 60)

res7 = supabase.table('estudiantes').update({'curso': '7°'}).eq('curso', '7° Básico').execute()
print(f"  7 Basico -> 7: Updated {len(res7.data)} students")

res8 = supabase.table('estudiantes').update({'curso': '8°'}).eq('curso', '8° Básico').execute()
print(f"  8 Basico -> 8: Updated {len(res8.data)} students")

# ============================================================
# ACTION 2: Move CORTEZ POBLETE from 3°C to 3°D
# ============================================================
print("\n" + "=" * 60)
print("ACTION 2: Moving CORTEZ POBLETE from 3C to 3D")
print("=" * 60)

cortez_rut_norm = normalize_rut("23.166.715-6")
# Find student by normalized RUT
all_students = supabase.table('estudiantes').select('*').execute().data
cortez = None
for s in all_students:
    if s.get('rut') and normalize_rut(s['rut']) == cortez_rut_norm:
        cortez = s
        break

if cortez:
    res = supabase.table('estudiantes').update({'curso': '3°D'}).eq('id', cortez['id']).execute()
    print(f"  Moved {cortez['nombre']} (RUT: {cortez['rut']}) from {cortez['curso']} to 3D")
else:
    print("  WARNING: Could not find CORTEZ POBLETE by RUT")

# ============================================================
# ACTION 3: Remove/delete the 12 retired students
# ============================================================
print("\n" + "=" * 60)
print("ACTION 3: Removing 12 retired students")
print("=" * 60)

retired_ruts = [
    "23.847.135-4",  # VARGAS VALLEJOS, Nakara Constanza - 1A
    "23.632.671-3",  # ARGEL SCHOETTGE, Stephanie Paulina - 1A
    "23.551.759-0",  # ROCHOW GALLARDO, Cristofer Alejandro - 1B
    "23.840.652-8",  # AUCAPAN AUCAPAN, Xiomara Millaray - 1C
    "23.945.620-0",  # ULLOA PICHICONA, Tomas Ignacio - 1C
    "23.504.375-0",  # BARRIENTOS CHAURA, Eduardo Nicolas - 1D
    "23.486.492-0",  # GONZALEZ FARIAS, Angelina Alexandra - 2C
    "23.110.275-2",  # SANDOVAL VARGAS, Carla Monserrat - 2D
    "23.476.814-K",  # ALVAREZ VELASQUEZ, Geremy Francisco - 2D
    "22.834.721-3",  # JARAMILLO RAMIREZ, Catalina Fernanda - 4C
    "21.307.249-8",  # ARS GREYRAT BOREAS - 4D
]
# Note: CORTEZ POBLETE was moved, not deleted

retired_norm = [normalize_rut(r) for r in retired_ruts]

deleted_count = 0
for s in all_students:
    if s.get('rut') and normalize_rut(s['rut']) in retired_norm:
        res = supabase.table('estudiantes').delete().eq('id', s['id']).execute()
        print(f"  Deleted: {s['nombre']} (RUT: {s['rut']}, Curso: {s['curso']})")
        deleted_count += 1

print(f"\n  Total deleted: {deleted_count}")

# ============================================================
# FINAL SUMMARY
# ============================================================
print("\n" + "=" * 60)
print("ALL ACTIONS COMPLETED")
print("=" * 60)
final_count = supabase.table('estudiantes').select('id', count='exact').execute()
print(f"Total students remaining in system: {len(final_count.data)}")
