"""
users.py
--------
This file defines the user-related API endpoints for the MindEcho backend.
It handles retrieving the currently authenticated user's profile and
updating editable profile information such as full name and phone number.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.models.database import get_session
from app.models.models import User, UserRead, UserUpdate
from app.utils.auth import get_current_user

# Router for all user-related API endpoints
router = APIRouter(prefix="/users", tags=["users"])


# Return the profile of the currently authenticated user
@router.get("/me", response_model=UserRead)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


# Update editable profile fields for the currently authenticated user
@router.patch("/me", response_model=UserRead)
def update_profile(
    updates: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if updates.full_name is not None:
        current_user.full_name = updates.full_name
    if updates.phone_number is not None:
        current_user.phone_number = updates.phone_number
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user
