"""
analysis.py
-----------
This file defines the analysis-related API endpoints for the MindEcho backend.
It handles starting and stopping eye and body tracking sessions, accepting speech
recordings, creating analysis jobs, saving uploaded files, and returning analysis
results linked to each assessment.
"""

import os
import asyncio
import json
import subprocess
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlmodel import Session, select
from pydantic import BaseModel

from app.models.database import get_session
from app.models.models import (
    AnalysisJob, AnalysisJobRead, AnalysisType, AnalysisStatus,
    Assessment, User
)
from app.utils.auth import get_current_user

from app.services.eye_tracker_service import (
    start_eye_tracker, stop_eye_tracker, run_gru_on_csv
)
from app.services.body_tracker_service import (
    start_body_tracker, stop_body_tracker, run_body_analysis_on_csv
)
from app.services.speech_service import run_speech_analysis_on_file


# API router for all analysis-related endpoints
router = APIRouter(prefix="/analysis", tags=["analysis"])

# Default camera indexes loaded from environment variables
EYE_CAM_INDEX = int(os.getenv("EYE_CAM_INDEX", 2))
BODY_CAM_INDEX = int(os.getenv("BODY_CAM_INDEX", 3))

# Directory used to store uploaded speech recordings
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Resolve a camera label from the frontend into a numeric camera index
def _resolve_cam_index(cam_label: str) -> int:
    try:
        import cv2
        for i in range(5):
            cap = cv2.VideoCapture(i)
            if not cap.isOpened():
                cap.release()
                continue
            cap.release()
            if f"::{i}" in cam_label:
                return i
        import re
        m = re.search(r'(\d+)$', cam_label.strip())
        if m:
            return int(m.group(1))
    except Exception as e:
        print(f"⚠ cam index resolve error: {e}")
    return 0

# Save an uploaded file locally and return its file path for later analysis
async def _save_upload(file, job_id, analysis_type):
    if file is None or file.filename == "":
        print(f"⚠ No upload received for {analysis_type}, job_id={job_id}", flush=True)
        return None

    ext = os.path.splitext(file.filename)[1] or ".bin"
    file_path = os.path.join(UPLOAD_DIR, f"{analysis_type}_{job_id}{ext}")

    data = await file.read()

    with open(file_path, "wb") as f:
        f.write(data)

    try:
        print(f"📁 Saved file size on disk: {os.path.getsize(file_path)} bytes", flush=True)
    except Exception as e:
        print(f"⚠ Could not read saved file size: {e}", flush=True)

    return file_path

# Create a new analysis job only if the assessment belongs to the current user.
def _create_job(analysis_type, assessment_id, current_user, session):
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assessment not found")
    job = AnalysisJob(
        user_id=current_user.id,
        assessment_id=assessment_id,
        type=analysis_type,
        status=AnalysisStatus.pending,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


# Request schema for starting eye tracking
class EyeStartRequest(BaseModel):
    assessment_id: int
    cam_label: str

# Request schema for stopping eye tracking
class EyeStopRequest(BaseModel):
    assessment_id: int

# Request schema for starting body tracking
class BodyStartRequest(BaseModel):
    assessment_id: int
    cam_label: str

# Request schema for stopping body tracking
class BodyStopRequest(BaseModel):
    assessment_id: int


# Start live eye tracking and prepare the related analysis job
@router.post("/eye/start", response_model=AnalysisJobRead)
async def eye_start(
    payload: EyeStartRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    existing = session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == payload.assessment_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.type == AnalysisType.eye,
        )
    ).first()
    job = existing if existing else _create_job(AnalysisType.eye, payload.assessment_id, current_user, session)
    job.status = AnalysisStatus.processing
    session.add(job); session.commit(); session.refresh(job)

    cam_index = EYE_CAM_INDEX
    result = start_eye_tracker(cam_index)
    if not result["ok"]:
        job.status = AnalysisStatus.failed
        session.add(job); session.commit()
        raise HTTPException(status_code=500, detail=result["error"])

    job.file_path = result.get("csv_path")
    session.add(job); session.commit(); session.refresh(job)
    print(f"✓ Eye tracker started for assessment {payload.assessment_id}, cam={cam_index}")
    return job

