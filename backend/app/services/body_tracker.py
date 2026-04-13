"""
body_tracker.py
===================
Captures frame-level body-movement features from a live camera feed using
MediaPipe Pose Landmarker (Tasks API). The script records pose-based movement
features into a CSV file for later analysis by the MindEcho backend.
"""

import argparse
import cv2
import time
import csv
import signal
import sys
import urllib.request
import numpy as np
from pathlib import Path
from collections import deque

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

# Read runtime options from the command line so the backend can control
# camera source, output file path, capture duration, and preview mode.
parser = argparse.ArgumentParser()
parser.add_argument("--cam", type=int, default=3)
parser.add_argument("--output", type=str, default="")
parser.add_argument("--duration", type=int, default=300)
parser.add_argument("--no-window", action="store_true")
args = parser.parse_args()

HEADLESS = args.no_window
CAM_INDEX = args.cam
MAX_SECONDS = args.duration

# Store generated body-tracking CSV files in the sessions folder
OUTPUT_DIR = Path("data/sessions")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CSV_PATH = Path(args.output) if args.output else OUTPUT_DIR / f"body_session_{int(time.time())}.csv"
CSV_PATH.parent.mkdir(parents=True, exist_ok=True)

AUTORECORD = True

# Selected landmarks used for motion analysis. These points focus on the head,
# arms, hips, knees, and ankles to capture major body movement patterns.
LANDMARK_IDS = [
    0,       
    11, 12,   
    13, 14,   
    15, 16,   
    23, 24,   
    25, 26,   
    27, 28    
]

MODEL_PATH = Path.home() / "pose_landmarker_lite.task"
if not MODEL_PATH.exists():
    print("Downloading PoseLandmarker model...", flush=True)
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        str(MODEL_PATH)
    )
    print("Model downloaded.", flush=True)

# Configure the pose detector in video mode so landmark tracking works
# across consecutive frames instead of treating each frame independently.
_base_opts = mp_python.BaseOptions(model_asset_path=str(MODEL_PATH))
_pose_opts = mp_vision.PoseLandmarkerOptions(
    base_options=_base_opts,
    running_mode=mp_vision.RunningMode.VIDEO,
    num_poses=1,
    min_pose_detection_confidence=0.5,
    min_pose_presence_confidence=0.5,
    min_tracking_confidence=0.5,
    output_segmentation_masks=False,
)
pose_landmarker = mp_vision.PoseLandmarker.create_from_options(_pose_opts)

# Convert a short sequence of pose landmarks into motion features such as
# overall speed, hand activity, leg activity, and sudden movement spikes.
def features_from_seq(seq: np.ndarray, fps: float) -> dict | None:
    if seq.shape[0] < 10:
        return None

    diff = np.diff(seq, axis=0)
    speed = np.linalg.norm(diff, axis=2)

    feats = {}
    feats["frames_used"] = float(seq.shape[0])
    feats["mean_speed_all"] = float(speed.mean())
    feats["std_speed_all"] = float(speed.std())
    feats["max_speed_all"] = float(speed.max())

    wrist_pos = [LANDMARK_IDS.index(15), LANDMARK_IDS.index(16)]
    ankle_pos = [LANDMARK_IDS.index(27), LANDMARK_IDS.index(28)]
    knee_pos = [LANDMARK_IDS.index(25), LANDMARK_IDS.index(26)]

    hand_speed = speed[:, wrist_pos].mean(axis=1)
    leg_speed = speed[:, ankle_pos + knee_pos].mean(axis=1)

    feats["mean_hand_speed"] = float(hand_speed.mean())
    feats["std_hand_speed"] = float(hand_speed.std())
    feats["max_hand_speed"] = float(hand_speed.max())

    feats["mean_leg_speed"] = float(leg_speed.mean())
    feats["std_leg_speed"] = float(leg_speed.std())
    feats["max_leg_speed"] = float(leg_speed.max())

    thresh = 0.02
    feats["spike_rate"] = float((speed > thresh).mean())

    feats["fps"] = float(fps if fps and fps > 1 else 30.0)
    feats["mean_speed_per_sec"] = feats["mean_speed_all"] * feats["fps"]
    return feats

# Draw the selected landmarks and simplified skeleton connections for live preview.
def draw_pose_points(frame, landmarks, w, h):
    for idx in LANDMARK_IDS:
        lm = landmarks[idx]
        x = int(lm.x * w)
        y = int(lm.y * h)
        cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)

    connections = [
        (11, 12),
        (11, 13), (13, 15),
        (12, 14), (14, 16),
        (11, 23), (12, 24),
        (23, 24),
        (23, 25), (25, 27),
        (24, 26), (26, 28)
    ]

    for a, b in connections:
        p1 = landmarks[a]
        p2 = landmarks[b]
        x1, y1 = int(p1.x * w), int(p1.y * h)
        x2, y2 = int(p2.x * w), int(p2.y * h)
        cv2.line(frame, (x1, y1), (x2, y2), (255, 255, 255), 2)

# Handle stop signals cleanly so the tracker can exit safely and still save output.
_running = True
def _handle_signal(sig, frame):
    global _running
    _running = False

signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)

cap = cv2.VideoCapture(CAM_INDEX)
if not cap.isOpened():
    print(f"ERROR: Could not open camera index {CAM_INDEX}", file=sys.stderr, flush=True)
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
if fps is None or fps <= 1:
    fps = 30.0

