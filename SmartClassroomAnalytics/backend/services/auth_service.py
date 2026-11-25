import hashlib
import os
import secrets
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from ..database.models import Teacher, Principal, Student, ClassSession, TeacherStudent

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with salt and iteration header."""
    salt = secrets.token_hex(16)
    iterations = 20_000
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations
    ).hex()
    return f"{salt}${iterations}${key}"


def verify_password(plain_password: str, hashed: str) -> bool:
    """Verify password against stored salt$iterations$key or legacy formats."""
    try:
        parts = hashed.split("$")
        if len(parts) == 3:
            salt, iterations_str, key = parts
            iterations = int(iterations_str)
        elif len(parts) == 2:
            salt, key = parts
            # Check with 20,000 first, then 100,000 fallback
            computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 20_000).hex()
            if secrets.compare_digest(computed, key):
                return True
            iterations = 100_000
        else:
            return plain_password == hashed

        computed = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations
        ).hex()
        return secrets.compare_digest(computed, key)
    except Exception as err:
        logger.error(f"Password verification error: {err}")
        return False


def seed_default_users(db: Session):
    """Seed default principal and sample teachers if not present."""
    try:
        # 1. Seed Principal: username 'principle', password 'principle'
        principal_entry = db.query(Principal).filter(
            Principal.username.in_(["principle", "principal"])
        ).first()

        if not principal_entry:
            default_principal = Principal(
                username="principle",
                name="Principal Office",
                email="principal@smartclassroom.edu",
                password_hash=hash_password("principle"),
                created_at=datetime.utcnow()
            )
            db.add(default_principal)
            db.commit()
            logger.info("Default principal user 'principle' seeded successfully.")

        # 2. Seed Sample Teacher 1001 if none exist
        teacher_count = db.query(Teacher).count()
        if teacher_count == 0:
            sample_teacher = Teacher(
                teacher_id="1001",
                name="Dr. Sarah Jenkins",
                email="sarah.jenkins@smartclassroom.edu",
                subject="Computer Vision & AI",
                password_hash=hash_password("teacher123"),
                created_at=datetime.utcnow()
            )
            db.add(sample_teacher)
            db.commit()

            sample_teacher2 = Teacher(
                teacher_id="1002",
                name="Prof. Alan Turing",
                email="alan.turing@smartclassroom.edu",
                subject="Data Structures & Algorithms",
                password_hash=hash_password("teacher123"),
                created_at=datetime.utcnow()
            )
            db.add(sample_teacher2)
            db.commit()

            # Assign existing students to teacher 1001
            students = db.query(Student).all()
            for s in students:
                db.add(TeacherStudent(teacher_id="1001", student_id=s.student_id))
            db.commit()

            logger.info("Sample teachers (1001, 1002) seeded successfully.")
    except Exception as err:
        logger.warning(f"Error seeding default users: {err}")
        db.rollback()
