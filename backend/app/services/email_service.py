"""
email_service.py
================
Handles OTP generation and email sending for password reset.

If SMTP_USER and SMTP_PASSWORD are not set in .env,
the OTP is printed to the terminal (development/testing mode).
"""

import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent.parent / ".env")

# TEMP DEBUG
print(f"DEBUG SMTP_USER='{os.getenv('SMTP_USER')}' SMTP_PASSWORD='{os.getenv('SMTP_PASSWORD')}'")

# ─── Read SMTP settings from .env ─────────────────────────────────────────────
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", 587))
SMTP_USER     = os.getenv("SMTP_USER", "")          # your Gmail address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")      # Gmail App Password
EMAIL_FROM    = os.getenv("EMAIL_FROM", SMTP_USER)  # defaults to SMTP_USER if not set


def generate_otp(length: int = 6) -> str:
    """Generate a random 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


def send_otp_email(to_email: str, otp: str, full_name: str) -> bool:
    """
    Send OTP email to the user.

    Returns True if email was sent (or printed in dev mode).
    Returns False if sending failed.

    Dev mode: if SMTP_USER or SMTP_PASSWORD is missing in .env,
    the OTP is printed to the terminal instead of emailed.
    """

    # ── Dev mode: no SMTP configured → print to terminal ──────────────────
    if not SMTP_USER or not SMTP_PASSWORD:
        print("\n" + "=" * 50)
        print("📧  OTP EMAIL (dev mode — SMTP not configured in .env)")
        print(f"    To:   {to_email}")
        print(f"    Name: {full_name}")
        print(f"    OTP:  {otp}")
        print("=" * 50 + "\n")
        return True

    # ── Production mode: send real email via SMTP ──────────────────────────
    try:
        # Build the email message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "MindEcho — Your Password Reset Code"
        msg["From"]    = EMAIL_FROM
        msg["To"]      = to_email

        # HTML email body
        html = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #3D2314;">MindEcho Password Reset</h2>
          <p>Hi {full_name},</p>
          <p>You requested a password reset. Use this OTP code to continue:</p>

          <div style="
            background: #F5F0E8;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #6B7F3A;
            margin: 24px 0;
          ">
            {otp}
          </div>

          <p style="color: #888; font-size: 13px;">
            This code expires in <strong>10 minutes</strong>.
            If you did not request this, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 11px;">MindEcho — ADHD Screening Platform</p>
        </div>
        """

        msg.attach(MIMEText(html, "html"))

        # Connect to Gmail SMTP and send
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()           # encrypt the connection
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())

        print(f"✓ OTP email sent to {to_email}", flush=True)
        return True

    except smtplib.SMTPAuthenticationError:
        # Wrong Gmail credentials or App Password not set up correctly
        print("❌ SMTP Authentication failed — check SMTP_USER and SMTP_PASSWORD in .env")
        print("   Make sure you are using a Gmail App Password, not your real Gmail password.")
        return False

    except smtplib.SMTPException as e:
        print(f"❌ SMTP error while sending email: {e}")
        return False

    except Exception as e:
        print(f"❌ Unexpected error sending email: {e}")
        return False