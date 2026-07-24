import os
import hashlib
import hmac
import base64
import random
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session

from database import get_db
import models

# In a real deployment this would come from an environment variable.
# For a local college-project demo, a fixed dev secret is fine.
SECRET_KEY = os.getenv("JWT_SECRET", "qpaper-ai-dev-secret-do-not-use-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 1 week — convenient for a demo, avoids re-login mid-viva
OTP_EXPIRE_MINUTES = 10
COOKIE_NAME = "qpaper_session"

# Cookies need different settings for local http dev vs. deployed https:
# - secure=True cookies are silently dropped by browsers over plain http
# - cross-site cookies (Vercel <-> Render, different domains) need SameSite=None,
#   which browsers only honor when Secure=True
# Set COOKIE_SECURE=true in Render's env vars; leave unset locally.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = "none" if COOKIE_SECURE else "lax"


def generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def otp_expiry() -> datetime:
    return datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)


def hash_password(password: str) -> str:
    """PBKDF2-SHA256, stdlib only — no bcrypt/argon2 native build required."""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return base64.b64encode(salt + dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        raw = base64.b64decode(stored.encode())
        salt, dk = raw[:16], raw[16:]
        new_dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
        return hmac.compare_digest(dk, new_dk)
    except Exception:
        return False


def create_access_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def set_auth_cookie(response, token: str):
    """Stores the session token in an HttpOnly cookie — JavaScript (and
    therefore any XSS on the page) can never read it, unlike localStorage."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )


def clear_auth_cookie(response):
    response.delete_cookie(key=COOKIE_NAME, path="/")


def _extract_token(request: Request, authorization: Optional[str]) -> Optional[str]:
    # Cookie is the real mechanism now; Authorization header is kept as a
    # fallback so nothing breaks for anyone with an old client still sending it.
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1]
    return None


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    token = _extract_token(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")

    user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.is_suspended:
        raise HTTPException(status_code=403, detail="This account has been suspended. Contact your administrator.")
    return user


def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user
