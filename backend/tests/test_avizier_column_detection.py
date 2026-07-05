import os
import sys


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.utils.parser import InvoiceParser


# Real, raw pdfplumber-extracted header text for three consecutive real
# production association statements (March/April/May 2026). Each word comes
# out per-word-reversed, exactly as pdfplumber returned it for these PDFs.
# March and April both have 25 numeric values per data row, but are NOT the
# same layout: April's export replaced March's single "Citire repartitoare" +
# single "Citire apometre" pair with two "Citire apometre" columns. May has
# only 23 numeric values per data row (a shorter, further-evolved layout).
MARCH_HEADER = "Cheltuieli pe index contoare individuale .pa .rN .srep .rN etrap atoC ecer ăpA ECER APA CM ădlac ăpA APA CM ADLAC enumoc iţrăp ăpA ăciroetem ăpA elarutan ezaG ărudlăC ăcirtcele eigrenE etatirbulaS Salarii esreviD eraotitraper eritiC atsI ileiutlehC evitartsinimda IICIVRES EINETARUC erartsinimda iicivreS ATNANETNEM EZAG ERAOTITRAPER ERITIC ERTEMOPA ănul latoT SNAVA /ăţnatseR ereniţertnî irudnof ăţnatseR erazilanep ăţnatseR irăzilaneP ătalp ed latoT .TPA .RN"

APRIL_HEADER = "Cheltuieli pe index contoare individuale .pa .rN .srep .rN etrap atoC ecer ăpA APA CM ECER ădlac ăpA APA CM ADLAC ăciroetem ăpA elarutan ezaG ărudlăC ăcirtcele eigrenE etatirbulaS Salarii esreviD eritiC atsI eraotitraper ileiutlehC evitartsinimda IICIVRES EINETARUC iicivreS erartsinimda ERTEMOPA ATNANETNEM EZAG ERTEMOPA ERITIC ERTEMOPA ănul latoT /ăţnatseR SNAVA ereniţertnî irudnof ăţnatseR ăţnatseR erazilanep irăzilaneP ătalp ed latoT .TPA .RN"

MAY_HEADER = "Cheltuieli pe index contoare individuale .pa .rN .srep .rN etrap atoC ecer ăpA APA CM ECER ădlac ăpA APA CM ADLAC iţrăp ăpA enumoc ăciroetem ăpA elarutan ezaG ăcirtcele eigrenE etatirbulaS Salarii esreviD ileiutlehC evitartsinimda IICIVRES EINETARUC iicivreS erartsinimda ERTEMOPA ATNANETNEM EZAG ERITIC ERTEMOPA ănul latoT /ăţnatseR SNAVA ereniţertnî irudnof ăţnatseR ăţnatseR erazilanep irăzilaneP ătalp ed latoT .TPA .RN"

MARCH_ROW_12 = (
    "12 3 1,803 71,41 5,79 183,17 7,27 0,10 1,16 78,49 56,14 1,53 87,41 18,50 "
    "9,72 19,60 3,28 36,06 28,85 15,00 126,00 6,82 743,24 0,00 0,00 0,00 0,00 "
    "743,24 12"
)

APRIL_ROW_12 = (
    "12 3 1,803 78,13 6,60 183,72 8,37 1,36 89,36 27,97 8,02 87,41 18,50 9,23 "
    "19,60 3,84 36,06 32,45 270,00 15,00 0,00 6,82 887,47 0,00 0,00 0,00 0,00 "
    "887,47 12"
)

MAY_ROW_12 = (
    "12 3 1,803 75,73 6,40 155,14 7,58 0,86 1,16 45,60 7,65 89,25 18,50 10,80 "
    "2,32 36,06 32,45 270,00 15,00 6,82 767,34 0,00 0,00 0,00 0,00 767,34 12"
)


def _raw_labels(profile):
    return [segment.get("raw_label") for segment in profile["segments"]]


def test_march_and_april_headers_are_recognized_as_distinct_layouts():
    march_profile = InvoiceParser._detect_avizier_columns_from_header(MARCH_HEADER)
    april_profile = InvoiceParser._detect_avizier_columns_from_header(APRIL_HEADER)

    assert march_profile is not None
    assert april_profile is not None
    assert _raw_labels(march_profile) != _raw_labels(april_profile)


def test_march_header_keeps_repartitoare_and_apometre_as_separate_single_columns():
    march_profile = InvoiceParser._detect_avizier_columns_from_header(MARCH_HEADER)

    assert march_profile["recognized_keys"].count("citire_repartitoare") == 1
    assert march_profile["recognized_keys"].count("citire_apometre") == 1


