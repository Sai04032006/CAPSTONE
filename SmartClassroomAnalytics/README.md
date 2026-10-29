# CAPSTONE

# Smart Classroom Analytics Platform

An intelligent, full-stack classroom monitoring and analytics platform that combines computer vision, deep learning face recognition, and real-time attendance calculation.

---

## 🌟 Key Features

- **Automated AI Camera Tracking**: Starting a session from the web dashboard automatically launches the YOLOv11 + InsightFace tracking pipeline in the background without needing PyCharm or manual terminal execution.
- **Real-Time Video Streaming**: Streams annotated camera frames (YOLO bounding boxes, recognized student names, distraction indicators) directly to the browser via MJPEG.
- **Deep Face Recognition**: 512-dimensional facial embeddings powered by InsightFace, stored and searched in PostgreSQL using `pgvector` with cosine similarity (threshold: `0.45`).
- **Presence & Attendance Accumulation**: Continuously tracks face presence throughout the class. Automatically marks students as `PRESENT` if they meet the required duration threshold (default: `70%`), or `ABSENT` otherwise.
- **Distraction & Behavior Monitoring**: Real-time phone detection (YOLO COCO class 67) with grace periods and duration thresholds to log infractions.
- **Full-Featured React Dashboard**: 7 comprehensive views including Dashboard, Live Monitoring, Student Management, Attendance Reports, Session History, Analytics & Behavioral Trends, and Settings.
- **Graceful Lifecycle Management**: Clean camera release and database persistence upon session completion.

---

## 🏗️ Architecture

```
SmartClassroom/
├── SmartClassroomAnalytics/
│   ├── ai/
│   │   ├── attendance/         # Presence accumulator & attendance math
│   │   ├── integration/        # identity_tracking_test.py (YOLO + InsightFace)
│   │   └── recognition/         # InsightFace recognizer & vector database
│   ├── backend/
│   │   ├── database/           # SQLAlchemy models & PostgreSQL connection
│   │   ├── routes/             # FastAPI routes (sessions, stream, attendance, behavior, students)
│   │   ├── schemas/            # Pydantic validation schemas
│   │   ├── services/           # tracker_manager.py (Process lifecycle)
│   │   └── main.py             # FastAPI entrypoint
│   ├── frontend/               # React + Vite + Tailwind CSS Web Application
│   │   ├── src/
│   │   │   ├── api/            # Axios API clients
│   │   │   ├── components/     # UI components (Navbar, Sidebar, Cards, Badges, Modals)
│   │   │   ├── pages/          # 7 Application pages
│   │   │   └── App.jsx
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── storage/                # Logs & runtime flags
│   └── migrate_embeddings.py   # Embedding migration utility
├── .gitignore
└── README.md
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 8, Tailwind CSS, Lucide React, Chart.js, Axios |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, Pydantic |
| **Database** | PostgreSQL 18, `pgvector` extension |
| **Computer Vision** | YOLOv11 (Ultralytics), InsightFace (512-d embeddings), OpenCV |

---

## 🚀 Quick Start Guide

### 1. Database Setup
Ensure PostgreSQL is running with the `pgvector` extension installed:
```sql
CREATE DATABASE smart_classroom;
\c smart_classroom;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Backend Setup
Activate your Python virtual environment and run the backend:
```powershell
cd SmartClassroomAnalytics
# Activate virtual environment
..\.venv\Scripts\Activate.ps1
# Start FastAPI backend
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
In a new terminal:
```powershell
cd SmartClassroomAnalytics\frontend
npm install
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 📹 How It Works

1. **Teacher Creates Session**: In the **Live Monitoring** page, click **"Start Session"**.
2. **Subprocess Bootstrapping**: FastAPI automatically launches `ai/integration/identity_tracking_test.py --session-id <id>` in the background.
3. **Camera Processing**: The AI process opens webcam 0, runs YOLO person detection and InsightFace recognition, and pushes JPEG frames to `POST /stream/frame`.
4. **Browser Streaming**: The web UI receives the stream at `GET /stream/video` and displays real-time overlays.
5. **Periodic Presence Sync**: Every 5 seconds, accumulated presence is pushed to `POST /attendance/` so live metrics update in real time.
6. **Session Teardown**: When the teacher clicks **"End Session"**, the AI process finalizes attendance calculations, releases the camera, and saves final records to PostgreSQL.

---

## 📄 License

This project is developed as an academic Capstone project.
