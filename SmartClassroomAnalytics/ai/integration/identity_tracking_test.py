import os
import sys
import signal
import threading
import queue
import argparse
from pathlib import Path
from datetime import datetime

# Ensure ai directory and project root are in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
AI_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = AI_DIR.parent

if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np
import time
import requests

from ultralytics import YOLO

from recognition.face_recognizer import FaceRecognizer
from recognition.face_database import FaceDatabase
from attendance.presence_accumulator import PresenceAccumulator


# ============================================================
# CONFIGURATION
# ============================================================

_local_yolo = SCRIPT_DIR / "yolo11n.pt"
_ai_yolo = AI_DIR / "yolo11n.pt"
MODEL_PATH = str(_local_yolo if _local_yolo.exists() else _ai_yolo if _ai_yolo.exists() else "yolo11n.pt")

CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", 0))

RECOGNITION_THRESHOLD = 0.45

STOP_FLAG_PATH = PROJECT_ROOT / "storage" / "tracker_stop.flag"

IS_HEADLESS = os.environ.get("SMARTCLASSROOM_HEADLESS", "0").lower() in ("1", "true", "yes")

_stop_requested = False

def _signal_handler(signum, frame):
    global _stop_requested
    print(f"\n[AI Tracker] Stop signal received ({signum}). Gracefully stopping...")
    _stop_requested = True

try:
    signal.signal(signal.SIGINT, _signal_handler)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, _signal_handler)
except Exception:
    pass


# ============================================================
# CLASS CONFIGURATION
# ============================================================

# Fallback only.
# The teacher-created FastAPI session overrides this value.

CLASS_DURATION_MINUTES = 2

# Fallback only.
# The teacher-created FastAPI session overrides this value.

ATTENDANCE_THRESHOLD = 0.70


# ============================================================
# FASTAPI CONFIGURATION
# ============================================================

API_URL = "http://127.0.0.1:8000"

# ============================================================
# LIVE WEB STREAMING QUEUE & BACKGROUND WORKER
# ============================================================

import queue
import threading

_stream_queue = queue.Queue(maxsize=1)
_stream_thread = None

def _stream_worker():
    session = requests.Session()
    while True:
        try:
            jpg = _stream_queue.get()
            session.post(
                f"{API_URL}/stream/frame",
                data=jpg,
                headers={"Content-Type": "image/jpeg"},
                timeout=0.3
            )
        except Exception:
            pass

def push_frame_to_stream(frame):
    global _stream_thread
    if _stream_thread is None:
        _stream_thread = threading.Thread(target=_stream_worker, daemon=True)
        _stream_thread.start()

    try:
        ret, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
        if ret:
            if _stream_queue.full():
                try:
                    _stream_queue.get_nowait()
                except Exception:
                    pass
            _stream_queue.put_nowait(buf.tobytes())
    except Exception:
        pass


def _attendance_sync_worker(session_id, presence_snapshot):
    for student_id, presence_secs in presence_snapshot.items():
        try:
            requests.post(
                f"{API_URL}/attendance/",
                json={
                    "session_id": session_id,
                    "student_id": str(student_id),
                    "presence_seconds": round(float(presence_secs), 2),
                },
                timeout=1.0,
            )
        except Exception:
            pass


def trigger_async_attendance_sync(session_id, attendance, current_time):
    snapshot = {}
    for st_id, st_info in attendance.students.items():
        curr = st_info.get("total_presence_seconds", 0.0)
        if st_info.get("is_present") and st_info.get("presence_start_time"):
            curr += (current_time - st_info["presence_start_time"])
        snapshot[str(st_id)] = curr
    if snapshot:
        threading.Thread(target=_attendance_sync_worker, args=(session_id, snapshot), daemon=True).start()


CURRENT_SESSION_ID = None


# ============================================================
# PHONE / BEHAVIOR CONFIGURATION
# ============================================================

# YOLO COCO classes:
#
# 0  = person
# 67 = cell phone

PHONE_CLASS_ID = 67


# Phone must remain detected this long before
# becoming a behavior event.

PHONE_MIN_DURATION_SECONDS = 5.0


# Small detection gap tolerance.

PHONE_DETECTION_GRACE_SECONDS = 1.5


# ============================================================
# COSINE SIMILARITY
# ============================================================

def cosine_similarity(
    a,
    b
):

    a = np.asarray(
        a,
        dtype=np.float32
    )

    b = np.asarray(
        b,
        dtype=np.float32
    )

    denominator = (
        np.linalg.norm(a)
        *
        np.linalg.norm(b)
    )

    if denominator == 0:

        return 0.0

    return float(
        np.dot(a, b)
        /
        denominator
    )


# ============================================================
# FACE RECOGNITION
# ============================================================

def recognize_face(
    face,
    students
):

    if not students:

        return (
            "Unknown",
            None,
            0.0
        )

    embedding = face.embedding

    norm = np.linalg.norm(
        embedding
    )

    if norm == 0:

        return (
            "Unknown",
            None,
            0.0
        )

    embedding = (
        embedding / norm
    )

    best_name = "Unknown"

    best_student_id = None

    best_score = -1.0

    for student_id, student_data in (
        students.items()
    ):

        stored_embedding = np.array(
            student_data["embedding"],
            dtype=np.float32
        )

        score = cosine_similarity(
            embedding,
            stored_embedding
        )

        if score > best_score:

            best_score = score

            best_name = (
                student_data["name"]
            )

            best_student_id = (
                student_id
            )

    if (
        best_score
        <
        RECOGNITION_THRESHOLD
    ):

        return (
            "Unknown",
            None,
            best_score
        )

    return (
        best_name,
        best_student_id,
        best_score
    )


# ============================================================
# FIND YOLO PERSON FOR A FACE
# ============================================================

def find_person_for_face(
    face,
    people
):

    fx1, fy1, fx2, fy2 = (
        face.bbox.astype(int)
    )

    face_center_x = (
        fx1 + fx2
    ) // 2

    face_center_y = (
        fy1 + fy2
    ) // 2

    for person in people:

        px1, py1, px2, py2 = (
            person["bbox"]
        )

        if (
            px1 <= face_center_x <= px2
            and
            py1 <= face_center_y <= py2
        ):

            return person["track_id"]

    return None


# ============================================================
# CHECK PHONE INSIDE PERSON
# ============================================================

def phone_inside_person(
    phone_bbox,
    person_bbox
):

    px1, py1, px2, py2 = (
        person_bbox
    )

    fx1, fy1, fx2, fy2 = (
        phone_bbox
    )

    phone_center_x = (
        fx1 + fx2
    ) / 2

    phone_center_y = (
        fy1 + fy2
    ) / 2

    return (
        px1 <= phone_center_x <= px2
        and
        py1 <= phone_center_y <= py2
    )


