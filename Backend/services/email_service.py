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


def send_verification_email(to_email: str, username: str, token: str) -> None:
    verify_url = f"{settings.app_base_url}/verify-email?token={token}"
    html = f"""
<p>Hi {username},</p>
<p>Thanks for signing up for HireIQ. Please verify your email address:</p>
<p><a href="{verify_url}">Verify Email</a></p>
<p>This link expires in 24 hours.</p>
<p>If you did not create an account, you can ignore this email.</p>
"""
    _send(to_email, "Verify your HireIQ email", html)


def send_password_reset_email(to_email: str, username: str, token: str) -> None:
    reset_url = f"{settings.app_base_url}/reset-password?token={token}"
    html = f"""
<p>Hi {username},</p>
<p>We received a request to reset your HireIQ password:</p>
<p><a href="{reset_url}">Reset Password</a></p>
<p>This link expires in 60 minutes.</p>
<p>If you did not request a password reset, you can ignore this email.</p>
"""
    _send(to_email, "Reset your HireIQ password", html)
