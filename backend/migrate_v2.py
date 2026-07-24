"""
One-time migration: adds per-user data ownership, OTP fields, set labels,
feedback replies, and creates the uploads/feedback tables if missing.
Existing questions/papers (which had no owner before) get assigned to your
FIRST registered account, so nothing you already generated disappears.

Safe to re-run any time — every step here is idempotent.

Run this after replacing your backend files:
    python migrate_v2.py
"""
import sqlite3

conn = sqlite3.connect("qpg.db")
cur = conn.cursor()


def add_column(table, column, coltype):
    try:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
        conn.commit()
        print(f"  added {table}.{column}")
    except sqlite3.OperationalError as e:
        print(f"  skipped {table}.{column} ({e})")


print("Creating new tables (uploads, feedback) if missing...")
cur.execute("""
CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    filename TEXT NOT NULL,
    topics_json TEXT NOT NULL,
    char_count INTEGER DEFAULT 0,
    created_at DATETIME
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    category TEXT DEFAULT 'general',
    message TEXT NOT NULL,
    created_at DATETIME
)
""")
conn.commit()
print("  done")

cur.execute("""
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    created_by_id INTEGER,
    created_at DATETIME
)
""")
conn.commit()

cur.execute("""
CREATE TABLE IF NOT EXISTS shared_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    shared_with_email TEXT NOT NULL,
    created_at DATETIME
)
""")
conn.commit()

print("\nAdding new columns...")
add_column("users", "is_verified", "BOOLEAN DEFAULT 1")   # existing users grandfathered in, no OTP needed
add_column("users", "otp_code", "TEXT")
add_column("users", "otp_expires_at", "DATETIME")
add_column("users", "auth_provider", "TEXT DEFAULT 'password'")
add_column("users", "avatar_url", "TEXT")
add_column("users", "is_suspended", "BOOLEAN DEFAULT 0")

cur.execute("""
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maintenance_mode BOOLEAN DEFAULT 0,
    allow_self_signup BOOLEAN DEFAULT 1,
    bilingual_enabled BOOLEAN DEFAULT 1,
    daily_rate_limit INTEGER DEFAULT 500
)
""")
cur.execute("SELECT COUNT(*) FROM app_settings")
if cur.fetchone()[0] == 0:
    cur.execute("INSERT INTO app_settings (maintenance_mode, allow_self_signup, bilingual_enabled, daily_rate_limit) VALUES (0, 1, 1, 500)")
conn.commit()
add_column("questions", "owner_id", "INTEGER")
add_column("questions", "set_label", "TEXT")
add_column("questions", "question_type", "TEXT DEFAULT 'short_answer'")
add_column("questions", "options_json", "TEXT")
add_column("questions", "correct_option", "TEXT")
add_column("questions", "diagram_type", "TEXT")
add_column("questions", "diagram_data", "TEXT")
add_column("papers", "owner_id", "INTEGER")
add_column("papers", "parent_paper_id", "INTEGER")
add_column("papers", "version", "INTEGER DEFAULT 1")
add_column("feedback", "reply", "TEXT")
add_column("feedback", "reply_at", "DATETIME")
add_column("feedback", "status", "TEXT DEFAULT 'open'")

print("\nCreating paper_templates table if missing...")
cur.execute("""
CREATE TABLE IF NOT EXISTS paper_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    name TEXT NOT NULL,
    output_mode TEXT DEFAULT 'standard',
    institution TEXT,
    course TEXT,
    duration TEXT,
    university_name TEXT,
    exam_title TEXT,
    semester_label TEXT,
    school TEXT,
    programme TEXT,
    course_code TEXT,
    course_name TEXT,
    semester TEXT,
    time_str TEXT,
    max_marks INTEGER,
    instructions TEXT,
    logo_filename TEXT,
    created_at DATETIME
)
""")
conn.commit()
print("  done")

print("\nAssigning existing (ownerless) questions/papers to your first account...")
cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
row = cur.fetchone()
if row:
    first_user_id = row[0]
    cur.execute("UPDATE questions SET owner_id = ? WHERE owner_id IS NULL", (first_user_id,))
    q_count = cur.rowcount
    cur.execute("UPDATE papers SET owner_id = ? WHERE owner_id IS NULL", (first_user_id,))
    p_count = cur.rowcount
    cur.execute("UPDATE users SET role = 'admin' WHERE id = ?", (first_user_id,))
    conn.commit()
    print(f"  assigned {q_count} questions and {p_count} papers to user id {first_user_id}")
    print(f"  promoted user id {first_user_id} to admin/owner")
else:
    print("  no users found yet — nothing to assign (this is fine if you haven't registered yet)")

conn.close()
print("\nMigration complete.")
