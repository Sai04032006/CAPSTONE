from datetime import datetime

from pydantic import BaseModel


# ============================================================
# CREATE BEHAVIOR EVENT
# ============================================================

class BehaviorEventCreate(BaseModel):

    session_id: int

    student_id: str

    behavior: str

    start_time: datetime | None = None

    end_time: datetime | None = None

    duration_seconds: float = 0.0

    severity: str = "WARNING"

    status: str = "ACTIVE"


# ============================================================
# BEHAVIOR EVENT RESPONSE
# ============================================================

class BehaviorEventResponse(BaseModel):

    id: int

    session_id: int

    student_id: str

    behavior: str

    start_time: datetime

    end_time: datetime | None

    duration_seconds: float

    severity: str

    status: str

    created_at: datetime

    class Config:

        from_attributes = True