# ============================================================
# FORMAT TIME
# ============================================================

def format_time(
    seconds
):

    seconds = max(
        0,
        seconds
    )

    minutes = int(
        seconds // 60
    )

    remaining_seconds = int(
        seconds % 60
    )

    return (
        f"{minutes:02d}:"
        f"{remaining_seconds:02d}"
    )


# ============================================================
# GET CURRENT PRESENCE
# ============================================================

def get_live_presence(
    attendance,
    student_id,
    current_time
):

    if student_id not in attendance.students:

        return (
            0.0,
            0.0
        )

    student = attendance.students[
        student_id
    ]

    total_presence = (
        student[
            "total_presence_seconds"
        ]
    )

    if student[
        "currently_present"
    ]:

        start_time = (
            student[
                "presence_start_time"
            ]
        )

        if start_time is not None:

            total_presence += (
                current_time
                -
                start_time
            )

    if (
        attendance.class_duration_seconds
        <=
        0
    ):

        percentage = 0.0

    else:

        percentage = (
            total_presence
            /
            attendance.class_duration_seconds
        ) * 100

    return (
        total_presence,
        percentage
    )


# ============================================================
# SEND ATTENDANCE TO FASTAPI
# ============================================================

def send_attendance_to_api(
    student_id,
    presence_seconds
):

    data = {

        "session_id":
            CURRENT_SESSION_ID,

        "student_id":
            str(student_id),

        "presence_seconds":
            float(presence_seconds)
    }

    print()
    print("-" * 60)

    print(
        f"Sending attendance for "
        f"{student_id}"
    )

    print(
        f"Presence seconds: "
        f"{presence_seconds:.2f}"
    )

    try:

        response = requests.post(

            f"{API_URL}/attendance/",

            json=data,

            timeout=5
        )

    except requests.exceptions.RequestException as error:

        print()
        print(
            "COULD NOT CONNECT TO FASTAPI"
        )

        print(
            f"Error: {error}"
        )

        print(
            "Make sure FastAPI is running:"
        )

        print(
            "uvicorn backend.main:app --reload"
        )

        print("-" * 60)

        return None

    if response.ok:

        try:
            result = response.json()
        except ValueError:
            result = {}

        print()
        print(
            "ATTENDANCE SENT TO FASTAPI"
        )

        print(
            f"Student ID: "
            f"{result.get('student_id')}"
        )

        print(
            f"Presence: "
            f"{result.get('presence_seconds', 0):.2f} sec"
        )

        print(
            f"Percentage: "
            f"{result.get('presence_percentage', 0):.2f}%"
        )

        print(
            f"Status: "
            f"{result.get('status')}"
        )

        print("-" * 60)

        return result

    print()
    print(
        "FASTAPI ATTENDANCE ERROR"
    )

    print(
        f"HTTP Status: "
        f"{response.status_code}"
    )

    print(
        f"Response: "
        f"{response.text}"
    )

    print("-" * 60)

    return None


# ============================================================
# GENERIC BEHAVIOR TRACKER
# ============================================================

class BehaviorTracker:

    def __init__(
        self,
        behavior,
        min_duration_seconds,
        grace_seconds
    ):

        self.behavior = behavior

        self.min_duration_seconds = (
            float(min_duration_seconds)
        )

        self.grace_seconds = (
            float(grace_seconds)
        )

        self.active = {}

        self.completed_events = []

    # ========================================================
    # UPDATE
    # ========================================================

    def update(
        self,
        student_id,
        student_name,
        detected,
        now
    ):

        if detected:

            if student_id not in self.active:

                self.active[
                    student_id
                ] = {

                    "name":
                        student_name,

                    "start_time":
                        now,

                    "last_seen":
                        now
                }

            else:

                self.active[
                    student_id
                ][
                    "last_seen"
                ] = now

            return

        if student_id not in self.active:

            return

        event = self.active[
            student_id
        ]

        if (
            now
            -
            event["last_seen"]
            <=
            self.grace_seconds
        ):

            return

        self._finish(
            student_id
        )

    # ========================================================
    # FINISH
    # ========================================================

    def _finish(
        self,
        student_id,
        end_time=None
    ):

        event = self.active.pop(
            student_id,
            None
        )

        if event is None:

            return

        if end_time is None:

            end_time = (
                event["last_seen"]
            )

        duration = max(
            0.0,
            event["last_seen"]
            -
            event["start_time"]
        )

        if (
            duration
            <
            self.min_duration_seconds
        ):

            return

        self.completed_events.append({

            "behavior":
                self.behavior,

            "student_id":
                student_id,

            "student_name":
                event["name"],

            "start_time":
                event["start_time"],

            "end_time":
                end_time,

            "duration_seconds":
                duration
        })

    # ========================================================
    # FINISH ALL
    # ========================================================

    def finish_all(
        self,
        now=None
    ):

        if now is None:

            now = time.time()

        for student_id in list(
            self.active.keys()
        ):

            event = self.active.get(
                student_id
            )

            if event is not None:

                self._finish(
                    student_id,
                    event["last_seen"]
                )

    # ========================================================
    # POP EVENTS
    # ========================================================

    def pop_events(self):

        events = list(
            self.completed_events
        )

        self.completed_events.clear()

        return events


# ============================================================
# FACE LANDMARK HELPERS
# ============================================================

def get_106_landmarks(
    face
):

    landmarks = getattr(
        face,
        "landmark_2d_106",
        None
    )

    if landmarks is None:

        return None

    landmarks = np.asarray(
        landmarks,
        dtype=np.float32
    )

    if (
        landmarks.ndim != 2
        or
        landmarks.shape[0] < 97
        or
        landmarks.shape[1] < 2
    ):

        return None

    return landmarks


# ============================================================
# DISTANCE
# ============================================================

def distance(
    a,
    b
):

    return float(
        np.linalg.norm(
            np.asarray(a)
            -
            np.asarray(b)
        )
    )


# ============================================================
# EYE ASPECT RATIO
# ============================================================

def eye_aspect_ratio(points):
    """Estimate eye openness from the eye-contour landmark extent.

    Using the contour's bounding width/height avoids assuming that
    consecutive InsightFace landmarks are ordered like the six-point
    EAR formula (that ordering assumption can make closed eyes invisible).
    """
    if points is None:
        return None

    points = np.asarray(points, dtype=np.float32)
    if points.ndim != 2 or points.shape[0] < 6 or points.shape[1] < 2:
        return None

    points = points[:, :2]
    if not np.isfinite(points).all():
        return None

    horizontal = float(np.max(points[:, 0]) - np.min(points[:, 0]))
    vertical = float(np.max(points[:, 1]) - np.min(points[:, 1]))
    if horizontal <= 1e-6:
        return None

    return vertical / horizontal