# Keep a rolling window of recent landmarks so movement features are based on
# short-term motion over time instead of a single frame.
live_buffer_len = int(5 * fps)
keypoints_buffer = deque(maxlen=live_buffer_len)

csv_file = open(CSV_PATH, "w", newline="", encoding="utf-8")
writer = csv.writer(csv_file)

# Write the CSV header once. Each later row stores raw landmark positions
# together with the computed body-movement features.
writer.writerow([
    "t",
    "pose",
    "nose_x", "nose_y",
    "left_wrist_x", "left_wrist_y",
    "right_wrist_x", "right_wrist_y",
    "left_ankle_x", "left_ankle_y",
    "right_ankle_x", "right_ankle_y",
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
    "mean_speed_per_sec"
])
csv_file.flush()

if AUTORECORD:
    print(f"Recording → {CSV_PATH}", flush=True)

# Start timing the session and enable recording immediately by default.
recording = AUTORECORD
start_time = time.time()

if not HEADLESS:
    print(f"Running cam={CAM_INDEX}. Keys: q=quit, r=record")

try:
    # Main tracking loop
    while _running:
        ok, frame = cap.read()
        if not ok:
            break

        t_now = time.time()
        elapsed = t_now - start_time
        if elapsed >= MAX_SECONDS:
            break

        frame_ts_ms = int((t_now - start_time) * 1000)
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        
        result = pose_landmarker.detect_for_video(mp_img, frame_ts_ms)

        pose_det = False
        nose_x = nose_y = 0.0
        left_wrist_x = left_wrist_y = 0.0
        right_wrist_x = right_wrist_y = 0.0
        left_ankle_x = left_ankle_y = 0.0
        right_ankle_x = right_ankle_y = 0.0

        if result.pose_landmarks and len(result.pose_landmarks) > 0:
            pose_det = True
            lms = result.pose_landmarks[0]

            pts = np.array([[lms[i].x, lms[i].y] for i in LANDMARK_IDS], dtype=np.float32)

            left_shoulder = pts[LANDMARK_IDS.index(11)]
            right_shoulder = pts[LANDMARK_IDS.index(12)]
            shoulder_dist = np.linalg.norm(left_shoulder - right_shoulder)
            if shoulder_dist > 0:
                pts = pts / shoulder_dist

            keypoints_buffer.append(pts)

            nose_x, nose_y = float(lms[0].x * w), float(lms[0].y * h)
            left_wrist_x, left_wrist_y = float(lms[15].x * w), float(lms[15].y * h)
            right_wrist_x, right_wrist_y = float(lms[16].x * w), float(lms[16].y * h)
            left_ankle_x, left_ankle_y = float(lms[27].x * w), float(lms[27].y * h)
            right_ankle_x, right_ankle_y = float(lms[28].x * w), float(lms[28].y * h)

            if not HEADLESS:
                draw_pose_points(frame, lms, w, h)

        feats = None
        if len(keypoints_buffer) >= 3:
            seq = np.stack(list(keypoints_buffer), axis=0)
            feats = features_from_seq(seq, fps=fps)

        # Write one output row per loop iteration, using zeros when pose features
        # are not yet available or no body is currently detected.
        if recording and writer:
            writer.writerow([
                t_now,
                int(pose_det),
                nose_x if pose_det else 0,
                nose_y if pose_det else 0,
                left_wrist_x if pose_det else 0,
                left_wrist_y if pose_det else 0,
                right_wrist_x if pose_det else 0,
                right_wrist_y if pose_det else 0,
                left_ankle_x if pose_det else 0,
                left_ankle_y if pose_det else 0,
                right_ankle_x if pose_det else 0,
                right_ankle_y if pose_det else 0,
                feats["frames_used"] if feats is not None else 0,
                feats["mean_speed_all"] if feats is not None else 0,
                feats["std_speed_all"] if feats is not None else 0,
                feats["max_speed_all"] if feats is not None else 0,
                feats["mean_hand_speed"] if feats is not None else 0,
                feats["std_hand_speed"] if feats is not None else 0,
                feats["max_hand_speed"] if feats is not None else 0,
                feats["mean_leg_speed"] if feats is not None else 0,
                feats["std_leg_speed"] if feats is not None else 0,
                feats["max_leg_speed"] if feats is not None else 0,
                feats["spike_rate"] if feats is not None else 0,
                feats["fps"] if feats is not None else 0,
                feats["mean_speed_per_sec"] if feats is not None else 0,
            ])
            csv_file.flush()


        if not HEADLESS:
            status = "BODY DETECTED" if pose_det else "NO BODY"
            col = (0, 255, 0) if pose_det else (0, 0, 255)

            cv2.putText(frame, status, (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, col, 2)
            cv2.putText(frame, "● REC" if recording else "○ REC OFF", (20, h - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                        (0, 0, 255) if recording else (140, 140, 140), 2)

            cv2.imshow("Body Tracker (q=quit r=record)", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('r'):
                recording = not recording

finally:
    cap.release()
    pose_landmarker.close()
    if not HEADLESS:
        cv2.destroyAllWindows()
    csv_file.flush()
    csv_file.close()
    print(f"Saved: {CSV_PATH}", flush=True)