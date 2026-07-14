import os
import json
import shutil
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, engine, get_db
import models
import auth
from services.pdf_parser import extract_text
from services.topic_extractor import extract_topics
from services.ai_generator import generate_questions, generate_mixed_questions
from services.bloom_classifier import classify_question
from services.validator import remove_duplicates, validate_against_existing
from services.pdf_export import build_pdf
from services.docx_export import build_docx_from_template, has_placeholder
from services.email_service import send_otp_email, send_email_with_attachment, is_configured as email_configured
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Automated Question Paper Generator")

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

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


class AutoGenerateRequest(BaseModel):
    topics: List[str]
    total_questions: int = 30
    marks: int = 5
    difficulty: str = "Medium"
    unit: Optional[str] = None
    language: str = "English"
    set_label: Optional[str] = None


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


class BuildFromTemplateRequest(BaseModel):
    paper_name: str
    template_filename: str
    sections: List[SectionInput]
    include_answers: bool = False


class FeedbackRequest(BaseModel):
    category: str = "general"
    message: str


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


def _persist_items(db: Session, items, topic: str, marks: int, difficulty: str,
                    unit: Optional[str], owner_id: int, set_label: Optional[str] = None):
    saved = []
    for item in items:
        detected_level = classify_question(item["question"])
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
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        saved.append({
            "id": q.id, "question": q.question, "answer": q.answer, "topic": q.topic,
            "bloom_level": q.bloom_level, "marks": q.marks, "difficulty": q.difficulty,
            "set": q.set_label,
        })
    return saved


def _user_dict(user: models.User) -> dict:
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "role": user.role, "avatar_url": user.avatar_url,
    }


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
def register(req: RegisterRequest, db: Session = Depends(get_db)):
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
def verify_otp(req: VerifyOtpRequest, db: Session = Depends(get_db)):
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

    token = auth.create_access_token(user.id, user.email)
    return {"access_token": token, "user": _user_dict(user)}


@app.post("/auth/resend-otp")
def resend_otp(req: ResendOtpRequest, db: Session = Depends(get_db)):
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
def request_login_otp(req: RequestLoginOtpRequest, db: Session = Depends(get_db)):
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


@app.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
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

    token = auth.create_access_token(user.id, user.email)
    return {"access_token": token, "user": _user_dict(user)}


@app.get("/auth/me")
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return _user_dict(current_user)


@app.post("/auth/google")
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in isn't configured on this server yet")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            req.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
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

    token = auth.create_access_token(user.id, user.email)
    return {"access_token": token, "user": _user_dict(user)}


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
def generate(req: GenerateRequest, db: Session = Depends(get_db),
             current_user: models.User = Depends(auth.get_current_user)):
    existing = [q.question for q in db.query(models.Question).filter(
        models.Question.topic == req.topic, models.Question.owner_id == current_user.id).all()]

    collected = _generate_deduped(
        gen_fn=lambda count: generate_questions(
            topic=req.topic, bloom_level=req.bloom_level, marks=req.marks,
            difficulty=req.difficulty, count=count, language=req.language,
        ),
        target_count=req.count,
        existing_texts=existing,
    )
    saved = _persist_items(db, collected, req.topic, req.marks, req.difficulty,
                            req.unit, current_user.id, req.set_label)
    return {"requested_level": req.bloom_level, "requested_count": req.count,
            "actual_count": len(saved), "questions": saved}


@app.post("/generate/auto")
def generate_auto(req: AutoGenerateRequest, db: Session = Depends(get_db),
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


@app.get("/questions")
def list_questions(topic: Optional[str] = None, bloom_level: Optional[str] = None,
                    search: Optional[str] = None, db: Session = Depends(get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.Question).filter(models.Question.owner_id == current_user.id)
    if topic:
        query = query.filter(models.Question.topic == topic)
    if bloom_level:
        query = query.filter(models.Question.bloom_level == bloom_level)
    if search:
        query = query.filter(models.Question.question.ilike(f"%{search}%"))
    results = query.order_by(models.Question.created_at.desc()).all()
    return [
        {"id": q.id, "question": q.question, "answer": q.answer, "topic": q.topic,
         "marks": q.marks, "difficulty": q.difficulty, "bloom_level": q.bloom_level,
         "unit": q.unit, "set": q.set_label, "created_at": q.created_at}
        for q in results
    ]


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
        file_type="pdf",
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    logo_path = os.path.join(LOGO_DIR, req.logo_filename) if req.logo_filename else None

    output_path = os.path.join(GENERATED_DIR, f"paper_{paper.id}.pdf")
    build_pdf(
        output_path=output_path, institution=req.institution, course=req.course,
        duration=req.duration, max_marks=req.max_marks, instructions=req.instructions,
        sections=sections_payload, include_answers=req.include_answers, logo_path=logo_path,
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


@app.post("/paper/{paper_id}/share-email")
def share_paper_email(paper_id: int, req: ShareEmailRequest, db: Session = Depends(get_db),
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
             "created_at": p.created_at} for p in papers]


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
        models.Question.topic, models.Question.bloom_level, models.Question.created_at
    ).filter(models.Question.owner_id == current_user.id
             ).order_by(models.Question.created_at.desc()).limit(5).all()
    recent_replies = db.query(models.Feedback).filter(
        models.Feedback.owner_id == current_user.id,
        models.Feedback.reply.isnot(None),
    ).order_by(models.Feedback.reply_at.desc()).limit(5).all()

    items = []
    for p in recent_papers:
        items.append({"type": "paper", "text": f'Built paper "{p.paper_name}"', "timestamp": p.created_at})
    for q in recent_questions:
        items.append({"type": "question", "text": f'Generated a {q.bloom_level} question on "{q.topic}"',
                       "timestamp": q.created_at})
    for f in recent_replies:
        preview = f.reply if len(f.reply) <= 80 else f.reply[:77] + "..."
        items.append({"type": "reply", "text": f'Owner replied: "{preview}"', "timestamp": f.reply_at,
                       "feedback_id": f.id})

    items.sort(key=lambda x: x["timestamp"], reverse=True)
    return items[:8]


# ---------- Feedback ----------
@app.post("/feedback")
def submit_feedback(req: FeedbackRequest, db: Session = Depends(get_db),
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
