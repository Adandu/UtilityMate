import pdfplumber
import re
from typing import Dict, Any, Optional
from datetime import datetime

class InvoiceParser:
    @staticmethod
    def parse_pdf(file_path: str, provider_name: str) -> Dict[str, Any]:
        """
        Parses a PDF invoice and extracts key fields.
        Supports: Hidroelectrica, ENGIE, and generic patterns for others.
        """
        text = ""
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
        except Exception:
            # Fallback if PDF reading fails
            pass
        
        result = {
            "provider": provider_name,
            "invoice_date": None,
            "due_date": None,
            "amount": 0.0,
            "consumption_value": 0.0,
            "currency": "RON"
        }
        
        if not text:
            return result
            
        lower_text = text.lower()
        
        if "hidroelectrica" in provider_name.lower() or "hidroelectrica" in lower_text:
            InvoiceParser._parse_hidroelectrica(text, result)
        elif "engie" in provider_name.lower() or "engie" in lower_text:
            InvoiceParser._parse_engie(text, result)
        else:
            InvoiceParser._parse_generic(text, result)
            
        return result

    @staticmethod
    def _parse_hidroelectrica(text: str, result: Dict[str, Any]):
        # data de 13.02.2026 or Data facturării: 14.10.2025
        billing_match = re.search(r"(?:data\s+de|data\s+factur(?:[aă]rii|ii)[:\s]+)\s*(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
            
        # Line might look like: 4 TOTAL DE PLATĂ FACTURĂ CURENTĂ (4=1+3) 71,60lei
        # or Total de plată: 123,45
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
            
        # Index nou - Index vechi (Consumption)
        consumption_match = re.search(r"(\d+)\s+kwh", text, re.IGNORECASE)
        if consumption_match:
            result["consumption_value"] = float(consumption_match.group(1))

    @staticmethod
    def _parse_engie(text: str, result: Dict[str, Any]):
        # Data emiterii: 15.10.2025 or Data facturii: 15.10.2025 or any DD.MM.YYYY
        billing_match = re.search(r"(?:data\s+emiterii[:\s]+|data\s+facturii[:\s]+)?(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
            
        # Total factura curenta: 234.56 or TOTAL FACTURĂ CURENTĂ: 130,91
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

    @staticmethod
    def _parse_generic(text: str, result: Dict[str, Any]):
        # Try to find a date following "data" or "date"
        date_match = re.search(r"(?:data|date)[:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if not date_match:
            # Fallback to the first date found
            date_match = re.search(r"(\d{2}\.\d{2}\.\d{4})", text)
            
        if date_match:
            try:
                result["invoice_date"] = datetime.strptime(date_match.group(1), "%d.%m.%Y").date()
            except ValueError:
                pass
            
        # Amount often follows "Total" or "RON"
        amount_match = re.search(r"total[:\s]+([\d\.,]+)", text, re.IGNORECASE)
        if amount_match:
            amount_str = amount_match.group(1)
            if "," in amount_str and "." in amount_str:
                amount_str = amount_str.replace(".", "")
            amount_str = amount_str.replace(",", ".")
            try:
                result["amount"] = float(amount_str)
            except (ValueError, TypeError):
                pass
