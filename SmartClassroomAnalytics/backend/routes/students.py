import logging
from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session
from pgvector.sqlalchemy import Vector

from ..database.database import get_db
from ..database.models import Student, TeacherStudent, ClassSession, Attendance
from ..schemas.student import (
    StudentCreate,
    StudentResponse,
    StudentEnrollRequest,
    StudentEnrollResponse,
    FaceDetectRequest,
    FaceDetectResponse
)
from ..services.face_service import face_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/students",
    tags=["Students"]
)


# ============================================================
# GET ALL STUDENTS
# ============================================================

@router.get(
    "/",
    response_model=list[StudentResponse]
)
def get_students(
    teacher_id: str | None = None,
    db: Session = Depends(get_db)
):
    """
    Returns all registered students with an indicator of whether
    their 512-d facial embedding is enrolled. If teacher_id is provided,
    filters to only students belonging to that teacher.
    """
    query = db.query(Student)

    if teacher_id:
        # Find students linked via TeacherStudent or Student.teacher_id or attended teacher's sessions
        assigned_ids = {
            ts.student_id for ts in db.query(TeacherStudent).filter(TeacherStudent.teacher_id == teacher_id).all()
        }
        session_ids = [
            s.id for s in db.query(ClassSession).filter(ClassSession.teacher_id == teacher_id).all()
        ]
        if session_ids:
            att_sids = {
                a.student_id for a in db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).all()
            }
            assigned_ids.update(att_sids)

        if assigned_ids:
            query = query.filter(
                (Student.teacher_id == teacher_id) | (Student.student_id.in_(assigned_ids))
            )
        else:
            query = query.filter(Student.teacher_id == teacher_id)

    students = (
        query
        .order_by(Student.name.asc())
        .all()
    )

    try:
        res = db.execute(text("SELECT student_id FROM face_embeddings")).fetchall()
        embedded_ids = {str(row[0]) for row in res}
    except Exception as err:
        logger.warning(f"Could not query face_embeddings table: {err}")
        embedded_ids = set()

    result = []
    for s in students:
        result.append(
            StudentResponse(
                id=s.id,
                student_id=s.student_id,
                name=s.name,
                email=s.email,
                teacher_id=s.teacher_id,
                has_embedding=str(s.student_id) in embedded_ids,
            )
        )

    return result


# ============================================================
# CREATE STUDENT (METADATA ONLY)
# ============================================================

@router.post(
    "/",
    response_model=StudentResponse
)
def create_student(
    student: StudentCreate,
    db: Session = Depends(get_db)
):
    student_id_clean = student.student_id.strip()
    name_clean = student.name.strip()

    if not student_id_clean or not name_clean:
        raise HTTPException(
            status_code=400,
            detail="Student ID and name cannot be empty."
        )

    # Check if student already exists
    existing_student = (
        db.query(Student)
        .filter(Student.student_id == student_id_clean)
        .first()
    )

    if existing_student:
        raise HTTPException(
            status_code=409,
            detail=f"Student ID '{student_id_clean}' is already registered ({existing_student.name})."
        )

    # Create new student
    new_student = Student(
        student_id=student_id_clean,
        name=name_clean,
        email=student.email.strip() if student.email else None,
        teacher_id=student.teacher_id.strip() if student.teacher_id else None
    )

    db.add(new_student)

    if student.teacher_id:
        db.add(TeacherStudent(
            teacher_id=student.teacher_id.strip(),
            student_id=student_id_clean
        ))

    db.commit()
    db.refresh(new_student)

    return StudentResponse(
        id=new_student.id,
        student_id=new_student.student_id,
        name=new_student.name,
        email=new_student.email,
        teacher_id=new_student.teacher_id,
        has_embedding=False,
    )


# ============================================================
# FACE DETECTION PRE-CHECK
# ============================================================

@router.post(
    "/detect-face",
    response_model=FaceDetectResponse
)
def detect_face_preview(
    request: FaceDetectRequest
):
    """
    Analyzes a browser webcam frame in real time to verify whether
    a single usable face is detected prior to enrollment submission.
    """
    try:
        detection = face_service.detect_face(request.image)
        return FaceDetectResponse(**detection)
    except ValueError as val_err:
        return FaceDetectResponse(
            face_detected=False,
            face_count=0,
            det_score=None,
            bbox=None,
            message=str(val_err)
        )
    except Exception as err:
        logger.error(f"Error in detect_face_preview: {err}")
        return FaceDetectResponse(
            face_detected=False,
            face_count=0,
            det_score=None,
            bbox=None,
            message=f"Detection error: {err}"
        )


# ============================================================
# ENROLL STUDENT WITH FACIAL BIOMETRICS
# ============================================================

