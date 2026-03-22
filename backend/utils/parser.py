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
        """
        lower_text = text.lower()
        
        # Priority 1: Avizier / Administratie
        if "asociatia de proprietari" in lower_text or "lista de plată" in lower_text:
            for provider in available_providers:
                if "administratie" in provider.name.lower() or "asociatie" in provider.name.lower():
                    return provider

        # Priority 2: Direct match
        for provider in available_providers:
            if provider.name.lower() in lower_text:
                return provider
        return None

    @staticmethod
    def parse_pdf(text: str, provider_name: str, location_name: str = "") -> Dict[str, Any]:
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
        lower_provider = provider_name.lower()
        
        if "hidroelectrica" in lower_provider or "hidroelectrica" in lower_text:
            InvoiceParser._parse_hidroelectrica(text, result)
        elif "engie" in lower_provider or "engie" in lower_text:
            InvoiceParser._parse_engie(text, result)
        elif "asociatia" in lower_text or "lista de plată" in lower_text or "administratie" in lower_provider:
            InvoiceParser._parse_avizier(text, result, location_name)
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

        consumption_match = re.search(r"consum\s+gaze\s+naturale\s+\(kwh\)\s+(\d+)", text, re.IGNORECASE)
        if not consumption_match:
            lines = text.split('\n')
            for i, line in enumerate(lines):
                if "consum gaze naturale (kwh)" in line.lower():
                    match = re.search(r"\(kwh\)\s*(\d+)", line, re.IGNORECASE)
                    if match:
                        result["consumption_value"] = float(match.group(1))
                        break
                    if i + 1 < len(lines):
                        match = re.search(r"^(\d+)", lines[i+1].strip())
                        if match:
                            result["consumption_value"] = float(match.group(1))
                            break

    @staticmethod
    def _parse_avizier(text: str, result: Dict[str, Any], location_name: str):
        # Extract date
        date_match = re.search(r"data\s+afi[şs][aă]rii[:\s]+(\d{1,2})\s+(\w+)\s+(\d{4})", text, re.IGNORECASE)
        if date_match:
            day, month_name, year = date_match.groups()
            months = {
                "ianuarie": "01", "februarie": "02", "martie": "03", "aprilie": "04", 
                "mai": "05", "iunie": "06", "iulie": "07", "august": "08", 
                "septembrie": "09", "octombrie": "10", "noiembrie": "11", "decembrie": "12"
            }
            month = months.get(month_name.lower(), "01")
            result["invoice_date"] = datetime.strptime(f"{day.zfill(2)}.{month}.{year}", "%d.%m.%Y").date()

        # Try to find the apartment number from location_name (e.g. AP12 -> 12)
        apt_num_match = re.search(r"(\d+)", location_name)
        if apt_num_match:
            apt_num = apt_num_match.group(1)
            # Find line starting with apt_num
            lines = text.split('\n')
            for line in lines:
                # Line format: apt_num pers cota_parte ... total_payment ...
                # 12 1 1,803 34,71 3,00 39,97 2,00 0,12 1,03 13,53 1,77 27,01 18,50 3,07 2,83 36,06 28,85 0,01 207,46 120,00 0,00 0,00 0,00 0,00 327,46 12 750,00
                parts = line.strip().split()
                if parts and parts[0] == apt_num:
                    # Total is usually near the end, but before the repeated apt num and some other index
                    # Let's find the first number that looks like a total (high value with decimals)
                    # For Avizier, we'll look for the second to last numeric-ish value that's not the apt number
                    try:
                        # Clean parts to only have numeric-ish values
                        numeric_parts = [p for p in parts if re.match(r"^-?[\d\.,]+$", p)]
                        if len(numeric_parts) > 5:
                            # Usually the total is the one before the apt number repeat
                            # In "327,46 12 750,00", 327,46 is the total
                            for i in range(len(numeric_parts)-1, 0, -1):
                                if numeric_parts[i] == apt_num:
                                    total_str = numeric_parts[i-1]
                                    total_str = total_str.replace(".", "").replace(",", ".")
                                    result["amount"] = float(total_str)
                                    break
                    except:
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
