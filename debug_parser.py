import pdfplumber
import re
import sys
import os
from typing import Dict, Any, Optional
from datetime import datetime

class DebugParser:
    @staticmethod
    def parse_pdf(file_path: str, provider_name: str) -> Dict[str, Any]:
        text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() + "\n"
        
        result = {
            "provider": provider_name,
            "invoice_date": None,
            "due_date": None,
            "amount": 0.0,
            "consumption_value": 0.0,
            "currency": "RON"
        }
        
        lower_text = text.lower()
        
        if "hidroelectrica" in provider_name.lower() or "hidroelectrica" in lower_text:
            DebugParser._parse_hidroelectrica(text, result)
        elif "engie" in provider_name.lower() or "engie" in lower_text:
            DebugParser._parse_engie(text, result)
        else:
            DebugParser._parse_generic(text, result)
            
        return result, text

    @staticmethod
    def _parse_hidroelectrica(text: str, result: Dict[str, Any]):
        billing_match = re.search(r"(?:data\s+de|data\s+factur(?:[aă]rii|ii)[:\s]+)\s*(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
            
        amount_match = re.search(r"total\s+de\s+plat[aă](?:.*?)\s+([\d\.,]+)lei", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+de\s+plat[aă](?:[^0-9,]+)?([\d\.,]+)", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+factur[aă][:\s]+([\d\.,]+)", text, re.IGNORECASE)
            
        if amount_match:
            amount_str = amount_match.group(1).strip()
            if "," in amount_str and "." in amount_str:
                amount_str = amount_str.replace(".", "")
            amount_str = amount_str.replace(",", ".")
            try:
                result["amount"] = float(amount_str)
            except ValueError:
                pass
            
        consumption_match = re.search(r"(\d+)\s+kwh", text, re.IGNORECASE)
        if consumption_match:
            result["consumption_value"] = float(consumption_match.group(1))

    @staticmethod
    def _parse_engie(text: str, result: Dict[str, Any]):
        # Data emiterii: 15.10.2025
        billing_match = re.search(r"(?:data\s+emiterii[:\s]+|data\s+facturii[:\s]+)?(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
            
        # Total de plata cu TVA: 158,40
        # or TOTAL FACTURĂ CURENTĂ: 130,91 27,49 158,40
        # We want the last number which is the total with VAT
        amount_match = re.search(r"total\s+factur[aă]\s+curent[aă][:\s]+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+de\s+plat[aă]\s+cu\s+t\.v\.a\.?\s+([\d\.,]+)", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+factur[aă]\s+curent[aă][:\s]+([\d\.,]+)", text, re.IGNORECASE)
            
        if amount_match:
            amount_str = amount_match.group(1).strip()
            if "," in amount_str and "." in amount_str:
                amount_str = amount_str.replace(".", "")
            amount_str = amount_str.replace(",", ".")
            try:
                result["amount"] = float(amount_str)
            except ValueError:
                pass

        # CONSUM GAZE NATURALE (kWh) 1234
        # Need to find the number following this label
        # In the context it was:
        # CONSUM GAZE NATURALE (kWh) TOTAL DE PLATĂ CU T.V.A. DATA SCADENTĂ
        # 1234 158,40 30.03.2026 (hypothetical next line)
        
        consumption_match = re.search(r"consum\s+gaze\s+naturale\s+\(kwh\)\s+(\d+)", text, re.IGNORECASE)
        if not consumption_match:
            # Try to find a line that looks like a consumption value near the header
            # Sometimes it's on the next line or separated by whitespace
            lines = text.split('\n')
            for i, line in enumerate(lines):
                if "consum gaze naturale (kwh)" in line.lower():
                    # Check this line
                    match = re.search(r"\(kwh\)\s*(\d+)", line, re.IGNORECASE)
                    if match:
                        result["consumption_value"] = float(match.group(1))
                        break
                    # Check next line
                    if i + 1 < len(lines):
                        match = re.search(r"^(\d+)", lines[i+1].strip())
                        if match:
                            result["consumption_value"] = float(match.group(1))
                            break

    @staticmethod
    def _parse_generic(text: str, result: Dict[str, Any]):
        date_match = re.search(r"(?:data|date)[:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if not date_match:
            date_match = re.search(r"(\d{2}\.\d{2}\.\d{4})", text)
        if date_match:
            try:
                result["invoice_date"] = datetime.strptime(date_match.group(1), "%d.%m.%Y").date()
            except ValueError: pass
        amount_match = re.search(r"total[:\s]+([\d\.,]+)", text, re.IGNORECASE)
        if amount_match:
            amount_str = amount_match.group(1)
            if "," in amount_str and "." in amount_str:
                amount_str = amount_str.replace(".", "")
            amount_str = amount_str.replace(",", ".")
            try:
                result["amount"] = float(amount_str)
            except (ValueError, TypeError): pass

def test_file(path, provider):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    print(f"\n--- Testing {provider}: {path} ---")
    res, text = DebugParser.parse_pdf(path, provider)
    print(f"Extracted: {res}")
    # Print lines containing "consum" or "kWh"
    print("Context around 'consum/kWh':")
    for line in text.split('\n'):
        if 'consum' in line.lower() or 'kwh' in line.lower():
            print(f"  {line}")

test_file("UtilityMate/Invoice/AP15/2026-03-16 - ENGIE.pdf", "ENGIE")
