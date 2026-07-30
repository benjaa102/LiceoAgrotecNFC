import pdfplumber
import glob
import re

def check_counts():
    files = glob.glob("cursos/*.pdf")
    total = 0
    for file in files:
        curso_name = file.replace("cursos\\\\", "").replace("cursos/", "").replace(".pdf", "")
        extracted = 0
        max_lista = 0
        
        with pdfplumber.open(file) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text: continue
                
                lines = text.split('\n')
                for line in lines:
                    match = re.search(r'^(\d{1,2})\s+(\d+)\s+(.+?)\s+([HM])\s+(\d{2}/\d{2}/\d{4})\s+([\d\.\-Kk]+)', line.strip())
                    if match:
                        extracted += 1
                        lista = int(match.group(1))
                        if lista > max_lista:
                            max_lista = lista
                    else:
                        # Check if it starts with a number but failed the full regex
                        if re.search(r'^(\d{1,2})\s+(\d+)', line.strip()) and "Matric." not in line and "Ret." not in line and "LISTA" not in line and "RUT" not in line:
                            # It might be a valid student that failed regex
                            print(f"[{curso_name}] Potential missed student line: {line.strip()}")
        
        if extracted != max_lista:
            print(f"WARNING {curso_name}: Extracted {extracted}, but max list number is {max_lista}")
            
        total += extracted
        
    print(f"Total extracted: {total}")

if __name__ == "__main__":
    check_counts()
