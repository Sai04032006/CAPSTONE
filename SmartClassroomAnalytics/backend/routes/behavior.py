from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from ..database.database import get_db

from ..database.models import (
    BehaviorEvent,
    ClassSession,
    Student
)

from ..schemas.behavior import (
    BehaviorEventCreate,
    BehaviorEventResponse
)


router = APIRouter(
    prefix="/behavior",
    tags=["Behavior"]
)


# ============================================================
# CREATE BEHAVIOR EVENT
# ============================================================

@router.post(
    "/",
    response_model=BehaviorEventResponse
)
def create_behavior_event(
    behavior_data: BehaviorEventCreate,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # CHECK CLASS SESSION
    # --------------------------------------------------------

    session = (
        db.query(ClassSession)
        .filter(
            ClassSession.id ==
            behavior_data.session_id
        )
        .first()
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Class session not found"
        )

    # --------------------------------------------------------
    # CHECK STUDENT
    # --------------------------------------------------------

    student = (
        db.query(Student)
        .filter(
            Student.student_id ==
            behavior_data.student_id
        )
        .first()
    )

    if not student:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # --------------------------------------------------------
    # VALIDATE DURATION
    # --------------------------------------------------------

    if behavior_data.duration_seconds < 0:

        raise HTTPException(
            status_code=400,
            detail="Duration cannot be negative"
        )

    # --------------------------------------------------------
    # CREATE EVENT
    # --------------------------------------------------------

    new_event = BehaviorEvent(

        session_id=
            behavior_data.session_id,

        student_id=
            behavior_data.student_id,

        behavior=
            behavior_data.behavior,

        start_time=
            behavior_data.start_time,

        end_time=
            behavior_data.end_time,

        duration_seconds=
            behavior_data.duration_seconds,

        severity=
            behavior_data.severity,

        status=
            behavior_data.status
    )

    db.add(new_event)

    db.commit()

    db.refresh(new_event)

    return new_event


# ============================================================
# GET ALL BEHAVIOR EVENTS FOR SESSION
# ============================================================

@router.get(
    "/session/{session_id}",
    response_model=list[BehaviorEventResponse]
)
def get_session_behavior_events(
    session_id: int,
    db: Session = Depends(get_db)
):

    # Check session

    session = (
        db.query(ClassSession)
        .filter(
            ClassSession.id ==
            session_id
        )
        .first()
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Class session not found"
        )

    return (
        db.query(BehaviorEvent)
        .filter(
            BehaviorEvent.session_id ==
            session_id
        )
        .order_by(
            BehaviorEvent.start_time.asc()
        )
        .all()
    )


# ============================================================
# GET BEHAVIOR EVENTS FOR STUDENT
# ============================================================

@router.get(
    "/student/{student_id}",
    response_model=list[BehaviorEventResponse]
)
def get_student_behavior_events(
    student_id: str,
    db: Session = Depends(get_db)
):

    student = (
        db.query(Student)
        .filter(
            Student.student_id ==
            student_id
        )
        .first()
    )

    if not student:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return (
        db.query(BehaviorEvent)
        .filter(
            BehaviorEvent.student_id ==
            student_id
        )
        .order_by(
            BehaviorEvent.start_time.desc()
        )
        .all()
    )