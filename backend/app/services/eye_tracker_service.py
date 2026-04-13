"""
eye_tracker_service.py
======================
Manages the eye tracker subprocess lifecycle.

- start_eye_tracker(cam_index)  → launches eye_tracker.py as a subprocess
- stop_eye_tracker()            → stops it, returns the CSV path it recorded
- run_gru_on_csv(csv_path)      → preprocesses CSV and runs GRU model
"""

import subprocess
import sys
import os
import time
import signal
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
    BASE_DIR / "app" / "services" / "eye_tracker.py",
    _SERVICE_DIR / "eye_tracker.py",
    _SERVICE_DIR / "eye_tracker" / "eye_tracker.py",
    _SERVICE_DIR.parent / "eye_tracker" / "eye_tracker.py",
]
_TRACKER_SCRIPT = next((p for p in _TRACKER_PATHS if p.exists()), None)

_GRU_ROOT = _SERVICE_DIR / "gru_model"
_MODEL_PATH = _GRU_ROOT / "gru_model.keras"
_MEAN_PATH = _GRU_ROOT / "feature_mean.npy"
_STD_PATH = _GRU_ROOT / "feature_std.npy"

SESSIONS_DIR = BASE_DIR / "data" / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


FEATURE_COLS = [
    "t", "face", "iris_x", "iris_y",
    "gaze_x", "gaze_y", "ear",
    "blink_closed", "lookaway", "jitter", "focus",
]
SEQ_LEN = 300

# ─── GRU model (lazy loaded) ──────────────────────────────────────────────────
_gru_model = None
_gru_mean  = None
_gru_std   = None

"""
Load the pretrained GRU eye model and its normalization statistics.
The model is loaded lazily so backend startup remains lightweight.
"""
def _load_gru() -> bool:
    global _gru_model, _gru_mean, _gru_std
    if _gru_model is not None:
        return True
    if not _MODEL_PATH.exists():
        print(f"⚠ GRU model not found at {_MODEL_PATH}")
        return False
    try:
        import tensorflow as tf
        _gru_model = tf.keras.models.load_model(str(_MODEL_PATH))
        _gru_mean  = np.load(str(_MEAN_PATH))
        _gru_std   = np.load(str(_STD_PATH))
        return True
    except Exception as e:
        print(f"⚠ Failed to load GRU model: {e}")
        return False

# ─── Active tracker process ───────────────────────────────────────────────────
_tracker_process: Optional[subprocess.Popen] = None
_tracker_csv_path: Optional[str] = None

"""
Launch eye_tracker.py as a subprocess with the given camera index.
If one is already running, kill it first and restart cleanly.
Returns {"ok": True} or {"ok": False, "error": "..."}
"""
def start_eye_tracker(cam_index: int) -> dict:
    global _tracker_process, _tracker_csv_path

    if _tracker_process:
        try:
            if _tracker_process.poll() is None:
                print("⚠ Stale eye tracker found — killing it.", flush=True)
                _tracker_process.terminate()
                _tracker_process.wait(timeout=5)
        except Exception:
            try: _tracker_process.kill()
            except Exception: pass
        _tracker_process  = None
        _tracker_csv_path = None

    if _TRACKER_SCRIPT is None:
        return {"ok": False, "error": "eye_tracker.py not found. Check eye_tracker_service.py paths."}

    csv_name = f"eye_session_{int(time.time())}.csv"
    csv_path = str(SESSIONS_DIR / csv_name)
    _tracker_csv_path = csv_path

    try:
        backend_dir = Path(__file__).resolve().parents[2]   # goes up to backend folder
        windows_python = backend_dir / "venv" / "Scripts" / "python.exe"

        if windows_python.exists():
            tracker_python = str(windows_python)
        else:
            tracker_python = sys.executable

        _tracker_process = subprocess.Popen(
            [tracker_python, str(_TRACKER_SCRIPT),
            "--cam", str(cam_index),
            "--output", csv_path,
            "--no-window"],
            stdout=None,#subprocess.PIPE,
            stderr=None,#subprocess.PIPE,
            text=True,
        )
        time.sleep(3)

        if _tracker_process.poll() is not None:
            stderr = _tracker_process.stderr.read()
            stdout = _tracker_process.stdout.read()
            print(f"⚠ Eye tracker crashed.\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}", flush=True)
            return {"ok": False, "error": f"Eye tracker crashed: {stderr[:300] or stdout[:300]}"}

        return {"ok": True, "csv_path": csv_path}

    except Exception as e:
        return {"ok": False, "error": str(e)}

"""
Stop the running eye tracker subprocess.
Returns the CSV path it was writing to, or None if not running.
"""
def stop_eye_tracker() -> Optional[str]:
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


