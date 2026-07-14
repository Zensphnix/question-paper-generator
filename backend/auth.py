import os
import hashlib
import hmac
import base64
import random
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from database import get_db
import models

# In a real deployment this would come from an environment variable.
# For a local college-project demo, a fixed dev secret is fine.
SECRET_KEY = os.getenv("JWT_SECRET", "qpaper-ai-dev-secret-do-not-use-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 1 week — convenient for a demo, avoids re-login mid-viva
OTP_EXPIRE_MINUTES = 10


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


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")

    user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user