@router.post(
    "/enroll",
    response_model=StudentEnrollResponse
)
def enroll_student(
    enroll_data: StudentEnrollRequest,
    db: Session = Depends(get_db)
):
    """
    Primary endpoint for browser-based student enrollment:
    1. Validates student credentials (ID & Name).
    2. Runs InsightFace face analysis to detect face and extract 512-d normalized embedding.
    3. Handles duplicate IDs safely (rejects or updates if overwrite=True).
    4. Transactionally updates both 'students' and 'face_embeddings' tables in PostgreSQL.
    """
    student_id = enroll_data.student_id.strip()
    name = enroll_data.name.strip()
    email = enroll_data.email.strip() if enroll_data.email else None

    if not student_id or not name:
        raise HTTPException(
            status_code=400,
            detail="Student ID and student name are required."
        )

    # 1. Check duplicate existence
    existing_student = (
        db.query(Student)
        .filter(Student.student_id == student_id)
        .first()
    )

    try:
        existing_emb = db.execute(
            text("SELECT student_name FROM face_embeddings WHERE student_id = :sid"),
            {"sid": student_id}
        ).first()
    except Exception:
        existing_emb = None

    if (existing_student or existing_emb) and not enroll_data.overwrite:
        existing_name = existing_student.name if existing_student else (existing_emb[0] if existing_emb else "Student")
        raise HTTPException(
            status_code=409,
            detail=(
                f"Student ID '{student_id}' is already enrolled ({existing_name}). "
                "Enable 'Overwrite existing biometric record' if you wish to re-enroll this student."
            )
        )

    # 2. Extract facial embeddings via InsightFace
    try:
        if enroll_data.images and len(enroll_data.images) > 1:
            embedding, samples_count = face_service.extract_multi_sample_embedding(enroll_data.images)
            det_score = 1.0
        elif enroll_data.image:
            embedding, meta = face_service.extract_embedding(enroll_data.image)
            samples_count = 1
            det_score = meta.get("det_score")
        else:
            raise ValueError("No face image data received. Please capture a camera photo.")
    except ValueError as val_err:
        raise HTTPException(
            status_code=400,
            detail=str(val_err)
        )
    except Exception as err:
        logger.error(f"InsightFace processing failure: {err}")
        raise HTTPException(
            status_code=500,
            detail=f"InsightFace biometrics processing failed: {err}"
        )

    # 3. Transactional PostgreSQL persistence
    try:
        # A. Upsert into students table
        if existing_student:
            existing_student.name = name
            if email is not None:
                existing_student.email = email
        else:
            new_student = Student(
                student_id=student_id,
                name=name,
                email=email
            )
            db.add(new_student)
        db.flush()

        # B. Upsert into face_embeddings table with Vector(512)
        upsert_query = text("""
            INSERT INTO face_embeddings
                (student_id, student_name, embedding, updated_at)
            VALUES
                (:student_id, :student_name, :embedding, NOW())
            ON CONFLICT (student_id)
            DO UPDATE SET
                student_name = EXCLUDED.student_name,
                embedding = EXCLUDED.embedding,
                updated_at = NOW()
        """).bindparams(
            bindparam("embedding", type_=Vector(512))
        )

        db.execute(upsert_query, {
            "student_id": student_id,
            "student_name": name,
            "embedding": embedding
        })

        db.commit()
    except Exception as db_err:
        db.rollback()
        logger.error(f"Database error during student enrollment: {db_err}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error while saving biometric records: {db_err}"
        )

    # 4. Synchronize in-memory face database if loaded
    try:
        from ai.recognition.face_database import FaceDatabase
        FaceDatabase().load()
    except Exception:
        pass

    logger.info(f"Student enrolled: {name} ({student_id}) with {samples_count} sample(s).")

    return StudentEnrollResponse(
        success=True,
        student_id=student_id,
        name=name,
        email=email,
        embedding_dimension=512,
        det_score=det_score,
        samples_processed=samples_count,
        has_embedding=True,
        message=f"Student {name} ({student_id}) enrolled successfully with 512-d facial embedding."
    )


# ============================================================
# GET STUDENT BY ID
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
        .filter(Student.student_id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    has_emb = False
    try:
        res = db.execute(
            text("SELECT 1 FROM face_embeddings WHERE student_id = :sid"),
            {"sid": student_id}
        ).first()
        has_emb = bool(res)
    except Exception:
        pass

    return StudentResponse(
        id=student.id,
        student_id=student.student_id,
        name=student.name,
        email=student.email,
        has_embedding=has_emb,
    )


# ============================================================
# GET STUDENT EMBEDDING STATUS
# ============================================================

@router.get(
    "/{student_id}/embedding-status"
)
def get_student_embedding_status(
    student_id: str,
    db: Session = Depends(get_db)
):
    try:
        row = db.execute(
            text("""
                SELECT student_id, student_name, updated_at,
                       vector_dims(embedding) as dim
                FROM face_embeddings
                WHERE student_id = :sid
            """),
            {"sid": student_id}
        ).first()

        if not row:
            return {
                "student_id": student_id,
                "has_embedding": False,
                "embedding_dimension": None,
                "updated_at": None
            }

        return {
            "student_id": row.student_id,
            "has_embedding": True,
            "student_name": row.student_name,
            "embedding_dimension": row.dim or 512,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None
        }
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check embedding status: {err}"
        )
