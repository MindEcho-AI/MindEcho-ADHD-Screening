"""
models.py
---------
This file defines the main database models and schemas used in the MindEcho backend.
It includes SQLModel tables for users, children, assessments, and analysis jobs,
along with related create/read/update schemas and enum classes for standardized
status and analysis type values.
"""

from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Enum classes for standardized analysis categories and processing states
class AnalysisType(str, Enum):
    eye = "eye"
    body = "body"
    speech = "speech"


# Enum representing the processing state of an analysis job
class AnalysisStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


# Base model containing common user fields shared across user schemas
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    full_name: str
    role: str = Field(default="teacher")


# Database table for storing registered users and their account-related information
class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str
    phone_number: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)

    # Fields used for password reset via OTP
    otp_code: Optional[str] = None
    otp_expires_at: Optional[datetime] = None

    assessments: List["Assessment"] = Relationship(back_populates="user")
    analysis_jobs: List["AnalysisJob"] = Relationship(back_populates="user")


# Schema used when creating a new user account
class UserCreate(SQLModel):
    email: str
    full_name: str
    password: str
    phone_number: Optional[str] = None


# Schema used when returning user details to the frontend
class UserRead(UserBase):
    id: int
    phone_number: Optional[str] = None
    created_at: datetime
    is_active: bool


# Schema used when updating editable user profile fields
class UserUpdate(SQLModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None


# Base model storing child information used during assessments
class ChildBase(SQLModel):
    full_name: str
    age: int
    class_name: str
    teacher_name: str
    assessment_date: str
    photo_url: Optional[str] = None


# Database table for storing child profiles linked to assessments
class Child(ChildBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    assessments: List["Assessment"] = Relationship(back_populates="child")


# Schema used when creating a new child profile
class ChildCreate(ChildBase):
    pass


# Schema used when returning child details to the frontend
class ChildRead(ChildBase):
    id: int
    created_at: datetime


# Enum for tracking the overall assessment workflow state
class AssessmentStatus(str, Enum):
    in_progress = "in_progress"
    processing = "processing"
    completed = "completed"


# Database table for storing each ADHD screening assessment
class Assessment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    child_id: int = Field(foreign_key="child.id")
    status: AssessmentStatus = Field(default=AssessmentStatus.in_progress)
    questionnaire_answers: Optional[str] = None
    adhd_likelihood: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    user: Optional[User] = Relationship(back_populates="assessments")
    child: Optional[Child] = Relationship(back_populates="assessments")
    analysis_jobs: List["AnalysisJob"] = Relationship(back_populates="assessment")


# Schema used when creating a new assessment
class AssessmentCreate(SQLModel):
    child_id: int
    questionnaire_answers: Optional[str] = None


# Schema used when returning assessment details and related child information
class AssessmentRead(SQLModel):
    id: int
    user_id: int
    child_id: int
    status: AssessmentStatus
    adhd_likelihood: Optional[str]
    questionnaire_answers: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    child: Optional[ChildRead] = None


# Database table for storing each analysis task linked to an assessment
class AnalysisJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    assessment_id: int = Field(foreign_key="assessment.id")
    type: AnalysisType
    status: AnalysisStatus = Field(default=AnalysisStatus.pending)
    file_path: Optional[str] = None
    result_json: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    user: Optional[User] = Relationship(back_populates="analysis_jobs")
    assessment: Optional[Assessment] = Relationship(back_populates="analysis_jobs")


# Schema used when returning analysis job results to the frontend
class AnalysisJobRead(SQLModel):
    id: int
    user_id: int
    assessment_id: int
    type: AnalysisType
    status: AnalysisStatus
    result_json: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
