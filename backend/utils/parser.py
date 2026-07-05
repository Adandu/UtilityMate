import pdfplumber
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from .logging_config import logger


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

ROMANIAN_CHAR_MAP = str.maketrans({
    "ă": "a",
    "â": "a",
    "î": "i",
    "ș": "s",
    "ş": "s",
    "ț": "t",
    "ţ": "t",
    "Ă": "a",
    "Â": "a",
    "Î": "i",
    "Ș": "s",
    "Ş": "s",
    "Ț": "t",
    "Ţ": "t",
})


def _metered_segment(
    raw_label: str,
    category_name: str,
    unit: str,
    *,
    include_in_category: bool = True,
    include_in_unit_cost: bool = True,
    store_consumption: bool = True,
    amount_position: str = "first",
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
        "amount_position": amount_position,
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


def _dual_charge_segment(
    left_raw_label: str,
    left_category_name: str,
    right_raw_label: str,
    right_category_name: str,
):
    return {
        "type": "dual_charge",
        "items": [
            {
                "raw_label": left_raw_label,
                "normalized_label": left_category_name,
                "category_name": left_category_name,
                "unit": None,
                "line_kind": "utility",
                "include_in_overall_analytics": True,
                "include_in_category_analytics": True,
                "include_in_unit_cost": False,
            },
            {
                "raw_label": right_raw_label,
                "normalized_label": right_category_name,
                "category_name": right_category_name,
                "unit": None,
                "line_kind": "utility",
                "include_in_overall_analytics": True,
                "include_in_category_analytics": True,
                "include_in_unit_cost": False,
            },
        ],
    }


AVIZIER_PROFILES: Dict[str, Dict[str, Any]] = {
    "septembrie 2025": {
        "name": "blocmanagernet_2025_09",
        "segments": [
            _metered_segment("Apa rece", "Cold Water", "m3"),
            _metered_segment("Apa calda", "Hot Water", "m3"),
            # This used to be followed by a second, separate "Apa meteorica"
            # metered segment. That was the same double-water-column bug
            # fixed in AVIZIER_COLUMN_CATALOG below: verified against the
            # real Septembrie 2025 statement's own row data, there is only
            # one shared/common-area water column here, not two. This
            # profile's real Septembrie 2025 row also genuinely includes
            # "Salarii asociatie" and "Servicii administrare" columns (added
            # below) that were previously missing -- their absence was
            # silently offset by the phantom "Apa meteorica" column keeping
            # the total column count numerically matching by coincidence,
            # even though every downstream label was shifted.
            _metered_segment("Apa parti comune", "Shared Water", "m3"),
            _charge_segment("Gaze naturale", category_name="Gas", line_kind="utility", include_in_category=True),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Servicii administrare"),
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
            _metered_segment("Apa rece", "Cold Water", "m3"),
            _metered_segment("Apa calda", "Hot Water", "m3"),
            _metered_segment("Apa parti comune", "Shared Water", "m3"),
            _dual_charge_segment("Gaze naturale", "Gas", "Caldura", "Heating"),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Citire lista"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Servicii administrare"),
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
            _metered_segment("Apa rece", "Cold Water", "m3"),
            _metered_segment("Apa calda", "Hot Water", "m3"),
            _metered_segment("Apa parti comune", "Shared Water", "m3"),
            _dual_charge_segment("Gaze naturale", "Gas", "Caldura", "Heating"),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Citire lista"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Servicii administrare"),
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
            _metered_segment("Apa rece", "Cold Water", "m3"),
            _metered_segment("Apa calda", "Hot Water", "m3"),
            _metered_segment("Apa parti comune", "Shared Water", "m3"),
            _dual_charge_segment("Gaze naturale", "Gas", "Caldura", "Heating"),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Citire lista"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Servicii administrare"),
            _charge_segment("Mentenanta gaze"),
            _charge_segment("Corectii"),
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
            _metered_segment("Apa rece", "Cold Water", "m3"),
            _metered_segment("Apa calda", "Hot Water", "m3"),
            _metered_segment("Apa parti comune", "Shared Water", "m3"),
            _dual_charge_segment("Gaze naturale", "Gas", "Caldura", "Heating"),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Citire lista"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Servicii administrare"),
            _charge_segment("Mentenanta gaze"),
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
            _metered_segment("Apa rece", "Cold Water", "m3"),
            _metered_segment("Apa calda", "Hot Water", "m3"),
            _metered_segment("Apa parti comune", "Shared Water", "m3"),
            _dual_charge_segment("Gaze naturale", "Gas", "Caldura", "Heating"),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Citire lista"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Servicii administrare"),
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
    "martie 2026": {
        "name": "blocmanagernet_2026_03",
        "segments": [
            _metered_segment("Apa rece", "Cold Water", "m3"),
            _metered_segment("Apa calda", "Hot Water", "m3"),
            _metered_segment("Apa parti comune", "Shared Water", "m3"),
            _dual_charge_segment("Gaze naturale", "Gas", "Caldura", "Heating"),
            _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True),
            _charge_segment("Salubritate"),
            _charge_segment("Salarii asociatie"),
            _charge_segment("Diverse"),
            _charge_segment("Citire lista"),
            _charge_segment("Cheltuieli administrative"),
            _charge_segment("Servicii curatenie"),
            _charge_segment("Servicii administrare"),
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


def _avizier_catalog_entry(key: str, signal_words: set, builder):
    return {"key": key, "signal_words": set(signal_words), "builder": builder}


# Canonical vocabulary of recognizable avizier column labels, built from the
# union of every segment already defined across AVIZIER_PROFILES above (the
# same `_metered_segment`/`_charge_segment` builders are reused, so this is
# not new business data — just metadata describing how to recognize each
# label from a document's own header text).
#
# The BlocManagerNET export template only ever changes by *adding or removing*
# columns over time; the relative left-to-right order of the columns it has
# used historically is stable. So instead of guessing a whole historical
# profile, we detect *which* of these known columns are present in a given
# statement's own header text (order-independent — see
# `_detect_avizier_columns_from_header` for why), and emit them in this
# well-established order.
AVIZIER_COLUMN_CATALOG: List[Dict[str, Any]] = [
    _avizier_catalog_entry("apa_rece", {"rece"}, lambda: _metered_segment("Apa rece", "Cold Water", "m3")),
    _avizier_catalog_entry("apa_calda", {"calda"}, lambda: _metered_segment("Apa calda", "Hot Water", "m3")),
    # "Apa parti comune" and "Apa meteorica" are NOT two separate physical
    # columns -- BlocManagerNET renders one shared/common-area water column
    # whose full label ("Apa parti comune (meteorica)") gets inconsistently
    # word-wrapped/split across months. Some months show "comune"/"parti" and
    # "meteorica" together on the same line, some split them across header
    # lines, and April shows "meteorica" alone with no "comune"/"parti" text
    # at all -- but in every real statement observed there is still only one
    # extra 2-value (amount + consumption) water segment in the actual row
    # data beyond "Apa rece"/"Apa calda". Treat any of these signal words as
    # triggering exactly one segment, under the historically-canonical
    # "Apa parti comune" / "Shared Water" label already used everywhere else
    # in AVIZIER_PROFILES and already shown correctly in the app's UI.
    _avizier_catalog_entry("apa_parti_comune", {"comune", "parti", "meteorica"}, lambda: _metered_segment("Apa parti comune", "Shared Water", "m3")),
    _avizier_catalog_entry("gaze_naturale", {"naturale"}, lambda: _charge_segment("Gaze naturale", category_name="Gas", line_kind="utility", include_in_category=True)),
    _avizier_catalog_entry("caldura", {"caldura"}, lambda: _charge_segment("Caldura", category_name="Heating", line_kind="utility", include_in_category=True)),
    _avizier_catalog_entry("energie_electrica", {"electrica"}, lambda: _charge_segment("Energie electrica", category_name="Energy", line_kind="utility", include_in_category=True)),
    _avizier_catalog_entry("salubritate", {"salubritate"}, lambda: _charge_segment("Salubritate")),
    _avizier_catalog_entry("salarii_asociatie", {"salarii"}, lambda: _charge_segment("Salarii asociatie")),
    _avizier_catalog_entry("diverse", {"diverse"}, lambda: _charge_segment("Diverse")),
    _avizier_catalog_entry("citire_lista", {"lista", "ista"}, lambda: _charge_segment("Citire lista")),
    _avizier_catalog_entry("cheltuieli_administrative", {"administrative"}, lambda: _charge_segment("Cheltuieli administrative")),
    _avizier_catalog_entry("servicii_curatenie", {"curatenie"}, lambda: _charge_segment("Servicii curatenie")),
    _avizier_catalog_entry("servicii_administrare", {"administrare"}, lambda: _charge_segment("Servicii administrare")),
    _avizier_catalog_entry("mentenanta_gaze", {"mentenanta"}, lambda: _charge_segment("Mentenanta gaze")),
    # One-off fire-prevention-system fee column, confirmed present only in the
    # real Noiembrie 2025 statement (immediately after "Mentenanta gaze" and
    # before "Total luna" in that month's own row data). Scoped to the
    # distinctive "preventie" signal word so it stays dormant for every other
    # month that doesn't have this charge.
    _avizier_catalog_entry("sistem_preventie", {"preventie"}, lambda: _charge_segment("Sistem preventie")),
    # Reading-fee columns: historically single, but the export template has
    # been observed to duplicate the "apometre" reading-fee column instead of
    # keeping one "repartitoare" + one "apometre" column (see the multiplicity
    # detection in `_detect_avizier_columns_from_header`), so these two are
    # handled with counted repetition rather than plain presence.
    _avizier_catalog_entry("citire_repartitoare", {"repartitoare"}, lambda: _charge_segment("Citire repartitoare")),
    _avizier_catalog_entry("citire_apometre", {"apometre"}, lambda: _charge_segment("Citire apometre")),
    _avizier_catalog_entry("corectii", {"corectii"}, lambda: _charge_segment("Corectii")),
    _avizier_catalog_entry("fond_de_rulment", {"rulment"}, lambda: _charge_segment("Fond de rulment", line_kind="fund", include_in_overall=False)),
]

# Columns that always appear after "Total luna" and before "Total de plata".
AVIZIER_TAIL_CATALOG: List[Dict[str, Any]] = [
    _avizier_catalog_entry("restanta_fonduri", {"fonduri"}, lambda: _charge_segment("Restanta fonduri", line_kind="arrears", include_in_overall=False)),
    _avizier_catalog_entry("restanta_intretinere", {"intretinere"}, lambda: _charge_segment("Restanta intretinere", line_kind="arrears", include_in_overall=False)),
    _avizier_catalog_entry("restanta_penalizare", {"penalizare"}, lambda: _charge_segment("Restanta penalizare", line_kind="penalty", include_in_overall=False)),
    _avizier_catalog_entry("penalizari", {"penalizari"}, lambda: _charge_segment("Penalizari", line_kind="penalty", include_in_overall=False)),
]

# Reading-fee columns whose real-world multiplicity is counted rather than
# just detected as present/absent (see _detect_avizier_columns_from_header).
_AVIZIER_MULTI_COUNT_KEYS = {"citire_repartitoare", "citire_apometre"}

# Minimum number of distinct columns that must be recognized from a
# document's own header before we trust it over the historical-profile
# fallback.
_AVIZIER_MIN_RECOGNIZED_COLUMNS = 5


class InvoiceParser:
    @staticmethod
    def _parse_number(value: str) -> float:
        cleaned = value.strip()
        if "," in cleaned and "." in cleaned:
            # Locale is ambiguous when both separators appear. Whichever separator
            # occurs last in the string is the decimal separator; every earlier
            # occurrence of either character is a thousands separator to strip.
            last_comma = cleaned.rfind(",")
            last_dot = cleaned.rfind(".")
            if last_comma > last_dot:
                decimal_sep, thousands_sep = ",", "."
            else:
                decimal_sep, thousands_sep = ".", ","
            cleaned = cleaned.replace(thousands_sep, "")
            if decimal_sep == ",":
                cleaned = cleaned.replace(",", ".")
        else:
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
        except Exception as exc:
            # Distinguish encrypted/password-protected PDFs from other failures
            # (corrupted files, unexpected formats, genuinely image-only/scanned
            # PDFs) in the logs, even though the caller only sees an empty string.
            try:
                import pypdfium2

                if isinstance(exc, pypdfium2.PdfiumError):
                    err_code = getattr(exc, "err_code", None)
                    if err_code in (
                        pypdfium2.raw.FPDF_ERR_PASSWORD,
                        pypdfium2.raw.FPDF_ERR_SECURITY,
                    ):
                        logger.warning(
                            "PDF text extraction failed for %s: encrypted/password-protected PDF (%s: %s)",
                            file_path,
                            type(exc).__name__,
                            exc,
                        )
                        return text
            except ImportError:
                pass

            logger.warning(
                "PDF text extraction failed for %s (%s: %s)",
                file_path,
                type(exc).__name__,
                exc,
            )
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
            "billing_period_start": None,
            "billing_period_end": None,
            "due_date": None,
            "amount": 0.0,
            "consumption_value": 0.0,
            "meter_index_old": None,
            "meter_index_new": None,
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
                "needs_review": True,
                "parsing_notes": "No text could be extracted from this PDF.",
                "apartments": [],
            }

        display_month = InvoiceParser._extract_statement_month(text)
        statement_month = InvoiceParser._parse_statement_month_to_date(display_month)
        posted_date = InvoiceParser._parse_romanian_date_from_text(text, r"data\s+afi[şs][aă]rii[:\s]+(\d{1,2})\s+([A-Za-zăâîşțţ]+)\s+(\d{4})")
        due_date = InvoiceParser._parse_romanian_date_from_text(text, r"data\s+scadent[ăa][:\s]+(\d{1,2})\s+([A-Za-zăâîşțţ]+)\s+(\d{4})")

        lines = text.splitlines()
        row_lines = []
        first_row_index: Optional[int] = None
        for index, line in enumerate(lines):
            normalized_line = " ".join(line.split())
            if InvoiceParser._looks_like_avizier_row(normalized_line):
                if first_row_index is None:
                    first_row_index = index
                row_lines.append(normalized_line)

        header_text = "\n".join(lines[:first_row_index]) if first_row_index is not None else text

        sample_length = None
        for row_line in row_lines:
            trimmed = InvoiceParser._trim_avizier_row_tokens(row_line.split())
            if trimmed:
                sample_length = len(trimmed)
                break

        profile, needs_review, parsing_notes = InvoiceParser._resolve_avizier_profile(
            display_month, sample_length, header_text,
        )
        apartments: List[Dict[str, Any]] = []
        if not profile:
            return {
                "statement_month": statement_month,
                "display_month": display_month,
                "posted_date": posted_date,
                "due_date": due_date,
                "parsing_profile": None,
                "needs_review": True,
                "parsing_notes": parsing_notes or "Unable to detect a column layout for this statement.",
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
            "needs_review": needs_review,
            "parsing_notes": parsing_notes,
            "apartments": apartments,
        }

    @staticmethod
    def _resolve_avizier_profile(
        display_month: str,
        sample_length: Optional[int],
        header_text: str,
    ) -> "tuple[Optional[Dict[str, Any]], bool, Optional[str]]":
        """Pick the column layout to use for a statement.

        Prefers reading the document's own header (see
        `_detect_avizier_columns_from_header`) over guessing a historical
        `AVIZIER_PROFILES` entry. Only falls back to a historical profile —
        and flags the statement for manual review — when header recognition
        genuinely fails or the recognized column count doesn't match the
        row's actual numeric value count.
        """
        header_profile = InvoiceParser._detect_avizier_columns_from_header(header_text)
        if header_profile is not None:
            header_slots = InvoiceParser._count_profile_values(header_profile)
            if sample_length is not None and header_slots == sample_length:
                return header_profile, False, None
            parsing_notes = (
                f"This statement's header suggested {header_slots} columns but its "
                f"rows have {sample_length if sample_length is not None else 'an unknown number of'} "
                "values; fell back to the closest known historical column layout. "
                "Please verify the imported amounts manually."
            )
        else:
            parsing_notes = (
                "Could not confidently recognize this statement's own column "
                "headers; fell back to the closest known historical column layout. "
                "Please verify the imported amounts manually."
            )

        fallback_profile = InvoiceParser._detect_avizier_profile(display_month, sample_length, header_text)
        if fallback_profile is not None:
            return fallback_profile, True, parsing_notes
        return None, True, parsing_notes

    @staticmethod
    def _detect_avizier_columns_from_header(header_text: str) -> Optional[Dict[str, Any]]:
        """Build a column layout ("profile") by reading a statement's own
        header row, instead of matching it against a fixed historical
        profile.

        BlocManagerNET's export template is hand-edited every so often, so
        the set of columns (and occasionally their count) drifts from month
        to month. Rather than guessing which historical month a new
        statement "looks like", this recognizes each column directly from
        the header text of *this* document.

        The header text pdfplumber extracts for these PDFs frequently comes
        out with individual words character-reversed (and sometimes
        duplicated, e.g. a secondary ALL-CAPS recap line), so detection is
        deliberately order-independent: each catalog label is recognized by
        a small set of "signal words", checked in both their normal and
        reversed-and-normalized spelling, anywhere in the header text.

        The two reading-fee columns ("Citire repartitoare" / "Citire
        apometre") are the one part of the template that has been observed
        to *duplicate* rather than simply appear/disappear (e.g. two
        "apometre" columns replacing one "repartitoare" + one "apometre"
        column). Detecting that requires counting occurrences rather than
        just presence, so it is scoped to the header's own
        "Mentenanta gaze ... Citire apometre" zone (bounded by the
        "administrare" and "luna" anchors) to avoid confusing a real repeated
        column with unrelated echoes of the same words elsewhere in the
        header -- e.g. a "Citire lista" label a few words earlier can leave
        an unrelated stray "repartitoare"-shaped echo in the extracted text.
        There are never more than 2 real reading-fee columns in this zone
        (either one "repartitoare" + one "apometre", or two "apometre"), and
        they always sit immediately before "Total luna", so scanning
        backward from "luna" and stopping once 2 have been collected finds
        the real pair even when -- as verified against the real Mai 2026
        statement -- the extraction quirk places one of the two duplicated
        "apometre" tokens before "mentenanta" instead of after it (unlike
        the real Aprilie 2026 statement, where the token in that same
        position is the unrelated echo and must NOT be counted).

        Every statement also carries a fixed boilerplate title line ("Lista
        de plată pe luna <month> <year>") ahead of the real column-header
        line. That boilerplate's literal word "Lista" collides with the
        distinct "Citire lista" reading-fee column's "lista"/"ista" signal
        words, producing a false-positive "citire_lista" match on statements
        that don't actually have that column (confirmed against the real
        Septembrie 2025 statement). Strip it before tokenizing.
        """
        header_text = re.sub(
            r"lista\s+de\s+plat[ăa]\s+pe\s+luna\s+[A-Za-zăâîşțţ]+\s+\d{4}",
            " ",
            header_text or "",
            flags=re.IGNORECASE,
        )
        tokens = re.findall(r"[A-Za-zĂÂÎȘŞȚŢăâîșşțţ]+", header_text or "")
        if not tokens:
            return None

        decoded: List[set] = []
        for token in tokens:
            forms = {
                InvoiceParser._normalize_romanian_text(token),
                InvoiceParser._normalize_romanian_text(token[::-1]),
            }
            forms.discard("")
            decoded.append(forms)

        all_words: set = set()
        for forms in decoded:
            all_words |= forms

        window_start: Optional[int] = None
        window_end = len(decoded)
        for index, forms in enumerate(decoded):
            if "administrare" in forms:
                window_start = index
                break
        for index, forms in enumerate(decoded):
            if "luna" in forms and (window_start is None or index > window_start):
                window_end = index
                break

        reading_fee_counts = {"repartitoare": 0, "apometre": 0}
        collected = 0
        scan_from = window_end - 1
        scan_to = window_start if window_start is not None else 0
        for index in range(scan_from, scan_to - 1, -1):
            if collected >= 2:
                break
            forms = decoded[index]
            if "repartitoare" in forms:
                reading_fee_counts["repartitoare"] += 1
                collected += 1
            elif "apometre" in forms:
                reading_fee_counts["apometre"] += 1
                collected += 1

        def windowed_count(signal_word: str) -> int:
            if signal_word in reading_fee_counts:
                return reading_fee_counts[signal_word]
            return 1 if signal_word in all_words else 0

        segments: List[Dict[str, Any]] = []
        recognized_keys: List[str] = []
        for entry in AVIZIER_COLUMN_CATALOG:
            if entry["key"] in _AVIZIER_MULTI_COUNT_KEYS:
                signal_word = next(iter(entry["signal_words"]))
                repeat = windowed_count(signal_word)
            else:
                repeat = 1 if entry["signal_words"] & all_words else 0
            for _ in range(repeat):
                segments.append(entry["builder"]())
                recognized_keys.append(entry["key"])

        if len(recognized_keys) < _AVIZIER_MIN_RECOGNIZED_COLUMNS:
            return None

        segments.append(_summary_segment("Total luna"))

        for entry in AVIZIER_TAIL_CATALOG:
            if entry["signal_words"] & all_words:
                segments.append(entry["builder"]())
                recognized_keys.append(entry["key"])

        segments.append(_summary_segment("Total de plata"))

        return {
            "name": f"header_detected_{len(recognized_keys)}cols",
            "segments": segments,
            "recognized_keys": recognized_keys,
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
    def _normalize_romanian_text(value: str) -> str:
        normalized = (value or "").translate(ROMANIAN_CHAR_MAP).lower()
        normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
        return " ".join(normalized.split())

    @staticmethod
    def _tokenize_avizier_header_text(header_text: str) -> set[str]:
        tokens: set[str] = set()
        for raw_token in re.findall(r"[A-Za-zĂÂÎȘŞȚŢăâîșşțţ]+", header_text or ""):
            normalized = InvoiceParser._normalize_romanian_text(raw_token)
            if normalized:
                tokens.add(normalized)

            reversed_normalized = InvoiceParser._normalize_romanian_text(raw_token[::-1])
            if reversed_normalized:
                tokens.add(reversed_normalized)
        return tokens

    @staticmethod
    def _label_is_present_in_header(label: str, header_tokens: set[str]) -> bool:
        label_tokens = [token for token in InvoiceParser._normalize_romanian_text(label).split() if token]
        if not label_tokens:
            return False

        alias_groups = {
            "citire lista": [{"citire", "lista"}, {"citire", "ista"}],
            "servicii curatenie": [{"servicii", "curatenie"}],
            "servicii administrare": [{"servicii", "administrare"}],
            "cheltuieli administrative": [{"cheltuieli", "administrative"}],
            "mentenanta gaze": [{"mentenanta", "gaze"}],
            "fond de rulment": [{"fond", "rulment"}],
        }
        for alias in alias_groups.get(" ".join(label_tokens), [set(label_tokens)]):
            if alias.issubset(header_tokens):
                return True
        return False

    @staticmethod
    def _profile_header_signature(profile: Dict[str, Any]) -> List[str]:
        signature_labels: List[str] = []
        ignored_labels = {
            "apa rece",
            "apa calda",
            "apa parti comune",
            "energie electrica",
            "salubritate",
            "diverse",
            "cheltuieli administrative",
            "servicii curatenie",
            "total luna",
            "restanta fonduri",
            "restanta intretinere",
            "restanta penalizare",
            "penalizari",
            "total de plata",
        }

        for segment in profile["segments"]:
            if segment["type"] == "summary":
                continue
            if segment["type"] == "dual_charge":
                for item in segment["items"]:
                    normalized_label = InvoiceParser._normalize_romanian_text(item["raw_label"])
                    if normalized_label not in ignored_labels:
                        signature_labels.append(item["raw_label"])
                continue

            normalized_label = InvoiceParser._normalize_romanian_text(segment["raw_label"])
            if normalized_label not in ignored_labels:
                signature_labels.append(segment["raw_label"])

        return signature_labels

    @staticmethod
    def _detect_avizier_profile(display_month: str, sample_length: Optional[int], header_text: str = "") -> Optional[Dict[str, Any]]:
        if display_month:
            profile = AVIZIER_PROFILES.get(display_month.lower())
            if profile:
                return profile

        header_tokens = InvoiceParser._tokenize_avizier_header_text(header_text)
        if sample_length is None:
            return None

        matching_profiles = [
            profile
            for profile in AVIZIER_PROFILES.values()
            if InvoiceParser._count_profile_values(profile) == sample_length
        ]
        if not matching_profiles:
            return None
        if len(matching_profiles) == 1:
            return matching_profiles[0]

        best_profile = None
        best_score = float("-inf")
        for profile in matching_profiles:
            score = 0
            for label in InvoiceParser._profile_header_signature(profile):
                if InvoiceParser._label_is_present_in_header(label, header_tokens):
                    score += 2
                else:
                    score -= 1

            if (
                score > best_score
                or (
                    score == best_score
                    and best_profile is not None
                    and profile["name"] > best_profile["name"]
                )
            ):
                best_score = score
                best_profile = profile

        return best_profile

    @staticmethod
    def _count_profile_values(profile: Dict[str, Any]) -> int:
        count = 0
        for segment in profile["segments"]:
            if segment["type"] == "metered":
                count += 2
            elif segment["type"] == "dual_charge":
                count += len(segment["items"])
            else:
                count += 1
        return count

    @staticmethod
    def _is_avizier_numeric_token(value: str) -> bool:
        return bool(re.fullmatch(r"-|[-]?[\d\.,]+", value or ""))

    @staticmethod
    def _normalize_avizier_row_parts(parts: List[str], apartment_number: Optional[str] = None) -> List[str]:
        normalized: List[str] = []
        index = 0
        while index < len(parts):
            current = parts[index]
            next_part = parts[index + 1] if index + 1 < len(parts) else None

            if current == "-" and next_part and InvoiceParser._is_avizier_numeric_token(next_part):
                normalized.append(f"-{next_part}")
                index += 2
                continue

            if (
                next_part
                and re.fullmatch(r"\d{1,3}", current)
                and re.fullmatch(r"\d{3},\d{2}", next_part)
                and not (
                    apartment_number
                    and current == apartment_number
                    and index >= len(parts) - 2
                )
            ):
                normalized.append(f"{current}{next_part}")
                index += 2
                continue

            normalized.append(current)
            index += 1

        return normalized

    @staticmethod
    def _looks_like_avizier_row(line: str) -> bool:
        parts = InvoiceParser._normalize_avizier_row_parts(line.split())
        if len(parts) < 8:
            return False
        if not parts[0].isdigit() or not parts[1].isdigit():
            return False
        if not InvoiceParser._is_avizier_numeric_token(parts[2]):
            return False
        numeric_tail_tokens = sum(1 for part in parts[3:] if InvoiceParser._is_avizier_numeric_token(part))
        return numeric_tail_tokens >= max(6, len(parts[3:]) - 2)

    @staticmethod
    def _trim_avizier_row_tokens(parts: List[str]) -> List[str]:
        if len(parts) < 6:
            return []
        apartment_number = parts[0]
        trimmed = InvoiceParser._normalize_avizier_row_parts(parts[3:], apartment_number=apartment_number)
        for index in range(len(trimmed) - 1, max(len(trimmed) - 5, -1), -1):
            if trimmed[index] != apartment_number:
                continue
            trailing_tokens = trimmed[index + 1:]
            if all(InvoiceParser._is_avizier_numeric_token(token) for token in trailing_tokens):
                trimmed = trimmed[:index]
                break
        return trimmed

    @staticmethod
    def _parse_avizier_row(apartment_number: str, values: List[str], profile: Dict[str, Any]) -> Dict[str, Any]:
        line_items = []
        monthly_total = 0.0
        total_payable = 0.0
        cursor = 0

        for segment in profile["segments"]:
            if segment["type"] == "metered":
                first_value = InvoiceParser._safe_parse(values[cursor])
                second_value = InvoiceParser._safe_parse(values[cursor + 1])
                cursor += 2
                amount_position = segment.get("amount_position", "first")
                amount = second_value if amount_position == "second" else first_value
                consumption = first_value if amount_position == "second" else second_value
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

            if segment["type"] == "dual_charge":
                for item in segment["items"]:
                    value = InvoiceParser._safe_parse(values[cursor])
                    cursor += 1
                    if abs(value) < 0.001:
                        continue
                    line_items.append({
                        "raw_label": item["raw_label"],
                        "normalized_label": item["normalized_label"],
                        "category_name": item["category_name"],
                        "line_kind": item["line_kind"],
                        "amount": value,
                        "consumption_value": None,
                        "unit": item["unit"],
                        "include_in_overall_analytics": item["include_in_overall_analytics"],
                        "include_in_category_analytics": item["include_in_category_analytics"],
                        "include_in_unit_cost": item["include_in_unit_cost"],
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
    def _parse_statement_date(value: str) -> Optional[date]:
        candidate = value.strip()
        for fmt in ("%d.%m.%Y", "%d.%m.%y"):
            try:
                return datetime.strptime(candidate, fmt).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _parse_meter_index(value: str) -> Optional[float]:
        raw = (value or "").strip()
        if not raw:
            return None
        # Keep only digits and separator characters, then reuse the same
        # locale-aware decimal detection as _parse_number so "123.45" isn't
        # mangled into "12345".
        candidate = re.sub(r"[^\d,.\-]", "", raw)
        if not candidate:
            return None
        try:
            return InvoiceParser._parse_number(candidate)
        except (TypeError, ValueError):
            digits_only = re.sub(r"[^\d]", "", raw)
            if not digits_only:
                return None
            return float(digits_only)

    @staticmethod
    def _extract_billing_period(text: str) -> Optional[tuple[date, date]]:
        match = re.search(
            r"Perioad[ăa]\s+de\s+facturare:\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})",
            text,
            re.IGNORECASE,
        )
        if not match:
            return None

        start = InvoiceParser._parse_statement_date(match.group(1))
        end = InvoiceParser._parse_statement_date(match.group(2))
        if not start or not end:
            return None
        return (start, end)

    @staticmethod
    def _extract_hidroelectrica_meter_span(text: str) -> Optional[tuple[date, float, float, date]]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        spans = []

        for index, line in enumerate(lines):
            if "EA kWh" not in line:
                continue

            previous_line = lines[index - 1] if index > 0 else ""
            next_line = lines[index + 1] if index + 1 < len(lines) else ""
            previous_match = re.search(r"(\d{2}\.\d{2}\.\d{2})\s*-\s*(\d+)\s+(\d+)", previous_line)
            next_match = re.search(r"(\d{2}\.\d{2}\.\d{2})", next_line)
            if not previous_match or not next_match:
                continue

            start = InvoiceParser._parse_statement_date(previous_match.group(1))
            end = InvoiceParser._parse_statement_date(next_match.group(1))
            old_index = InvoiceParser._parse_meter_index(previous_match.group(2))
            new_index = InvoiceParser._parse_meter_index(previous_match.group(3))
            if not start or not end or old_index is None or new_index is None:
                continue
            spans.append((start, old_index, new_index, end))

        if not spans:
            return None

        first = spans[0]
        last = spans[-1]
        return (first[0], first[1], last[2], last[3])

    @staticmethod
    def _extract_engie_meter_span(text: str) -> Optional[tuple[date, float, float, date]]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        for index, line in enumerate(lines):
            if "DGSR-" not in line:
                continue

            previous_line = lines[index - 1] if index > 0 else ""
            next_line = lines[index + 1] if index + 1 < len(lines) else ""
            previous_match = re.search(r"(\d{2}\.\d{2}\.\d{4})\s+([\d\.,]+)\s+([\d\.,]+)", previous_line)
            next_match = re.search(r"(\d{2}\.\d{2}\.\d{4})", next_line)
            if not previous_match or not next_match:
                continue

            start = InvoiceParser._parse_statement_date(previous_match.group(1))
            end = InvoiceParser._parse_statement_date(next_match.group(1))
            old_index = InvoiceParser._parse_meter_index(previous_match.group(2))
            new_index = InvoiceParser._parse_meter_index(previous_match.group(3))
            if not start or not end or old_index is None or new_index is None:
                continue
            return (start, old_index, new_index, end)

        return None

    @staticmethod
    def _parse_hidroelectrica(text: str, result: Dict[str, Any]):
        billing_match = re.search(r"(?:data\s+de|data\s+factur(?:[aă]rii|ii)[:\s]+)\s*(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
        billing_period = InvoiceParser._extract_billing_period(text)
        if billing_period:
            result["billing_period_start"], result["billing_period_end"] = billing_period
        meter_span = InvoiceParser._extract_hidroelectrica_meter_span(text)
        if meter_span:
            result["billing_period_start"] = meter_span[0]
            result["meter_index_old"] = meter_span[1]
            result["meter_index_new"] = meter_span[2]
            result["billing_period_end"] = meter_span[3]
        # Hidroelectrica's PDF layout often interleaves an unrelated
        # column/row of text between the "Data scadenta:" label and its
        # actual value (e.g. a VAT breakdown line), so the date isn't
        # always immediately adjacent to the label in the extracted text.
        # Search (non-greedily) for the next date after the label instead
        # of requiring strict adjacency.
        due_match = re.search(r"scaden[ţtț][aă][:\s]*.*?(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE | re.DOTALL)
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
        billing_match = re.search(
            r"seria\s+eng\s+nr\.\s*\d+.*?data\s+facturii:\s*(\d{2}\.\d{2}\.\d{4})",
            text,
            re.IGNORECASE | re.DOTALL,
        )
        if not billing_match:
            billing_match = re.search(r"data\s+facturii:\s*(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if not billing_match:
            billing_match = re.search(r"data\s+emiterii:\s*(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if billing_match:
            result["invoice_date"] = datetime.strptime(billing_match.group(1), "%d.%m.%Y").date()
        billing_period = InvoiceParser._extract_billing_period(text)
        if billing_period:
            result["billing_period_start"], result["billing_period_end"] = billing_period
        meter_span = InvoiceParser._extract_engie_meter_span(text)
        if meter_span:
            result["billing_period_start"] = meter_span[0]
            result["meter_index_old"] = meter_span[1]
            result["meter_index_new"] = meter_span[2]
            result["billing_period_end"] = meter_span[3]
        # Engie's summary table often prints a row of unrelated numbers
        # (consumption/amount) between the "DATA SCADENTA" header and the
        # actual due date, so require the label first but allow a short gap
        # before the next date rather than strict adjacency.
        due_match = re.search(r"data\s+scadent[ăa]\s*.*?(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE | re.DOTALL)
        if not due_match:
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
            if line.get("unit") == "m3" and line.get("include_in_unit_cost")
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

        # Prefer specific, unambiguous total labels first (mirrors the vocabulary
        # already used by the Hidroelectrica/Engie parsers), then fall back to a
        # bare "total" only when it is immediately followed by a currency marker.
        # A bare "total[:\s]+<number>" with no further anchor is too permissive on
        # unrecognized providers and can pick up an unrelated number.
        amount_match = re.search(
            r"(?:total\s+de\s+plat[aă]|total\s+factur[aă]|sum[aă]\s+total[aă]|sum[aă]\s+de\s+plat[aă])"
            r"[:\s]+([\d\.,]+)",
            text,
            re.IGNORECASE,
        )
        if not amount_match:
            amount_match = re.search(
                r"total[:\s]+([\d\.,]+)\s*(?:lei|ron)\b",
                text,
                re.IGNORECASE,
            )
        if amount_match:
            try:
                result["amount"] = InvoiceParser._parse_number(amount_match.group(1))
            except (ValueError, TypeError):
                pass
