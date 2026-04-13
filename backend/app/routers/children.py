"""
children.py
-----------
This file defines the child-related API endpoints for the MindEcho backend.
It handles creating child profiles, listing stored child records, and
retrieving individual child details for use in assessments.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.models.database import get_session
from app.models.models import Child, ChildCreate, ChildRead, User
from app.utils.auth import get_current_user

# Router for all child-related API endpoints
router = APIRouter(prefix="/children", tags=["children"])


# Create a new child profile
@router.post("/", response_model=ChildRead, status_code=201)
def create_child(
    child_in: ChildCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    child = Child(**child_in.model_dump())
    session.add(child)
    session.commit()
    session.refresh(child)
    return child


# Return all child profiles available to the current user
@router.get("/", response_model=List[ChildRead])
def list_children(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(select(Child)).all()


# Return a single child profile by ID
@router.get("/{child_id}", response_model=ChildRead)
def get_child(
    child_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    child = session.get(Child, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    return child
