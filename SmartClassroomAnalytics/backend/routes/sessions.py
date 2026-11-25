from ..services.tracker_manager import tracker_manager
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from ..database.database import get_db

from ..database.models import ClassSession

from ..schemas.session import (
    SessionCreate,
    SessionResponse
)


router = APIRouter(
    prefix="/sessions",
    tags=["Class Sessions"]
)


# ============================================================
# CREATE CLASS SESSION
# ============================================================

@router.post(
    "/",
    response_model=SessionResponse
)
def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Validate duration
    # --------------------------------------------------------

    if session_data.duration_minutes <= 0:

        raise HTTPException(
            status_code=400,
            detail="Duration must be greater than 0"
        )

    # --------------------------------------------------------
    # Check whether another session is already active
    # --------------------------------------------------------

    active_session = (
        db.query(ClassSession)
        .filter(
            ClassSession.status == "ACTIVE"
        )
        .first()
    )

    if active_session:

        raise HTTPException(
            status_code=400,
            detail=(
                f"An active class session already exists "
                f"with session_id={active_session.id}"
            )
        )

    # --------------------------------------------------------
    # CREATE SESSION
    #
    # Attendance threshold is FIXED at 70%.
    # Teacher does not select this value.
    # --------------------------------------------------------

    new_session = ClassSession(

        subject=session_data.subject,

        teacher_id=session_data.teacher_id,

        teacher_name=session_data.teacher_name,

        duration_minutes=
            session_data.duration_minutes,

        attendance_threshold=0.70,

        started_at=datetime.utcnow(),

        status="ACTIVE"
    )

    db.add(new_session)

    db.commit()

    db.refresh(new_session)

    # Automatically launch AI camera tracking process
    try:
        tracker_manager.start_tracker(new_session.id)
    except Exception as err:
        print(f"Failed to auto-start tracker: {err}")

    return new_session


# ============================================================
# GET ALL SESSIONS
# ============================================================

@router.get(
    "/",
    response_model=list[SessionResponse]
)
def get_sessions(
    teacher_id: str | None = None,
    db: Session = Depends(get_db)
):

    query = db.query(ClassSession)

    if teacher_id:
        query = query.filter(ClassSession.teacher_id == teacher_id)

    return (
        query.order_by(
            ClassSession.id.desc()
        )
        .all()
    )


# ============================================================
# GET ACTIVE SESSION
# ============================================================

@router.get(
    "/active",
    response_model=SessionResponse
)
def get_active_session(
    teacher_id: str | None = None,
    db: Session = Depends(get_db)
):

    query = (
        db.query(ClassSession)
        .filter(
            ClassSession.status == "ACTIVE"
        )
    )

    if teacher_id:
        query = query.filter(ClassSession.teacher_id == teacher_id)

    session = query.order_by(
        ClassSession.id.desc()
    ).first()

    if not session:

        raise HTTPException(
            status_code=404,
            detail="No active class session found"
        )

    return session


# ============================================================
# GET SESSION BY ID
# ============================================================

@router.get(
    "/{session_id}",
    response_model=SessionResponse
)
def get_session(
    session_id: int,
    db: Session = Depends(get_db)
):

    session = (
        db.query(ClassSession)
        .filter(
            ClassSession.id == session_id
        )
        .first()
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Class session not found"
        )

    return session


# ============================================================
# END CLASS SESSION
# ============================================================

@router.post(
    "/{session_id}/end",
    response_model=SessionResponse
)
def end_session(
    session_id: int,
    db: Session = Depends(get_db)
):

    session = (
        db.query(ClassSession)
        .filter(
            ClassSession.id == session_id
        )
        .first()
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Class session not found"
        )

    if session.status == "COMPLETED":

        raise HTTPException(
            status_code=400,
            detail=(
                "Class session is already completed"
            )
        )

    # --------------------------------------------------------
    # End session
    # --------------------------------------------------------

    session.ended_at = datetime.utcnow()

    session.status = "COMPLETED"

    db.commit()

    db.refresh(session)

    # Automatically stop AI camera tracking process and release camera
    try:
        tracker_manager.stop_tracker(session_id)
    except Exception as err:
        print(f"Failed to auto-stop tracker: {err}")

    return session

# ============================================================
# AI TRACKER STATUS & LIFECYCLE ENDPOINTS
# ============================================================

@router.get("/tracker/status")
def get_tracker_status():
    """
    Returns real-time status of the AI camera tracking process
    (IDLE, STARTING, RUNNING, STOPPED, FAILED), active PID, errors, and recent logs.
    """
    return tracker_manager.get_status()


@router.post("/{session_id}/tracker/start")
def start_session_tracker(session_id: int, db: Session = Depends(get_db)):
    """
    Explicitly starts or restarts the AI tracking pipeline for an active class session.
    """
    session = (
        db.query(ClassSession)
        .filter(ClassSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Class session not found"
        )
    if session.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Cannot start AI tracking on a completed or inactive session"
        )
    return tracker_manager.start_tracker(session_id)


@router.post("/{session_id}/tracker/stop")
def stop_session_tracker(session_id: int):
    """
    Explicitly stops the AI tracking pipeline and releases camera resources.
    """
    return tracker_manager.stop_tracker(session_id)
