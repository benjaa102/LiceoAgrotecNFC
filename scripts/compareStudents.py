import os
import re
import json
import pypdf
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def normalize_rut(rut):
    """Normalize RUT: remove dots, dashes, leading zeros/100, keep only digits+K"""
    rut = rut.upper().replace('.', '').replace('-', '').replace(' ', '')
    # Remove leading "100" for foreign RUTs stored as 100.xxx.xxx
    if rut.startswith('100') and len(rut) > 9:
        rut = rut[3:]
    # Remove leading zeros
    rut = rut.lstrip('0')
    return rut

def extract_students_from_pdf(pdf_path):
    """Extract student names and RUTs from a PDF course list."""
    reader = pypdf.PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"
    
    students = []
    
    # Pattern: captures sequences like "APELLIDO1 APELLIDO2, NOMBRE1 NOMBRE2  RUT"
    # The PDF has lines like: "2 3 ALARCÓN CANQUIL, AILYN DANAAE 23619222-9 11/04/2011 F"
    # Or multiline where number, matric, name, rut, date, sex are on separate lines
    
    # Strategy: find all RUTs first, then try to find names near them
    rut_pattern = re.compile(r'(\d{7,9}-[\dKk])')
    
    # Split by lines
    lines = full_text.split('\n')
    
    # Join everything into one big string for easier regex
    joined = ' '.join(lines)
    
    # Find all name+rut pairs
    # Pattern: LASTNAME LASTNAME, FIRSTNAME FIRSTNAME ... RUT
    name_rut_pattern = re.compile(
        r'([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]+(?:,\s*[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü\s\-]+)?)\s+(\d{7,9}-[\dKk])',
        re.UNICODE
    )
    
    found_ruts = set()
    
    for match in name_rut_pattern.finditer(joined):
        raw_name = match.group(1).strip()
        raw_rut = match.group(2).strip()
        
        # Clean up the name - remove leading numbers and matric numbers
        clean_name = re.sub(r'^\d+\s*', '', raw_name).strip()
        clean_name = re.sub(r'^\d+\s*', '', clean_name).strip()  # twice for double numbers
        
        # Remove common header text that might get captured
        if any(skip in clean_name.upper() for skip in ['LISTA DE CURSO', 'PROFESORA JEFE', 'PROFESOR JEFE', 'MATRIC', 'OBSERVACIONES']):
            continue
            
        norm_rut = normalize_rut(raw_rut)
        if norm_rut not in found_ruts:
            found_ruts.add(norm_rut)
            students.append({
                'nombre': clean_name,
                'rut_original': raw_rut,
                'rut_normalizado': norm_rut
            })
    
    # Also find standalone RUTs that weren't captured with names
    all_ruts_in_pdf = set()
    for match in rut_pattern.finditer(full_text):
        norm = normalize_rut(match.group(1))
        all_ruts_in_pdf.add(norm)
    
    # Check for RUTs found in PDF but not matched with a name
    for rut in all_ruts_in_pdf:
        if rut not in found_ruts:
            # Skip date-like patterns (day/month/year could produce false positives)
            if len(rut) < 7:
                continue
            students.append({
                'nombre': '(nombre no extraído)',
                'rut_original': rut,
                'rut_normalizado': rut
            })
    
    return students

