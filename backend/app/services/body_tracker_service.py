"""
body_tracker_service.py
======================
Manages the body tracker subprocess lifecycle.

- start_body_tracker(cam_index)  → launches body_tracker.py as a subprocess
- stop_body_tracker()            → stops it, returns the CSV path it recorded
- run_body_model_on_csv(csv_path)→ preprocesses CSV and runs Random Forest model
"""

import subprocess
import sys
import time
import json
import asyncio
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional

from sqlmodel import Session
from app.models.models import AnalysisJob, AnalysisStatus

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parents[2]
_SERVICE_DIR = Path(__file__).resolve().parent

_TRACKER_PATHS = [
    BASE_DIR / "app" / "services" / "body_tracker.py",
    _SERVICE_DIR / "body_tracker.py",
    _SERVICE_DIR / "body_tracker" / "body_tracker.py",
    _SERVICE_DIR.parent / "body_tracker" / "body_tracker.py",
]
_TRACKER_SCRIPT = next((p for p in _TRACKER_PATHS if p.exists()), None)

_MODEL_PATH = _SERVICE_DIR / "rf_model" / "hyperactivity_rf.joblib"
_COLS_PATH  = _SERVICE_DIR / "rf_model" / "feature_cols.joblib"

SESSIONS_DIR = BASE_DIR / "data" / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# These are the motion features expected from body_tracker.py and used by the model.
FEATURE_COLS = [
    "frames_used",
    "mean_speed_all",
    "std_speed_all",
    "max_speed_all",
    "mean_hand_speed",
    "std_hand_speed",
    "max_hand_speed",
    "mean_leg_speed",
    "std_leg_speed",
    "max_leg_speed",
    "spike_rate",
    "fps",
    "mean_speed_per_sec",
]

# ─── Body model (lazy loaded) ────────────────────────────────────────────────
_body_model = None
_body_cols  = None

'''Load the trained body-movement model only when it is first needed,
then keep it in memory for later predictions.'''
def _load_body_model() -> bool:
    global _body_model, _body_cols
    if _body_model is not None:
        return True

    if not _MODEL_PATH.exists():
        print(f"⚠ Body model not found at {_MODEL_PATH}")
        return False
    if not _COLS_PATH.exists():
        print(f"⚠ Body feature columns not found at {_COLS_PATH}")
        return False

    try:
        import joblib
        _body_model = joblib.load(str(_MODEL_PATH))
        _body_cols  = joblib.load(str(_COLS_PATH))
        return True
    except Exception as e:
        print(f"⚠ Failed to load body model: {e}")
        return False

# ─── Active tracker process ───────────────────────────────────────────────────
_tracker_process: Optional[subprocess.Popen] = None
_tracker_csv_path: Optional[str] = None

'''Start the body tracker as a separate process and prepare a new CSV file
for the upcoming recording session.'''
def start_body_tracker(cam_index: int) -> dict:
    global _tracker_process, _tracker_csv_path

    if _tracker_process:
        try:
            if _tracker_process.poll() is None:
                _tracker_process.terminate()
                _tracker_process.wait(timeout=5)
        except Exception:
            try:
                _tracker_process.kill()
            except Exception:
                pass
        _tracker_process = None
        _tracker_csv_path = None

    if _TRACKER_SCRIPT is None:
        return {"ok": False, "error": "body_tracker.py not found. Check body_tracker_service.py paths."}

    csv_name = f"body_session_{int(time.time())}.csv"
    csv_path = str(SESSIONS_DIR / csv_name)
    _tracker_csv_path = csv_path

    try:
        backend_dir = Path(__file__).resolve().parents[2]
        windows_python = backend_dir / "venv" / "Scripts" / "python.exe"

        if windows_python.exists():
            tracker_python = str(windows_python)
        else:
            tracker_python = sys.executable

        _tracker_process = subprocess.Popen(
            [tracker_python, str(_TRACKER_SCRIPT),
             "--cam", str(cam_index),
             "--output", csv_path,
             "--duration","300",
             "--no-window"],
            stdout=None,
            stderr=None,
            text=True,
        )
        time.sleep(3)

        if _tracker_process.poll() is not None:
            return {"ok": False, "error": "Body tracker crashed immediately after launch."}

        return {"ok": True, "csv_path": csv_path}

    except Exception as e:
        return {"ok": False, "error": str(e)}

# Stop the active tracker process and return the path of the CSV it recorded.
def stop_body_tracker() -> Optional[str]:
    global _tracker_process, _tracker_csv_path

    csv_path = _tracker_csv_path 

    if _tracker_process:
        try:
            _tracker_process.terminate()
            _tracker_process.wait(timeout=5)
        except Exception:
            _tracker_process.kill()
        _tracker_process = None

    _tracker_csv_path = None
    return csv_path