def test_april_header_double_apometre_detected_as_two_distinct_columns():
    april_profile = InvoiceParser._detect_avizier_columns_from_header(APRIL_HEADER)

    # April's export dropped "Citire repartitoare" entirely and instead has
    # two "Citire apometre" reading-fee columns -- this must NOT be collapsed
    # or misaligned against March's single-repartitoare + single-apometre
    # layout.
    assert april_profile["recognized_keys"].count("citire_apometre") == 2
    assert april_profile["recognized_keys"].count("citire_repartitoare") == 0
    assert _raw_labels(april_profile).count("Citire apometre") == 2


def test_april_header_detected_column_count_matches_its_own_real_row_length():
    april_profile = InvoiceParser._detect_avizier_columns_from_header(APRIL_HEADER)
    trimmed = InvoiceParser._trim_avizier_row_tokens(APRIL_ROW_12.split())

    # April's own header, read on its own, should reconstruct exactly the
    # number of numeric values its own real rows actually have (25) -- this
    # is the confident, non-fallback path.
    assert InvoiceParser._count_profile_values(april_profile) == len(trimmed) == 25


def test_may_header_is_shorter_and_distinct_from_march_and_not_forced_into_a_borrowed_shape():
    march_profile = InvoiceParser._detect_avizier_columns_from_header(MARCH_HEADER)
    may_profile = InvoiceParser._detect_avizier_columns_from_header(MAY_HEADER)

    assert may_profile is not None
    assert _raw_labels(may_profile) != _raw_labels(march_profile)
    assert InvoiceParser._count_profile_values(may_profile) < InvoiceParser._count_profile_values(march_profile)

    trimmed_may_row = InvoiceParser._trim_avizier_row_tokens(MAY_ROW_12.split())
    assert len(trimmed_may_row) == 23


def test_april_row_values_map_to_plausible_water_labels_via_its_own_header():
    april_profile = InvoiceParser._detect_avizier_columns_from_header(APRIL_HEADER)
    parts = APRIL_ROW_12.split()
    trimmed = InvoiceParser._trim_avizier_row_tokens(parts)

    result = InvoiceParser._parse_avizier_row(parts[0], trimmed, april_profile)
    by_label = {item["raw_label"]: item for item in result["line_items"]}

    # The early water/gas/energy columns are stable in relative order across
    # all three months, so they're a reliable sanity check that values land
    # on the labels a human reading the header would expect.
    assert by_label["Apa rece"]["amount"] == 78.13
    assert by_label["Apa rece"]["consumption_value"] == 6.6
    assert by_label["Apa calda"]["amount"] == 183.72
    assert by_label["Apa calda"]["consumption_value"] == 8.37
    assert by_label["Gaze naturale"]["amount"] == 27.97
    assert by_label["Energie electrica"]["amount"] == 87.41


def test_march_row_values_map_to_plausible_water_labels_via_fallback_profile():
    # March's own header, read in isolation, reconstructs a couple more
    # columns than its real rows actually contain (see the needs_review test
    # below), so it takes the safety-net fallback path. Even so, the stable
    # early water columns must still land on the right labels via the
    # fallback historical profile.
    text = (
        "Asociatia de Proprietari Bl. A4 generat cu BlocManagerNET\n"
        "Lista de plată pe luna Martie 2026\n"
        f"{MARCH_HEADER}\n"
        f"{MARCH_ROW_12}\n"
    )

    structured = InvoiceParser.parse_association_statement(text)
    apartment = structured["apartments"][0]
    by_label = {item["raw_label"]: item for item in apartment["line_items"]}

    assert by_label["Apa rece"]["amount"] == 71.41
    assert by_label["Apa rece"]["consumption_value"] == 5.79
    assert by_label["Apa calda"]["amount"] == 183.17
    assert by_label["Apa calda"]["consumption_value"] == 7.27


def test_parse_association_statement_flags_needs_review_when_header_and_row_length_disagree():
    # March's own header, on its own, reconstructs more columns than its real
    # rows actually contain (a handful of stray/duplicated header tokens
    # can't be perfectly disambiguated from text alone) -- this must be
    # surfaced as needs_review rather than silently trusted.
    text = (
        "Asociatia de Proprietari Bl. A4 generat cu BlocManagerNET\n"
        "Lista de plată pe luna Martie 2026\n"
        f"{MARCH_HEADER}\n"
        f"{MARCH_ROW_12}\n"
    )

    structured = InvoiceParser.parse_association_statement(text)

    assert structured["needs_review"] is True
    assert structured["parsing_notes"]


def test_parse_association_statement_no_review_needed_when_header_matches_row_length():
    text = (
        "Asociatia de Proprietari Bl. A4 generat cu BlocManagerNET\n"
        "Lista de plată pe luna Aprilie 2026\n"
        f"{APRIL_HEADER}\n"
        f"{APRIL_ROW_12}\n"
    )

    structured = InvoiceParser.parse_association_statement(text)

    assert structured["needs_review"] is False
    assert structured["parsing_notes"] is None
    assert structured["parsing_profile"] == "header_detected_20cols"
