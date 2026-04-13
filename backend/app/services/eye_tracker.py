"""
eye_tracker.py
===================
Captures frame-level eye-tracking features from a live camera feed using
MediaPipe Face Landmarker. The script records gaze, blink, look-away,
jitter, and focus-related signals into a CSV file for later analysis
by the MindEcho backend.
"""

import argparse
import cv2
import time
import csv
import signal
import sys
import os
import urllib.request
import numpy as np
import mediapipe as mp
from pathlib import Path
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

# Command-line arguments allow the backend service to choose the camera,
# output CSV path, and whether the tracker should run without a preview window.
parser = argparse.ArgumentParser()
parser.add_argument("--cam",       type=int,            default=2)
parser.add_argument("--output",    type=str,            default="")
parser.add_argument("--no-window", action="store_true")
args = parser.parse_args()

HEADLESS  = args.no_window
CAM_INDEX = args.cam

# Prepare the session output location so each recording can be saved
# as a standalone CSV file for later backend analysis.
OUTPUT_DIR = Path("data/sessions")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CSV_PATH = Path(args.output) if args.output else OUTPUT_DIR / f"eye_session_{int(time.time())}.csv"
CSV_PATH.parent.mkdir(parents=True, exist_ok=True)

AUTORECORD = True

# Core tracking thresholds and smoothing parameters used to control
# blink detection, baseline calibration, gaze stability, and look-away logic.
SMOOTHING            = 0.82
BLINK_THR            = 0.18
BASELINE_SECONDS     = 5.0
MIN_BASELINE_FRAMES  = 40
BASELINE_TIMEOUT_SEC = 15.0
YAW_THR_DEG          = 30.0
PITCH_THR_DEG        = 25.0
GAZE_X_THR_PX        = 110.0
GAZE_Y_THR_PX        = 90.0
LOOKAWAY_CONFIRM_SEC = 0.5

# Load the MediaPipe face-landmarker model used for iris detection,
# eyelid landmarks, and coarse head-pose estimation.
MODEL_PATH = Path.home() / "face_landmarker.task"
if not MODEL_PATH.exists():
    print("Downloading FaceLandmarker model (~6MB)...", flush=True)
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        str(MODEL_PATH)
    )
    print("Model downloaded.", flush=True)

_base_opts  = mp_python.BaseOptions(model_asset_path=str(MODEL_PATH))
_face_opts  = mp_vision.FaceLandmarkerOptions(
    base_options=_base_opts,
    output_face_blendshapes=False,
    output_facial_transformation_matrixes=True,
    num_faces=1,
    running_mode=mp_vision.RunningMode.VIDEO,
)
face_landmarker = mp_vision.FaceLandmarker.create_from_options(_face_opts)

# Landmark indices
LEFT_IRIS   = [474, 475, 476, 477]
RIGHT_IRIS  = [469, 470, 471, 472]
LEFT_EYE_OUTER  = 33;  LEFT_EYE_INNER  = 133
RIGHT_EYE_INNER = 362; RIGHT_EYE_OUTER = 263
LEFT_EYE_TOP    = 159; LEFT_EYE_BOTTOM = 145
RIGHT_EYE_TOP   = 386; RIGHT_EYE_BOTTOM= 374
LEFT_EYE_BOX  = [33, 133, 160, 159, 158, 144, 145, 153]
RIGHT_EYE_BOX = [362, 263, 387, 386, 385, 373, 374, 380]
POSE_LMS = [1, 199, 33, 263, 61, 291]
MODEL_POINTS_3D = np.array([
    ( 0.0,   0.0,   0.0), ( 0.0, -63.6, -12.5),
    (-43.3,  32.7, -26.0), (43.3,  32.7, -26.0),
    (-28.9, -28.9, -24.1), (28.9, -28.9, -24.1),
], dtype=np.float64)

def lm_xy(lms, idx, w, h):
    l = lms[idx]
    return np.array([l.x * w, l.y * h], dtype=np.float64)

def iris_center(lms, ids, w, h):
    return np.array([lm_xy(lms, i, w, h) for i in ids]).mean(axis=0)

def calc_ear(lms, top, bot, outer, inner, w, h):
    v  = np.linalg.norm(lm_xy(lms, top, w, h) - lm_xy(lms, bot, w, h))
    ho = np.linalg.norm(lm_xy(lms, outer, w, h) - lm_xy(lms, inner, w, h)) + 1e-6
    return float(v / ho)

def draw_eye_box(frame, lms, ids, w, h, pad=6):
    pts = np.array([[int(lms[i].x * w), int(lms[i].y * h)] for i in ids])
    x1, y1 = np.clip(pts.min(axis=0) - pad, 0, [w-1, h-1])
    x2, y2 = np.clip(pts.max(axis=0) + pad, 0, [w-1, h-1])
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

