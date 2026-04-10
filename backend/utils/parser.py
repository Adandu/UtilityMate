import pdfplumber
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional


ROMANIAN_MONTHS = {
    "ianuarie": "01",
    "februarie": "02",
    "martie": "03",
    "aprilie": "04",
    "mai": "05",
    "iunie": "06",
    "iulie": "07",
    "august": "08",
    "septembrie": "09",
    "octombrie": "10",
    "noiembrie": "11",
    "decembrie": "12",
}


def _metered_segment(
    raw_label: str,
    category_name: str,
    unit: str,
    *,
    include_in_category: bool = True,
    include_in_unit_cost: bool = True,
    store_consumption: bool = True,
):
    return {
        "type": "metered",
        "raw_label": raw_label,
        "normalized_label": category_name,
        "category_name": category_name,
        "unit": unit,
        "line_kind": "utility",
        "include_in_overall_analytics": True,
        "include_in_category_analytics": include_in_category,
        "include_in_unit_cost": include_in_unit_cost,
        "store_consumption": store_consumption,
    }


def _charge_segment(
    raw_label: str,
    *,
    category_name: Optional[str] = None,
    unit: Optional[str] = None,
    line_kind: str = "fee",
    include_in_overall: bool = True,
    include_in_category: bool = False,
    include_in_unit_cost: bool = False,
):
    return {
        "type": "charge",
        "raw_label": raw_label,
        "normalized_label": category_name or raw_label,
        "category_name": category_name,
        "unit": unit,
        "line_kind": line_kind,
        "include_in_overall_analytics": include_in_overall,
        "include_in_category_analytics": include_in_category,
        "include_in_unit_cost": include_in_unit_cost,
    }


def _summary_segment(raw_label: str):
    return {"type": "summary", "raw_label": raw_label}


