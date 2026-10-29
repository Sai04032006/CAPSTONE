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
    email: str | None = None
    has_embedding: bool = False

    class Config:
        from_attributes = True


# ============================================================
# STUDENT ENROLLMENT REQUEST
# ============================================================

class StudentEnrollRequest(BaseModel):
    student_id: str
    name: str
    email: str | None = None
    image: str | None = None  # Base64 data URL or raw base64
    images: list[str] | None = None  # Optional multi-sample images
    overwrite: bool = False


# ============================================================
# STUDENT ENROLLMENT RESPONSE
# ============================================================

class StudentEnrollResponse(BaseModel):
    success: bool
    student_id: str
    name: str
    email: str | None = None
    embedding_dimension: int = 512
    det_score: float | None = None
    samples_processed: int = 1
    has_embedding: bool = True
    message: str


# ============================================================
# FACE DETECTION PRE-CHECK
# ============================================================

class FaceDetectRequest(BaseModel):
    image: str


class FaceDetectResponse(BaseModel):
    face_detected: bool
    face_count: int
    det_score: float | None = None
    bbox: list[int] | None = None
    message: str
