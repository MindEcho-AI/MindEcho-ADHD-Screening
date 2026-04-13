
"""
auth.py
-------
This utility file handles authentication and authorization logic for the
MindEcho backend. It loads security settings, hashes and verifies passwords,
creates JWT access tokens, and retrieves the currently authenticated user
from the provided token.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session
from dotenv import load_dotenv
import os

from app.models.database import get_session
from app.models.models import User

# Load environment variables such as SECRET_KEY and token expiry settings
load_dotenv()

# Security settings used for JWT creation and validation
SECRET_KEY = os.getenv("SECRET_KEY", "mindecho-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

# OAuth2 scheme used to read the bearer token from requests
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# Check whether a plain-text password matches its stored bcrypt hash
def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# Hash a plain-text password before storing it in the database
def hash_password(plain: str) -> str:
    # Truncate to 72 bytes — bcrypt's maximum (this is safe & standard)
    plain_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_bytes, salt).decode("utf-8")


# Create a signed JWT access token containing user authentication data
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Decode the JWT token and return the currently authenticated active user
def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.get(User, int(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    return user
