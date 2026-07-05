import os
import sys


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.utils.parser import InvoiceParser


def test_parse_number_handles_european_thousands_separator():
    # "." is thousands separator, "," is decimal (comma occurs last)
    assert InvoiceParser._parse_number("1.234,56") == 1234.56


def test_parse_number_handles_us_thousands_separator():
    # "," is thousands separator, "." is decimal (dot occurs last)
    assert InvoiceParser._parse_number("1,234.56") == 1234.56


def test_parse_number_handles_multiple_thousands_groups():
    assert InvoiceParser._parse_number("12.345.678,90") == 12345678.90
    assert InvoiceParser._parse_number("12,345,678.90") == 12345678.90


def test_parse_number_handles_comma_only_as_decimal():
    assert InvoiceParser._parse_number("245,67") == 245.67


def test_parse_number_handles_dot_only_as_decimal():
    assert InvoiceParser._parse_number("245.67") == 245.67


def test_parse_number_handles_plain_integer():
    assert InvoiceParser._parse_number("245") == 245.0


def test_parse_meter_index_preserves_decimal_point():
    # Regression test: previously all non-digit characters (including the
    # decimal point) were stripped, turning 123.45 into 12345 (a 100x error).
    assert InvoiceParser._parse_meter_index("123.45") == 123.45


def test_parse_meter_index_preserves_decimal_comma():
    assert InvoiceParser._parse_meter_index("123,45") == 123.45


def test_parse_meter_index_strips_thousands_separator_with_decimal():
    # Two separators present: only the last one (the comma) is the decimal
    # separator, the dot is a thousands separator and must be stripped.
    assert InvoiceParser._parse_meter_index("12.345,67") == 12345.67


def test_parse_meter_index_handles_plain_digits():
    assert InvoiceParser._parse_meter_index("12345") == 12345.0


def test_parse_meter_index_returns_none_for_empty_value():
    assert InvoiceParser._parse_meter_index("") is None
    assert InvoiceParser._parse_meter_index(None) is None
