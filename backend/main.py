import os
import json
import random
import shutil
import io
import csv
from difflib import SequenceMatcher
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, engine, get_db
import models
import auth
from services.pdf_parser import extract_text
from services.topic_extractor import extract_topics
from services.ai_generator import generate_questions, generate_mixed_questions, generate_mcq_questions
from services.bloom_classifier import classify_question
from services.validator import remove_duplicates, validate_against_existing
from services.pdf_export import build_pdf, build_university_pdf
from services.docx_export import build_docx_from_template, has_placeholder
from services.email_service import send_otp_email, send_email_with_attachment, is_configured as email_configured
from services.diagram_generator import build_diagram_question
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Automated Question Paper Generator")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
OWNER_EMAIL = os.getenv("OWNER_EMAIL", "").strip().lower()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
GENERATED_DIR = "generated_papers"
LOGO_DIR = "logos"
TEMPLATE_DIR = "templates"
AVATAR_DIR = "avatars"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(GENERATED_DIR, exist_ok=True)
os.makedirs(LOGO_DIR, exist_ok=True)
os.makedirs(TEMPLATE_DIR, exist_ok=True)
os.makedirs(AVATAR_DIR, exist_ok=True)

app.mount("/avatars", StaticFiles(directory=AVATAR_DIR), name="avatars")


# ---------- Schemas ----------
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


class ResendOtpRequest(BaseModel):
    email: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RequestLoginOtpRequest(BaseModel):
    email: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


class GoogleAuthRequest(BaseModel):
    credential: str  # the ID token from Google's Sign-In button


class GenerateRequest(BaseModel):
    topic: str
    bloom_level: str
    marks: int
    difficulty: str
    count: int = 5
    unit: Optional[str] = None
    language: str = "English"
    set_label: Optional[str] = None
    question_type: str = "short_answer"  # "short_answer" | "mcq"


class AutoGenerateRequest(BaseModel):
    topics: List[str]
    total_questions: int = 30
    marks: int = 5
    difficulty: str = "Medium"
    unit: Optional[str] = None
    language: str = "English"
    set_label: Optional[str] = None
    question_type: str = "short_answer"  # "short_answer" | "mcq"


class DiagramQuestionRequest(BaseModel):
    diagram_type: str  # "graph_dfs" | "graph_bfs" | "tree_inorder" | "tree_preorder" | "tree_postorder"
    marks: int = 10
    num_nodes: int = 6
    unit: Optional[str] = None
    topic: Optional[str] = None


