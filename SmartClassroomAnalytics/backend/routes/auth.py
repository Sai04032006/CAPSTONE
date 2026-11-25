import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database.models import Teacher, Principal, Student, ClassSession, TeacherStudent
from ..schemas.auth import (
    TeacherRegisterRequest,
    TeacherLoginRequest,
    PrincipalRegisterRequest,
    PrincipalLoginRequest,
    TeacherResponse,
    AuthResponse
)
from ..services.auth_service import hash_password, verify_password, seed_default_users

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# ============================================================
# TEACHER REGISTRATION
# ============================================================

@router.post("/register/teacher", response_model=AuthResponse)
def register_teacher(
    data: TeacherRegisterRequest,
    db: Session = Depends(get_db)
):
    teacher_id = data.teacher_id.strip()
    # Check if teacher_id is exactly 4 digits
    if len(teacher_id) != 4 or not teacher_id.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Teacher ID must be exactly 4 digits (e.g. 1001, 2045)"
        )

    if len(data.password) <= 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be more than 6 characters"
        )

    # Check if already exists
    existing = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Teacher ID '{teacher_id}' is already registered."
        )

    new_teacher = Teacher(
        teacher_id=teacher_id,
        name=data.name.strip(),
        email=data.email.strip() if data.email else f"{teacher_id}@smartclassroom.edu",
        subject=data.subject.strip() if data.subject else "General",
        password_hash=hash_password(data.password)
    )
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)

    token = f"teacher_{teacher_id}_{secrets.token_hex(16)}"

    return AuthResponse(
        success=True,
        role="TEACHER",
        user_id=new_teacher.id,
        username=new_teacher.teacher_id,
        teacher_id=new_teacher.teacher_id,
        name=new_teacher.name,
        subject=new_teacher.subject,
        token=token,
        message="Teacher registered and logged in successfully"
    )


# ============================================================
# TEACHER LOGIN
# ============================================================

@router.post("/login/teacher", response_model=AuthResponse)
def login_teacher(
    data: TeacherLoginRequest,
    db: Session = Depends(get_db)
):
    teacher_id = data.teacher_id.strip()
    if len(teacher_id) != 4 or not teacher_id.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Teacher ID must be exactly 4 digits"
        )

    teacher = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=401,
            detail="Teacher ID not found. Please register first."
        )

    if not verify_password(data.password, teacher.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid password for teacher ID."
        )

    token = f"teacher_{teacher_id}_{secrets.token_hex(16)}"

    return AuthResponse(
        success=True,
        role="TEACHER",
        user_id=teacher.id,
        username=teacher.teacher_id,
        teacher_id=teacher.teacher_id,
        name=teacher.name,
        subject=teacher.subject,
        token=token,
        message=f"Welcome back, {teacher.name}!"
    )


# ============================================================
# PRINCIPAL REGISTRATION
# ============================================================

@router.post("/register/principal", response_model=AuthResponse)
def register_principal(
    data: PrincipalRegisterRequest,
    db: Session = Depends(get_db)
):
    username = data.username.strip().lower()
    if len(data.password) <= 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be more than 6 characters"
        )

    existing = db.query(Principal).filter(Principal.username == username).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Principal username '{username}' is already registered."
        )

    new_principal = Principal(
        username=username,
        name=data.name.strip() if data.name else "Principal",
        email=data.email.strip() if data.email else f"{username}@smartclassroom.edu",
        password_hash=hash_password(data.password)
    )
    db.add(new_principal)
    db.commit()
    db.refresh(new_principal)

    token = f"principal_{username}_{secrets.token_hex(16)}"

    return AuthResponse(
        success=True,
        role="PRINCIPAL",
        user_id=new_principal.id,
        username=new_principal.username,
        teacher_id=None,
        name=new_principal.name,
        subject="Administration",
        token=token,
        message="Principal registered successfully"
    )


# ============================================================
# PRINCIPAL LOGIN
# ============================================================

@router.post("/login/principal", response_model=AuthResponse)
def login_principal(
    data: PrincipalLoginRequest,
    db: Session = Depends(get_db)
):
    username = data.username.strip().lower()
    # Map common variations ("principle" or "principal")
    lookup_names = [username]
    if username in ["principle", "principal"]:
        lookup_names = ["principle", "principal"]

    principal = db.query(Principal).filter(Principal.username.in_(lookup_names)).first()
    if not principal:
        # If not yet seeded, seed default and retry
        seed_default_users(db)
        principal = db.query(Principal).filter(Principal.username.in_(lookup_names)).first()

    if not principal:
        raise HTTPException(
            status_code=401,
            detail="Principal account not found."
        )

    if not verify_password(data.password, principal.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials for principal login."
        )

    token = f"principal_{principal.username}_{secrets.token_hex(16)}"

    return AuthResponse(
        success=True,
        role="PRINCIPAL",
        user_id=principal.id,
        username=principal.username,
        teacher_id=None,
        name=principal.name,
        subject="Administration",
        token=token,
        message=f"Welcome, {principal.name}!"
    )


# ============================================================
# GET ALL TEACHERS (FOR PRINCIPAL DASHBOARD)
# ============================================================

@router.get("/teachers", response_model=list[dict])
def list_teachers(
    db: Session = Depends(get_db)
):
    # Ensure default seeding has occurred
    seed_default_users(db)
    teachers = db.query(Teacher).order_by(Teacher.teacher_id.asc()).all()

    result = []
    for t in teachers:
        # Calculate session count and students count
        session_count = db.query(ClassSession).filter(ClassSession.teacher_id == t.teacher_id).count()
        student_count = db.query(TeacherStudent).filter(TeacherStudent.teacher_id == t.teacher_id).count()

        result.append({
            "id": t.id,
            "teacher_id": t.teacher_id,
            "name": t.name,
            "email": t.email,
            "subject": t.subject,
            "sessions_count": session_count,
            "students_count": student_count,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })

    return result