# ─── GRU preprocessing + prediction ──────────────────────────────────────────
"""
Convert the recorded eye-tracking CSV into a GRU-ready sequence by validating
columns, cleaning numeric values, normalizing features, and padding/trimming
to the expected sequence length.
"""
def _preprocess_csv(csv_path: str) -> Optional[np.ndarray]:
    try:
        df = pd.read_csv(csv_path)
        missing = [c for c in FEATURE_COLS if c not in df.columns]
        if missing:
            print(f"⚠ Eye CSV missing columns: {missing}")
            return None
        df = df[FEATURE_COLS].apply(pd.to_numeric, errors="coerce")
        df = df.ffill().fillna(0)
        X = df.values.astype(np.float32)
        if X.shape[0] == 0:
            return None
        
        # Rebase time so each recording starts at t = 0 before normalization.
        X[:, 0] = X[:, 0] - X[0, 0]
        safe_std = np.where(_gru_std == 0, 1.0, _gru_std)

        # Standardize features using the same statistics used during model training.
        X = (X - _gru_mean) / safe_std
        n = X.shape[0]
        if n > SEQ_LEN:
            X = X[:SEQ_LEN]
        elif n < SEQ_LEN:
            X = np.vstack([X, np.repeat(X[-1:], SEQ_LEN - n, axis=0)])
        return np.expand_dims(X, axis=0)
    except Exception as e:
        print(f"⚠ CSV preprocessing failed: {e}")
        return None