class UpdateQuestionRequest(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None


class SectionInput(BaseModel):
    name: str
    question_ids: List[int]


class BuildPaperRequest(BaseModel):
    paper_name: str
    institution: str = "ABC University"
    course: str = ""
    duration: str = "3 Hours"
    max_marks: int = 100
    instructions: List[str] = []
    sections: List[SectionInput]
    include_answers: bool = False
    logo_filename: Optional[str] = None
    parent_paper_id: Optional[int] = None
    shuffle: bool = False
    watermark_text: Optional[str] = None


class BuildFromTemplateRequest(BaseModel):
    paper_name: str
    template_filename: str
    sections: List[SectionInput]
    include_answers: bool = False
    parent_paper_id: Optional[int] = None


class BuildUniversityPaperRequest(BaseModel):
    paper_name: str
    university_name: str = "ABC University"
    exam_title: str = "MID TERM EXAMINATION"
    semester_label: str = "Odd Semester 2024-25"
    school: str = ""
    programme: str = ""
    course_code: str = ""
    course_name: str = ""
    semester: str = ""
    time_str: str = "1 Hr"
    max_marks: int = 20
    instructions: str = "All questions are compulsory."
    sections: List[SectionInput]
    logo_filename: Optional[str] = None
    parent_paper_id: Optional[int] = None
    shuffle: bool = False
    watermark_text: Optional[str] = None


class FeedbackRequest(BaseModel):
    category: str = "general"
    message: str


class SaveTemplateRequest(BaseModel):
    name: str
    output_mode: str = "standard"  # "standard" | "university"
    institution: Optional[str] = None
    course: Optional[str] = None
    duration: Optional[str] = None
    university_name: Optional[str] = None
    exam_title: Optional[str] = None
    semester_label: Optional[str] = None
    school: Optional[str] = None
    programme: Optional[str] = None
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    semester: Optional[str] = None
    time_str: Optional[str] = None
    max_marks: Optional[int] = None
    instructions: Optional[str] = None
    logo_filename: Optional[str] = None


class InviteCoTeacherRequest(BaseModel):
    email: str


class ShareEmailRequest(BaseModel):
    to: List[str]
    message: str = ""


class ReplyFeedbackRequest(BaseModel):
    message: str


# ---------- Generation helper with retry-to-target ----------
def _generate_deduped(gen_fn, target_count: int, existing_texts: list, max_attempts: int = 3):
    """Calls gen_fn(count=N) repeatedly, deduping against existing_texts AND
    everything already collected this call, until target_count is reached or
    attempts run out. This is what fixes 'asked for 30, got 12' and 'set C
    came back nearly empty' — earlier the app only ever asked once."""
    collected = []
    seen_texts = list(existing_texts)
    attempts = 0

    while len(collected) < target_count and attempts < max_attempts:
        attempts += 1
        remaining = target_count - len(collected)
        ask_for = remaining + 3  # buffer, since some will get filtered as duplicates

        try:
            raw_items = gen_fn(count=ask_for)
        except Exception:
            if attempts >= max_attempts:
                break
            continue

        deduped_batch = remove_duplicates(raw_items)
        fresh = validate_against_existing(deduped_batch, seen_texts)
        collected.extend(fresh)
        seen_texts.extend([f["question"] for f in fresh])

    return collected[:target_count]


def _question_dict(q: models.Question) -> dict:
    return {
        "id": q.id, "question": q.question, "answer": q.answer, "topic": q.topic,
        "bloom_level": q.bloom_level, "marks": q.marks, "difficulty": q.difficulty,
        "unit": q.unit, "set": q.set_label,
        "question_type": q.question_type,
        "options": json.loads(q.options_json) if q.options_json else None,
        "correct_option": q.correct_option,
        "diagram_type": q.diagram_type,
        "diagram_data": json.loads(q.diagram_data) if q.diagram_data else None,
    }


def _persist_items(db: Session, items, topic: str, marks: int, difficulty: str,
                    unit: Optional[str], owner_id: int, set_label: Optional[str] = None,
                    question_type: str = "short_answer"):
    saved = []
    for item in items:
        is_mcq = question_type == "mcq" and "options" in item
        detected_level = "Remember" if is_mcq else classify_question(item["question"])
        q = models.Question(
            owner_id=owner_id,
            question=item["question"],
            answer=item.get("answer", ""),
            topic=topic,
            marks=marks,
            difficulty=difficulty,
            bloom_level=detected_level,
            unit=unit,
            set_label=set_label,
            question_type="mcq" if is_mcq else "short_answer",
            options_json=json.dumps(item["options"]) if is_mcq else None,
            correct_option=item.get("correct_option") if is_mcq else None,
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        saved.append(_question_dict(q))
    return saved


def _user_dict(user: models.User) -> dict:
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "role": user.role, "avatar_url": user.avatar_url,
    }


def _sync_owner_role(db: Session):
    """If an OWNER_EMAIL is configured, make sure that account is admin —
    and demote anyone else who accidentally ended up admin (e.g. because
    they registered first on a fresh/redeployed database by coincidence).
    Runs on every login and session check, so it self-heals automatically."""
    if not OWNER_EMAIL:
        return
    changed = False
    owner = db.query(models.User).filter(models.User.email == OWNER_EMAIL).first()
    if owner and owner.role != "admin":
        owner.role = "admin"
        changed = True

    stray_admins = db.query(models.User).filter(
        models.User.role == "admin", models.User.email != OWNER_EMAIL
    ).all()
    for u in stray_admins:
        u.role = "teacher"
        changed = True

    if changed:
        db.commit()


def _dispatch_otp(email: str, name: str, otp: str) -> str:
    """Tries to actually email the OTP. Falls back to printing it in the
    backend terminal if Gmail isn't configured (or sending fails), so the
    app never breaks — it just degrades to demo mode."""
    if email_configured():
        if send_otp_email(email, otp, name):
            return "A verification code was emailed to you — check your inbox."
    print(f"\n{'='*50}\n  OTP for {email}: {otp}\n{'='*50}\n")
    return "Demo mode (no email configured): check the backend terminal for your code."


# ---------- Auth routes ----------
@app.get("/")
def root():
    return {"status": "ok", "message": "Question Paper Generator API running"}


@app.post("/auth/register")
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    is_first_user = db.query(models.User).count() == 0
    otp = auth.generate_otp()
    user = models.User(
        name=req.name,
        email=req.email,
        password=auth.hash_password(req.password),
        role="admin" if is_first_user else "teacher",
        is_verified=False,
        otp_code=otp,
        otp_expires_at=auth.otp_expiry(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    message = _dispatch_otp(user.email, user.name, otp)
    return {"otp_required": True, "email": user.email, "message": message}


@app.post("/auth/verify-otp")
@limiter.limit("10/minute")
def verify_otp(request: Request, response: Response, req: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")
    if user.is_verified and user.otp_code is None:
        raise HTTPException(status_code=400, detail="Account already verified — just log in")
    if not user.otp_code or user.otp_code != req.otp:
        raise HTTPException(status_code=400, detail="Incorrect code")
    if user.otp_expires_at and user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Code expired — request a new one")

    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    _sync_owner_role(db)
    db.refresh(user)
    token = auth.create_access_token(user.id, user.email)
    auth.set_auth_cookie(response, token)
    return {"user": _user_dict(user)}


@app.post("/auth/resend-otp")
@limiter.limit("5/minute")
def resend_otp(request: Request, req: ResendOtpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Account already verified — just log in")

    otp = auth.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = auth.otp_expiry()
    db.commit()

    message = _dispatch_otp(user.email, user.name, otp)
    return {"message": message}


@app.post("/auth/request-login-otp")
@limiter.limit("5/minute")
def request_login_otp(request: Request, req: RequestLoginOtpRequest, db: Session = Depends(get_db)):
    """Passwordless login: send a fresh code to an EXISTING account's email,
    which they then verify at /auth/verify-otp (same endpoint used for
    registration) to get a session — no password needed at all."""
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email — register first")

    otp = auth.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = auth.otp_expiry()
    db.commit()

    message = _dispatch_otp(user.email, user.name, otp)
    return {"otp_required": True, "email": user.email, "message": message}


@app.post("/auth/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        # Don't reveal whether the email exists — same generic response either way.
        return {"message": "If an account exists for this email, a reset code has been sent."}

    otp = auth.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = auth.otp_expiry()
    db.commit()

    _dispatch_otp(user.email, user.name, otp)
    return {"message": "If an account exists for this email, a reset code has been sent."}


@app.post("/auth/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, response: Response, req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not user.otp_code or user.otp_code != req.otp:
        raise HTTPException(status_code=400, detail="Incorrect or expired code")
    if user.otp_expires_at and user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Code expired — request a new one")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.password = auth.hash_password(req.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    user.is_verified = True
    db.commit()

    _sync_owner_role(db)
    db.refresh(user)
    token = auth.create_access_token(user.id, user.email)
    auth.set_auth_cookie(response, token)
    return {"user": _user_dict(user)}


@app.post("/auth/login")
@limiter.limit("10/minute")
def login(request: Request, response: Response, req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not auth.verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not user.is_verified:
        otp = auth.generate_otp()
        user.otp_code = otp
        user.otp_expires_at = auth.otp_expiry()
        db.commit()
        message = _dispatch_otp(user.email, user.name, otp)
        return {"otp_required": True, "email": user.email, "message": message}

    _sync_owner_role(db)
    db.refresh(user)
    token = auth.create_access_token(user.id, user.email)
    auth.set_auth_cookie(response, token)
    return {"user": _user_dict(user)}


@app.get("/auth/me")
def get_me(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    _sync_owner_role(db)
    db.refresh(current_user)
    return _user_dict(current_user)


@app.post("/auth/logout")
def logout(response: Response):
    auth.clear_auth_cookie(response)
    return {"message": "Logged out"}


@app.post("/auth/google")
@limiter.limit("10/minute")
def google_auth(request: Request, response: Response, req: GoogleAuthRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in isn't configured on this server yet")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            req.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        print(f"[google_auth] Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    email = idinfo.get("email")
    email_verified = idinfo.get("email_verified", False)
    name = idinfo.get("name") or (email.split("@")[0] if email else "User")
    picture = idinfo.get("picture")

    if not email or not email_verified:
        raise HTTPException(status_code=401, detail="Google account email isn't verified")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        is_first_user = db.query(models.User).count() == 0
        # Google-only accounts still get a password column filled (schema requires
        # it) — a random value that can never be typed in, so password login
        # for this account is effectively impossible unless they set one later.
        user = models.User(
            name=name,
            email=email,
            password=auth.hash_password(os.urandom(24).hex()),
            role="admin" if is_first_user else "teacher",
            is_verified=True,  # Google already verified this email — no OTP needed
            auth_provider="google",
            avatar_url=picture,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.is_verified:
        # They'd registered with a password before but never completed OTP —
        # signing in with the same Google-verified email counts as verification.
        user.is_verified = True
        db.commit()
        db.refresh(user)

    _sync_owner_role(db)
    db.refresh(user)
    token = auth.create_access_token(user.id, user.email)
    auth.set_auth_cookie(response, token)
    return {"user": _user_dict(user)}


@app.post("/profile/avatar")
async def upload_avatar(file: UploadFile = File(...), db: Session = Depends(get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("png", "jpg", "jpeg", "webp"):
        raise HTTPException(status_code=400, detail="Avatar must be PNG, JPG, or WEBP")

    filename = f"user_{current_user.id}_{int(datetime.utcnow().timestamp())}.{ext}"
    path = os.path.join(AVATAR_DIR, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    current_user.avatar_url = filename
    db.commit()
    db.refresh(current_user)
    return {"user": _user_dict(current_user)}


@app.delete("/profile/avatar")
def remove_avatar(db: Session = Depends(get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return {"user": _user_dict(current_user)}


# ---------- Upload routes ----------
@app.post("/upload")
async def upload_material(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = extract_text(file_path, file.filename)
    topics = extract_topics(text)

    record = models.Upload(
        owner_id=current_user.id,
        filename=file.filename,
        topics_json=json.dumps(topics),
        char_count=len(text),
    )
    db.add(record)
    db.commit()

    return {"filename": file.filename, "topics": topics, "char_count": len(text)}


@app.get("/uploads")
def list_uploads(db: Session = Depends(get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    records = db.query(models.Upload).filter(
        models.Upload.owner_id == current_user.id
    ).order_by(models.Upload.created_at.desc()).all()
    return [
        {"id": r.id, "filename": r.filename, "topics": json.loads(r.topics_json),
         "char_count": r.char_count, "created_at": r.created_at}
        for r in records
    ]


@app.post("/logo/upload")
async def upload_logo(file: UploadFile = File(...),
                       current_user: models.User = Depends(auth.get_current_user)):
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
        raise HTTPException(status_code=400, detail="Logo must be a PNG or JPG image")
    path = os.path.join(LOGO_DIR, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"logo_filename": file.filename}


@app.post("/template/upload")
async def upload_template(file: UploadFile = File(...),
                           current_user: models.User = Depends(auth.get_current_user)):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Template must be a .docx Word file")
    path = os.path.join(TEMPLATE_DIR, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"template_filename": file.filename, "has_placeholder": has_placeholder(path)}


# ---------- Generation routes ----------
@app.post("/generate")
@limiter.limit("15/minute")
def generate(request: Request, req: GenerateRequest, db: Session = Depends(get_db),
             current_user: models.User = Depends(auth.get_current_user)):
    existing = [q.question for q in db.query(models.Question).filter(
        models.Question.topic == req.topic, models.Question.owner_id == current_user.id).all()]

    if req.question_type == "mcq":
        gen_fn = lambda count: generate_mcq_questions(
            topic=req.topic, difficulty=req.difficulty, count=count, language=req.language,
        )
    else:
        gen_fn = lambda count: generate_questions(
            topic=req.topic, bloom_level=req.bloom_level, marks=req.marks,
            difficulty=req.difficulty, count=count, language=req.language,
        )

    collected = _generate_deduped(gen_fn=gen_fn, target_count=req.count, existing_texts=existing)
    saved = _persist_items(db, collected, req.topic, req.marks, req.difficulty,
                            req.unit, current_user.id, req.set_label, req.question_type)
    return {"requested_level": req.bloom_level, "requested_count": req.count,
            "actual_count": len(saved), "questions": saved}


@app.post("/generate/auto")
@limiter.limit("5/minute")
def generate_auto(request: Request, req: AutoGenerateRequest, db: Session = Depends(get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Bulk-generate questions across MANY topics in one click, with retry-to-target
    per topic so the actual yield matches what was requested."""
    if not req.topics:
        raise HTTPException(status_code=400, detail="No topics provided")

    per_topic_target = max(2, req.total_questions // len(req.topics))
    all_saved = []
    failed_topics = []

    for topic in req.topics:
        existing = [q.question for q in db.query(models.Question).filter(
            models.Question.topic == topic, models.Question.owner_id == current_user.id).all()]

        collected = _generate_deduped(
            gen_fn=lambda count, t=topic: generate_mixed_questions(
                topic=t, marks=req.marks, difficulty=req.difficulty,
                count=count, language=req.language,
            ),
            target_count=per_topic_target,
            existing_texts=existing,
        )

        if not collected:
            failed_topics.append(topic)
            continue

        saved = _persist_items(db, collected, topic, req.marks, req.difficulty,
                                req.unit, current_user.id, req.set_label)
        all_saved.extend(saved)

    return {
        "generated": len(all_saved),
        "requested": req.total_questions,
        "topics_used": len(req.topics) - len(failed_topics),
        "topics_failed": failed_topics,
        "questions": all_saved,
    }


@app.post("/generate/diagram")
@limiter.limit("15/minute")
def generate_diagram_question(request: Request, req: DiagramQuestionRequest, db: Session = Depends(get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    """Graph/tree traversal questions — the diagram AND the answer are both
    generated by real algorithms (not the AI), so the answer is guaranteed
    correct rather than an LLM's best guess at a graph traversal."""
    valid_types = ("graph_dfs", "graph_bfs", "tree_inorder", "tree_preorder", "tree_postorder")
    if req.diagram_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"diagram_type must be one of {valid_types}")

    question_text, answer_text, diagram_data = build_diagram_question(
        req.diagram_type, num_nodes=max(4, min(req.num_nodes, 8))
    )
    bloom_level = "Apply" if "graph" in req.diagram_type else "Understand"

    q = models.Question(
        owner_id=current_user.id,
        question=question_text,
        answer=answer_text,
        topic=req.topic or "Data Structures",
        marks=req.marks,
        difficulty="Medium",
        bloom_level=bloom_level,
        unit=req.unit,
        question_type="short_answer",
        diagram_type=req.diagram_type,
        diagram_data=json.dumps(diagram_data),
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return {"questions": [_question_dict(q)]}


@app.get("/questions")
def list_questions(topic: Optional[str] = None, bloom_level: Optional[str] = None,
                    search: Optional[str] = None, owner_id: Optional[int] = None,
                    db: Session = Depends(get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    effective_owner_id = current_user.id
    if owner_id and owner_id != current_user.id:
        has_access = db.query(models.SharedAccess).filter(
            models.SharedAccess.owner_id == owner_id,
            models.SharedAccess.shared_with_email == current_user.email.lower()).first()
        if not has_access:
            raise HTTPException(status_code=403, detail="No access to this teacher's question bank")
        effective_owner_id = owner_id
    query = db.query(models.Question).filter(models.Question.owner_id == effective_owner_id)
    if topic:
        query = query.filter(models.Question.topic == topic)
    if bloom_level:
        query = query.filter(models.Question.bloom_level == bloom_level)
    if search:
        query = query.filter(models.Question.question.ilike(f"%{search}%"))
    results = query.order_by(models.Question.created_at.desc()).all()
    return [dict(_question_dict(q), created_at=q.created_at) for q in results]


@app.patch("/questions/{question_id}")
def update_question(question_id: int, req: UpdateQuestionRequest, db: Session = Depends(get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Lets a teacher correct the AI's question wording or model answer
    before it goes into a real paper — review/edit, not just accept-as-is."""
    q = db.query(models.Question).filter(
        models.Question.id == question_id, models.Question.owner_id == current_user.id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    if req.question is not None and req.question.strip():
        q.question = req.question.strip()
    if req.answer is not None:
        q.answer = req.answer.strip()

    db.commit()
    db.refresh(q)
    return _question_dict(q)



def _next_paper_version(db: Session, parent_paper_id: Optional[int]) -> int:
    if not parent_paper_id:
        return 1
    parent = db.query(models.Paper).filter(models.Paper.id == parent_paper_id).first()
    return (parent.version + 1) if parent else 1


def _maybe_shuffle(sections_payload: list, shuffle: bool) -> list:
    if shuffle:
        for s in sections_payload:
            random.shuffle(s["questions"])
    return sections_payload


# ---------- Co-teacher sharing ----------
@app.post("/share/invite")
def invite_co_teacher(req: InviteCoTeacherRequest, db: Session = Depends(get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    email = req.email.strip().lower()
    if email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="Can't share with yourself")
    existing = db.query(models.SharedAccess).filter(
        models.SharedAccess.owner_id == current_user.id,
        models.SharedAccess.shared_with_email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this email")
    share = models.SharedAccess(owner_id=current_user.id, shared_with_email=email)
    db.add(share)
    db.commit()
    db.refresh(share)
    return {"id": share.id, "shared_with_email": share.shared_with_email}


@app.get("/share/my-shares")
def list_my_shares(db: Session = Depends(get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    """Who I've given access to my question bank."""
    shares = db.query(models.SharedAccess).filter(models.SharedAccess.owner_id == current_user.id).all()
    return [{"id": s.id, "shared_with_email": s.shared_with_email, "created_at": s.created_at} for s in shares]


@app.delete("/share/{share_id}")
def revoke_share(share_id: int, db: Session = Depends(get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    share = db.query(models.SharedAccess).filter(
        models.SharedAccess.id == share_id, models.SharedAccess.owner_id == current_user.id).first()
    if not share:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(share)
    db.commit()
    return {"message": "Revoked"}


@app.get("/share/shared-with-me")
def list_shared_with_me(db: Session = Depends(get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    """Teachers whose question banks I can view."""
    shares = db.query(models.SharedAccess).filter(
        models.SharedAccess.shared_with_email == current_user.email.lower()).all()
    result = []
    for s in shares:
        owner = db.query(models.User).filter(models.User.id == s.owner_id).first()
        if owner:
            result.append({"owner_id": owner.id, "owner_name": owner.name, "owner_email": owner.email})
    return result


# ---------- Paper build routes ----------
@app.post("/paper/build")
def build_paper(req: BuildPaperRequest, db: Session = Depends(get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    all_ids = []
    sections_payload = []

    for section in req.sections:
        questions = db.query(models.Question).filter(
            models.Question.id.in_(section.question_ids),
            models.Question.owner_id == current_user.id).all()
        id_to_q = {q.id: q for q in questions}
        ordered = [_question_dict(id_to_q[i]) for i in section.question_ids if i in id_to_q]
        sections_payload.append({"name": section.name, "questions": ordered})
        all_ids.extend(section.question_ids)

    paper = models.Paper(
        owner_id=current_user.id,
        paper_name=req.paper_name,
        question_ids=",".join(str(i) for i in all_ids),
        file_type="pdf",
        parent_paper_id=req.parent_paper_id,
        version=_next_paper_version(db, req.parent_paper_id),
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    logo_path = os.path.join(LOGO_DIR, req.logo_filename) if req.logo_filename else None
    sections_payload = _maybe_shuffle(sections_payload, req.shuffle)

    output_path = os.path.join(GENERATED_DIR, f"paper_{paper.id}.pdf")
    build_pdf(
        output_path=output_path, institution=req.institution, course=req.course,
        duration=req.duration, max_marks=req.max_marks, instructions=req.instructions,
        sections=sections_payload, include_answers=req.include_answers, logo_path=logo_path,
        watermark_text=req.watermark_text,
    )

    return {"paper_id": paper.id, "download_url": f"/paper/{paper.id}/download"}


@app.post("/paper/build-university")
def build_university_paper(req: BuildUniversityPaperRequest, db: Session = Depends(get_db),
                            current_user: models.User = Depends(auth.get_current_user)):
    """University-format paper — Roll No line, School/Programme/Course metadata
    block, and Q.No/Question/Marks/CO-L tables matching the common Indian
    university mid-term/end-semester layout."""
    all_ids = []
    sections_payload = []

    for section in req.sections:
        questions = db.query(models.Question).filter(
            models.Question.id.in_(section.question_ids),
            models.Question.owner_id == current_user.id).all()
        id_to_q = {q.id: q for q in questions}
        ordered = [_question_dict(id_to_q[i]) for i in section.question_ids if i in id_to_q]
        sections_payload.append({"name": section.name, "questions": ordered})
        all_ids.extend(section.question_ids)

    paper = models.Paper(
        owner_id=current_user.id,
        paper_name=req.paper_name,
        question_ids=",".join(str(i) for i in all_ids),
        file_type="pdf",
        parent_paper_id=req.parent_paper_id,
        version=_next_paper_version(db, req.parent_paper_id),
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    logo_path = os.path.join(LOGO_DIR, req.logo_filename) if req.logo_filename else None
    sections_payload = _maybe_shuffle(sections_payload, req.shuffle)

    output_path = os.path.join(GENERATED_DIR, f"paper_{paper.id}.pdf")
    build_university_pdf(
        output_path=output_path,
        university_name=req.university_name,
        exam_title=req.exam_title,
        semester_label=req.semester_label,
        school=req.school,
        programme=req.programme,
        course_code=req.course_code,
        course_name=req.course_name,
        semester=req.semester,
        time_str=req.time_str,
        max_marks=req.max_marks,
        instructions=req.instructions,
        sections=sections_payload,
        logo_path=logo_path,
        watermark_text=req.watermark_text,
    )

    return {"paper_id": paper.id, "download_url": f"/paper/{paper.id}/download"}


@app.post("/paper/build-from-template")
def build_paper_from_template(req: BuildFromTemplateRequest, db: Session = Depends(get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    template_path = os.path.join(TEMPLATE_DIR, req.template_filename)
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template not found — upload it again")

    all_ids = []
    sections_payload = []
    for section in req.sections:
        questions = db.query(models.Question).filter(
            models.Question.id.in_(section.question_ids),
            models.Question.owner_id == current_user.id).all()
        id_to_q = {q.id: q for q in questions}
        ordered = [
            {"question": id_to_q[i].question, "answer": id_to_q[i].answer}
            for i in section.question_ids if i in id_to_q
        ]
        sections_payload.append({"name": section.name, "questions": ordered})
        all_ids.extend(section.question_ids)

    paper = models.Paper(
        owner_id=current_user.id,
        paper_name=req.paper_name,
        question_ids=",".join(str(i) for i in all_ids),
        file_type="docx",
        parent_paper_id=req.parent_paper_id,
        version=_next_paper_version(db, req.parent_paper_id),
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    output_path = os.path.join(GENERATED_DIR, f"paper_{paper.id}.docx")
    build_docx_from_template(
        template_path=template_path, output_path=output_path,
        sections=sections_payload, include_answers=req.include_answers,
    )

    return {"paper_id": paper.id, "download_url": f"/paper/{paper.id}/download"}


@app.get("/paper/{paper_id}/download")
def download_paper(paper_id: int, db: Session = Depends(get_db)):
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    ext = "docx" if paper.file_type == "docx" else "pdf"
    media_type = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if ext == "docx" else "application/pdf"
    )
    file_path = os.path.join(GENERATED_DIR, f"paper_{paper.id}.{ext}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not generated yet")

    return FileResponse(file_path, media_type=media_type, filename=f"{paper.paper_name}.{ext}")


@app.get("/paper/{paper_id}/preview")
def preview_paper(paper_id: int, db: Session = Depends(get_db)):
    """Same file as /download, but with Content-Disposition: inline so the
    browser renders it directly (in an <iframe>, typically) instead of
    triggering a download prompt."""
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    ext = "docx" if paper.file_type == "docx" else "pdf"
    if ext != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF papers can be previewed in-browser — DOCX will download instead")

    file_path = os.path.join(GENERATED_DIR, f"paper_{paper.id}.{ext}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not generated yet")

    return FileResponse(
        file_path, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{paper.paper_name}.pdf"'},
    )


@app.post("/paper/{paper_id}/share-email")
@limiter.limit("10/minute")
def share_paper_email(request: Request, paper_id: int, req: ShareEmailRequest, db: Session = Depends(get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    if not email_configured():
        raise HTTPException(
            status_code=400,
            detail="Email isn't set up yet. Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD to backend/.env (see the email setup steps from earlier) to enable this.",
        )
    if not req.to:
        raise HTTPException(status_code=400, detail="Add at least one recipient email")

    paper = db.query(models.Paper).filter(
        models.Paper.id == paper_id, models.Paper.owner_id == current_user.id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    ext = "docx" if paper.file_type == "docx" else "pdf"
    file_path = os.path.join(GENERATED_DIR, f"paper_{paper.id}.{ext}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not generated yet")

    subject = f"Question Paper: {paper.paper_name}"
    body = req.message.strip() or (
        f"Hi,\n\nSharing the question paper \"{paper.paper_name}\", generated via QPaper AI.\n\n— {current_user.name}"
    )

    sent_to, failed = [], []
    for email in req.to:
        ok = send_email_with_attachment(email, subject, body, file_path, f"{paper.paper_name}.{ext}")
        (sent_to if ok else failed).append(email)

    return {"sent_to": sent_to, "failed": failed}


@app.get("/papers")
def list_papers(db: Session = Depends(get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    papers = db.query(models.Paper).filter(
        models.Paper.owner_id == current_user.id
    ).order_by(models.Paper.created_at.desc()).all()
    return [{"id": p.id, "paper_name": p.paper_name, "file_type": p.file_type,
             "parent_paper_id": p.parent_paper_id, "version": p.version, "created_at": p.created_at} for p in papers]


@app.get("/papers/{paper_id}")
def get_paper_detail(paper_id: int, db: Session = Depends(get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Returns a paper's full question list — used by the 'rebuild this paper'
    flow, which loads these questions back into the Generate Paper workspace
    so the teacher can tweak/add/remove before building a new version."""
    paper = db.query(models.Paper).filter(
        models.Paper.id == paper_id, models.Paper.owner_id == current_user.id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    ids = [int(i) for i in paper.question_ids.split(",") if i]
    questions = db.query(models.Question).filter(
        models.Question.id.in_(ids), models.Question.owner_id == current_user.id
    ).all()
    id_to_q = {q.id: q for q in questions}
    ordered = [_question_dict(id_to_q[i]) for i in ids if i in id_to_q]

    return {
        "id": paper.id, "paper_name": paper.paper_name, "file_type": paper.file_type,
        "parent_paper_id": paper.parent_paper_id, "version": paper.version, "created_at": paper.created_at,
        "questions": ordered,
    }


# ---------- Paper templates (save institution/course details for reuse) ----------
def _template_dict(t: models.PaperTemplate) -> dict:
    return {
        "id": t.id, "name": t.name, "output_mode": t.output_mode,
        "institution": t.institution, "course": t.course, "duration": t.duration,
        "university_name": t.university_name, "exam_title": t.exam_title,
        "semester_label": t.semester_label, "school": t.school, "programme": t.programme,
        "course_code": t.course_code, "course_name": t.course_name, "semester": t.semester,
        "time_str": t.time_str, "max_marks": t.max_marks, "instructions": t.instructions,
        "logo_filename": t.logo_filename, "created_at": t.created_at,
    }


@app.post("/paper-templates")
def save_paper_template(req: SaveTemplateRequest, db: Session = Depends(get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    t = models.PaperTemplate(owner_id=current_user.id, **req.dict())
    db.add(t)
    db.commit()
    db.refresh(t)
    return _template_dict(t)


@app.get("/paper-templates")
def list_paper_templates(db: Session = Depends(get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    templates = db.query(models.PaperTemplate).filter(
        models.PaperTemplate.owner_id == current_user.id
    ).order_by(models.PaperTemplate.created_at.desc()).all()
    return [_template_dict(t) for t in templates]


@app.delete("/paper-templates/{template_id}")
def delete_paper_template(template_id: int, db: Session = Depends(get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    t = db.query(models.PaperTemplate).filter(
        models.PaperTemplate.id == template_id, models.PaperTemplate.owner_id == current_user.id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"status": "deleted"}


# ---------- Similarity check (near-duplicate questions in your bank) ----------
@app.get("/questions/similarity")
def check_similarity(threshold: float = 0.75, db: Session = Depends(get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Flags near-duplicate questions within the same topic — genuinely
    different wording of the same question, which exact-match dedup during
    generation wouldn't catch. Capped comparisons (same-topic only) so this
    stays fast even with a few hundred questions."""
    questions = db.query(models.Question).filter(
        models.Question.owner_id == current_user.id
    ).order_by(models.Question.topic).all()

    by_topic = {}
    for q in questions:
        by_topic.setdefault(q.topic or "Untitled", []).append(q)

    pairs = []
    MAX_PER_TOPIC = 150  # avoid O(n^2) blowup on a huge single-topic bank
    for topic, qs in by_topic.items():
        qs = qs[:MAX_PER_TOPIC]
        for i in range(len(qs)):
            for j in range(i + 1, len(qs)):
                ratio = SequenceMatcher(None, qs[i].question.lower(), qs[j].question.lower()).ratio()
                if ratio >= threshold:
                    pairs.append({
                        "topic": topic, "similarity": round(ratio, 3),
                        "question_a": {"id": qs[i].id, "text": qs[i].question},
                        "question_b": {"id": qs[j].id, "text": qs[j].question},
                    })

    pairs.sort(key=lambda p: p["similarity"], reverse=True)
    return {"total_questions": len(questions), "similar_pairs": pairs}


# ---------- Export MCQs for Google Forms-style bulk importers ----------
@app.get("/questions/export-mcq-csv")
def export_mcq_csv(ids: Optional[str] = None, db: Session = Depends(get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    """CSV with one row per MCQ: Question, Option A-D, Answer. Google Forms
    itself has no native bulk-import feature (confirmed — there isn't a
    'direct' path), but this column layout matches what popular import
    add-ons (Form Builder, Formswrite, etc.) expect, so you can drop this
    straight into one of those instead of retyping every question by hand."""
    query = db.query(models.Question).filter(
        models.Question.owner_id == current_user.id, models.Question.question_type == "mcq"
    )
    if ids:
        id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
        query = query.filter(models.Question.id.in_(id_list))
    questions = query.order_by(models.Question.created_at.desc()).all()

    if not questions:
        raise HTTPException(status_code=404, detail="No MCQ questions found to export")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Question", "Option A", "Option B", "Option C", "Option D", "Answer"])
    for q in questions:
        options = json.loads(q.options_json) if q.options_json else ["", "", "", ""]
        while len(options) < 4:
            options.append("")
        writer.writerow([q.question, *options[:4], q.correct_option or ""])

    csv_path = os.path.join(GENERATED_DIR, f"mcq_export_{current_user.id}_{int(datetime.utcnow().timestamp())}.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        f.write(output.getvalue())

    return FileResponse(csv_path, media_type="text/csv", filename="mcq_questions.csv")


# ---------- Stats & activity ----------
@app.get("/stats")
def get_stats(db: Session = Depends(get_db),
              current_user: models.User = Depends(auth.get_current_user)):
    base_q = db.query(models.Question).filter(models.Question.owner_id == current_user.id)
    total_questions = base_q.count()
    total_papers = db.query(models.Paper).filter(models.Paper.owner_id == current_user.id).count()
    total_topics = base_q.filter(models.Question.topic.isnot(None)).with_entities(
        models.Question.topic).distinct().count()

    bloom_levels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
    bloom_counts = {
        level: base_q.filter(models.Question.bloom_level == level).count()
        for level in bloom_levels
    }
    bloom_coverage_pct = round(
        sum(1 for v in bloom_counts.values() if v > 0) / len(bloom_levels) * 100, 1
    )

    today = datetime.utcnow().date()
    daily_counts = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = base_q.filter(func.date(models.Question.created_at) == day.isoformat()).count()
        daily_counts.append({"date": day.strftime("%a"), "count": count})

    return {
        "total_topics": total_topics, "total_questions": total_questions,
        "total_papers": total_papers, "bloom_counts": bloom_counts,
        "bloom_coverage_pct": bloom_coverage_pct, "daily_counts": daily_counts,
    }


@app.get("/activity")
def get_activity(db: Session = Depends(get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    recent_papers = db.query(models.Paper).filter(
        models.Paper.owner_id == current_user.id
    ).order_by(models.Paper.created_at.desc()).limit(5).all()
    recent_questions = db.query(
        models.Question.id, models.Question.topic, models.Question.bloom_level, models.Question.created_at
    ).filter(models.Question.owner_id == current_user.id
             ).order_by(models.Question.created_at.desc()).limit(5).all()
    recent_replies = db.query(models.Feedback).filter(
        models.Feedback.owner_id == current_user.id,
        models.Feedback.reply.isnot(None),
    ).order_by(models.Feedback.reply_at.desc()).limit(5).all()

    items = []
    for p in recent_papers:
        items.append({"id": f"paper-{p.id}", "type": "paper",
                       "text": f'Built paper "{p.paper_name}"', "timestamp": p.created_at})
    for q in recent_questions:
        items.append({"id": f"question-{q.id}", "type": "question",
                       "text": f'Generated a {q.bloom_level} question on "{q.topic}"',
                       "timestamp": q.created_at})
    for f in recent_replies:
        preview = f.reply if len(f.reply) <= 80 else f.reply[:77] + "..."
        items.append({"id": f"reply-{f.id}", "type": "reply",
                       "text": f'Owner replied: "{preview}"', "timestamp": f.reply_at,
                       "feedback_id": f.id})

    items.sort(key=lambda x: x["timestamp"], reverse=True)
    return items[:8]


# ---------- Feedback ----------
@app.post("/feedback")
@limiter.limit("10/minute")
def submit_feedback(request: Request, req: FeedbackRequest, db: Session = Depends(get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    fb = models.Feedback(owner_id=current_user.id, category=req.category, message=req.message)
    db.add(fb)
    db.commit()
    return {"status": "received", "message": "Thanks — your feedback was saved."}


@app.get("/feedback")
def list_feedback(db: Session = Depends(get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    items = db.query(models.Feedback).filter(
        models.Feedback.owner_id == current_user.id
    ).order_by(models.Feedback.created_at.desc()).all()
    return [
        {"id": f.id, "category": f.category, "message": f.message, "created_at": f.created_at,
         "reply": f.reply, "reply_at": f.reply_at}
        for f in items
    ]


@app.post("/admin/feedback/{feedback_id}/reply")
def admin_reply_feedback(feedback_id: int, req: ReplyFeedbackRequest, db: Session = Depends(get_db),
                          admin_user: models.User = Depends(auth.get_admin_user)):
    """Owner-only: reply in-app to a piece of feedback. The sender sees it
    show up in their own notification bell, no email needed."""
    fb = db.query(models.Feedback).filter(models.Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")

    fb.reply = req.message
    fb.reply_at = datetime.utcnow()
    db.commit()
    db.refresh(fb)
    return {"id": fb.id, "reply": fb.reply, "reply_at": fb.reply_at}


@app.get("/admin/feedback")
def admin_list_feedback(db: Session = Depends(get_db),
                         admin_user: models.User = Depends(auth.get_admin_user)):
    """Owner-only: every user's feedback, with enough info to contact them back."""
    items = db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).all()
    result = []
    for f in items:
        sender = db.query(models.User).filter(models.User.id == f.owner_id).first()
        result.append({
            "id": f.id, "category": f.category, "message": f.message, "created_at": f.created_at,
            "reply": f.reply, "reply_at": f.reply_at,
            "user_name": sender.name if sender else "Unknown user",
            "user_email": sender.email if sender else None,
        })
    return result


@app.get("/admin/users")
def admin_list_users(db: Session = Depends(get_db),
                      admin_user: models.User = Depends(auth.get_admin_user)):
    """Owner-only: everyone who has registered, for reference/contact."""
    users = db.query(models.User).order_by(models.User.id).all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "is_verified": u.is_verified}
        for u in users
    ]
