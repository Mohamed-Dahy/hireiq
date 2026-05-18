"""
email_service.py
----------------
Transactional email via Resend. Falls back to a logger warning when
RESEND_API_KEY is not configured (dev / test environments).
"""

import resend
from loguru import logger

from app.config import settings


def _send(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — email suppressed | to={} subject={}", to, subject)
        return

    try:
        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        })
    except Exception as exc:
        # Email delivery failure must never crash the request that triggered it.
        # The token is already persisted — user can request a resend.
        logger.error("Email delivery failed | to={} subject={} error={}", to, subject, exc)


def send_account_deletion_email(to_email: str, username: str) -> None:
    html = f"""
<p>Hi {username},</p>
<p>Your HireIQ account has been permanently deleted as requested.</p>
<p>All your data, including CV sessions and interview results, has been removed.</p>
<p>If you believe this was done in error, please contact support immediately.</p>
"""
    _send(to_email, "Your HireIQ account has been deleted", html)


def send_otp_email(to_email: str, username: str, otp_code: str, purpose: str) -> None:
    subjects = {
        "registration": "Your HireIQ verification code",
        "password_reset": "Your HireIQ password reset code",
        "password_change": "Your HireIQ password change code",
    }
    subject = subjects.get(purpose, "Your HireIQ verification code")
    html = f"""
<p>Hi {username},</p>
<p>{subject}:</p>
<p style="font-size:2em; font-weight:bold; letter-spacing:4px; text-align:center; margin:24px 0;">{otp_code}</p>
<p>This code expires in 10 minutes. If you did not request this code, you can ignore this email.</p>
"""
    _send(to_email, subject, html)
