from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database.models import Student

from ..schemas.student import (
    StudentCreate,
    StudentResponse
)


router = APIRouter(
    prefix="/students",
    tags=["Students"]
)


# ============================================================
# CREATE STUDENT
# ============================================================

@router.post(
    "/",
    response_model=StudentResponse
)
def create_student(
    student: StudentCreate,
    db: Session = Depends(get_db)
):

    # Check if student already exists
    existing_student = (
        db.query(Student)
        .filter(
            Student.student_id
            == student.student_id
        )
        .first()
    )

    if existing_student:

        raise HTTPException(
            status_code=400,
            detail="Student already exists"
        )

    # Create new student
    new_student = Student(

        student_id=
            student.student_id,

        name=
            student.name,

        email=
            student.email
    )

    db.add(new_student)

    db.commit()

    db.refresh(new_student)

    return new_student


# ============================================================
# GET ALL STUDENTS
# ============================================================

@router.get(
    "/",
    response_model=list[StudentResponse]
)
def get_students(
    db: Session = Depends(get_db)
):

    students = (
        db.query(Student)
        .all()
    )

    return students


# ============================================================
# GET STUDENT BY STUDENT ID
# ============================================================

@router.get(
    "/{student_id}",
    response_model=StudentResponse
)
def get_student(
    student_id: str,
    db: Session = Depends(get_db)
):

    student = (
        db.query(Student)
        .filter(
            Student.student_id
            == student_id
        )
        .first()
    )

    if not student:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return student