import pdfplumber
import re
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

class InvoiceParser:
    @staticmethod
    def get_pdf_text(file_path: str) -> str:
        text = ""
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
        except Exception:
            pass
        return text

    @staticmethod
    def detect_provider(text: str, available_providers: List[Any]) -> Optional[Any]:
        """
        Matches text against available providers.
        available_providers should be a list of database Provider objects.
        """
        lower_text = text.lower()
        for provider in available_providers:
            # Simple keyword match for now. In a real app, providers might have 'search_keywords'
            if provider.name.lower() in lower_text:
                return provider
        return None

    @staticmethod
    def parse_pdf(text: str, provider_name: str) -> Dict[str, Any]:
        """
        Parses PDF text and extracts key fields.
        """
        result = {
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
        billing_match = re.search(r"(?:data\s+emiterii[:\s]+|data\s+facturii[:\s]+)?(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
            
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
        date_match = re.search(r"(?:data|date)[:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if not date_match:
            date_match = re.search(r"(\d{2}\.\d{2}\.\d{4})", text)
            
        if date_match:
            try:
                result["invoice_date"] = datetime.strptime(date_match.group(1), "%d.%m.%Y").date()
            except ValueError:
                pass
            
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