AVIZIER_PROFILES: Dict[str, Dict[str, Any]] = {
    "septembrie 2025": {
        "name": "blocmanagernet_2025_09",
        "segments": [
            _metered_segment("Apa rece", "Water", "m3"),
            _metered_segment("Apa calda", "Water", "m3"),
            _metered_segment("Apa parti comune", "Water", "m3"),
            _metered_segment("Apa meteorica", "Water", "m3"),
            _charge_segment("Gaze naturale", category_name="Gas", line_kind="utility", include_in_category=True),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Diverse"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Corectii"),
            _summary_segment("Total luna"),
            _charge_segment("Fond de rulment", line_kind="fund", include_in_overall=False),
            _charge_segment("Restanta fonduri", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta intretinere", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta penalizare", line_kind="penalty", include_in_overall=False),
            _charge_segment("Penalizari", line_kind="penalty", include_in_overall=False),
            _summary_segment("Total de plata"),
        ],
    },
    "octombrie 2025": {
        "name": "blocmanagernet_2025_10",
        "segments": [
            _metered_segment("Apa rece", "Water", "m3"),
            _metered_segment("Apa calda", "Water", "m3"),
            _metered_segment("Apa parti comune", "Water", "m3"),
            _metered_segment("Gaze naturale", "Gas", "unit", include_in_unit_cost=False, store_consumption=False),
            _metered_segment("Caldura", "Heating", "unit", include_in_unit_cost=False, store_consumption=False),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _summary_segment("Total luna"),
            _charge_segment("Fond de rulment", line_kind="fund", include_in_overall=False),
            _charge_segment("Restanta fonduri", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta intretinere", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta penalizare", line_kind="penalty", include_in_overall=False),
            _charge_segment("Penalizari", line_kind="penalty", include_in_overall=False),
            _summary_segment("Total de plata"),
        ],
    },
    "noiembrie 2025": {
        "name": "blocmanagernet_2025_11",
        "segments": [
            _metered_segment("Apa rece", "Water", "m3"),
            _metered_segment("Apa calda", "Water", "m3"),
            _metered_segment("Apa parti comune", "Water", "m3"),
            _metered_segment("Gaze naturale", "Gas", "unit", include_in_unit_cost=False, store_consumption=False),
            _metered_segment("Caldura", "Heating", "unit", include_in_unit_cost=False, store_consumption=False),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Citire repartitoare"),
            _charge_segment("Mentenanta gaze"),
            _summary_segment("Total luna"),
            _charge_segment("Restanta fonduri", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta intretinere", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta penalizare", line_kind="penalty", include_in_overall=False),
            _charge_segment("Penalizari", line_kind="penalty", include_in_overall=False),
            _summary_segment("Total de plata"),
        ],
    },
    "decembrie 2025": {
        "name": "blocmanagernet_2025_12",
        "segments": [
            _metered_segment("Apa rece", "Water", "m3"),
            _metered_segment("Apa calda", "Water", "m3"),
            _metered_segment("Apa parti comune", "Water", "m3"),
            _metered_segment("Gaze naturale", "Gas", "unit", include_in_unit_cost=False, store_consumption=False),
            _metered_segment("Caldura", "Heating", "unit", include_in_unit_cost=False, store_consumption=False),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Citire repartitoare"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Mentenanta gaze"),
            _summary_segment("Total luna"),
            _charge_segment("Restanta fonduri", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta intretinere", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta penalizare", line_kind="penalty", include_in_overall=False),
            _charge_segment("Penalizari", line_kind="penalty", include_in_overall=False),
            _summary_segment("Total de plata"),
        ],
    },
    "ianuarie 2026": {
        "name": "blocmanagernet_2026_01",
        "segments": [
            _metered_segment("Apa rece", "Water", "m3"),
            _metered_segment("Apa calda", "Water", "m3"),
            _metered_segment("Apa parti comune", "Water", "m3"),
            _metered_segment("Gaze naturale", "Gas", "unit", include_in_unit_cost=False, store_consumption=False),
            _metered_segment("Caldura", "Heating", "unit", include_in_unit_cost=False, store_consumption=False),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Citire repartitoare"),
            _summary_segment("Total luna"),
            _charge_segment("Restanta fonduri", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta intretinere", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta penalizare", line_kind="penalty", include_in_overall=False),
            _charge_segment("Penalizari", line_kind="penalty", include_in_overall=False),
            _summary_segment("Total de plata"),
        ],
    },
    "februarie 2026": {
        "name": "blocmanagernet_2026_02",
        "segments": [
            _metered_segment("Apa rece", "Water", "m3"),
            _metered_segment("Apa calda", "Water", "m3"),
            _metered_segment("Apa parti comune", "Water", "m3"),
            _metered_segment("Gaze naturale", "Gas", "unit", include_in_unit_cost=False, store_consumption=False),
            _metered_segment("Caldura", "Heating", "unit", include_in_unit_cost=False, store_consumption=False),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Mentenanta gaze"),
            _charge_segment("Citire repartitoare"),
            _charge_segment("Citire apometre"),
            _summary_segment("Total luna"),
            _charge_segment("Restanta fonduri", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta intretinere", line_kind="arrears", include_in_overall=False),
            _charge_segment("Restanta penalizare", line_kind="penalty", include_in_overall=False),
            _charge_segment("Penalizari", line_kind="penalty", include_in_overall=False),
            _summary_segment("Total de plata"),
        ],
    },
}


