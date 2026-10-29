from pydantic import BaseModel


class AttendanceCreate(BaseModel):

    session_id: int

    student_id: str

    presence_seconds: float


class AttendanceResponse(BaseModel):

    id: int

    session_id: int

    student_id: str

    presence_seconds: float

    presence_percentage: float

    status: str

    class Config:

        from_attributes = True