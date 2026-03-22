import sqlite3
import os

db_path = "UtilityMate/data/utilitymate.db"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("--- INVOICES ---")
    cursor.execute("SELECT id, invoice_date, amount, user_id FROM invoices;")
    invoices = cursor.fetchall()
    for inv in invoices:
        print(inv)
    print(f"Total invoices: {len(invoices)}")

    print("\n--- LOCATIONS ---")
    cursor.execute("SELECT id, name, user_id FROM locations;")
    locations = cursor.fetchall()
    for loc in locations:
        print(loc)
    print(f"Total locations: {len(locations)}")

    print("\n--- PROVIDERS ---")
    cursor.execute("SELECT id, name FROM providers;")
    providers = cursor.fetchall()
    for prov in providers:
        print(prov)
    print(f"Total providers: {len(providers)}")

    print("\n--- USERS ---")
    cursor.execute("SELECT id, email FROM users;")
    users = cursor.fetchall()
    for user in users:
        print(user)

except Exception as e:
    print(f"Error reading database: {e}")
finally:
    conn.close()
