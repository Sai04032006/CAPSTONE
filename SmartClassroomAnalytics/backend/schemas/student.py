from pydantic import BaseModel


# ============================================================
# CREATE STUDENT REQUEST
# ============================================================

class StudentCreate(BaseModel):

    student_id: str

    name: str

    email: str | None = None


# ============================================================
# STUDENT RESPONSE
# ============================================================

class StudentResponse(BaseModel):

    id: int

    student_id: str

    name: str

    email: str | None

    class Config:

        from_attributes = True