# ============================================================
# CALCULATE FACE EAR
# ============================================================

def calculate_face_ear(
    face
):

    """
    Calculate average Eye Aspect Ratio.

    Uses InsightFace 106-point landmarks.

    The important improvement is that the caller does NOT rely
    on one fixed EAR value for every student.
    """

    landmarks = get_106_landmarks(
        face
    )

    if landmarks is None:

        return None

    try:

        # InsightFace 106-point eye contours.
        # Use the complete contour rather than six consecutive points.
        left_eye = landmarks[33:43]
        right_eye = landmarks[87:97]

    except IndexError:

        return None

    left_ear = eye_aspect_ratio(
        left_eye
    )

    right_ear = eye_aspect_ratio(
        right_eye
    )

    if (
        left_ear is None
        or
        right_ear is None
    ):

        return None

    return float(
        (
            left_ear
            +
            right_ear
        )
        /
        2.0
    )


# ============================================================
# LOOK-AWAY DETECTION
# ============================================================

def calculate_look_away(
    face
):

    kps = getattr(
        face,
        "kps",
        None
    )

    if kps is None:

        return (
            False,
            0.0
        )

    kps = np.asarray(
        kps,
        dtype=np.float32
    )

    if kps.shape[0] < 5:

        return (
            False,
            0.0
        )

    left_eye = kps[0]

    right_eye = kps[1]

    nose = kps[2]

    eye_mid = (
        left_eye
        +
        right_eye
    ) / 2.0

    eye_distance = distance(
        left_eye,
        right_eye
    )

    if eye_distance <= 1e-6:

        return (
            False,
            0.0
        )

    ratio = abs(
        float(
            nose[0]
            -
            eye_mid[0]
        )
    ) / eye_distance

    return (
        ratio > LOOK_AWAY_YAW_RATIO,
        ratio
    )


# ============================================================
# ADAPTIVE SLEEPING DETECTOR
# ============================================================

class SleepingDetector:

    """
    Improved sleeping detector.

    Instead of assuming every person's open-eye EAR is identical,
    this learns each student's normal EAR and detects a sustained
    decrease.

    Example:

        Normal EAR = 0.30
        Sleeping EAR = 0.15

    Adaptive threshold:

        0.30 * 0.72 = 0.216

    So the detector can recognize closed eyes even if the person's
    normal EAR is different from another student's.
    """

    def __init__(
        self,
        min_duration_seconds=5.0,
        grace_seconds=2.0,
        history_size=30,
        baseline_size=60,
        relative_threshold=0.72,
        absolute_threshold=0.20,
        minimum_open_ear=0.18
    ):

        self.min_duration_seconds = (
            float(min_duration_seconds)
        )

        self.grace_seconds = (
            float(grace_seconds)
        )

        self.history_size = (
            int(history_size)
        )

        self.baseline_size = (
            int(baseline_size)
        )

        self.relative_threshold = (
            float(relative_threshold)
        )

        self.absolute_threshold = (
            float(absolute_threshold)
        )

        self.minimum_open_ear = (
            float(minimum_open_ear)
        )

        self.samples = {}

        self.baselines = {}

        self.last_valid_ear = {}

        self.closed_since = {}

    # ========================================================
    # UPDATE
    # ========================================================

    def update(
        self,
        student_id,
        ear,
        now
    ):

        if (
            ear is None
            or
            not np.isfinite(ear)
        ):

            return False

        ear = float(
            ear
        )

        if (
            ear <= 0.0
            or
            ear > 1.0
        ):

            return False

        history = self.samples.setdefault(
            student_id,
            []
        )

        history.append(
            ear
        )

        if (
            len(history)
            >
            self.history_size
        ):

            del history[
                :-
                self.history_size
            ]

        self.last_valid_ear[
            student_id
        ] = ear

        baseline = self.baselines.get(
            student_id
        )

        # ----------------------------------------------------
        # Learn normal open-eye EAR
        # ----------------------------------------------------

        if (
            ear
            >=
            self.minimum_open_ear
        ):

            open_samples = [

                value

                for value in history

                if value
                >=
                self.minimum_open_ear
            ]

            if open_samples:

                recent_open = (
                    open_samples[
                        -self.baseline_size:
                    ]
                )

                candidate = float(
                    np.median(
                        recent_open
                    )
                )

                if baseline is None:

                    baseline = candidate

                else:

                    # Slow adaptation.
                    # Prevents closed eyes from immediately
                    # changing the baseline.

                    baseline = (
                        0.95
                        *
                        baseline
                        +
                        0.05
                        *
                        candidate
                    )

                self.baselines[
                    student_id
                ] = baseline

        # ----------------------------------------------------
        # Determine sleeping threshold
        # ----------------------------------------------------

        if baseline is None:

            threshold = (
                self.absolute_threshold
            )

        else:

            threshold = min(

                self.absolute_threshold,

                baseline
                *
                self.relative_threshold
            )

        # ----------------------------------------------------
        # Smooth EAR
        # ----------------------------------------------------

        recent = history[
            -5:
        ]

        smoothed_ear = float(
            np.median(
                recent
            )
        )

        sleeping_now = (
            smoothed_ear
            <
            threshold
        )

        # ----------------------------------------------------
        # Start sleeping state
        # ----------------------------------------------------

        if sleeping_now:

            if student_id not in (
                self.closed_since
            ):

                self.closed_since[
                    student_id
                ] = now

            return True

        # ----------------------------------------------------
        # Eyes open again
        # ----------------------------------------------------

        self.closed_since.pop(
            student_id,
            None
        )

        return False

    # ========================================================
    # DEBUG INFORMATION
    # ========================================================

    def get_debug(
        self,
        student_id
    ):

        return {

            "ear":
                self.last_valid_ear.get(
                    student_id
                ),

            "baseline":
                self.baselines.get(
                    student_id
                )
        }


    def get_state(self, student_id, now):
        """Return AWAKE, POSSIBLE SLEEPING, or SLEEPING."""
        closed_start = self.closed_since.get(student_id)
        if closed_start is None:
            return "AWAKE", 0.0

        closed_duration = max(0.0, now - closed_start)
        if closed_duration >= self.min_duration_seconds:
            return "SLEEPING", closed_duration

        return "POSSIBLE SLEEPING", closed_duration


