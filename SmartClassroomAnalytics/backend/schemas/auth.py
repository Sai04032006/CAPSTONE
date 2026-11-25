from pydantic import BaseModel, Field, field_validator
import re


# ============================================================
# TEACHER SCHEMAS
# ============================================================

class TeacherRegisterRequest(BaseModel):
    teacher_id: str = Field(..., description="Teacher ID must be exactly 4 digits")
    name: str = Field(..., min_length=2, description="Teacher full name")
    email: str | None = None
    subject: str | None = Field(default="General", description="Subject or Department")
    password: str = Field(..., description="Password must be more than 6 characters")

    @field_validator("teacher_id")
    @classmethod
    def validate_teacher_id(cls, v: str) -> str:
        v_clean = v.strip()
        if not re.match(r"^\d{4}$", v_clean):
            raise ValueError("Teacher ID must be exactly 4 digits (e.g. 1001, 2045)")
        return v_clean

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) <= 6:
            raise ValueError("Password must be more than 6 characters long")
        return v


class TeacherLoginRequest(BaseModel):
    teacher_id: str = Field(..., description="4-digit Teacher ID")
    password: str = Field(..., min_length=1)

    @field_validator("teacher_id")
    @classmethod
    def validate_teacher_id(cls, v: str) -> str:
        v_clean = v.strip()
        if not re.match(r"^\d{4}$", v_clean):
            raise ValueError("Teacher ID must be exactly 4 digits")
        return v_clean


class TeacherResponse(BaseModel):
    id: int
    teacher_id: str
    name: str
    email: str | None = None
    subject: str | None = None

    class Config:
        from_attributes = True


# ============================================================
# PRINCIPAL SCHEMAS
# ============================================================

class PrincipalRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3)
    name: str = Field(default="Principal")
    email: str | None = None
    password: str = Field(..., description="Password must be more than 6 characters")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) <= 6:
            raise ValueError("Password must be more than 6 characters long")
        return v


class PrincipalLoginRequest(BaseModel):
    username: str
    password: str


# ============================================================
# UNIFIED LOGIN RESPONSE
# ============================================================

class AuthResponse(BaseModel):
    success: bool
    role: str  # "TEACHER" or "PRINCIPAL"
    user_id: int
    username: str
    teacher_id: str | None = None
    name: str
    subject: str | None = None
    token: str
    message: str
