from pydantic import BaseModel


class SessionCreate(BaseModel):

    subject: str | None = None

    duration_minutes: int = 50

    teacher_id: str | None = None

    teacher_name: str | None = None


class SessionResponse(BaseModel):

    id: int

    subject: str | None

    teacher_id: str | None = None

    teacher_name: str | None = None

    duration_minutes: int

    attendance_threshold: float

    started_at: object | None

    ended_at: object | None

    status: str

    class Config:

        from_attributes = True