"""
Estimate head yaw and pitch from selected face landmarks using solvePnP.
This helps determine whether the child is still facing the screen.
"""
def head_pose(lms, w, h):
    img_pts = np.array([lm_xy(lms, i, w, h) for i in POSE_LMS], dtype=np.float64)
    cam_mat = np.array([[w, 0, w/2], [0, w, h/2], [0, 0, 1]], dtype=np.float64)
    ok, rvec, _ = cv2.solvePnP(MODEL_POINTS_3D, img_pts, cam_mat,
                                np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok:
        return None, None
    R, _ = cv2.Rodrigues(rvec)
    sy    = np.sqrt(R[0, 0]**2 + R[1, 0]**2)
    yaw   = float(np.degrees(np.arctan2(-R[2, 0], sy)))
    pitch = float(np.degrees(np.arctan2( R[2, 1], R[2, 2])))
    return yaw, pitch

def clamp01(x):
    return max(0.0, min(1.0, float(x)))


_running = True
def _handle_signal(sig, frame):
    global _running
    _running = False
signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT,  _handle_signal)


cap = cv2.VideoCapture(CAM_INDEX)
if not cap.isOpened():
    print(f"ERROR: Could not open camera index {CAM_INDEX}", file=sys.stderr, flush=True)
    sys.exit(1)

# Write one row per processed frame so the backend can later compute
# interpretable metrics and GRU-based predictions from the recorded sequence.
csv_file = open(CSV_PATH, "w", newline="", encoding="utf-8")
writer   = csv.writer(csv_file)
writer.writerow(["t", "face", "iris_x", "iris_y", "gaze_x", "gaze_y",
                 "ear", "blink_closed", "lookaway", "jitter", "focus"])
csv_file.flush()
if AUTORECORD:
    print(f"Recording → {CSV_PATH}", flush=True)

recording   = AUTORECORD
show_boxes  = True

sm_gx = sm_gy = prev_gx = prev_gy = None
jitter      = 0.0
last_closed = 0

# Baseline variables store the child’s normal centred gaze/head position
# before attention and look-away checks are applied.
baseline_active  = True
baseline_start   = None
baseline_frames  = 0
yaw_s = []; pitch_s = []; gx_s = []; gy_s = []
yaw0 = pitch0 = gx0 = gy0 = 0.0

lookaway       = 0.0
lookaway_start = None
total_frames = attend_frames = 0
frame_ts_ms = 0

if not HEADLESS:
    print(f"Running cam={CAM_INDEX}. Keys: q=quit, r=record, b=boxes, n=baseline")

