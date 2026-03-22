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
        
        # Lowercase for easier matching
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
        # Data facturării: 14.10.2025 or Data facturii
        billing_match = re.search(r"data\s+factur(?:[aă]rii|ii)[:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
            
        # Total de plată: 123,45 or Total factura
        amount_match = re.search(r"total\s+de\s+plat[aă][:\s]+([\d\.,]+)", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+factur[aă][:\s]+([\d\.,]+)", text, re.IGNORECASE)
            
        if amount_match:
            # Clean up the amount string: remove thousands separator if it's a dot and the decimal is a comma
            amount_str = amount_match.group(1)
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
        # Data emiterii: 15.10.2025
        billing_match = re.search(r"data\s+emiterii[:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
            
        # Total factura curenta: 234.56
        amount_match = re.search(r"total\s+factur[aă]\s+curent[aă][:\s]+([\d\.,]+)", text, re.IGNORECASE)
        if amount_match:
            amount_str = amount_match.group(1)
            if "," in amount_str and "." in amount_str:
                amount_str = amount_str.replace(".", "")
            amount_str = amount_str.replace(",", ".")
            try:
                result["amount"] = float(amount_str)
            except ValueError:
                pass

    @staticmethod
    def _parse_generic(text: str, result: Dict[str, Any]):
        # Simple date finder
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