def main():
    print("Fetching all students from Supabase...")
    all_students = []
    offset = 0
    while True:
        res = supabase.table('estudiantes').select('*').range(offset, offset + 999).execute()
        if not res.data:
            break
        all_students.extend(res.data)
        if len(res.data) < 1000:
            break
        offset += 1000
    
    print(f"Total students in DB: {len(all_students)}")
    
    # Build a dict of normalized RUT -> student
    db_by_rut = {}
    for s in all_students:
        if s.get('rut'):
            norm = normalize_rut(s['rut'])
            db_by_rut[norm] = s
    
    # Also build by course
    db_by_course = {}
    for s in all_students:
        c = s.get('curso', 'SIN CURSO')
        if c not in db_by_course:
            db_by_course[c] = []
        db_by_course[c].append(s)
    
    cursos_dir = './cursos/'
    pdf_files = sorted([f for f in os.listdir(cursos_dir) if f.endswith('.pdf')])
    
    report = {}
    
    for pdf_file in pdf_files:
        course_name = pdf_file.replace('.pdf', '')
        print(f"\nProcessing: {course_name}")
        
        pdf_students = extract_students_from_pdf(os.path.join(cursos_dir, pdf_file))
        print(f"  Found {len(pdf_students)} students in PDF")
        
        pdf_ruts = {s['rut_normalizado'] for s in pdf_students}
        
        # DB students for this course
        db_course = db_by_course.get(course_name, [])
        db_course_ruts = {normalize_rut(s['rut']): s for s in db_course if s.get('rut')}
        
        missing_in_db = []
        for ps in pdf_students:
            norm = ps['rut_normalizado']
            if norm not in db_by_rut:
                # Double check - maybe they're in a different course?
                missing_in_db.append(ps)
            elif norm not in db_course_ruts:
                # They exist in DB but in a different course
                actual_student = db_by_rut[norm]
                ps['en_otro_curso'] = actual_student.get('curso', '?')
                ps['nombre_db'] = actual_student.get('nombre', '?')
                missing_in_db.append(ps)
        
        no_longer = []
        for db_rut, student in db_course_ruts.items():
            if db_rut not in pdf_ruts:
                # Check if maybe they moved to another course's PDF
                found_elsewhere = False
                for other_pdf in pdf_files:
                    if other_pdf == pdf_file:
                        continue
                    other_name = other_pdf.replace('.pdf', '')
                    # We'll check this later
                
                no_longer.append(student)
        
        report[course_name] = {
            'pdf_count': len(pdf_students),
            'db_count': len(db_course),
            'missing_in_db': missing_in_db,
            'no_longer': no_longer,
            'pdf_students': pdf_students
        }
    
    # Now write a detailed report
    output = "# 📊 Reporte Detallado: Comparación Estudiantes (PDF vs Sistema)\n\n"
    output += f"**Total de estudiantes en el sistema:** {len(all_students)}\n\n"
    output += "---\n\n"
    
    total_missing = 0
    total_removed = 0
    
    for course_name in sorted(report.keys()):
        data = report[course_name]
        output += f"## 📁 Curso: {course_name}\n"
        output += f"- Alumnos en PDF: **{data['pdf_count']}**\n"
        output += f"- Alumnos en Sistema: **{data['db_count']}**\n\n"
        
        if not data['missing_in_db'] and not data['no_longer']:
            output += "✅ **Todo cuadra perfectamente.** No hay diferencias.\n\n"
            output += "---\n\n"
            continue
        
        if data['missing_in_db']:
            output += "### 🔴 Están en el PDF pero NO en el sistema:\n"
            output += "| # | Nombre (del PDF) | RUT | Observación |\n"
            output += "|---|---|---|---|\n"
            for i, s in enumerate(data['missing_in_db'], 1):
                obs = ""
                if s.get('en_otro_curso'):
                    obs = f"⚠️ Está en el sistema pero en **{s['en_otro_curso']}** como {s.get('nombre_db', '?')}"
                elif s['nombre'] == '(nombre no extraído)':
                    obs = "Solo se detectó el RUT"
                total_missing += 1
                output += f"| {i} | {s['nombre']} | {s['rut_original']} | {obs} |\n"
            output += "\n"
        
        if data['no_longer']:
            output += "### 🟡 Están en el sistema pero NO en el PDF:\n"
            output += "| # | Nombre (en Sistema) | RUT | Curso actual |\n"
            output += "|---|---|---|---|\n"
            for i, s in enumerate(data['no_longer'], 1):
                total_removed += 1
                output += f"| {i} | {s['nombre']} | {s.get('rut', 'N/A')} | {s.get('curso', 'N/A')} |\n"
            output += "\n"
        
        output += "---\n\n"
    
    output += f"\n## 📈 Resumen Final\n"
    output += f"- **Alumnos que faltan por ingresar al sistema:** {total_missing}\n"
    output += f"- **Alumnos que están de más en el sistema (posibles retirados):** {total_removed}\n"
    
    with open('comparacion_detallada.md', 'w', encoding='utf-8') as f:
        f.write(output)
    
    print(f"\n[OK] Reporte guardado en comparacion_detallada.md")
    print(f"   Faltan: {total_missing} | Sobran: {total_removed}")

if __name__ == '__main__':
    main()