class InvoiceParser:
    @staticmethod
    def _parse_number(value: str) -> float:
        cleaned = value.strip()
        if "," in cleaned and "." in cleaned:
            cleaned = cleaned.replace(".", "")
        cleaned = cleaned.replace(",", ".")
        return float(cleaned)

    @staticmethod
    def get_pdf_text(file_path: str) -> str:
        text = ""
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        except Exception:
            pass
        return text

    @staticmethod
    def detect_provider(text: str, available_providers: List[Any]) -> Optional[Any]:
        lower_text = text.lower()

        if "asociatia de proprietari" in lower_text or "lista de plată" in lower_text:
            for provider in available_providers:
                if "administratie" in provider.name.lower() or "asociatie" in provider.name.lower():
                    return provider

        for provider in available_providers:
            if provider.name.lower() in lower_text:
                return provider
        return None

    @staticmethod
    def parse_pdf(text: str, provider_name: str, location_name: str = "") -> Dict[str, Any]:
        result = {
            "invoice_date": None,
            "due_date": None,
            "amount": 0.0,
            "consumption_value": 0.0,
            "currency": "RON",
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
            InvoiceParser._parse_avizier_summary(text, result, location_name)
        else:
            InvoiceParser._parse_generic(text, result)

        return result

    @staticmethod
    def parse_association_statement(text: str) -> Dict[str, Any]:
        if not text:
            return {
                "statement_month": None,
                "display_month": "",
                "posted_date": None,
                "due_date": None,
                "parsing_profile": None,
                "apartments": [],
            }

        display_month = InvoiceParser._extract_statement_month(text)
        statement_month = InvoiceParser._parse_statement_month_to_date(display_month)
        posted_date = InvoiceParser._parse_romanian_date_from_text(text, r"data\s+afi[şs][aă]rii[:\s]+(\d{1,2})\s+([A-Za-zăâîşțţ]+)\s+(\d{4})")
        due_date = InvoiceParser._parse_romanian_date_from_text(text, r"data\s+scadent[ăa][:\s]+(\d{1,2})\s+([A-Za-zăâîşțţ]+)\s+(\d{4})")

        row_lines = []
        for line in text.splitlines():
            normalized_line = " ".join(line.split())
            if re.match(r"^\d+\s+\d+\s+\d,\d{3}\s", normalized_line):
                row_lines.append(normalized_line)

        sample_length = None
        for row_line in row_lines:
            trimmed = InvoiceParser._trim_avizier_row_tokens(row_line.split())
            if trimmed:
                sample_length = len(trimmed)
                break

        profile = InvoiceParser._detect_avizier_profile(display_month, sample_length)
        apartments: List[Dict[str, Any]] = []
        if not profile:
            return {
                "statement_month": statement_month,
                "display_month": display_month,
                "posted_date": posted_date,
                "due_date": due_date,
                "parsing_profile": None,
                "apartments": apartments,
            }

        for row_line in row_lines:
            row_parts = row_line.split()
            apartment_number = row_parts[0]
            trimmed_values = InvoiceParser._trim_avizier_row_tokens(row_parts)
            if len(trimmed_values) != InvoiceParser._count_profile_values(profile):
                continue
            apartments.append(InvoiceParser._parse_avizier_row(apartment_number, trimmed_values, profile))

        return {
            "statement_month": statement_month,
            "display_month": display_month,
            "posted_date": posted_date,
            "due_date": due_date,
            "parsing_profile": profile["name"],
            "apartments": apartments,
        }

    @staticmethod
    def _extract_statement_month(text: str) -> str:
        match = re.search(r"lista\s+de\s+plat[ăa]\s+pe\s+luna\s+([A-Za-zăâîşțţ]+\s+\d{4})", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""

    @staticmethod
    def _parse_statement_month_to_date(display_month: str) -> Optional[date]:
        if not display_month:
            return None
        parts = display_month.split()
        if len(parts) != 2:
            return None
        month = ROMANIAN_MONTHS.get(parts[0].lower())
        if not month:
            return None
        return datetime.strptime(f"01.{month}.{parts[1]}", "%d.%m.%Y").date()

    @staticmethod
    def _parse_romanian_date_from_text(text: str, pattern: str) -> Optional[date]:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            return None
        day, month_name, year = match.groups()
        month = ROMANIAN_MONTHS.get(month_name.lower())
        if not month:
            return None
        return datetime.strptime(f"{day.zfill(2)}.{month}.{year}", "%d.%m.%Y").date()

    @staticmethod
    def _detect_avizier_profile(display_month: str, sample_length: Optional[int]) -> Optional[Dict[str, Any]]:
        if display_month:
            profile = AVIZIER_PROFILES.get(display_month.lower())
            if profile:
                return profile
        if sample_length is None:
            return None
        for profile in AVIZIER_PROFILES.values():
            if InvoiceParser._count_profile_values(profile) == sample_length:
                return profile
        return None

    @staticmethod
    def _count_profile_values(profile: Dict[str, Any]) -> int:
        count = 0
        for segment in profile["segments"]:
            if segment["type"] == "metered":
                count += 2
            else:
                count += 1
        return count

    @staticmethod
    def _trim_avizier_row_tokens(parts: List[str]) -> List[str]:
        if len(parts) < 6:
            return []
        apartment_number = parts[0]
        trimmed = parts[3:]
        if len(trimmed) >= 2 and trimmed[-1] == apartment_number:
            trimmed = trimmed[:-1]
        elif len(trimmed) >= 2 and trimmed[-2] == apartment_number:
            trimmed = trimmed[:-2]
        return trimmed

    @staticmethod
    def _parse_avizier_row(apartment_number: str, values: List[str], profile: Dict[str, Any]) -> Dict[str, Any]:
        line_items = []
        monthly_total = 0.0
        total_payable = 0.0
        cursor = 0

        for segment in profile["segments"]:
            if segment["type"] == "metered":
                amount = InvoiceParser._safe_parse(values[cursor])
                consumption = InvoiceParser._safe_parse(values[cursor + 1])
                cursor += 2
                if abs(amount) < 0.001 and abs(consumption) < 0.001:
                    continue
                line_items.append({
                    "raw_label": segment["raw_label"],
                    "normalized_label": segment["normalized_label"],
                    "category_name": segment["category_name"],
                    "line_kind": segment["line_kind"],
                    "amount": amount,
                    "consumption_value": consumption if segment.get("store_consumption", True) else None,
                    "unit": segment["unit"] if segment.get("store_consumption", True) else None,
                    "include_in_overall_analytics": segment["include_in_overall_analytics"],
                    "include_in_category_analytics": segment["include_in_category_analytics"],
                    "include_in_unit_cost": segment["include_in_unit_cost"],
                })
                continue

            value = InvoiceParser._safe_parse(values[cursor])
            cursor += 1
            if segment["type"] == "summary":
                if segment["raw_label"] == "Total luna":
                    monthly_total = value
                elif segment["raw_label"] == "Total de plata":
                    total_payable = value
                continue
            if abs(value) < 0.001:
                continue
            line_items.append({
                "raw_label": segment["raw_label"],
                "normalized_label": segment["normalized_label"],
                "category_name": segment["category_name"],
                "line_kind": segment["line_kind"],
                "amount": value,
                "consumption_value": None,
                "unit": segment["unit"],
                "include_in_overall_analytics": segment["include_in_overall_analytics"],
                "include_in_category_analytics": segment["include_in_category_analytics"],
                "include_in_unit_cost": segment["include_in_unit_cost"],
            })

        return {
            "apartment_number": apartment_number,
            "monthly_total": monthly_total,
            "total_payable": total_payable or monthly_total,
            "line_items": line_items,
        }

    @staticmethod
    def _safe_parse(value: str) -> float:
        try:
            return InvoiceParser._parse_number(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _parse_hidroelectrica(text: str, result: Dict[str, Any]):
        billing_match = re.search(r"(?:data\s+de|data\s+factur(?:[aă]rii|ii)[:\s]+)\s*(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
        due_match = re.search(r"scaden[ţt][aă][:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if due_match:
            result["due_date"] = datetime.strptime(due_match.group(1), "%d.%m.%Y").date()

        amount_match = re.search(r"total\s+de\s+plat[aă](?:.*?)\s+([\d\.,]+)lei", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+de\s+plat[aă](?:[^0-9,]+)?([\d\.,]+)", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+factur[aă][:\s]+([\d\.,]+)", text, re.IGNORECASE)

        if amount_match:
            try:
                result["amount"] = InvoiceParser._parse_number(amount_match.group(1))
            except ValueError:
                pass

        summary_consumption_match = re.search(
            r"consum\s+energie\s+activ[ăa]\s+în\s+perioada\s+de\s+facturare\s+([\d\.,]+)\s*kwh",
            text,
            re.IGNORECASE,
        )
        if summary_consumption_match:
            try:
                value = InvoiceParser._parse_number(summary_consumption_match.group(1))
                if value > 0:
                    result["consumption_value"] = value
                    return
            except ValueError:
                pass

        metering_match = re.search(
            r"cantitate\s+de\s+facturat.*?ea\s+kwh\s+[\d\.,]+\s+\d+\s+\d+\s+([\d\.,]+)",
            text,
            re.IGNORECASE | re.DOTALL,
        )
        if metering_match:
            try:
                value = InvoiceParser._parse_number(metering_match.group(1))
                if value > 0:
                    result["consumption_value"] = value
                    return
            except ValueError:
                pass

        current_charge_matches = re.findall(
            r"energie\s+activ[ăa]\s+factur[ăa]\s+curent[ăa]\s+\d+\s+(-?[\d\.,]+)\s*kwh",
            text,
            re.IGNORECASE,
        )
        if current_charge_matches:
            try:
                values = [InvoiceParser._parse_number(match) for match in current_charge_matches]
                positive_total = sum(value for value in values if value > 0)
                if positive_total > 0:
                    result["consumption_value"] = positive_total
                    return
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
        due_match = re.search(r"termen\s+de\s+plat[aă][:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if due_match:
            result["due_date"] = datetime.strptime(due_match.group(1), "%d.%m.%Y").date()

        amount_match = re.search(r"total\s+factur[aă]\s+curent[aă][:\s]+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+de\s+plat[aă]\s+cu\s+t\.v\.a\.?\s+([\d\.,]+)", text, re.IGNORECASE)
        if not amount_match:
            amount_match = re.search(r"total\s+factur[aă]\s+curent[aă][:\s]+([\d\.,]+)", text, re.IGNORECASE)

        if amount_match:
            try:
                result["amount"] = InvoiceParser._parse_number(amount_match.group(1))
            except ValueError:
                pass

        meter_detail_matches = re.findall(
            r"DGSR-[A-Z0-9-]+\s+(-?[\d\.,]+)\s+[\d\.,]+\s+[\d\.,]+",
            text,
            re.IGNORECASE,
        )
        if meter_detail_matches:
            try:
                values = [InvoiceParser._parse_number(match) for match in meter_detail_matches]
                positive_total = sum(value for value in values if value > 0)
                if positive_total > 0:
                    result["consumption_value"] = positive_total
                    return
            except ValueError:
                pass

        consumption_match = re.search(r"consum\s+gaze\s+naturale\s+\(kwh\)\s+([\d\.,]+)", text, re.IGNORECASE)
        if consumption_match:
            try:
                value = InvoiceParser._parse_number(consumption_match.group(1))
                if value > 0:
                    result["consumption_value"] = value
                    return
            except ValueError:
                pass

    @staticmethod
    def _parse_avizier_summary(text: str, result: Dict[str, Any], location_name: str):
        structured = InvoiceParser.parse_association_statement(text)
        if structured.get("posted_date"):
            result["invoice_date"] = structured["posted_date"]
        elif structured.get("statement_month"):
            result["invoice_date"] = structured["statement_month"]
        if structured.get("due_date"):
            result["due_date"] = structured["due_date"]

        apt_num_match = re.search(r"(\d+)", location_name)
        if not apt_num_match:
            return
        apartment_number = apt_num_match.group(1)
        apartment = next((item for item in structured.get("apartments", []) if item["apartment_number"] == apartment_number), None)
        if not apartment:
            return
        result["amount"] = apartment.get("total_payable", 0.0)
        water_consumption = sum(
            line.get("consumption_value") or 0.0
            for line in apartment.get("line_items", [])
            if line.get("category_name") == "Water" and line.get("include_in_unit_cost")
        )
        result["consumption_value"] = water_consumption

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
        due_match = re.search(r"(?:due|scadent[ăa]|termen(?:\s+de\s+plat[ăa])?)[:\s]+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if due_match:
            try:
                result["due_date"] = datetime.strptime(due_match.group(1), "%d.%m.%Y").date()
            except ValueError:
                pass

        amount_match = re.search(r"total[:\s]+([\d\.,]+)", text, re.IGNORECASE)
        if amount_match:
            try:
                result["amount"] = InvoiceParser._parse_number(amount_match.group(1))
            except (ValueError, TypeError):
                pass
