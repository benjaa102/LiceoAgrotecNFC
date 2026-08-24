import os
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env')
s = create_client(os.environ['VITE_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

# Test insert into asistencia_buses
record = {
    'id': 'test_' + str(int(datetime.now().timestamp())),
    'id_estudiante': 'est_test',
    'id_recorrido': 'rec_test',
    'id_bus': None,
    'tipo_registro': 'MANUAL',
    'estado': 'PRESENTE',
    'fecha': '2026-08-19',
    'hora': '16:30',
    'metodo': 'MANUAL',
    'observacion': None
}

try:
    print("Attempting to insert test record...")
    res = s.table('asistencia_buses').insert([record]).execute()
    print("Insert success:", res.data)
except Exception as e:
    print("Insert failed:", e)