# Stop live eye tracking and queue GRU-based analysis on the recorded CSV file.
@router.post("/eye/stop")
async def eye_stop(
    payload: EyeStopRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    job = session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == payload.assessment_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.type == AnalysisType.eye,
        )
    ).first()
    csv_path = stop_eye_tracker()
    if not job:
        return {"status": "no active eye job found"}
    if csv_path:
        job.file_path = csv_path
        session.add(job); session.commit()
    background_tasks.add_task(run_gru_on_csv, csv_path or job.file_path, job, session)
    print(f"✓ Eye tracker stopped, GRU queued for {csv_path}")
    return {"status": "processing", "csv_path": csv_path}


# Start live body tracking and prepare the related analysis job
@router.post("/body/start", response_model=AnalysisJobRead)
async def body_start(
    payload: BodyStartRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    existing = session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == payload.assessment_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.type == AnalysisType.body,
        )
    ).first()
    job = existing if existing else _create_job(AnalysisType.body, payload.assessment_id, current_user, session)
    job.status = AnalysisStatus.processing
    session.add(job); session.commit(); session.refresh(job)

    cam_index = BODY_CAM_INDEX
    result = start_body_tracker(cam_index)
    if not result["ok"]:
        job.status = AnalysisStatus.failed
        session.add(job); session.commit()
        raise HTTPException(status_code=500, detail=result["error"])

    job.file_path = result.get("csv_path")
    session.add(job); session.commit(); session.refresh(job)
    print(f"✓ Body tracker started for assessment {payload.assessment_id}, cam={cam_index}")
    return job

# Stop live body tracking and queue body-movement analysis on the saved CSV file.
@router.post("/body/stop")
async def body_stop(
    payload: BodyStopRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    job = session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == payload.assessment_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.type == AnalysisType.body,
        )
    ).first()
    csv_path = stop_body_tracker()
    if not job:
        return {"status": "no active body job found"}
    if csv_path:
        job.file_path = csv_path
        session.add(job); session.commit()
    background_tasks.add_task(run_body_analysis_on_csv, csv_path or job.file_path, job, session)
    print(f"✓ Body tracker stopped, analysis queued for {csv_path}")
    return {"status": "processing", "csv_path": csv_path}


# Accept a speech recording, save it, and queue speech analysis in the background
@router.post("/speech", response_model=AnalysisJobRead)
async def analyze_speech(
    background_tasks: BackgroundTasks,
    assessment_id: int = Form(...),
    file: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    
    if file is not None:
        print(f"upload filename={file.filename}", flush=True)
        print(f"upload content_type={file.content_type}", flush=True)

    existing = session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == assessment_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.type == AnalysisType.speech,
        )
    ).first()

    job = existing if existing else _create_job(AnalysisType.speech, assessment_id, current_user, session)

    file_path = await _save_upload(file, job.id, "speech")

    if file_path:
        job.file_path = file_path
        job.status = AnalysisStatus.processing
        session.add(job)
        session.commit()
    else:
        print("⚠ No speech file path was created", flush=True)

    background_tasks.add_task(run_speech_analysis_on_file, file_path, job, session)

    session.refresh(job)
    return job

# Return one analysis job by ID, but only if it belongs to the current user.
@router.get("/job/{job_id}", response_model=AnalysisJobRead)
def get_job(job_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    job = session.get(AnalysisJob, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

# Return all analysis jobs associated with a specific assessment for the current user.
@router.get("/{assessment_id}", response_model=list[AnalysisJobRead])
def get_assessment_jobs(assessment_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    return session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == assessment_id,
            AnalysisJob.user_id == current_user.id,
        )
    ).all()