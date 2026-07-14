import sqlite3

conn = sqlite3.connect("qpg.db")
try:
    conn.execute("ALTER TABLE papers ADD COLUMN file_type TEXT DEFAULT 'pdf'")
    conn.commit()
    print("Success: file_type column added.")
except sqlite3.OperationalError as e:
    print(f"Skipped (probably already applied): {e}")
conn.close()