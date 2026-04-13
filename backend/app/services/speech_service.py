"""
speech_service.py
=================
Wraps the voice_tracker speech analysis pipeline for use in the MindEcho backend.

Flow:
  1. Browser records audio → sends WebM/WAV file to POST /analysis/speech
  2. Backend saves file → calls run_speech_analysis_on_file(file_path, job, session)
  3. This service loads audio → runs VAD + feature extraction + ASR (Whisper)
  4. Computes metrics → saves result to DB job

No direct microphone capture is needed in the backend — audio is recorded in the browser 
(using the selected microphone, such as a RODE mic) and then uploaded for analysis.
"""
import json
import asyncio
import tempfile
import os
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Tuple
from faster_whisper import WhisperModel

from sqlmodel import Session
from app.models.models import AnalysisJob, AnalysisStatus

import webrtcvad
from pydub import AudioSegment
import librosa
import soundfile as sf

'''Core speech-analysis configuration:
these values control resampling, window size, VAD sensitivity,
pause detection and ASR behavior.'''
# ─── Settings (from config.py) ────────────────────────────────────────────────

SAMPLE_RATE         = 16000
CHANNELS            = 1
WINDOW_MS           = 500
HOP_MS              = 500
VAD_AGGRESSIVENESS  = 2
VAD_FRAME_MS        = 30
PAUSE_THRESHOLD_S   = 0.30
ROLLING_SEC         = 10
LOUD_SPIKE_Z        = 2.5
ENABLE_ASR          = True
ASR_MODEL_SIZE      = "small"
ASR_LANGUAGE        = "en"
SAVE_TRANSCRIPT_TEXT = False

FILLER_SINGLE  = {"um", "uh", "erm", "hmm", "like", "basically", "ah", "maybe" , "so"}
FILLER_PHRASES = ["you know", "i mean" , "i dont know"]

# ─── Audio loading (replaces sounddevice.record) ──────────────────────────────
'''
Load the uploaded browser audio and convert it into a mono 16 kHz NumPy array.
Multiple loaders are tried so that different browser formats like WebM or WAV
can still be processed reliably.
'''
def load_audio_file(file_path: str) -> Optional[np.ndarray]:
    try:
        audio, _ = librosa.load(file_path, sr=SAMPLE_RATE, mono=True)
        return audio.astype(np.float32)
    except Exception as e:
        print(f"⚠ librosa failed: {e}", flush=True)

    try:
        audio, sr = sf.read(file_path, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != SAMPLE_RATE:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)
        return audio.astype(np.float32)
    except Exception as e2:
        print(f"⚠ soundfile failed: {e2}", flush=True)

    # Last fallback: pydub + ffmpeg
    # Try librosa first, then soundfile, then pydub/ffmpeg as a final fallback.
    # This makes the upload pipeline more robust across different browser audio formats.
    try:
        seg = AudioSegment.from_file(file_path)
        seg = seg.set_frame_rate(SAMPLE_RATE).set_channels(1)
        samples = np.array(seg.get_array_of_samples()).astype(np.float32)

        # Normalise int audio to [-1, 1]
        if seg.sample_width == 2:
            samples /= 32768.0
        elif seg.sample_width == 4:
            samples /= 2147483648.0
        else:
            max_val = max(np.max(np.abs(samples)), 1.0)
            samples /= max_val

        return samples
    except Exception as e3:
        print(f"⚠ pydub failed: {e3}", flush=True)
        print("⚠ Audio load failed completely.", flush=True)
        return None

# ─── VAD ──────────────────────────────────────────────────────────────────────
# WebRTC VAD expects 16-bit PCM byte input, so float audio must be converted first.
def _float_to_int16_bytes(x: np.ndarray) -> bytes:
    x = np.clip(x, -1.0, 1.0)
    return (x * 32767.0).astype(np.int16).tobytes()

