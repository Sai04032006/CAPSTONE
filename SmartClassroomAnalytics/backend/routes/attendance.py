
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database.models import Attendance, ClassSession, Student
from ..schemas.attendance import AttendanceCreate, AttendanceResponse

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)


# ============================================================
# RECORD / UPDATE ATTENDANCE
# ============================================================

@router.post("/", response_model=AttendanceResponse)
def record_attendance(
    attendance_data: AttendanceCreate,
    db: Session = Depends(get_db)
):
    # Find session
    session = (
        db.query(ClassSession)
        .filter(ClassSession.id == attendance_data.session_id)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Class session {attendance_data.session_id} not found"
        )

    student_id = str(attendance_data.student_id).strip()

    # Find student in the main Student table
    student = (
        db.query(Student)
        .filter(Student.student_id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Student {student_id} not found in the Student table. "
                "Register this student in the main student records first. "
                "A face_embeddings entry alone is not sufficient."
            )
        )

    # Validate presence time
    if attendance_data.presence_seconds < 0:
        raise HTTPException(
            status_code=400,
            detail="Presence seconds cannot be negative"
        )

    # Class duration in seconds
    class_duration_seconds = session.duration_minutes * 60

    if class_duration_seconds <= 0:
        raise HTTPException(
            status_code=400,
            detail="Class session duration must be greater than zero"
        )

    # Cap presence at the class duration
    presence_seconds = min(
        float(attendance_data.presence_seconds),
        float(class_duration_seconds)
    )

    # Calculate attendance percentage
    presence_percentage = (
        presence_seconds / class_duration_seconds
    ) * 100

    # Determine attendance status
    threshold_percentage = session.attendance_threshold * 100

    status = (
        "PRESENT"
        if presence_percentage >= threshold_percentage
        else "ABSENT"
    )

    # Find existing attendance record
    existing_attendance = (
        db.query(Attendance)
        .filter(
            Attendance.session_id == attendance_data.session_id,
            Attendance.student_id == student_id
        )
        .first()
    )

    if existing_attendance:
        existing_attendance.presence_seconds = presence_seconds
        existing_attendance.presence_percentage = presence_percentage
        existing_attendance.status = status

        db.commit()
        db.refresh(existing_attendance)
        return existing_attendance

    # Create new attendance record
    new_attendance = Attendance(
        session_id=attendance_data.session_id,
        student_id=student_id,
        presence_seconds=presence_seconds,
        presence_percentage=presence_percentage,
        status=status
    )

    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)

    return new_attendance


# ============================================================
# GET SESSION ATTENDANCE
# ============================================================

@router.get(
    "/session/{session_id}",
    response_model=list[AttendanceResponse]
)
def get_session_attendance(
    session_id: int,
    db: Session = Depends(get_db)
):
    return (
        db.query(Attendance)
        .filter(Attendance.session_id == session_id)
        .all()
    )


# ============================================================
# GET STUDENT ATTENDANCE
# ============================================================

@router.get(
    "/student/{student_id}",
    response_model=list[AttendanceResponse]
)
def get_student_attendance(
    student_id: str,
    db: Session = Depends(get_db)
):
    return (
        db.query(Attendance)
        .filter(Attendance.student_id == student_id)
        .all()
    )
