import pdfplumber
import sys
import os

def debug_pdf(path):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    print(f"\n--- Debugging PDF: {path} ---")
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"\n--- Page {i+1} ---")
            print(page.extract_text())

debug_pdf("UtilityMate/Invoice/2025-10-22 - Avizier Septembrie 2025.pdf")
