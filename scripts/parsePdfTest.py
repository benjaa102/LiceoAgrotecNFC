import pypdf
import os

pdf_path = "./cursos/1°A.pdf"
reader = pypdf.PdfReader(pdf_path)
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

print("--- TEXT ---")
print(text)