# ─── Body preprocessing + prediction ─────────────────────────────────────────
'''Load the recorded CSV, keep only the model input features, and clean
missing or non-numeric values before prediction.'''
def _preprocess_csv(csv_path: str) -> Optional[pd.DataFrame]:
    try:
        df = pd.read_csv(csv_path)
        missing = [c for c in FEATURE_COLS if c not in df.columns]
        if missing:
            print(f"⚠ Body CSV missing columns: {missing}")
            return None

        df = df[FEATURE_COLS].apply(pd.to_numeric, errors="coerce")
        df = df.ffill().fillna(0)

        if len(df) == 0:
            return None

        return df
    except Exception as e:
        print(f"⚠ Body CSV preprocessing failed: {e}")
        return None

'''Run the trained body model on the cleaned CSV data and convert the raw model
outputs into user-facing body-analysis metrics.'''
def _extract_metrics_and_predict(csv_path: str) -> Optional[dict]:
    if not _load_body_model():
        return None

    df = _preprocess_csv(csv_path)
    if df is None or len(df) == 0:
        return None

    try:
        x = df.copy()

        x = x.reindex(columns=_body_cols, fill_value=0.0)

        proba = _body_model.predict_proba(x)[:, 1]
        preds = _body_model.predict(x)

        final_score = float(np.median(proba) * 100.0)
        hyper_rate = float(np.mean(preds == 1) * 100.0)

        if final_score >= 66:
            movement_intensity = "High"
        elif final_score >= 33:
            movement_intensity = "Medium"
        else:
            movement_intensity = "Low"

        fidget_events = int((df["mean_hand_speed"] > df["mean_hand_speed"].median()).sum())
        posture_changes = int((df["mean_leg_speed"] > df["mean_leg_speed"].median()).sum())

        timestamps = []
        step = max(1, len(df) // 15)

        raw_df = pd.read_csv(csv_path)
        t0 = float(raw_df["t"].iloc[0]) if "t" in raw_df.columns else 0.0
        for i in range(0, len(df), step):
            t_val = (float(raw_df["t"].iloc[i]) - t0) if ("t" in raw_df.columns and i < len(raw_df)) else float(i)
            timestamps.append({
                "t": round(t_val, 1),
                "score": round(float(proba[i]) * 100.0, 1),
            })

        return {
            "hyperactivity_score": round(final_score, 1),
            "movement_intensity": movement_intensity,
            "hyperactive_window_rate": round(hyper_rate, 1),
            "fidget_events": fidget_events,
            "posture_changes": posture_changes,
            "focus_duration_seconds": 0,
            "analysis_notes": (
                f"Random Forest body analysis completed. "
                f"Hyperactivity score: {round(final_score, 1)}%. "
                f"Movement intensity: {movement_intensity}. "
                f"Hyperactive windows: {round(hyper_rate, 1)}%."
            ),
            "timestamps": timestamps,
        }
    except Exception as e:
        print(f"⚠ Body model prediction failed: {e}")
        return None

'''Check whether the CSV contains enough non-zero body-motion signal
to justify running the prediction model.'''
def _has_meaningful_body_data(csv_path: str) -> bool:
    try:
        df = pd.read_csv(csv_path)

        if len(df) == 0:
            return False

        needed = ["mean_speed_all", "mean_hand_speed", "mean_leg_speed"]
        for col in needed:
            if col not in df.columns:
                return False

        has_signal = (
            (pd.to_numeric(df["mean_speed_all"], errors="coerce").fillna(0) > 0).any() or
            (pd.to_numeric(df["mean_hand_speed"], errors="coerce").fillna(0) > 0).any() or
            (pd.to_numeric(df["mean_leg_speed"], errors="coerce").fillna(0) > 0).any()
        )

        return len(df) >= 10 and has_signal

    except Exception as e:
        print(f"⚠ Body validity check failed: {e}", flush=True)
        return False

'''Run the saved body model on the recorded CSV and save result to the DB job.
Called as a background task after the tracker is stopped.'''
async def run_body_analysis_on_csv(csv_path: str, job: AnalysisJob, db_session: Session):
    await asyncio.sleep(0.2)

    result = None

    valid_body_data = csv_path and Path(csv_path).exists() and _has_meaningful_body_data(csv_path)

    if valid_body_data:
        result = _extract_metrics_and_predict(csv_path)
    else:
        print("Body CSV failed validation before model step.", flush=True)

    if result is None:
        result = {
            "hyperactivity_score": 0,
            "movement_intensity": "Low",
            "hyperactive_window_rate": 0,
            "fidget_events": 0,
            "posture_changes": 0,
            "focus_duration_seconds": 0,
            "analysis_notes": "Fallback mock — CSV missing or model error.",
            "timestamps": [],
        }

    job.result_json = json.dumps(result)
    job.status = AnalysisStatus.completed
    job.completed_at = datetime.utcnow()
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    try:
        from app.services.adhd_scorer import update_assessment_likelihood
        update_assessment_likelihood(job.assessment_id, db_session)
    except Exception as e:
        print(f"⚠ ADHD scoring error: {e}", flush=True)