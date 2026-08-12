import os
import re
import pypdf
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# Extract details from 1A PDF for AHUMADA UTRERA
reader1 = pypdf.PdfReader('./cursos/1°A.pdf')
text1 = ""
for page in reader1.pages:
    text1 += page.extract_text() + "\n"

print("=== 1A PDF - searching AHUMADA ===")
for line in text1.split('\n'):
    if 'AHUMADA' in line.upper():
        print(f"  Found: {line.strip()}")

# Extract details from 3A PDF for PICHINTINI
reader3 = pypdf.PdfReader('./cursos/3°A.pdf')
text3 = ""
for page in reader3.pages:
    text3 += page.extract_text() + "\n"

print("\n=== 3A PDF - searching PICHINTINI ===")
for line in text3.split('\n'):
    if 'PICHINTINI' in line.upper():
        print(f"  Found: {line.strip()}")

# Also search in the full joined text
print("\n=== Full text search 1A ===")
idx = text1.upper().find('AHUMADA')
if idx >= 0:
    print(f"  Context: ...{text1[max(0,idx-20):idx+120]}...")

print("\n=== Full text search 3A ===")
idx = text3.upper().find('PICHINTINI')
if idx >= 0:
    print(f"  Context: ...{text3[max(0,idx-20):idx+120]}...")
