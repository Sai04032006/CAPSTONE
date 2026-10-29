from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database.database import (
    Base,
    engine
)

from .database import models


# ============================================================
# ROUTES
# ============================================================

from .routes.students import (
    router as student_router
)

from .routes.sessions import (
    router as session_router
)

from .routes.attendance import (
    router as attendance_router
)

from .routes.behavior import (
    router as behavior_router
)

from .routes.analytics import (
    router as analytics_router
)

from .routes.stream import (
    router as stream_router
)


# ============================================================
# CREATE DATABASE TABLES
# ============================================================

Base.metadata.create_all(
    bind=engine
)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Smart Classroom Analytics API",

    description=(
        "Backend API for Smart Classroom Analytics, "
        "Attendance, Behavior and Student Analytics"
    ),

    version="1.0.0"
)


# ============================================================
# CORS MIDDLEWARE
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# INCLUDE ROUTERS
# ============================================================

app.include_router(
    student_router
)

app.include_router(
    session_router
)

app.include_router(
    attendance_router
)

app.include_router(
    behavior_router
)

app.include_router(
    analytics_router
)

app.include_router(
    stream_router
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message":
            "Smart Classroom Analytics API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy"
    }