'''
Create a voiced/unvoiced mask for the audio using WebRTC VAD.
Each sample is labelled as speech or non-speech so later features can distinguish
between speaking and silence.
'''
def vad_mask_per_sample(audio: np.ndarray) -> np.ndarray:
    try:
        vad       = webrtcvad.Vad(VAD_AGGRESSIVENESS)
        frame_len = int(SAMPLE_RATE * VAD_FRAME_MS / 1000)
        n_frames  = len(audio) // frame_len
        mask      = np.zeros(len(audio), dtype=np.int8)
        for i in range(n_frames):
            s, e = i * frame_len, (i + 1) * frame_len
            mask[s:e] = 1 if vad.is_speech(_float_to_int16_bytes(audio[s:e]), SAMPLE_RATE) else 0
        tail = n_frames * frame_len
        if tail < len(audio):
            mask[tail:] = mask[tail - 1] if tail > 0 else 0
        return mask
    except Exception as e:
        print(f"⚠ VAD failed: {e} — treating all audio as voiced")
        return np.ones(len(audio), dtype=np.int8)

'''These helper functions compute low-level speech features such as loudness,
pitch, MFCCs, spectral characteristics, and zero-crossing rate.
They form the acoustic feature layer of the speech-analysis pipeline.
'''
# ─── Feature helpers ──────────────────────────────────────────────────────────

def _rms(x): return float(np.sqrt(np.mean(np.square(x)) + 1e-12))
def _dbfs(r): return float(20.0 * np.log10(max(r, 1e-12)))

