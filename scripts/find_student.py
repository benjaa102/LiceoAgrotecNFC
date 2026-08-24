import os
import pdfplumber

pdf_path = "cursos/1°C.pdf"
print(f"Searching for ULLOA PICHICONA in {pdf_path}...")

if os.path.exists(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines = text.split('\n')
                for line in lines:
                    if "ULLOA PICHICONA" in line:
                        print(f"FOUND: {line}")
else:
    print("PDF not found.")
