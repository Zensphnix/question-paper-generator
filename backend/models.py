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
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    auth_provider = Column(String, default="password")  # "password" | "google"
    avatar_url = Column(String, nullable=True)  # filename (local upload) or full URL (e.g. Google photo)


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
    created_at = Column(DateTime, default=datetime.utcnow)


class Paper(Base):
    __tablename__ = "papers"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    paper_name = Column(String, nullable=False)
    question_ids = Column(Text, nullable=False)  # comma-separated ids, kept simple for demo
    file_type = Column(String, default="pdf")     # "pdf" | "docx"
    created_at = Column(DateTime, default=datetime.utcnow)


class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    topics_json = Column(Text, nullable=False)   # JSON-encoded list of extracted topics
    char_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    category = Column(String, default="general")  # bug | feature | general
    message = Column(Text, nullable=False)
    reply = Column(Text, nullable=True)
    reply_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
