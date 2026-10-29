import base64
import logging
import sys
import threading
from pathlib import Path
import cv2
import numpy as np

# Ensure ai directory and project root are in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
AI_DIR = PROJECT_ROOT / "ai"

for p in (PROJECT_ROOT, AI_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

EMBEDDING_DIMENSIONS = 512


class FaceService:
    """
    Singleton service managing the InsightFace face analysis model
    for biometric face detection, quality assessment, and 512-d embedding extraction.
    Reuses the existing InsightFace buffalo_l implementation.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self._recognizer = None
        self._init_lock = threading.Lock()
        self._initialized = True

    def _get_recognizer(self):
        """
        Lazily initializes the InsightFace recognizer on first request
        to ensure fast backend startup and thread safety.
        """
        if self._recognizer is None:
            with self._init_lock:
                if self._recognizer is None:
                    from recognition.face_recognizer import FaceRecognizer
                    logger.info("Initializing InsightFace FaceRecognizer model (buffalo_l)...")
                    self._recognizer = FaceRecognizer()
                    logger.info("InsightFace FaceRecognizer model ready.")
        return self._recognizer

    def decode_image_base64(self, image_data: str) -> np.ndarray:
        """
        Decodes a base64 string (with or without 'data:image/...;base64,' prefix)
        into an OpenCV BGR numpy array.
        """
        if not image_data or not isinstance(image_data, str):
            raise ValueError("Invalid image data provided.")

        # Strip data URL header if present
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as err:
            raise ValueError(f"Failed to decode base64 image data: {err}")

        if not image_bytes or len(image_bytes) < 100:
            raise ValueError("Image data is corrupted or too small.")

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            raise ValueError("Failed to decode image into valid pixel buffer.")

        return img

    def detect_face(self, image_data: str) -> dict:
        """
        Runs face detection on a captured preview frame and returns
        bounding box coordinates, detection confidence score, and face count.
        """
        img = self.decode_image_base64(image_data)
        recognizer = self._get_recognizer()
        faces = recognizer.detect_faces(img)

        face_count = len(faces)
        if face_count == 0:
            return {
                "face_detected": False,
                "face_count": 0,
                "det_score": None,
                "bbox": None,
                "message": "No face detected in the frame. Please look directly at the camera."
            }

        if face_count > 1:
            return {
                "face_detected": False,
                "face_count": face_count,
                "det_score": None,
                "bbox": None,
                "message": f"Multiple faces detected ({face_count}). Only one student must be in the frame."
            }

        face = faces[0]
        det_score = float(getattr(face, "det_score", 1.0))
        bbox = face.bbox.astype(int).tolist() if hasattr(face, "bbox") else None

        return {
            "face_detected": True,
            "face_count": 1,
            "det_score": round(det_score, 3),
            "bbox": bbox,
            "message": f"Face detected ({round(det_score * 100, 1)}% confidence)."
        }

    def extract_embedding(self, image_data: str) -> tuple[list[float], dict]:
        """
        Extracts and L2-normalizes the 512-d embedding for a single face image.
        Raises ValueError if 0 or multiple faces are found, or if embedding is invalid.
        """
        img = self.decode_image_base64(image_data)
        recognizer = self._get_recognizer()
        faces = recognizer.detect_faces(img)

        if len(faces) == 0:
            raise ValueError("No face detected. Please position your face clearly in front of the camera with good lighting.")

        if len(faces) > 1:
            raise ValueError(f"Multiple faces detected ({len(faces)}). Please ensure only one student is in the frame.")

        face = faces[0]
        raw_embedding = face.embedding
        if raw_embedding is None or len(raw_embedding) != EMBEDDING_DIMENSIONS:
            actual_dim = len(raw_embedding) if raw_embedding is not None else 0
            raise ValueError(f"Extracted embedding has invalid dimensions ({actual_dim}); expected {EMBEDDING_DIMENSIONS}.")

        # L2 Unit Normalization (required for cosine similarity in pgvector)
        norm = np.linalg.norm(raw_embedding)
        if norm == 0:
            raise ValueError("Extracted face embedding has zero norm.")
        normalized = raw_embedding / norm

        metadata = {
            "det_score": round(float(getattr(face, "det_score", 1.0)), 3),
            "bbox": face.bbox.astype(int).tolist() if hasattr(face, "bbox") else None
        }

        return normalized.tolist(), metadata

    def extract_multi_sample_embedding(self, images: list[str]) -> tuple[list[float], int]:
        """
        Processes multiple face image samples, extracts embeddings for each valid face,
        and computes the unit-normalized mean embedding vector for superior recognition accuracy.
        """
        valid_embeddings = []
        errors = []

        for idx, img_b64 in enumerate(images):
            try:
                emb, _ = self.extract_embedding(img_b64)
                valid_embeddings.append(np.array(emb, dtype=np.float32))
            except Exception as e:
                errors.append(f"Sample #{idx + 1}: {str(e)}")

        if not valid_embeddings:
            error_msg = "; ".join(errors) if errors else "No valid faces could be extracted from the samples."
            raise ValueError(f"Failed to extract face embeddings: {error_msg}")

        # Compute average vector and L2-normalize
        avg_vec = np.mean(valid_embeddings, axis=0)
        norm = np.linalg.norm(avg_vec)
        if norm == 0:
            raise ValueError("Aggregated embedding vector has zero magnitude.")
        normalized_avg = avg_vec / norm

        return normalized_avg.tolist(), len(valid_embeddings)


face_service = FaceService()
