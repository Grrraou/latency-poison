"""
Send verification emails. Configure SMTP via env or log link in dev.
Env: SMTP_HOST, SMTP_PORT (587=STARTTLS, 465=SMTPS), SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_TIMEOUT (optional)
"""
import os
import re
import ssl
import smtplib
from email.mime.text import MIMEText


def _envelope_from(display_from: str) -> str:
    """Extract envelope sender (addr-spec). OVH and some servers require plain email."""
    m = re.search(r"<([^>]+)>", display_from)
    return m.group(1).strip().lower() if m else display_from.strip().lower()

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
    print(f"[EMAIL] Sending verification to {to_email}")
    try:
        msg = MIMEText(body, "plain")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = to_email
        port = int(os.getenv("SMTP_PORT", "587"))
        user = os.getenv("SMTP_USER", "").strip()
        password = os.getenv("SMTP_PASSWORD", "")
        timeout = int(os.getenv("SMTP_TIMEOUT", "25"))
        # Port 465 = SMTPS (implicit TLS); use SMTP_SSL with explicit context. Port 587 = STARTTLS.
        if port == 465:
            context = ssl.create_default_context()
            # Some providers (e.g. OVH) use a cert with different CN; allow skipping hostname check.
            if os.getenv("SMTP_SSL_NO_VERIFY_HOST", "").strip().lower() in ("1", "true", "yes"):
                context.check_hostname = False
            with smtplib.SMTP_SSL(smtp_host, port, timeout=timeout, context=context) as server:
                server.ehlo()
                if user and password:
                    server.login(user, password)
                refused = server.sendmail(_envelope_from(smtp_from), [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, port, timeout=timeout) as server:
                if user and password:
                    server.starttls()
                    server.login(user, password)
                refused = server.sendmail(_envelope_from(smtp_from), [to_email], msg.as_string())
        if refused:
            print(f"[EMAIL] Server refused recipient {to_email}: {refused}")
            return None
        print(f"[EMAIL] Sent verification to {to_email}")
        return None
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to_email}: {e}")
        return None
