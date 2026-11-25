from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey
)

from .database import Base


# ============================================================
# STUDENT
# ============================================================

class Student(Base):

    __tablename__ = "students"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    student_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        nullable=True
    )

    teacher_id = Column(
        String,
        nullable=True,
        index=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# CLASS SESSION
# ============================================================

class ClassSession(Base):

    __tablename__ = "class_sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    subject = Column(
        String,
        nullable=True
    )

    teacher_id = Column(
        String,
        nullable=True,
        index=True
    )

    teacher_name = Column(
        String,
        nullable=True
    )

    duration_minutes = Column(
        Integer,
        default=50
    )

    attendance_threshold = Column(
        Float,
        default=0.70
    )

    started_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    ended_at = Column(
        DateTime,
        nullable=True
    )

    status = Column(
        String,
        default="ACTIVE"
    )


# ============================================================
# TEACHER
# ============================================================

class Teacher(Base):

    __tablename__ = "teachers"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    teacher_id = Column(
        String(4),
        unique=True,
        nullable=False,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        nullable=True
    )

    subject = Column(
        String,
        nullable=True
    )

    password_hash = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# PRINCIPAL
# ============================================================

class Principal(Base):

    __tablename__ = "principals"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    username = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    name = Column(
        String,
        default="Principal"
    )

    email = Column(
        String,
        nullable=True
    )

    password_hash = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# TEACHER STUDENT MAPPING
# ============================================================

class TeacherStudent(Base):

    __tablename__ = "teacher_students"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    teacher_id = Column(
        String(4),
        nullable=False,
        index=True
    )

    student_id = Column(
        String,
        nullable=False,
        index=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# ATTENDANCE
# ============================================================

class Attendance(Base):

    __tablename__ = "attendance"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        Integer,
        ForeignKey(
            "class_sessions.id"
        ),
        nullable=False
    )

    student_id = Column(
        String,
        nullable=False
    )

    presence_seconds = Column(
        Float,
        default=0.0
    )

    presence_percentage = Column(
        Float,
        default=0.0
    )

    status = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # ============================================================
    # BEHAVIOR EVENT
    # ============================================================

# ============================================================
# BEHAVIOR EVENT
# ============================================================

class BehaviorEvent(Base):

    __tablename__ = "behavior_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        Integer,
        ForeignKey(
            "class_sessions.id"
        ),
        nullable=False
    )

    student_id = Column(
        String,
        nullable=False
    )

    behavior = Column(
        String,
        nullable=False
    )

    start_time = Column(
        DateTime,
        default=datetime.utcnow
    )

    end_time = Column(
        DateTime,
        nullable=True
    )

    duration_seconds = Column(
        Float,
        default=0.0
    )

    severity = Column(
        String,
        default="WARNING"
    )

    status = Column(
        String,
        default="ACTIVE"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )