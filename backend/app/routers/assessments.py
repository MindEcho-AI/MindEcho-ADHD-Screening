"""
assessments.py
--------------
This file defines the assessment-related API endpoints for the MindEcho backend.
It handles creating assessments, listing and retrieving assessment records,
saving questionnaire responses, completing assessments, and attaching child
details to the data returned to the frontend.
"""

from typing import List, Optional
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.models.database import get_session
from app.models.models import (
    Assessment, AssessmentCreate, AssessmentRead, AssessmentStatus,
    AnalysisJob, AnalysisType, AnalysisStatus, Child, User
)
from app.utils.auth import get_current_user

# Router for all assessment-related API endpoints
router = APIRouter(prefix="/assessments", tags=["assessments"])


# Create a new assessment linked to the current user and selected child
@router.post("/", response_model=AssessmentRead, status_code=201)
def create_assessment(
    assessment_in: AssessmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    child = session.get(Child, assessment_in.child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    # Create a new assessment linked to the current user and selected child
    assessment = Assessment(
        user_id=current_user.id,
        child_id=assessment_in.child_id,
        questionnaire_answers=assessment_in.questionnaire_answers,
    )
    session.add(assessment)
    session.commit()
    session.refresh(assessment)
    return _enrich(assessment, session)


# Return all assessments created by the current user, ordered by newest first
@router.get("/", response_model=List[AssessmentRead])
def list_assessments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    assessments = session.exec(
        select(Assessment).where(Assessment.user_id == current_user.id).order_by(Assessment.created_at.desc())
    ).all()
    return [_enrich(a, session) for a in assessments]


# Return a single assessment if it belongs to the current user
@router.get("/{assessment_id}", response_model=AssessmentRead)
def get_assessment(
    assessment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _enrich(assessment, session)


# Save questionnaire responses for a specific assessment
@router.patch("/{assessment_id}/questionnaire")
def save_questionnaire(
    assessment_id: int,
    answers: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    # Store questionnaire answers as JSON text in the database
    assessment.questionnaire_answers = json.dumps(answers)
    session.add(assessment)
    session.commit()
    return {"status": "saved"}


# Mark an assessment as complete and calculate the final ADHD likelihood
@router.post("/{assessment_id}/complete")
def complete_assessment(
    assessment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Mark assessment complete and compute ADHD likelihood from analysis results."""
    from datetime import datetime
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    # Collect completed analysis jobs for this assessment
    jobs = session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == assessment_id,
            AnalysisJob.status == AnalysisStatus.completed,
        )
    ).all()

    eye_result = body_result = speech_result = {}
    for job in jobs:
        if job.result_json:
            data = json.loads(job.result_json)
            if job.type == AnalysisType.eye:
                eye_result = data
            elif job.type == AnalysisType.body:
                body_result = data
            elif job.type == AnalysisType.speech:
                speech_result = data

    # Combine eye, body, and speech outputs into one final likelihood
    from app.services.adhd_scorer import compute_adhd_likelihood
    if eye_result or body_result or speech_result:
        assessment.adhd_likelihood = compute_adhd_likelihood(eye_result, body_result, speech_result)

    assessment.status = AssessmentStatus.completed
    assessment.completed_at = datetime.utcnow()
    session.add(assessment)
    session.commit()
    return {"status": "completed", "adhd_likelihood": assessment.adhd_likelihood}


# Add child details to the assessment response sent to the frontend
def _enrich(assessment: Assessment, session: Session) -> dict:
    child = session.get(Child, assessment.child_id)
    return {
        "id": assessment.id,
        "user_id": assessment.user_id,
        "child_id": assessment.child_id,
        "status": assessment.status,
        "adhd_likelihood": assessment.adhd_likelihood,
        "questionnaire_answers": assessment.questionnaire_answers,
        "created_at": assessment.created_at,
        "completed_at": assessment.completed_at,
        "child": child,
    }