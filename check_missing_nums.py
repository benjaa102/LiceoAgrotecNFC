import pdfplumber
import glob
import re

def check_counts():
    files = glob.glob("cursos/*.pdf")
    for file in files:
        curso_name = file.replace("cursos\\\\", "").replace("cursos/", "").replace(".pdf", "")
        list_nums = []
        
        with pdfplumber.open(file) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text: continue
                
                lines = text.split('\n')
                for line in lines:
                    match = re.search(r'^(\d{1,2})\s+(\d+)\s+(.+?)\s+([HM])\s+(\d{2}/\d{2}/\d{4})\s+([\d\.\-Kk]+)', line.strip())
                    if match:
                        lista = int(match.group(1))
                        list_nums.append(lista)
                        
        if not list_nums: continue
        
        max_lista = max(list_nums)
        missing = []
        for i in range(1, max_lista + 1):
            if i not in list_nums:
                missing.append(i)
                
        if missing:
            print(f"{curso_name}: Missing list numbers: {missing}")
            # print the lines near the missing numbers to see if it failed regex
            with pdfplumber.open(file) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if not text: continue
                    lines = text.split('\n')
                    for line in lines:
                        for m in missing:
                            if line.strip().startswith(f"{m:02d} ") or line.strip().startswith(f"{m} "):
                                print(f"   Line for {m}: {line.strip()}")

if __name__ == "__main__":
    check_counts()