def _rolling_spike_flags(dbfs_series: pd.Series, hop_s: float) -> pd.Series:
    win = max(3, int(ROLLING_SEC / hop_s))
    mu  = dbfs_series.rolling(win, min_periods=max(2, win // 3)).mean()
    sdv = dbfs_series.rolling(win, min_periods=max(2, win // 3)).std(ddof=0)
    return ((dbfs_series > mu + LOUD_SPIKE_Z * sdv).astype(int).fillna(0))

def _pitch_f0(y: np.ndarray) -> float:
    if len(y) < int(0.05 * SAMPLE_RATE): return 0.0
    try:
        f0 = librosa.yin(y, fmin=70, fmax=400, sr=SAMPLE_RATE)
        f0 = f0[np.isfinite(f0)]
        return float(np.median(f0)) if len(f0) else 0.0
    except: return 0.0

def _mfcc13(y: np.ndarray) -> List[float]:
    try:
        m = librosa.feature.mfcc(y=y, sr=SAMPLE_RATE, n_mfcc=13)
        return [float(np.mean(m[i])) for i in range(13)]
    except: return [0.0] * 13

def _spectral(y: np.ndarray) -> Tuple[float, float]:
    try:
        c = librosa.feature.spectral_centroid(y=y, sr=SAMPLE_RATE)
        b = librosa.feature.spectral_bandwidth(y=y, sr=SAMPLE_RATE)
        return float(np.mean(c)), float(np.mean(b))
    except: return 0.0, 0.0

def _zcr(y: np.ndarray) -> float:
    try:
        return float(np.mean(librosa.feature.zero_crossing_rate(y)))
    except: return 0.0

# ─── ASR ──────────────────────────────────────────────────────────────────────
# Count filler words and filler phrases in the transcript.
# This is used as a lightweight NLP-style indicator of hesitation or uncertainty.
def _count_fillers(text: str) -> int:
    t = text.lower()
    total = 0
    for ph in FILLER_PHRASES:
        total += t.count(ph)
        t = t.replace(ph, " ")
    for tok in [w.strip(".,!?;:()[]\"'").lower() for w in t.split()]:
        if tok in FILLER_SINGLE:
            total += 1
    return total

'''
Run Whisper-based automatic speech recognition (ASR) on the uploaded audio.
The transcript is later used for word-count, filler detection, and speech-rate analysis.
'''
def _run_asr(audio: np.ndarray) -> Optional[List[Dict]]:
    if not ENABLE_ASR:
        return None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        sf.write(tmp_path, audio, SAMPLE_RATE, subtype="PCM_16")
        model = WhisperModel(ASR_MODEL_SIZE, device="cpu", compute_type="int8")
        segments, _ = model.transcribe(
            tmp_path, language=ASR_LANGUAGE,
            vad_filter=True, word_timestamps=False,
        )
        out = [{"start": float(s.start), "end": float(s.end), "text": (s.text or "").strip()}
               for s in segments]
        os.remove(tmp_path)
        return out
    except Exception as e:
        print(f"⚠ ASR failed: {e}")
        return None

# ─── Window feature extraction ────────────────────────────────────────────────
'''
Split the audio into fixed analysis windows and compute acoustic features per window.
Each row represents one time window and stores information such as loudness, pitch,
spectral properties, pause length, and speech burst length.
'''
def build_window_df(audio: np.ndarray, vad_mask: np.ndarray) -> pd.DataFrame:
    win   = int(SAMPLE_RATE * WINDOW_MS / 1000)
    hop   = int(SAMPLE_RATE * HOP_MS  / 1000)
    hop_s = HOP_MS / 1000.0
    rows  = []
    pause_len = burst_len = 0.0

    for start in range(0, len(audio) - win + 1, hop):
        end    = start + win
        y      = audio[start:end]
        voiced = 1 if np.mean(vad_mask[start:end]) >= 0.5 else 0
        r      = _rms(y);  db = _dbfs(r)
        f0     = _pitch_f0(y); z = _zcr(y)
        sc, sb = _spectral(y); mfccs = _mfcc13(y)

        # Track how long the current voiced segment or pause has lasted.
        # This helps derive hesitation- and fluency-related features.
        if voiced: burst_len += hop_s; pause_len = 0.0
        else:      pause_len += hop_s; burst_len = 0.0

        row = {
            "t":                   round(start / SAMPLE_RATE, 3),
            "voiced":              voiced,
            "rms":                 r,
            "dbfs":                db,
            "pitch_f0":            f0 if voiced else 0.0,
            "zcr":                 z,
            "spectral_centroid":   sc,
            "spectral_bandwidth":  sb,
            "speech_burst_len_s":  round(burst_len, 3),
            "pause_len_s":         round(pause_len, 3),
            "is_pause":            1 if pause_len >= PAUSE_THRESHOLD_S else 0,
        }
        for i, v in enumerate(mfccs, 1): row[f"mfcc_{i}"] = v
        rows.append(row)

    df = pd.DataFrame(rows)
    df["dbfs_delta"]  = df["dbfs"].diff().fillna(0.0)
    df["pitch_delta"] = df["pitch_f0"].diff().fillna(0.0)
    df["loud_spike"]  = _rolling_spike_flags(df["dbfs"], hop_s)
    return df

"""
Merge transcript-derived information into the acoustic feature dataframe.
This adds word-count, filler-count, filler-ratio, and rolling WPM estimates
to the time windows generated from the raw audio.
"""
def merge_asr_metrics(df: pd.DataFrame, segments: List[Dict]) -> pd.DataFrame:
    df = df.copy()
    df["word_count"]   = 0.0
    df["filler_count"] = 0.0
    df["filler_ratio"] = 0.0

    for seg in segments:
        s, e, text = seg["start"], seg["end"], seg["text"]
        if not text: continue
        mask = (df["t"] >= s) & (df["t"] < e)
        if not mask.any(): continue
        words = [w for w in text.split() if w.strip()]
        wc    = len(words); fc = _count_fillers(text)
        n_windows = mask.sum()
        df.loc[mask, "word_count"]   = wc / max(n_windows, 1)
        df.loc[mask, "filler_count"] = fc / max(n_windows, 1)
        df.loc[mask, "filler_ratio"] = fc / max(wc, 1)

    hop_s    = HOP_MS / 1000.0
    roll_win = max(3, int(10.0 / hop_s))
    df["wpm_est"] = (
        df["word_count"]
        .rolling(roll_win, min_periods=max(3, roll_win // 3)).sum()
        / max(roll_win * (HOP_MS / 1000.0), 1.0) * 60.0
    ).fillna(0.0)
    return df

# ─── Summary + metrics ────────────────────────────────────────────────────────
"""
Aggregate the window-level speech features into session-level summary metrics.
These summary values are later converted into the final frontend-friendly speech result.
"""
def compute_summary(df: pd.DataFrame, duration_s: float) -> dict:
    hop_s = HOP_MS / 1000.0
    voiced_ratio   = float(df["voiced"].mean()) if len(df) else 0.0
    pause_entries  = int((df["is_pause"].diff().fillna(0) == 1).sum())
    pauses_per_min = pause_entries / max(duration_s / 60.0, 1e-9)

    burst_peaks = df.loc[
        (df["voiced"] == 1) & (df["speech_burst_len_s"].diff().fillna(0) < 0),
        "speech_burst_len_s"
    ]
    avg_burst = float(burst_peaks.mean()) if len(burst_peaks) else 0.0
    loud_spikes_per_min = float(df["loud_spike"].sum()) / max(duration_s / 60.0, 1e-9)

    total_words  = int(df["word_count"].sum())   if "word_count"   in df.columns else 0
    total_fillers= int(df["filler_count"].sum()) if "filler_count" in df.columns else 0
    avg_wpm      = float(total_words / max(duration_s / 60.0, 1e-9)) if total_words > 0 else 0.0
    filler_ratio = total_fillers / max(total_words, 1)
    fillers_per_min = total_fillers / max(duration_s / 60.0, 1e-9)

    return {
        "duration_s":          duration_s,
        "voiced_ratio":        voiced_ratio,
        "avg_dbfs":            float(df["dbfs"].mean())  if len(df) else 0.0,
        "dbfs_std":            float(df["dbfs"].std(ddof=0)) if len(df) else 0.0,
        "loud_spikes_per_min": loud_spikes_per_min,
        "pauses_per_min":      pauses_per_min,
        "avg_burst_s":         avg_burst,
        "pitch_mean":          float(df.loc[df["pitch_f0"] > 0, "pitch_f0"].mean()) if (df["pitch_f0"] > 0).any() else 0.0,
        "pitch_std":           float(df.loc[df["pitch_f0"] > 0, "pitch_f0"].std(ddof=0)) if (df["pitch_f0"] > 0).any() else 0.0,
        "total_words":         total_words,
        "avg_wpm":             avg_wpm,
        "fillers_per_min":     fillers_per_min,
        "filler_ratio":        filler_ratio,
        "total_fillers":       total_fillers,
    }

# Downsample loudness values into a compact waveform representation
# so the frontend can display a simple visual speech waveform.
def _waveform_data(df: pd.DataFrame, n_points: int = 40) -> list:
    """Downsample dbfs for waveform display in frontend."""
    if len(df) == 0: return []
    step = max(1, len(df) // n_points)
    vals = df["dbfs"].iloc[::step].head(n_points).tolist()
    # Normalise to 0–1 range
    mn, mx = min(vals), max(vals)
    rng = mx - mn if mx != mn else 1
    return [round((v - mn) / rng, 3) for v in vals]

"""
Convert the computed speech summary into the final result schema expected by the frontend.
This includes speech clarity, hesitation count, confidence labels, uncertainty labels,
speech rate, and simplified waveform data.
"""
def _build_result(summary: dict, df: pd.DataFrame) -> dict:
    avg_wpm      = summary.get("avg_wpm", 0)
    fillers_min  = summary.get("fillers_per_min", 0)
    voiced_r     = summary.get("voiced_ratio", 0)
    pauses_min   = summary.get("pauses_per_min", 0)
    total_words  = summary.get("total_words", 0)
    avg_dbfs     = summary.get("avg_dbfs", -100)

    # If almost no words are detected, speech rate is too low, or voiced ratio is too small,
    # treat the session as having no meaningful spoken response.
    no_meaningful_speech = (
        total_words == 0 or
        avg_wpm < 10 or
        voiced_r < 0.15
    )

    # Speech clarity combines fluency (WPM), voiced speech presence, and hesitation penalty.
    # Higher fillers reduce the final clarity score.
    if no_meaningful_speech:
        clarity_score = 0.0
    else:
        wpm_score    = min(100, max(0, (avg_wpm / 150.0) * 100))
        filler_pen   = min(50, fillers_min * 5)
        voiced_score = voiced_r * 100
        clarity_score = round(
            max(0, (wpm_score * 0.4 + voiced_score * 0.4) - filler_pen * 0.2),
            1
        )

    # Word confidence is estimated heuristically from fluency and hesitation behaviour,
    # not from a dedicated confidence model.
    if no_meaningful_speech:
        word_conf = "Low"
    elif fillers_min < 2 and pauses_min < 5 and avg_wpm >= 60:
        word_conf = "High"
    elif fillers_min < 5 and pauses_min < 10 and avg_wpm >= 20:
        word_conf = "Medium"
    else:
        word_conf = "Low"

    # Uncertain words label
    filler_ratio = summary.get("filler_ratio", 0)
    if no_meaningful_speech:
        uncertain = "Low"
    elif filler_ratio < 0.03:
        uncertain = "Low"
    elif filler_ratio < 0.08:
        uncertain = "Medium"
    else:
        uncertain = "High"

    hesitation_count = int(summary.get("total_fillers", 0))
    speech_rate_wpm  = 0 if no_meaningful_speech else int(round(avg_wpm))

    notes = (
        "No meaningful speech detected. "
        if no_meaningful_speech else
        f"AI analysed speech clarity and hesitation patterns. "
        f"Speech rate: {speech_rate_wpm} WPM. "
        f"Fillers detected: {hesitation_count}. "
    )

    return {
        "speech_clarity_score":     clarity_score,
        "hesitation_count":         hesitation_count,
        "word_confidence":          word_conf,
        "uncertain_words_detected": uncertain,
        "speech_rate_wpm":          speech_rate_wpm,
        "analysis_notes":           notes,
        "waveform_data":            _waveform_data(df),
    }

# ─── Main entry point ─────────────────────────────────────────────────────────
"""
Main backend entry point for speech analysis.
It loads the uploaded file, extracts acoustic and transcript-based features,
builds the final speech-analysis result, and stores it in the database.
"""
async def run_speech_analysis_on_file(
    file_path: Optional[str],
    job: AnalysisJob,
    db_session: Session,
):
    await asyncio.sleep(0.1)

    result = None

    if file_path and Path(file_path).exists():
        try:
            audio = load_audio_file(file_path)

            if audio is not None and len(audio) > SAMPLE_RATE * 0.5:
                duration_s = float(len(audio) / SAMPLE_RATE)

                vad = vad_mask_per_sample(audio)
                df = build_window_df(audio, vad)
                print(f"🎙 Window DF rows: {len(df)}", flush=True)

                segments = _run_asr(audio) or []
                print(f"🎙 ASR segments: {len(segments)}", flush=True)

                if segments:
                    df = merge_asr_metrics(df, segments)

                summary = compute_summary(df, duration_s)
                result = _build_result(summary, df)

            else:
                print("⚠ Audio too short or failed to load", flush=True)

        except Exception as e:
            print(f"⚠ Speech analysis failed: {e}", flush=True)
            import traceback
            traceback.print_exc()

        finally:
            # Delete the uploaded raw audio file after processing for better privacy
            if file_path and Path(file_path).exists():
                try:
                    os.remove(file_path)
                    print(f"🗑 Deleted uploaded speech file: {file_path}", flush=True)
                    job.file_path = None
                except Exception as e:
                    print(f"⚠ Failed to delete uploaded speech file: {e}", flush=True)

    # Fallback mock if analysis failed
    if result is None:
        result = {
            "speech_clarity_score":     0,
            "hesitation_count":         0,
            "word_confidence":          "Low",
            "uncertain_words_detected": "Unknown",
            "speech_rate_wpm":          0,
            "analysis_notes":           "Fallback mock — audio missing or analysis error.",
            "waveform_data":            [],
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