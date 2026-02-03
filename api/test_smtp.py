#!/usr/bin/env python3
"""
Test SMTP from inside the API container.
Usage (from host):
  docker compose exec api python test_smtp.py [recipient@example.com]
If no recipient is given, only connectivity is tested (no email sent).
"""
import os
import sys

def main():
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", "noreply@localhost").strip()

    if not host:
        print("SMTP_HOST is not set. Set SMTP_* in .env and restart the api container.")
        sys.exit(1)

    print(f"SMTP_HOST={host} SMTP_PORT={port} SMTP_USER={user or '(empty)'} SMTP_FROM={from_addr}")
    to_email = (sys.argv[1] if len(sys.argv) > 1 else "").strip()

    try:
        import smtplib
        timeout = int(os.getenv("SMTP_TIMEOUT", "15"))
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=timeout)
        else:
            server = smtplib.SMTP(host, port, timeout=timeout)
        with server:
            server.ehlo()
            if port == 587:
                server.starttls()
                server.ehlo()
            if user and password:
                server.login(user, password)
                print("Login OK.")
            if to_email:
                from email.mime.text import MIMEText
                msg = MIMEText("SMTP test from Latency Poison API container.")
                msg["Subject"] = "Latency Poison SMTP test"
                msg["From"] = from_addr
                msg["To"] = to_email
                server.sendmail(from_addr, [to_email], msg.as_string())
                print(f"Test email sent to {to_email}.")
            else:
                print("No recipient given; connectivity OK. To send a test email: python test_smtp.py you@example.com")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
