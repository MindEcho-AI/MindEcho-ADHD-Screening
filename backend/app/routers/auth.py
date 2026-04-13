"""
auth.py
-------
This file defines the authentication-related API endpoints for the MindEcho backend.
It handles user registration, login, fetching the current authenticated user,
and the OTP-based forgot-password and password reset workflow.
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.models.database import get_session
from app.models.models import User, UserCreate, UserRead
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.services.email_service import generate_otp, send_otp_email

# Router for all authentication-related API endpoints
router = APIRouter(prefix="/auth", tags=["auth"])

# OTP settings used for password reset requests
OTP_EXPIRE_MINUTES = 10   # OTP is valid for 10 minutes
OTP_COOLDOWN_SECS  = 48   # Minimum wait time before requesting a new OTP

# Return the current timezone-aware UTC datetime
def utc_now():
    return datetime.now(timezone.utc)


# Register a new user account if the email is not already in use
@router.post("/register", response_model=UserRead, status_code=201)
def register(user_in: UserCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == user_in.email)).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="This email is already registered. Please sign in instead."
        )
    user = User(
        email=user_in.email.lower().strip(),
        full_name=user_in.full_name.strip(),
        role="teacher",
        phone_number=user_in.phone_number,
        hashed_password=hash_password(user_in.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# Authenticate a user and return an access token on successful login
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.email == form_data.username.lower().strip())
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with this email. Please check and try again.",
        )
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been deactivated.",
        )

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    }


# Return the currently authenticated user's profile
@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# Step 1 of password reset: generate and send an OTP to the user's email
@router.post("/forgot-password")
def forgot_password(payload: dict, session: Session = Depends(get_session)):
    email = payload.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No account found with this email address. Please check and try again."
        )

    now = utc_now()

    # Enforce cooldown — prevent spamming OTP requests
    if user.otp_expires_at:
        # Make stored time timezone-aware for comparison
        stored_expiry = user.otp_expires_at
        if stored_expiry.tzinfo is None:
            stored_expiry = stored_expiry.replace(tzinfo=timezone.utc)
        
        # otp_expires_at = when OTP expires = sent_time + 10 min
        # sent_time = otp_expires_at - 10 min
        # cooldown_until = sent_time + 48s
        sent_time = stored_expiry - timedelta(minutes=OTP_EXPIRE_MINUTES)
        cooldown_until = sent_time + timedelta(seconds=OTP_COOLDOWN_SECS)
        
        if now < cooldown_until:
            seconds_left = int((cooldown_until - now).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {seconds_left} seconds before requesting a new OTP."
            )

    # Generate new OTP with timezone-aware expiry
    otp = generate_otp()
    user.otp_code       = otp
    user.otp_expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)
    session.add(user)
    session.commit()

    send_otp_email(to_email=user.email, otp=otp, full_name=user.full_name)

    return {"message": f"OTP sent to {email}."}


# Step 2 of password reset: verify the OTP submitted by the user
@router.post("/verify-otp")
def verify_otp(payload: dict, session: Session = Depends(get_session)):
    email = payload.get("email", "").lower().strip()
    otp   = payload.get("otp", "").strip()

    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not user.otp_code:
        raise HTTPException(status_code=400, detail="Invalid request. Please request a new OTP.")

    now = utc_now()
    stored_expiry = user.otp_expires_at
    if stored_expiry.tzinfo is None:
        stored_expiry = stored_expiry.replace(tzinfo=timezone.utc)

    if now > stored_expiry:
        raise HTTPException(
            status_code=400,
            detail="This OTP has expired. Please request a new one."
        )
    if user.otp_code != otp:
        raise HTTPException(
            status_code=400,
            detail="Incorrect OTP code. Please check and try again."
        )

    return {"message": "OTP verified.", "email": email}


# Step 3 of password reset: update the password after OTP verification
@router.post("/reset-password")
def reset_password(payload: dict, session: Session = Depends(get_session)):
    email    = payload.get("email", "").lower().strip()
    otp      = payload.get("otp", "").strip()
    new_pass = payload.get("new_password", "")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not user.otp_code:
        raise HTTPException(
            status_code=400,
            detail="Invalid request. Please restart the reset process."
        )

    now = utc_now()
    stored_expiry = user.otp_expires_at
    if stored_expiry.tzinfo is None:
        stored_expiry = stored_expiry.replace(tzinfo=timezone.utc)

    if now > stored_expiry:
        raise HTTPException(
            status_code=400,
            detail="OTP expired. Please request a new one."
        )
    if user.otp_code != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    # Update password, clear OTP fields
    user.hashed_password = hash_password(new_pass)
    user.otp_code        = None
    user.otp_expires_at  = None
    session.add(user)
    session.commit()

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "message": "Password reset successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    }
