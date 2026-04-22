import sys
import os

# Add the root directory to sys.path so we can import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.utils.file_utils import secure_filename

def test_secure_filename():
    test_cases = [
        ("../../etc/passwd", "etc_passwd"),
        ("test.pdf\x00.exe", "test.pdf_.exe"),
        ("file name with spaces.pdf", "file_name_with_spaces.pdf"),
        ("multiple...dots.pdf", "multiple...dots.pdf"),
        ("../../../linux.pdf", "linux.pdf"),
        ("??invalid??chars.pdf", "invalid_chars.pdf"),
        (".hidden", "hidden"),
        ("CON.txt", "_CON.txt") if os.name == 'nt' else ("CON.txt", "CON.txt"),
    ]

    print("Running secure_filename tests...")
    all_passed = True
    for input_fn, expected in test_cases:
        actual = secure_filename(input_fn)
        if actual == expected:
            print(f"[PASS] '{input_fn}' -> '{actual}'")
        else:
            print(f"[FAIL] '{input_fn}' -> expected '{expected}', got '{actual}'")
            all_passed = False

    if all_passed:
        print("\nAll secure_filename tests passed!")
    else:
        print("\nSome secure_filename tests failed.")
        sys.exit(1)

def verify_integration():
    print("\nVerifying integration in routers (via grep)...")

    import subprocess

    files_to_check = [
        'backend/routers/invoices.py',
        'backend/routers/association_statements.py'
    ]

    for filepath in files_to_check:
        result = subprocess.run(['grep', 'file_utils.secure_filename', filepath], capture_output=True)
        if result.returncode == 0:
            print(f"[PASS] secure_filename usage found in {filepath}")
        else:
            print(f"[FAIL] secure_filename usage NOT found in {filepath}")
            sys.exit(1)

if __name__ == "__main__":
    test_secure_filename()
    verify_integration()
