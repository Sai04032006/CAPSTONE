from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from sqlalchemy import func

from ..database.database import get_db

from ..database.models import (
    Student,
    Attendance,
    ClassSession
)

from ..schemas.analytics import (
    SessionAnalyticsResponse,
    StudentAnalyticsResponse,
    BehaviorAnalyticsResponse
)


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


# ============================================================
# SESSION ANALYTICS
# ============================================================

@router.get(
    "/session/{session_id}",
    response_model=SessionAnalyticsResponse
)
def get_session_analytics(
    session_id: int,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check session
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Total students
    # --------------------------------------------------------

    total_students = (
        db.query(Student)
        .count()
    )

    # --------------------------------------------------------
    # Attendance records
    # --------------------------------------------------------

    attendance_records = (
        db.query(Attendance)
        .filter(
            Attendance.session_id ==
            session_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Present / absent
    # --------------------------------------------------------

    present_students = sum(

        1
        for record in attendance_records

        if record.status == "PRESENT"
    )

    absent_students = sum(

        1
        for record in attendance_records

        if record.status == "ABSENT"
    )

    # --------------------------------------------------------
    # Students without attendance record
    # are also considered absent for analytics.
    # --------------------------------------------------------

    recorded_students = len(
        attendance_records
    )

    if total_students > recorded_students:

        absent_students += (
            total_students
            -
            recorded_students
        )

    # --------------------------------------------------------
    # Attendance percentage
    # --------------------------------------------------------

    if total_students > 0:

        attendance_percentage = (

            present_students
            /
            total_students

        ) * 100

    else:

        attendance_percentage = 0.0

    # --------------------------------------------------------
    # Behavior events
    #
    # We query dynamically so this module works with
    # the BehaviorEvent model you already added.
    # --------------------------------------------------------

    try:

        from ..database.models import (
            BehaviorEvent
        )

        total_behavior_events = (

            db.query(BehaviorEvent)
            .filter(
                BehaviorEvent.session_id ==
                session_id
            )
            .count()
        )

    except (
        ImportError,
        AttributeError
    ):

        total_behavior_events = 0

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return SessionAnalyticsResponse(

        session_id=session_id,

        total_students=total_students,

        present_students=present_students,

        absent_students=absent_students,

        attendance_percentage=round(
            attendance_percentage,
            2
        ),

        total_behavior_events=
            total_behavior_events
    )


# ============================================================
# STUDENT ANALYTICS
# ============================================================

@router.get(
    "/student/{student_id}",
    response_model=StudentAnalyticsResponse
)
def get_student_analytics(
    student_id: str,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Find student
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Total class sessions
    # --------------------------------------------------------

    total_sessions = (
        db.query(ClassSession)
        .count()
    )

    # --------------------------------------------------------
    # Attendance
    # --------------------------------------------------------

    attendance_records = (
        db.query(Attendance)
        .filter(
            Attendance.student_id ==
            student_id
        )
        .all()
    )

    present_sessions = sum(

        1
        for record in attendance_records

        if record.status == "PRESENT"
    )

    absent_sessions = (

        total_sessions
        -
        present_sessions
    )

    if absent_sessions < 0:

        absent_sessions = 0

    # --------------------------------------------------------
    # Overall attendance percentage
    # --------------------------------------------------------

    if total_sessions > 0:

        attendance_percentage = (

            present_sessions
            /
            total_sessions

        ) * 100

    else:

        attendance_percentage = 0.0

    # --------------------------------------------------------
    # Behavior events
    # --------------------------------------------------------

    try:

        from ..database.models import (
            BehaviorEvent
        )

        total_behavior_events = (

            db.query(BehaviorEvent)
            .filter(
                BehaviorEvent.student_id ==
                student_id
            )
            .count()
        )

    except (
        ImportError,
        AttributeError
    ):

        total_behavior_events = 0

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return StudentAnalyticsResponse(

        student_id=student.student_id,

        student_name=student.name,

        total_sessions=total_sessions,

        present_sessions=present_sessions,

        absent_sessions=absent_sessions,

        attendance_percentage=round(
            attendance_percentage,
            2
        ),

        total_behavior_events=
            total_behavior_events
    )


# ============================================================
# SESSION BEHAVIOR ANALYTICS
# ============================================================

@router.get(
    "/session/{session_id}/behavior",
    response_model=BehaviorAnalyticsResponse
)
def get_session_behavior_analytics(
    session_id: int,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check session
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # BehaviorEvent
    # --------------------------------------------------------

    try:

        from ..database.models import (
            BehaviorEvent
        )

    except ImportError:

        raise HTTPException(

            status_code=500,

            detail=
                "BehaviorEvent model is not available"
        )

    # --------------------------------------------------------
    # Get events
    # --------------------------------------------------------

    events = (

        db.query(BehaviorEvent)

        .filter(
            BehaviorEvent.session_id ==
            session_id
        )

        .all()
    )

    # --------------------------------------------------------
    # Number of unique students
    # --------------------------------------------------------

    unique_students = set()

    total_duration = 0.0

    for event in events:

        unique_students.add(
            event.student_id
        )

        if event.duration_seconds:

            total_duration += (
                event.duration_seconds
            )

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return BehaviorAnalyticsResponse(

        session_id=session_id,

        total_events=len(events),

        students_with_behavior=
            len(unique_students),

        total_behavior_duration_seconds=
            round(
                total_duration,
                2
            )
    )