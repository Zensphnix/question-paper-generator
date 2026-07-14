import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from dotenv import load_dotenv

load_dotenv()

GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")


def is_configured() -> bool:
    return bool(GMAIL_ADDRESS and GMAIL_APP_PASSWORD)


def send_otp_email(to_email: str, otp: str, name: str = "") -> bool:
    """Sends the OTP via Gmail SMTP. Returns True if sent, False if email
    isn't configured or sending failed — caller should fall back to
    printing the code in the backend terminal either way."""
    if not is_configured():
        return False

    msg = MIMEMultipart()
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to_email
    msg["Subject"] = "Your QPaper AI verification code"

    body = f"""Hi {name or 'there'},

Your verification code is: {otp}

This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.

— QPaper AI
"""
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[email_service] Failed to send email: {e}")
        return False


def send_email_with_attachment(to_email: str, subject: str, body: str,
                                attachment_path: str, attachment_filename: str) -> bool:
    if not is_configured():
        return False

    msg = MIMEMultipart()
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with open(attachment_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{attachment_filename}"')
        msg.attach(part)

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[email_service] Failed to send email with attachment: {e}")
        return False
