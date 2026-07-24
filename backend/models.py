from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)  # hashed (PBKDF2); random+unusable for Google-only accounts
    role = Column(String, default="teacher")   # teacher | admin
    is_verified = Column(Boolean, default=False)
    is_suspended = Column(Boolean, default=False)
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    auth_provider = Column(String, default="password")  # "password" | "google"
    avatar_url = Column(String, nullable=True)  # filename (local upload) or full URL (e.g. Google photo)


class AppSettings(Base):
    """Single-row table of platform-wide settings the owner can toggle from
    the admin panel. Enforced for real (maintenance mode blocks generation,
    self-signup gate blocks registration), not just stored for display."""
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True, index=True)
    maintenance_mode = Column(Boolean, default=False)
    allow_self_signup = Column(Boolean, default=True)
    bilingual_enabled = Column(Boolean, default=True)
    daily_rate_limit = Column(Integer, default=500)


class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    semester = Column(String, nullable=True)
    topics = relationship("Topic", back_populates="subject")


class Topic(Base):
    __tablename__ = "topics"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    topic_name = Column(String, nullable=False)
    subject = relationship("Subject", back_populates="topics")


class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    topic = Column(String, nullable=True)
    marks = Column(Integer, nullable=False)
    difficulty = Column(String, nullable=False)   # Easy | Medium | Hard
    bloom_level = Column(String, nullable=False)  # Remember..Create
    unit = Column(String, nullable=True)
    set_label = Column(String, nullable=True)     # "Set A", "Set B", ... or null
    question_type = Column(String, default="short_answer")  # short_answer | mcq
    options_json = Column(Text, nullable=True)    # JSON list of 4 option strings, MCQ only
    correct_option = Column(String, nullable=True)  # "A" | "B" | "C" | "D", MCQ only
    diagram_type = Column(String, nullable=True)  # e.g. "graph_dfs", "graph_bfs" — null if no diagram
    diagram_data = Column(Text, nullable=True)     # JSON-encoded structure to redraw the diagram
    created_at = Column(DateTime, default=datetime.utcnow)


class Paper(Base):
    __tablename__ = "papers"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    paper_name = Column(String, nullable=False)
    question_ids = Column(Text, nullable=False)  # comma-separated ids, kept simple for demo
    file_type = Column(String, default="pdf")     # "pdf" | "docx"
    parent_paper_id = Column(Integer, ForeignKey("papers.id"), nullable=True)  # set when "rebuilt from" another paper
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class PaperTemplate(Base):
    __tablename__ = "paper_templates"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    output_mode = Column(String, default="standard")  # "standard" | "university"
    # Standard-mode fields
    institution = Column(String, nullable=True)
    course = Column(String, nullable=True)
    duration = Column(String, nullable=True)
    # University-mode fields
    university_name = Column(String, nullable=True)
    exam_title = Column(String, nullable=True)
    semester_label = Column(String, nullable=True)
    school = Column(String, nullable=True)
    programme = Column(String, nullable=True)
    course_code = Column(String, nullable=True)
    course_name = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    time_str = Column(String, nullable=True)
    max_marks = Column(Integer, nullable=True)
    # Shared
    instructions = Column(Text, nullable=True)
    logo_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    topics_json = Column(Text, nullable=False)   # JSON-encoded list of extracted topics
    char_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Announcement(Base):
    """A message the owner broadcasts to every user at once — shows up in
    everyone's notification bell alongside their personal activity."""
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SharedAccess(Base):
    __tablename__ = "shared_access"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # bank owner
    shared_with_email = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    category = Column(String, default="general")  # bug | feature | general
    message = Column(Text, nullable=False)
    reply = Column(Text, nullable=True)
    reply_at = Column(DateTime, nullable=True)
    status = Column(String, default="open")  # open | resolved — independent of whether it's been replied to
    created_at = Column(DateTime, default=datetime.utcnow)