# ============================================================
# GET ACTIVE TEACHER SESSION
# ============================================================

def get_session_by_id(session_id):
    try:
        response = requests.get(
            f"{API_URL}/sessions/{session_id}",
            timeout=5
        )
    except requests.exceptions.RequestException as error:
        print(f"Could not connect to FastAPI: {error}")
        return None

    if response.status_code != 200:
        print(f"Session #{session_id} not found: HTTP {response.status_code}")
        return None

    session = response.json()
    print()
    print("=" * 70)
    print(f"LOADED SESSION #{session['id']}")
    print("=" * 70)
    print(f"Subject    : {session.get('subject')}")
    print(f"Duration   : {session.get('duration_minutes')} minutes")
    print(f"Threshold  : {session.get('attendance_threshold', 0.70) * 100:.0f}%")
    print(f"Status     : {session.get('status')}")
    print("=" * 70)
    return session


def get_active_session():

    try:

        response = requests.get(

            f"{API_URL}/sessions/active",

            timeout=5
        )

    except requests.exceptions.RequestException as error:

        print(
            f"Could not connect to FastAPI: "
            f"{error}"
        )

        print(
            "Start FastAPI with:"
        )

        print(
            "uvicorn backend.main:app --reload"
        )

        return None

    if response.status_code != 200:

        print(
            "No active class session found."
        )

        print(
            f"HTTP {response.status_code}: "
            f"{response.text}"
        )

        print(
            "Create one in Swagger using "
            "POST /sessions/ first."
        )

        return None

    session = response.json()

    print()
    print("=" * 70)
    print("ACTIVE TEACHER SESSION")
    print("=" * 70)

    print(
        f"Session ID : "
        f"{session['id']}"
    )

    print(
        f"Subject    : "
        f"{session.get('subject')}"
    )

    print(
        f"Duration   : "
        f"{session['duration_minutes']} minutes"
    )

    print(
        f"Threshold  : "
        f"{session['attendance_threshold'] * 100:.0f}%"
    )

    print("=" * 70)

    return session


# ============================================================
# SEND BEHAVIOR EVENT TO FASTAPI
# ============================================================

def send_behavior_event_to_api(
    session_id,
    event
):

    data = {

        "session_id":
            session_id,

        "student_id":
            str(
                event["student_id"]
            ),

        "behavior":
            event["behavior"],

        "start_time":
            datetime.fromtimestamp(
                event["start_time"]
            ).isoformat(),

        "end_time":
            datetime.fromtimestamp(
                event["end_time"]
            ).isoformat(),

        "duration_seconds":
            round(
                float(
                    event[
                        "duration_seconds"
                    ]
                ),
                2
            ),

        "severity":
            "WARNING",

        "status":
            "RESOLVED"
    }

    try:

        response = requests.post(

            f"{API_URL}/behavior/",

            json=data,

            timeout=5
        )

    except requests.exceptions.RequestException as error:

        print(
            f"Behavior API connection error: "
            f"{error}"
        )

        return

    if response.status_code == 200:

        print(

            f"Behavior saved: "
            f"{event['behavior']} | "
            f"{event['student_name']} | "
            f"{event['duration_seconds']:.1f}s"
        )

    else:

        print(

            f"Behavior API error "
            f"{response.status_code}: "
            f"{response.text}"
        )


# ============================================================
# END API SESSION
# ============================================================

def end_api_session(
    session_id
):

    try:

        response = requests.post(

            f"{API_URL}/sessions/"
            f"{session_id}/end",

            timeout=5
        )

    except requests.exceptions.RequestException as error:

        print(
            f"Could not complete API session: "
            f"{error}"
        )

        return

    if response.status_code == 200:

        print(
            f"Session "
            f"{session_id} "
            f"marked COMPLETED."
        )

    elif response.status_code == 400 and "already completed" in response.text:

        print(
            f"Session {session_id} was already finalized by the web dashboard."
        )

    else:

        print(
            f"Could not complete session: "
            f"HTTP {response.status_code} "
            f"{response.text}"
        )


# ============================================================
# BEHAVIOR CONFIGURATION
# ============================================================

ATTENDANCE_DETECTION_GRACE_SECONDS = 2.0


# LOOK-AWAY

LOOK_AWAY_GRACE_SECONDS = 2.5

LOOK_AWAY_MIN_DURATION_SECONDS = 3.0

LOOK_AWAY_YAW_RATIO = 0.22


# SLEEPING

SLEEPING_GRACE_SECONDS = 2.0

SLEEPING_MIN_DURATION_SECONDS = 5.0

SLEEPING_EAR_THRESHOLD = 0.20


# ============================================================
# CAMERA / PRESENTATION CONFIGURATION
# ============================================================

CAMERA_WIDTH = 1280

CAMERA_HEIGHT = 720


DISPLAY_WIDTH = 1600

DISPLAY_HEIGHT = 900


WINDOW_NAME = (
    "Smart Classroom Live Analytics"
)


# ============================================================
# DRAW TEXT WITH BACKGROUND
# ============================================================

def draw_text_background(
    frame,
    text,
    position,
    font=cv2.FONT_HERSHEY_SIMPLEX,
    font_scale=0.55,
    text_color=(255, 255, 255),
    background_color=(0, 0, 0),
    thickness=1,
    padding=5
):

    x, y = position

    (
        text_width,
        text_height
    ), baseline = cv2.getTextSize(

        text,
        font,
        font_scale,
        thickness
    )

    x1 = max(
        0,
        x - padding
    )

    y1 = max(
        0,
        y - text_height - padding
    )

    x2 = min(

        frame.shape[1],

        x
        +
        text_width
        +
        padding
    )

    y2 = min(

        frame.shape[0],

        y
        +
        baseline
        +
        padding
    )

    cv2.rectangle(

        frame,

        (x1, y1),

        (x2, y2),

        background_color,

        -1
    )

    cv2.putText(

        frame,

        text,

        (x, y),

        font,

        font_scale,

        text_color,

        thickness,

        cv2.LINE_AA
    )


# ============================================================
# DRAW PRESENTATION DASHBOARD
# ============================================================