# Process the video stream frame by frame, extract eye-related features,
# and continuously update attention-related signals.
try:
    while _running:
        ok, frame = cap.read()
        if not ok:
            break

        total_frames += 1
        t_now       = time.time()
        frame_ts_ms += 33
        frame        = cv2.flip(frame, 1)
        h, w         = frame.shape[:2]

        # ── START BASELINE TIMER IMMEDIATELY on first frame ──
        if baseline_active and baseline_start is None:
            baseline_start = t_now

        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = face_landmarker.detect_for_video(mp_img, frame_ts_ms)

        face_det = False
        iris_x = iris_y = gaze_x = gaze_y = ear_val = yaw = pitch = None

        if result.face_landmarks:
            face_det = True
            lms = result.face_landmarks[0]

            li       = iris_center(lms, LEFT_IRIS,  w, h)
            ri       = iris_center(lms, RIGHT_IRIS, w, h)
            iris_raw = (li + ri) / 2.0
            iris_x, iris_y = float(iris_raw[0]), float(iris_raw[1])

            if sm_gx is None:
                sm_gx, sm_gy = iris_raw[0], iris_raw[1]
            else:
                sm_gx = SMOOTHING * sm_gx + (1 - SMOOTHING) * iris_raw[0]
                sm_gy = SMOOTHING * sm_gy + (1 - SMOOTHING) * iris_raw[1]
            gaze_x, gaze_y = float(sm_gx), float(sm_gy)

            if prev_gx is not None:
                delta  = np.sqrt((sm_gx - prev_gx)**2 + (sm_gy - prev_gy)**2)
                jitter = clamp01(delta / 30.0)
            prev_gx, prev_gy = sm_gx, sm_gy

            ear_l   = calc_ear(lms, LEFT_EYE_TOP,  LEFT_EYE_BOTTOM, LEFT_EYE_OUTER,  LEFT_EYE_INNER,  w, h)
            ear_r   = calc_ear(lms, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, RIGHT_EYE_OUTER, RIGHT_EYE_INNER, w, h)
            ear_val = float((ear_l + ear_r) / 2.0)
            last_closed = 1 if ear_val < BLINK_THR else 0

            yaw, pitch = head_pose(lms, w, h)

            if not HEADLESS and show_boxes:
                draw_eye_box(frame, lms, LEFT_EYE_BOX,  w, h)
                draw_eye_box(frame, lms, RIGHT_EYE_BOX, w, h)

            # ── Baseline capture (only when face visible) ──
            if baseline_active and yaw is not None:
                yaw_s.append(yaw);   pitch_s.append(pitch or 0.0)
                gx_s.append(gaze_x); gy_s.append(gaze_y)
                baseline_frames += 1

        else:
            jitter = float(jitter * 0.9)

        # Finalize baseline once enough stable samples are collected,
        # or fall back to defaults if calibration takes too long.
        if baseline_active:
            elapsed = t_now - baseline_start
            if (elapsed >= BASELINE_SECONDS and baseline_frames >= MIN_BASELINE_FRAMES):
                yaw0, pitch0 = float(np.median(yaw_s)), float(np.median(pitch_s))
                gx0,  gy0   = float(np.median(gx_s)),  float(np.median(gy_s))
                sm_gx, sm_gy     = gx0, gy0
                prev_gx, prev_gy = gx0, gy0
                baseline_active  = False
                print(f"Baseline done: centre=({gx0:.0f},{gy0:.0f})px", flush=True)
            elif elapsed >= BASELINE_TIMEOUT_SEC:
                # Timed out — use whatever we have or defaults
                if baseline_frames > 0:
                    yaw0, pitch0 = float(np.median(yaw_s)), float(np.median(pitch_s))
                    gx0,  gy0   = float(np.median(gx_s)),  float(np.median(gy_s))
                else:
                    yaw0 = pitch0 = gx0 = gy0 = 0.0
                baseline_active = False
                print(f"Baseline timeout after {elapsed:.1f}s — using defaults.", flush=True)

        # Determine whether the child appears attentive by combining
        # face visibility and head-orientation checks relative to the baseline.
        if baseline_active:
            attending = True
        elif not face_det:
            attending = False
        else:
            yaw_ok   = (abs(yaw   - yaw0)   <= YAW_THR_DEG)   if yaw   is not None else False
            pitch_ok = (abs(pitch - pitch0) <= PITCH_THR_DEG) if pitch is not None else False
            attending = yaw_ok and pitch_ok

        # Confirm look-away behaviour only after it persists briefly,
        # reducing false positives from short natural movements.
        if not attending:
            if not face_det:
                lookaway = 1.0
                lookaway_start = None
            else:
                if lookaway_start is None:
                    lookaway_start = t_now
                lookaway = 1.0 if (t_now - lookaway_start) >= LOOKAWAY_CONFIRM_SEC else 0.0
        else:
            lookaway_start = None
            lookaway = 0.0

        # If no face is visible, force the frame to be treated as inattentive.
        # Otherwise, derive a normalized focus score from look-away, jitter, and eye openness.
        if not face_det:
            ear_open = 0.0
            focus = 0.0
            jitter = 1.0
        else:
            ear_open = clamp01((ear_val - BLINK_THR) / (0.35 - BLINK_THR))
            focus = clamp01(
                (1.0 - lookaway) * 0.60
                + (1.0 - jitter)  * 0.25
                + ear_open         * 0.15
            )

        if attending:
            attend_frames += 1

        if recording and writer:
            writer.writerow([
                t_now,
                int(face_det),
                iris_x if face_det and iris_x is not None else 0,
                iris_y if face_det and iris_y is not None else 0,
                gaze_x if face_det and gaze_x is not None else 0,
                gaze_y if face_det and gaze_y is not None else 0,
                ear_val if face_det and ear_val is not None else 0,
                int(last_closed) if face_det else 0,
                lookaway if face_det else 1.0,
                jitter if face_det else 1.0,
                focus if face_det else 0.0,
            ])
            csv_file.flush()

        if not HEADLESS:
            attn_pct = 100.0 * attend_frames / max(1, total_frames)
            status   = "BASELINE..." if baseline_active else ("ATTENDING" if lookaway < 0.5 else "LOOKING AWAY")
            col      = (0, 255, 0) if lookaway < 0.5 else (0, 0, 255)
            cv2.putText(frame, status, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, col, 2)
            cv2.putText(frame, f"Attention: {attn_pct:.1f}%", (20, 80),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            cv2.putText(frame, f"Focus:{focus:.2f} Jitter:{jitter:.2f}", (20, 115),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (220, 220, 220), 2)
            cv2.putText(frame, "● REC" if recording else "○ REC OFF", (20, h - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255) if recording else (140, 140, 140), 2)
            cv2.imshow("Eye Tracker (q=quit r=rec b=boxes n=baseline)", frame)
            key = cv2.waitKey(1) & 0xFF
            if   key == ord('q'): break
            elif key == ord('b'): show_boxes = not show_boxes
            elif key == ord('r'): recording  = not recording
            elif key == ord('n'):
                baseline_active = True; baseline_start = None; baseline_frames = 0
                yaw_s.clear(); pitch_s.clear(); gx_s.clear(); gy_s.clear()
                sm_gx = sm_gy = None; prev_gx = prev_gy = None
                print("Baseline reset.", flush=True)

finally:
    cap.release()
    face_landmarker.close()
    if not HEADLESS:
        cv2.destroyAllWindows()
    if csv_file:
        csv_file.flush()
        csv_file.close()
    print(f"Saved: {CSV_PATH}", flush=True)