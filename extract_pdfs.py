import pdfplumber
import glob
import json
import re

def extract_all():
    files = glob.glob("cursos/*.pdf")
    results = {}
    
    for file in files:
        curso_name = file.replace("cursos\\\\", "").replace("cursos/", "").replace(".pdf", "")
        students = []
        
        with pdfplumber.open(file) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text: continue
                
                lines = text.split('\n')
                for line in lines:
                    # Look for lines starting with "N° Lista", "Matric", etc. No, look for actual student rows
                    # typical row: "01 24 AMPUERO LEAL DIEGO AGUSTIN H 27/07/2012 24021871-2"
                    # regex: start with 1-2 digits, then 1-4 digits, then text, then H or M, then date, then RUT
                    match = re.search(r'^(\d{1,2})\s+(\d+)\s+(.+?)\s+([HM])\s+(\d{2}/\d{2}/\d{4})\s+([\d\.\-Kk]+)', line.strip())
                    if match:
                        n_lista = match.group(1)
                        mat = match.group(2)
                        names = match.group(3)
                        sexo = match.group(4)
                        fecha = match.group(5)
                        rut = match.group(6)
                        
                        students.append({
                            "lista": n_lista,
                            "matricula": mat,
                            "nombres": names,
                            "sexo": sexo,
                            "fecha_nacimiento": fecha,
                            "rut": rut
                        })
        results[curso_name] = students
        print(f"Extracted {len(students)} from {file}")
        
    with open("extracted_students.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    extract_all()
