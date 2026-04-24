import os
import sys
from datetime import date


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.utils.parser import InvoiceParser


def test_parse_association_statement_handles_split_amount_tokens():
    text = """Asociatia de Proprietari Bl. A4 generat cu BlocManagerNET
Lista de plată pe luna Martie 2026
Data afişării: 23 Aprilie 2026
Data scadentă: 20 Mai 2026
2 0 0.967 0,00 0,00 0,00 0,00 0,06 0,62 0,00 29,96 0,00 0,00 9,92 0,16 14,71 1,76 19,34 15,47 15,00 0,00 0,00 107,00 - 213,90 0,00 0,00 0,00 - 106,90 2
4 1 1.891 46,36 3,76 40,72 1,62 0,11 1,22 26,16 438,65 0,51 29,14 19,40 0,32 19,60 3,45 37,82 30,26 15,00 0,00 6,82 715,54 924,95 0,00 0,00 0,00 1 640,49 4
"""

    structured = InvoiceParser.parse_association_statement(text)

    assert structured["statement_month"] == date(2026, 3, 1)
    assert structured["display_month"] == "Martie 2026"
    assert structured["posted_date"] == date(2026, 4, 23)
    assert structured["due_date"] == date(2026, 5, 20)
    assert structured["parsing_profile"] == "blocmanagernet_2026_03"
    assert len(structured["apartments"]) == 2

    apartment_2 = structured["apartments"][0]
    apartment_4 = structured["apartments"][1]

    assert apartment_2["apartment_number"] == "2"
    assert apartment_2["monthly_total"] == 107.0
    assert apartment_2["total_payable"] == -106.9

    assert apartment_4["apartment_number"] == "4"
    assert apartment_4["monthly_total"] == 715.54
    assert apartment_4["total_payable"] == 1640.49