def draw_dashboard(
    frame,
    session_id,
    subject,
    elapsed,
    duration,
    threshold,
    students,
    attendance,
    now,
    phone_students,
    look_away_students,
    sleeping_students,
    possible_sleeping_students,
    fps
):

    height, width = (
        frame.shape[:2]
    )

    # --------------------------------------------------------
    # HEADER
    # --------------------------------------------------------

    header_height = 105

    cv2.rectangle(

        frame,

        (0, 0),

        (
            width,
            header_height
        ),

        (30, 30, 30),

        -1
    )

    cv2.putText(

        frame,

        "SMART CLASSROOM LIVE ANALYTICS",

        (25, 38),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.95,

        (255, 255, 255),

        2,

        cv2.LINE_AA
    )

    subject_text = (
        str(subject)
        if subject
        else
        "Class Session"
    )

    header_info = (

        f"Session: {session_id}"
        f"   |   "
        f"Subject: {subject_text}"
        f"   |   "
        f"Threshold: "
        f"{threshold * 100:.0f}%"
    )

    cv2.putText(

        frame,

        header_info,

        (25, 70),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.55,

        (230, 230, 230),

        1,

        cv2.LINE_AA
    )

    remaining = max(

        0,

        duration
        -
        elapsed
    )

    timer_text = (

        f"Elapsed "
        f"{format_time(elapsed)}"
        f" / "
        f"{format_time(duration)}"
        f"   |   "
        f"Remaining "
        f"{format_time(remaining)}"
        f"   |   "
        f"FPS {fps:.1f}"
    )

    cv2.putText(

        frame,

        timer_text,

        (25, 94),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.48,

        (230, 230, 230),

        1,

        cv2.LINE_AA
    )

    # --------------------------------------------------------
    # FOOTER
    # --------------------------------------------------------

    footer_height = 48

    footer_y = (
        height
        -
        footer_height
    )

    cv2.rectangle(

        frame,

        (0, footer_y),

        (width, height),

        (30, 30, 30),

        -1
    )

    active_phone = len(
        phone_students
    )

    active_look = len(
        look_away_students
    )

    active_sleep = len(
        sleeping_students
    )

    footer = (

        f"LIVE"
        f"  |  "
        f"Phone: {active_phone}"
        f"  |  "
        f"Look-away: {active_look}"
        f"  |  "
        f"Sleeping: {active_sleep}"
        f"  |  "
        f"Q: End Session"
        f"  |  "
        f"F: Fullscreen"
    )

    cv2.putText(

        frame,

        footer,

        (20, footer_y + 31),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.52,

        (255, 255, 255),

        1,

        cv2.LINE_AA
    )

    # --------------------------------------------------------
    # STUDENT PANEL
    # --------------------------------------------------------

    panel_x = 15

    panel_y = (
        header_height
        +
        15
    )

    row_height = 48

    panel_width = min(

        760,

        max(
            620,
            width // 2
        )
    )

    for index, (
        student_id,
        student_data
    ) in enumerate(
        students.items()
    ):

        y = (
            panel_y
            +
            index
            *
            row_height
        )

        if (
            y
            +
            row_height
            >=
            footer_y
            -
            5
        ):

            break

        presence, percentage = (
            get_live_presence(

                attendance,

                student_id,

                now
            )
        )

        record = (
            attendance.students.get(
                student_id
            )
        )

        if (
            record is not None
            and
            record[
                "currently_present"
            ]
        ):

            state = "IN CLASS"

        else:

            state = "NOT DETECTED"

        behavior = []

        if (
            student_id
            in
            phone_students
        ):

            behavior.append(
                "PHONE"
            )

        if (
            student_id
            in
            look_away_students
        ):

            behavior.append(
                "LOOK-AWAY"
            )

        if (
            student_id
            in
            sleeping_students
        ):

            behavior.append(
                "SLEEPING"
            )

        elif (
            student_id
            in
            possible_sleeping_students
        ):

            behavior.append(
                "POSSIBLE SLEEPING"
            )

        if behavior:

            behavior_text = (
                ", ".join(
                    behavior
                )
            )

        else:

            behavior_text = "NORMAL"

        cv2.rectangle(

            frame,

            (
                panel_x,
                y
            ),

            (
                panel_x
                +
                panel_width,

                y
                +
                row_height
                -
                5
            ),

            (245, 245, 245),

            -1
        )

        name = (
            student_data[
                "name"
            ]
        )

        text1 = (

            f"{name}"
            f"  |  "
            f"{student_id}"
        )

        text2 = (

            f"Presence "
            f"{format_time(presence)}"
            f"  |  "
            f"{percentage:.1f}%"
            f"  |  "
            f"{state}"
            f"  |  "
            f"{behavior_text}"
        )

        cv2.putText(

            frame,

            text1,

            (
                panel_x + 12,
                y + 19
            ),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.48,

            (20, 20, 20),

            1,

            cv2.LINE_AA
        )

        cv2.putText(

            frame,

            text2,

            (
                panel_x + 12,
                y + 39
            ),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.39,

            (20, 20, 20),

            1,

            cv2.LINE_AA
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print()

    print("=" * 70)

    print(
        "          SMART CLASSROOM LIVE ATTENDANCE"
    )

    print("=" * 70)

    # --------------------------------------------------------
    # GET TEACHER SESSION
    # --------------------------------------------------------

    parser = argparse.ArgumentParser(description="Smart Classroom AI Tracking Pipeline")
    parser.add_argument("--session-id", type=int, default=None, help="Target Class Session ID")
    cli_args, _ = parser.parse_known_args()

    target_session_id = cli_args.session_id or os.environ.get("TRACKER_SESSION_ID")
    if target_session_id:
        session = get_session_by_id(int(target_session_id))
    else:
        session = get_active_session()

    if session is None:
        print("ERROR: No valid class session available to track.")
        sys.exit(1)

    global CURRENT_SESSION_ID

    session_id = int(
        session["id"]
    )

    CURRENT_SESSION_ID = (
        session_id
    )

    class_duration_minutes = int(
        session[
            "duration_minutes"
        ]
    )

    attendance_threshold = float(
        session[
            "attendance_threshold"
        ]
    )

    subject = (
        session.get(
            "subject"
        )
        or
        "Class Session"
    )

    # --------------------------------------------------------
    # YOLO
    # --------------------------------------------------------

    print(
        "\nLoading YOLO..."
    )

    model = YOLO(
        MODEL_PATH
    )

    print(
        "YOLO loaded."
    )

    # --------------------------------------------------------
    # FACE RECOGNITION
    # --------------------------------------------------------

    print(
        "\nLoading Face Recognition..."
    )

    face_recognizer = (
        FaceRecognizer()
    )

    print(
        "Face Recognition loaded."
    )

    # --------------------------------------------------------
    # FACE DATABASE
    # --------------------------------------------------------

    print(
        "\nLoading enrolled students..."
    )

    face_database = (
        FaceDatabase()
    )

    students = (
        face_database.get_students()
    )

    print(
        f"Registered students: "
        f"{len(students)}"
    )

    if not students:

        print(
            "ERROR: "
            "No enrolled students found."
        )

        return

    # --------------------------------------------------------
    # ATTENDANCE
    # --------------------------------------------------------

    attendance = (
        PresenceAccumulator(

            class_duration_minutes=
                class_duration_minutes,

            attendance_threshold=
                attendance_threshold
        )
    )

    # --------------------------------------------------------
    # PHONE TRACKER
    # --------------------------------------------------------

    phone_tracker = (
        BehaviorTracker(

            "MOBILE_PHONE",

            PHONE_MIN_DURATION_SECONDS,

            PHONE_DETECTION_GRACE_SECONDS
        )
    )

    # --------------------------------------------------------
    # LOOK-AWAY TRACKER
    # --------------------------------------------------------

    look_away_tracker = (
        BehaviorTracker(

            "LOOK_AWAY",

            LOOK_AWAY_MIN_DURATION_SECONDS,

            LOOK_AWAY_GRACE_SECONDS
        )
    )

    # --------------------------------------------------------
    # SLEEPING TRACKER
    # --------------------------------------------------------

    sleeping_tracker = (
        BehaviorTracker(

            "SLEEPING",

            SLEEPING_MIN_DURATION_SECONDS,

            SLEEPING_GRACE_SECONDS
        )
    )

    # --------------------------------------------------------
    # SLEEPING DETECTOR
    # --------------------------------------------------------

    sleeping_detector = (
        SleepingDetector(

            min_duration_seconds=
                SLEEPING_MIN_DURATION_SECONDS,

            grace_seconds=
                SLEEPING_GRACE_SECONDS,

            relative_threshold=
                0.72,

            absolute_threshold=
                SLEEPING_EAR_THRESHOLD,

            minimum_open_ear=
                0.18
        )
    )

    # --------------------------------------------------------
    # RECOGNITION STATE
    # --------------------------------------------------------

    last_recognized = {}

    track_identity = {}

    # --------------------------------------------------------
    # CAMERA
    # --------------------------------------------------------

    print(
        "\nOpening camera..."
    )

    camera = cv2.VideoCapture(
        CAMERA_INDEX
    )

    if not camera.isOpened():

        print(
            "ERROR: "
            "Could not open camera."
        )

        sys.exit(1)

    # --------------------------------------------------------
    # REQUEST HIGHER CAMERA RESOLUTION
    # --------------------------------------------------------

    camera.set(
        cv2.CAP_PROP_FRAME_WIDTH,
        CAMERA_WIDTH
    )

    camera.set(
        cv2.CAP_PROP_FRAME_HEIGHT,
        CAMERA_HEIGHT
    )

    camera.set(
        cv2.CAP_PROP_BUFFERSIZE,
        1
    )

    actual_width = int(
        camera.get(
            cv2.CAP_PROP_FRAME_WIDTH
        )
    )

    actual_height = int(
        camera.get(
            cv2.CAP_PROP_FRAME_HEIGHT
        )
    )

    print(
        f"Camera resolution: "
        f"{actual_width}x"
        f"{actual_height}"
    )

    print(
        "Camera opened."
    )

    # --------------------------------------------------------
    # RESIZABLE WINDOW (Skipped in headless mode)
    # --------------------------------------------------------

    if not IS_HEADLESS:
        cv2.namedWindow(
            WINDOW_NAME,
            cv2.WINDOW_NORMAL
            |
            cv2.WINDOW_KEEPRATIO
        )

        cv2.resizeWindow(
            WINDOW_NAME,
            DISPLAY_WIDTH,
            DISPLAY_HEIGHT
        )

    # --------------------------------------------------------
    # START ATTENDANCE
    # --------------------------------------------------------

    attendance.start_class()

    print()

    print("=" * 70)

    print(
        "LIVE ATTENDANCE STARTED"
    )

    print("=" * 70)

    print(
        f"Session ID: "
        f"{session_id}"
    )

    print(
        f"Subject: "
        f"{subject}"
    )

    print(
        f"Class duration: "
        f"{class_duration_minutes} minutes"
    )

    print(
        f"Attendance threshold: "
        f"{attendance_threshold * 100:.0f}%"
    )

    print(
        f"Required presence: "
        f"{class_duration_minutes * attendance_threshold:.2f} minutes"
    )

    print(
        f"Phone minimum duration: "
        f"{PHONE_MIN_DURATION_SECONDS:.1f}s"
    )

    print(
        f"Look-away minimum duration: "
        f"{LOOK_AWAY_MIN_DURATION_SECONDS:.1f}s"
    )

    print(
        f"Sleeping minimum duration: "
        f"{SLEEPING_MIN_DURATION_SECONDS:.1f}s"
    )

    print(
        f"Camera target: "
        f"{CAMERA_WIDTH}x"
        f"{CAMERA_HEIGHT}"
    )

    print(
        f"Display window: "
        f"{DISPLAY_WIDTH}x"
        f"{DISPLAY_HEIGHT}"
    )

    print(
        "Press Q to end the session."
    )

    print(
        "Press F to toggle fullscreen."
    )

    print("=" * 70)

    fullscreen = False

    fps_time = time.time()

    fps_frames = 0

    fps = 0.0

    # FPS optimization: run InsightFace every second frame.
    # Reuse the most recent face detections on intervening frames.
    frame_counter = 0
    cached_faces = []
    FACE_DETECTION_INTERVAL = 2
    last_attendance_sync = time.time()

    # ========================================================
    # MAIN LOOP
    # ========================================================

    while True:
        # Check backend stop request or stop flag
        if _stop_requested or (STOP_FLAG_PATH.exists() and STOP_FLAG_PATH.is_file()):
            print("\n[AI Tracker] Stop flag detected from backend. Finalizing session...")
            break

        success, frame = (
            camera.read()
        )

        if not success:

            print(
                "Could not read camera."
            )

            break

        now = time.time()

        elapsed = (
            now
            -
            attendance.class_start_time
        )

        # ----------------------------------------------------
        # END WHEN CLASS DURATION COMPLETES
        # ----------------------------------------------------

        if (
            elapsed
            >=
            attendance.class_duration_seconds
        ):

            print(
                "Class duration completed."
            )

            break

        # ----------------------------------------------------
        # FPS
        # ----------------------------------------------------

        fps_frames += 1

        fps_elapsed = (
            now
            -
            fps_time
        )

        if fps_elapsed >= 1.0:

            fps = (
                fps_frames
                /
                fps_elapsed
            )

            fps_frames = 0

            fps_time = now

        # ----------------------------------------------------
        # YOLO
        #
        # IMPORTANT:
        #
        # classes=[0, 67]
        #
        # means:
        #
        # 0  = person
        # 67 = mobile phone
        # ----------------------------------------------------

        results = model.track(

            frame,

            persist=True,

            # Smaller inference size reduces YOLO compute cost.
            # Ultralytics rescales boxes back to the original frame.
            imgsz=480,

            classes=[
                0,
                PHONE_CLASS_ID
            ],

            verbose=False
        )

        result = results[0]

        people = []

        phones = []

        # ----------------------------------------------------
        # EXTRACT YOLO RESULTS
        # ----------------------------------------------------

        if result.boxes is not None:

            boxes = (
                result
                .boxes
                .xyxy
                .cpu()
                .numpy()
            )

            class_ids = (
                result
                .boxes
                .cls
                .int()
                .cpu()
                .tolist()
            )

            if (
                result.boxes.id
                is not None
            ):

                track_ids = (

                    result
                    .boxes
                    .id
                    .int()
                    .cpu()
                    .tolist()
                )

            else:

                track_ids = [
                    None
                    for _ in boxes
                ]

            for (
                box,
                class_id,
                track_id
            ) in zip(

                boxes,
                class_ids,
                track_ids
            ):

                x1, y1, x2, y2 = (
                    box.astype(int)
                )

                # PERSON

                if (
                    class_id == 0
                    and
                    track_id is not None
                ):

                    people.append({

                        "bbox":
                            (
                                x1,
                                y1,
                                x2,
                                y2
                            ),

                        "track_id":
                            int(track_id)
                    })

                # PHONE

                elif (
                    class_id
                    ==
                    PHONE_CLASS_ID
                ):

                    phones.append({

                        "bbox":
                            (
                                x1,
                                y1,
                                x2,
                                y2
                            )
                    })

        # ----------------------------------------------------
        # FACE DETECTION
        # ----------------------------------------------------

        frame_counter += 1

        if frame_counter % FACE_DETECTION_INTERVAL == 1:
            cached_faces = face_recognizer.detect_faces(frame)

        faces = cached_faces

        detected_students = set()

        phone_students = set()

        look_away_students = set()

        sleeping_students = set()

        possible_sleeping_students = set()

        # ====================================================
        # PROCESS EACH FACE
        # ====================================================

        for face in faces:

            track_id = (
                find_person_for_face(
                    face,
                    people
                )
            )

            (
                name,
                student_id,
                score
            ) = recognize_face(
                face,
                students
            )

            if (
                track_id is None
                or
                student_id is None
            ):

                continue

            # ------------------------------------------------
            # SAVE TRACK IDENTITY
            # ------------------------------------------------

            track_identity[
                track_id
            ] = {

                "student_id":
                    student_id,

                "name":
                    name,

                "score":
                    score
            }

            detected_students.add(
                student_id
            )

            last_recognized[
                student_id
            ] = now

            # ------------------------------------------------
            # ATTENDANCE
            # ------------------------------------------------

            attendance.update_presence(

                student_id,

                name,

                True,

                now
            )

            # =================================================
            # LOOK-AWAY
            # =================================================

            (
                is_away,
                yaw_ratio
            ) = calculate_look_away(
                face
            )

            if is_away:

                look_away_students.add(
                    student_id
                )

            # =================================================
            # SLEEPING
            # =================================================

            ear = calculate_face_ear(face)

            eyes_appear_closed = sleeping_detector.update(
                student_id,
                ear,
                now
            )

            sleep_state, sleep_seconds = sleeping_detector.get_state(
                student_id,
                now
            )

            if eyes_appear_closed:
                if sleep_state == "SLEEPING":
                    sleeping_students.add(student_id)
                else:
                    possible_sleeping_students.add(student_id)

            # =================================================
            # PHONE
            # =================================================

            person = next(

                (
                    p

                    for p in people

                    if p[
                        "track_id"
                    ]
                    ==
                    track_id
                ),

                None
            )

            if person is not None:

                for phone in phones:

                    if phone_inside_person(

                        phone[
                            "bbox"
                        ],

                        person[
                            "bbox"
                        ]
                    ):

                        phone_students.add(
                            student_id
                        )

                        break

            # =================================================
            # FACE BOX
            # =================================================

            x1, y1, x2, y2 = (
                face.bbox.astype(int)
            )

            cv2.rectangle(

                frame,

                (x1, y1),

                (x2, y2),

                (0, 255, 0),

                2
            )

            # =================================================
            # BEHAVIOR LABEL
            # =================================================

            behavior_text = []

            if (
                student_id
                in
                phone_students
            ):

                behavior_text.append(
                    "PHONE"
                )

            if (
                student_id
                in
                look_away_students
            ):

                behavior_text.append(
                    "LOOK-AWAY"
                )

            if (
                student_id
                in
                sleeping_students
            ):

                behavior_text.append(
                    "SLEEPING"
                )

            label = (
                f"{name}"
                f" | "
                f"{score:.2f}"
            )

            sleep_debug = sleeping_detector.get_debug(student_id)
            ear_value = sleep_debug.get("ear")
            if ear_value is None:
                label += " | EAR N/A | AWAKE"
            else:
                label += f" | EAR {ear_value:.3f} | {sleep_state}"
                if sleep_state != "AWAKE":
                    label += f" {sleep_seconds:.1f}s"

            if behavior_text:

                label += (

                    " | "
                    +
                    ",".join(
                        behavior_text
                    )
                )

            draw_text_background(

                frame,

                label,

                (
                    x1,
                    max(
                        25,
                        y1
                    )
                ),

                font_scale=0.55,

                text_color=(
                    0,
                    0,
                    0
                ),

                background_color=(
                    255,
                    255,
                    255
                ),

                thickness=1
            )

        # ====================================================
        # ATTENDANCE GRACE
        # ====================================================

        for (
            student_id,
            student_data
        ) in students.items():

            if (
                student_id
                in
                detected_students
            ):

                continue

            last_seen = (
                last_recognized.get(
                    student_id
                )
            )

            if (

                last_seen is not None

                and

                now
                -
                last_seen
                <=
                ATTENDANCE_DETECTION_GRACE_SECONDS

            ):

                continue

            attendance.update_presence(

                student_id,

                student_data[
                    "name"
                ],

                False,

                now
            )

        # ====================================================
        # UPDATE BEHAVIOR TRACKERS
        # ====================================================

        for (
            student_id,
            student_data
        ) in students.items():

            name = (
                student_data[
                    "name"
                ]
            )

            phone_tracker.update(

                student_id,

                name,

                student_id
                in
                phone_students,

                now
            )

            look_away_tracker.update(

                student_id,

                name,

                student_id
                in
                look_away_students,

                now
            )

            sleeping_tracker.update(

                student_id,

                name,

                (
                    student_id in sleeping_students
                    or student_id in possible_sleeping_students
                ),

                now
            )

        # ====================================================
        # SEND COMPLETED BEHAVIOR EVENTS
        # ====================================================

        for tracker in (

            phone_tracker,

            look_away_tracker,

            sleeping_tracker

        ):

            for event in (
                tracker.pop_events()
            ):

                send_behavior_event_to_api(

                    session_id,

                    event
                )

        # ====================================================
        # PERSON BOXES
        # ====================================================

        for person in people:

            x1, y1, x2, y2 = (
                person["bbox"]
            )

            track_id = (
                person[
                    "track_id"
                ]
            )

            identity = (
                track_identity.get(
                    track_id
                )
            )

            cv2.rectangle(

                frame,

                (x1, y1),

                (x2, y2),

                (255, 0, 0),

                2
            )

        # ====================================================
        # PHONE BOXES
        # ====================================================

        for phone in phones:

            x1, y1, x2, y2 = (
                phone["bbox"]
            )

            cv2.rectangle(

                frame,

                (x1, y1),

                (x2, y2),

                (0, 0, 255),

                3
            )

            draw_text_background(

                frame,

                "PHONE",

                (
                    x1,
                    max(
                        25,
                        y1
                    )
                ),

                font_scale=0.60,

                text_color=(
                    255,
                    255,
                    255
                ),

                background_color=(
                    0,
                    0,
                    180
                ),

                thickness=2
            )

        # ====================================================
        # PRESENTATION DASHBOARD
        # ====================================================

        draw_dashboard(

            frame,

            session_id,

            subject,

            elapsed,

            attendance.class_duration_seconds,

            attendance_threshold,

            students,

            attendance,

            now,

            phone_students,

            look_away_students,

            sleeping_students,

            possible_sleeping_students,

            fps
        )

        # ====================================================
        # LIVE STREAM & ATTENDANCE SYNC
        # ====================================================

        push_frame_to_stream(frame)

        # Periodic live attendance sync to backend (every 5 seconds)
        if now - last_attendance_sync >= 5.0:
            last_attendance_sync = now
            trigger_async_attendance_sync(session_id, attendance, now)

        if not IS_HEADLESS:
            cv2.imshow(
                WINDOW_NAME,
                frame
            )

            key = (
                cv2.waitKey(1)
                &
                0xFF
            )

            # ----------------------------------------------------
            # Q = END SESSION
            # ----------------------------------------------------

            if key == ord("q"):

                print(
                    "Q pressed. "
                    "Ending session..."
                )

                break

            # ----------------------------------------------------
            # F = FULLSCREEN
            # ----------------------------------------------------

            elif key == ord("f"):

                fullscreen = (
                    not fullscreen
                )

                if fullscreen:

                    cv2.setWindowProperty(

                        WINDOW_NAME,

                        cv2.WND_PROP_FULLSCREEN,

                        cv2.WINDOW_FULLSCREEN
                    )

                else:

                    cv2.setWindowProperty(

                        WINDOW_NAME,

                        cv2.WND_PROP_FULLSCREEN,

                        cv2.WINDOW_NORMAL
                    )

                    cv2.resizeWindow(

                        WINDOW_NAME,

                        DISPLAY_WIDTH,

                        DISPLAY_HEIGHT
                    )
        else:
            # Yield CPU slightly in headless mode
            time.sleep(0.005)

    # ========================================================
    # CLEANUP
    # ========================================================

    now = time.time()

    phone_tracker.finish_all(
        now
    )

    look_away_tracker.finish_all(
        now
    )

    sleeping_tracker.finish_all(
        now
    )

    for tracker in (

        phone_tracker,

        look_away_tracker,

        sleeping_tracker

    ):

        for event in (
            tracker.pop_events()
        ):

            send_behavior_event_to_api(

                session_id,

                event
            )

    # --------------------------------------------------------
    # FINALIZE ATTENDANCE
    # --------------------------------------------------------

    attendance.finalize_presence(
        now
    )

    try:
        camera.release()
    except Exception:
        pass

    if not IS_HEADLESS:
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass

    # ========================================================
    # FINAL ATTENDANCE
    # ========================================================

    final_results = attendance.calculate_attendance()

    # Normalize attendance result keys to strings so they match the
    # student IDs returned by PostgreSQL, regardless of original key type.
    final_results = {str(student_id): data for student_id, data in final_results.items()}

    # Ensure every enrolled student gets a final attendance record,
    # including students who were never recognized during this session.
    print(f"Attendance results before adding missing students: {len(final_results)}")
    print(f"Enrolled students loaded from database: {len(students)}")

    for student_id, student_data in students.items():
        student_id = str(student_id)
        if student_id not in final_results:
            final_results[student_id] = {
                "name": student_data.get("name", student_data.get("student_name", "Unknown")),
                "total_presence_seconds": 0.0,
                "presence_minutes": 0.0,
                "presence_percentage": 0.0,
                "status": "ABSENT",
            }
            print(f"Added missing attendance result: {student_id} ({final_results[student_id]['name']})")

    print(f"Final attendance records to submit: {len(final_results)}")

    print()

    print("=" * 70)

    print(
        "                 FINAL ATTENDANCE"
    )

    print("=" * 70)

    for (
        student_id,
        data
    ) in final_results.items():

        print(

            f"{data['name']}"
            f" | "
            f"{student_id}"
            f" | "
            f"{data['presence_minutes']:.2f}"
            f" min"
            f" | "
            f"{data['presence_percentage']:.2f}%"
            f" | "
            f"{data['status']}"
        )

    print("=" * 70)

    # ========================================================
    # SEND FINAL ATTENDANCE
    # ========================================================

    print()

    print(
        "SENDING FINAL ATTENDANCE TO FASTAPI"
    )

    submission_failures = []

    for student_id, data in final_results.items():
        result = send_attendance_to_api(
            student_id,
            data["total_presence_seconds"]
        )
        if result is None:
            submission_failures.append(str(student_id))

    if submission_failures:
        print("WARNING: Attendance submission failed for student IDs: " + ", ".join(submission_failures))
    else:
        print(f"Attendance submission completed for all {len(final_results)} students.")

    # ========================================================
    # COMPLETE TEACHER SESSION
    # ========================================================

    end_api_session(
        session_id
    )

    print()

    print("=" * 70)

    print(
        "       ATTENDANCE SESSION COMPLETED"
    )

    print("=" * 70)


# ============================================================
# PROGRAM ENTRY
# ============================================================

if __name__ == "__main__":

    main()

