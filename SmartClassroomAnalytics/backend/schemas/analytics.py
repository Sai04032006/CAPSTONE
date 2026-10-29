from pydantic import BaseModel


# ============================================================
# SESSION ANALYTICS
# ============================================================

class SessionAnalyticsResponse(BaseModel):

    session_id: int

    total_students: int

    present_students: int

    absent_students: int

    attendance_percentage: float

    total_behavior_events: int


# ============================================================
# STUDENT ANALYTICS
# ============================================================

class StudentAnalyticsResponse(BaseModel):

    student_id: str

    student_name: str

    total_sessions: int

    present_sessions: int

    absent_sessions: int

    attendance_percentage: float

    total_behavior_events: int


# ============================================================
# BEHAVIOR ANALYTICS
# ============================================================

class BehaviorAnalyticsResponse(BaseModel):

    session_id: int

    total_events: int

    students_with_behavior: int

    total_behavior_duration_seconds: float