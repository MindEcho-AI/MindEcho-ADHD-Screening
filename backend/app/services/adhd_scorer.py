"""
adhd_scorer.py
==============
Computes final ADHD likelihood from eye, body, and speech analysis results.

Algorithm:
  Step 1 — Convert each module result to a numeric risk score (0–2):
             0 = Low, 1 = Medium, 2 = High

  Step 2 — Weighted average:
             Eye:    0.45  (primary attention signal)
             Speech: 0.35  (cognitive/linguistic signal)
             Body:   0.20  (supporting signal)

  Step 3 — Confidence gate (prevents single bad reading from skewing result):
             To call HIGH   → weighted score >= 1.5 AND at least 2 modules Medium or above
             To call MEDIUM → weighted score >= 0.75 OR at least 2 modules Medium or above
             Otherwise      → Low

  Step 4 — Save likelihood to Assessment in DB.
"""

import json
from typing import Optional
from sqlmodel import Session, select
from app.models.models import Assessment, AnalysisJob, AnalysisType, AnalysisStatus

# ─── Weights ──────────────────────────────────────────────────────────────────
WEIGHT_EYE    = 0.45
WEIGHT_SPEECH = 0.35
WEIGHT_BODY   = 0.20

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _label_to_raw(label: str) -> int:
    """Convert Low/Medium/High string to 0/1/2."""
    mapping = {"low": 0, "medium": 1, "high": 2}
    return mapping.get(str(label).strip().lower(), 0)

'''Detect results that should not influence the final score, such as fallback
outputs, empty module results, or recordings with no meaningful signal.'''
def _is_fallback_or_empty(result: dict, module: str) -> bool:
    notes = str(result.get("analysis_notes", "")).lower()
    if "fallback mock" in notes or "csv missing or model error" in notes:
        return True

    if module == "eye":
        return (
            float(result.get("attention_score", 0)) == 0 and
            float(result.get("focus_duration_seconds", 0)) == 0 and
            int(result.get("fixation_count", 0)) == 0 and
            int(result.get("saccade_count", 0)) == 0
        )

    if module == "body":
        return (
            float(result.get("hyperactivity_score", 0)) == 0 and
            int(result.get("fidget_events", 0)) == 0 and
            int(result.get("posture_changes", 0)) == 0
        )

    if module == "speech":
        return (
            float(result.get("speech_clarity_score", 0)) == 0 and
            float(result.get("speech_rate_wpm", 0)) == 0 and
            int(result.get("hesitation_count", 0)) == 0
        )

    return False

'''Eye result → risk score (0/1/2).
    Low attention = high ADHD risk.
    attention_score is 0–100 where higher = more attentive.'''
def _score_from_eye(result: dict) -> int:
    if _is_fallback_or_empty(result, "eye"):
        return 0
    attention = float(result.get("attention_score", 50))
    gaze      = result.get("gaze_stability", "Medium")

    # Invert attention: low attention = high risk
    if attention < 40:
        base = 2   
    elif attention < 65:
        base = 1  
    else:
        base = 0 

    # Use gaze stability as a secondary adjustment so unstable gaze can slightly
    # raise the final eye-risk score.
    gaze_adj = _label_to_raw(gaze)
    combined = round((base * 2 + (2 - gaze_adj)) / 3)  # weighted toward attention
    return int(min(2, max(0, combined)))

'''Body result → risk score (0/1/2).
    High hyperactivity = high ADHD risk.
    hyperactivity_score is 0–100 where higher = more hyperactive.'''
def _score_from_body(result: dict) -> int:
    if _is_fallback_or_empty(result, "body"):
        return 0
    hyper = float(result.get("hyperactivity_score", 50))
    intensity = result.get("movement_intensity", "Medium")

    if hyper > 65:
        base = 2
    elif hyper > 40:
        base = 1
    else:
        base = 0

    intensity_raw = _label_to_raw(intensity)
    combined = round((base + intensity_raw) / 2)
    return int(min(2, max(0, combined)))

'''Speech result → risk score (0/1/2).
    Low clarity + high hesitation + low word confidence = high ADHD risk.
    speech_clarity_score is 0–100 where higher = clearer speech.'''
def _score_from_speech(result: dict) -> int:
    if _is_fallback_or_empty(result, "speech"):
        return 0
    clarity    = float(result.get("speech_clarity_score", 50))
    word_conf  = result.get("word_confidence", "Medium")
    uncertain  = result.get("uncertain_words_detected", "Medium")

    # Invert clarity: low clarity = high risk
    if clarity < 35:
        base = 2
    elif clarity < 60:
        base = 1
    else:
        base = 0

    # Convert speech-confidence features into risk values so weaker speech
    # confidence and more uncertainty raise the speech-risk score.
    conf_risk = 2 - _label_to_raw(word_conf)
    uncertain_risk = _label_to_raw(uncertain)

    combined = round((base * 2 + conf_risk + uncertain_risk) / 4)
    return int(min(2, max(0, combined)))

# Convert a numeric weighted score back into a user-facing Low/Medium/High label.
def _raw_to_label(raw: float) -> str:
    if raw >= 1.5:
        return "High"
    elif raw >= 0.75:
        return "Medium"
    return "Low"


# ─── Main scoring function ────────────────────────────────────────────────────

def compute_adhd_likelihood(
    eye_result: Optional[dict],
    body_result: Optional[dict],
    speech_result: Optional[dict],
) -> str:
    """
    Returns "Low", "Medium", or "High" ADHD likelihood.

    Uses weighted average (Eye 45%, Speech 35%, Body 20%)
    with a confidence gate requiring convergent evidence.
    """
    scores = {}
    weights = {}

    if eye_result:
        scores["eye"]    = _score_from_eye(eye_result)
        weights["eye"]   = WEIGHT_EYE

    if body_result:
        scores["body"]   = _score_from_body(body_result)
        weights["body"]  = WEIGHT_BODY

    if speech_result:
        scores["speech"] = _score_from_speech(speech_result)
        weights["speech"]= WEIGHT_SPEECH

    if not scores:
        return "Low"  

    total_weight = sum(weights[k] for k in scores)
    weighted_avg = sum(scores[k] * weights[k] for k in scores) / total_weight

    medium_or_above = sum(1 for s in scores.values() if s >= 1)
    total_modules = len(scores)

    if weighted_avg >= 1.5 and medium_or_above >= 2:
        return "High"

    if weighted_avg >= 0.75 or medium_or_above >= 2:
        return "Medium"

    return "Low"

# ─── DB integration ───────────────────────────────────────────────────────────

'''Called after all 3 analysis jobs complete.
    Reads their results, computes ADHD likelihood, saves to Assessment.'''
def update_assessment_likelihood(assessment_id: int, db_session: Session):
    jobs = db_session.exec(
        select(AnalysisJob).where(
            AnalysisJob.assessment_id == assessment_id,
            AnalysisJob.status == AnalysisStatus.completed,
        )
    ).all()   

    latest_jobs = {}

    for job in jobs:
        if not job.result_json:
            continue

        try:
            parsed = json.loads(job.result_json)
        except Exception:
            continue

        notes = str(parsed.get("analysis_notes", "")).lower()

        # Skip fallback or placeholder results so only real analysis outputs affect scoring.
        if "fallback mock" in notes or "ai-generated estimate" in notes:
            continue

        prev = latest_jobs.get(job.type)

        # If multiple jobs exist for the same module, keep the most recently completed one.
        if prev is None or (
            job.completed_at is not None and
            (prev.completed_at is None or job.completed_at > prev.completed_at)
        ):
            latest_jobs[job.type] = job

    results = {}
    for job_type, job in latest_jobs.items():
        try:
            results[job_type] = json.loads(job.result_json)
        except Exception:
            pass

    eye_result    = results.get(AnalysisType.eye)
    body_result   = results.get(AnalysisType.body)
    speech_result = results.get(AnalysisType.speech)

    # Need at least 2 modules to make a call
    available = sum([eye_result is not None, body_result is not None, speech_result is not None])
    if available < 2:
        print(f"⚠ Only {available} module(s) completed — skipping ADHD likelihood update", flush=True)
        return

    likelihood = compute_adhd_likelihood(eye_result, body_result, speech_result)

    assessment = db_session.get(Assessment, assessment_id)
    if assessment:
        assessment.adhd_likelihood = likelihood
        assessment.status = "completed"
        db_session.add(assessment)
        db_session.commit()
        db_session.refresh(assessment)