"""
Extract interpretable eye-attention metrics from the CSV.
These heuristic metrics complement the GRU output with values that are easier
to explain in the frontend, such as attention score, focus duration,
blink count, fixation count, saccade count, and gaze stability.
"""
def _extract_metrics(csv_path: str) -> dict:
    try:
        df = pd.read_csv(csv_path)
        df = df[FEATURE_COLS].apply(pd.to_numeric, errors="coerce").ffill().fillna(0)

        # Keep only rows where a face was actually detected
        df = df[df["face"] > 0].copy()

        if len(df) == 0:
            return {
                "attention_score": 0.0,
                "gaze_stability": "Low",
                "focus_duration_seconds": 0,
                "saccade_count": 0,
                "fixation_count": 0,
                "blink_count": 0,
                "lookaway_pct": 100.0,
                "timestamps": [],
            }

        total = len(df)

        # Estimate frame duration
        if total > 1:
            dt_series = df["t"].diff().fillna(0)
            valid_dt = dt_series[dt_series > 0]
            avg_dt = float(valid_dt.mean()) if len(valid_dt) > 0 else 0.033
        else:
            avg_dt = 0.033

        # Compute attention as a weighted combination of look-away behaviour,
        # focus level, and gaze stability.
        attention_frame_score = (
            (1.0 - df["lookaway"].clip(0, 1)) * 0.50 +
            df["focus"].clip(0, 1) * 0.35 +
            (1.0 - df["jitter"].clip(0, 1)) * 0.15
        )
        attention_score = round(float(attention_frame_score.mean()) * 100, 1)

        # Count only frames that look truly focused
        focused_mask = (
            (df["lookaway"] < 0.5) &
            (df["focus"] > 0.60) &
            (df["jitter"] < 0.20)
        )
        focus_duration = round(float(focused_mask.sum()) * avg_dt, 2)

        blinks = int((df["blink_closed"].diff().fillna(0) > 0).sum())

        # Estimate saccades and fixations heuristically from jitter patterns:
        # high jitter suggests gaze shifts, while sustained low jitter suggests fixation.
        saccade_mask = (
            (df["jitter"] > 0.18) &
            (df["lookaway"] < 0.5)
        )
        saccades = int((saccade_mask.astype(int).diff().fillna(0) == 1).sum())

        # Count the START of a stable gaze segment
        fixation_mask = (
            (df["jitter"] < 0.04) &
            (df["lookaway"] < 0.5) &
            (df["focus"] > 0.65)
        )
        fixations = int((fixation_mask.astype(int).diff().fillna(0) == 1).sum())

        # Optional smoothing of unrealistic values
        # Prevent fixation/saccade counts from exploding due to noisy frame-level changes
        max_reasonable_events = max(1, int(focus_duration * 2.5))
        saccades = min(saccades, max_reasonable_events * 3)
        fixations = min(fixations, max_reasonable_events)

        avg_focus = float(df["focus"].mean())
        lookaway_mean = float(df["lookaway"].mean())
        jitter_mean = float(df["jitter"].mean())

        if lookaway_mean < 0.10 and jitter_mean < 0.05 and avg_focus > 0.75:
            gaze_stability = "High"
        elif lookaway_mean < 0.30 and jitter_mean < 0.12 and avg_focus > 0.50:
            gaze_stability = "Medium"
        else:
            gaze_stability = "Low"

        timestamps = []
        if total > 1:
            t0 = float(df["t"].iloc[0])
            step = max(1, total // 15)

            for i in range(0, total, step):
                chunk = df.iloc[i:i + step]
                chunk_attention = (
                    (1.0 - chunk["lookaway"].clip(0, 1)) * 0.50 +
                    chunk["focus"].clip(0, 1) * 0.35 +
                    (1.0 - chunk["jitter"].clip(0, 1)) * 0.15
                ).mean()

                timestamps.append({
                    "t": round(float(df["t"].iloc[i] - t0), 1),
                    "score": round(float(chunk_attention) * 100, 1),
                })

        return {
            "attention_score":        attention_score,
            "gaze_stability":         gaze_stability,
            "focus_duration_seconds": focus_duration,
            "saccade_count":          saccades,
            "fixation_count":         fixations,
            "blink_count":            blinks,
            "lookaway_pct":           round(lookaway_mean * 100, 1),
            "timestamps":             timestamps,
        }

    except Exception as e:
        print(f"⚠ Metrics extraction failed: {e}", flush=True)
        return {}

"""
Check whether the recording contains enough valid face-based eye data
to justify GRU inference. This prevents misleading model output on blank
or unusable recordings.
"""
def _has_meaningful_eye_data(csv_path: str) -> bool:
    try:
        df = pd.read_csv(csv_path)
        df = df[FEATURE_COLS].apply(pd.to_numeric, errors="coerce").ffill().fillna(0)

        if len(df) == 0:
            return False

        # Require enough rows with a detected face
        face_rows = int((df["face"] > 0).sum())
        face_ratio = face_rows / max(len(df), 1)

        # Require at least some non-zero signal
        has_signal = (
            (df["focus"] > 0).any() or
            (df["jitter"] > 0).any() or
            (df["lookaway"] > 0).any()
        )

        return face_rows >= 10 and face_ratio >= 0.2 and has_signal

    except Exception as e:
        print(f"⚠ Eye validity check failed: {e}", flush=True)
        return False

async def run_gru_on_csv(csv_path: str, job: AnalysisJob, db_session: Session):
    """
    Run GRU on the recorded CSV and save result to the DB job.
    Called as a background task after the tracker is stopped.
    """
    await asyncio.sleep(0.2)

    result = None
    metrics = {}

    if csv_path and Path(csv_path).exists():
        metrics = _extract_metrics(csv_path)

    # Only allow GRU inference when the CSV contains meaningful eye-tracking signal.
    valid_eye_data = csv_path and Path(csv_path).exists() and _has_meaningful_eye_data(csv_path)
    
    if valid_eye_data and _load_gru():
        X = _preprocess_csv(csv_path)
        if X is not None:
            try:
                prob    = float(_gru_model.predict(X, verbose=0)[0][0])
                metrics = _extract_metrics(csv_path)
                attention_score = metrics.get("attention_score", round((1 - prob) * 100, 1))
                result = {
                    "adhd_attention_probability": round(prob, 4),
                    "attention_score":        attention_score,
                    "gaze_stability":         metrics.get("gaze_stability", "Medium"),
                    "focus_duration_seconds": metrics.get("focus_duration_seconds", 0),
                    "saccade_count":          metrics.get("saccade_count", 0),
                    "fixation_count":         metrics.get("fixation_count", 0),
                    "analysis_notes": (
                        f"{'GRU ADHD attention probability: ' + format(prob, '.1%') + '. ' if prob is not None else ''}"
                        f"Attention: {attention_score}%. "
                        f"Gaze stability: {metrics.get('gaze_stability', 'N/A')}. "
                        f"Focus duration: {metrics.get('focus_duration_seconds', 0)}s. "
                        f"Saccades: {metrics.get('saccade_count', 0)}. "
                        f"Fixations: {metrics.get('fixation_count', 0)}. "
                        f"Look-away rate: {metrics.get('lookaway_pct', 0)}%."
                    ),
                    "timestamps": metrics.get("timestamps", []),
                }
            except Exception as e:
                print(f"⚠ GRU prediction failed: {e}")

    if result is None:
        # Fallback mock if something went wrong
        result = {
            "adhd_attention_probability": None,
            "attention_score": 0,
            "gaze_stability": "Medium",
            "focus_duration_seconds": 0,
            "saccade_count": 0,
            "fixation_count": 0,
            "analysis_notes": "Fallback mock — CSV missing or model error.",
            "timestamps": [],
        }

    job.result_json  = json.dumps(result)
    job.status       = AnalysisStatus.completed
    job.completed_at = datetime.utcnow()
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    try:
        from app.services.adhd_scorer import update_assessment_likelihood
        update_assessment_likelihood(job.assessment_id, db_session)
    except Exception as e:
        print(f"⚠ ADHD scoring error: {e}", flush=True)