"""
Send verification emails. Configure SMTP via env or log link in dev.
Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM (e.g. "Latency Poison <noreply@example.com>")
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_verification_email(to_email: str, verify_url: str, is_new_email: bool = False):
    """Send verification email. Returns verify_url when SMTP not configured (dev), None when sent or on failure."""
    subject = "Verify your new email address" if is_new_email else "Verify your email address"
    body = f"""Hello,

Please verify your email by clicking the link below:

{verify_url}

This link expires in 24 hours. If you didn't request this, you can ignore this email.

— Latency Poison
"""
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "noreply@localhost").strip()
    if not smtp_host:
        # Dev: log link and return it so API can include in response
        print(f"[EMAIL] Verification link for {to_email}: {verify_url}")
        return verify_url
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain"))
        port = int(os.getenv("SMTP_PORT", "587"))
        user = os.getenv("SMTP_USER", "").strip()
        password = os.getenv("SMTP_PASSWORD", "")
        with smtplib.SMTP(smtp_host, port) as server:
            if user and password:
                server.starttls()
                server.login(user, password)
            server.sendmail(smtp_from, to_email, msg.as_string())
        return None
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to_email}: {e}")
        return None
