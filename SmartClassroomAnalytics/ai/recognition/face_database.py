import json
import sys
import numpy as np
from pathlib import Path

from sqlalchemy import text, bindparam
from pgvector.sqlalchemy import Vector

# Make the project root available when this file is run from the ai folder.
PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database.database import engine


EMBEDDING_DIMENSIONS = 512


class FaceDatabase:

    def __init__(self):
        self.database = self.load()

    def load(self):
        """Load student face embeddings from PostgreSQL."""

        query = text("""
            SELECT student_id, student_name, embedding
            FROM face_embeddings
            ORDER BY student_id
        """)

        with engine.connect() as connection:
            rows = connection.execute(query).fetchall()

        students = {}

        for row in rows:
            raw_embedding = row.embedding

            # PostgreSQL may return the vector as a string.
            if isinstance(raw_embedding, str):
                raw_embedding = json.loads(raw_embedding)

            embedding = np.asarray(
                raw_embedding,
                dtype=np.float32
            )

            if embedding.size != 512:
                raise ValueError(
                    f"Student {row.student_id} has "
                    f"{embedding.size} embedding values; expected 512."
                )

            students[str(row.student_id)] = {
                "name": row.student_name,
                "embedding": embedding.tolist()
            }

        self.database = students
        return students

    def save(self):
        """Save the current student records to PostgreSQL."""

        query = text("""
            INSERT INTO face_embeddings
                (student_id, student_name, embedding)
            VALUES
                (:student_id, :student_name, :embedding)
            ON CONFLICT (student_id)
            DO UPDATE SET
                student_name = EXCLUDED.student_name,
                embedding = EXCLUDED.embedding,
                updated_at = NOW()
        """).bindparams(
            bindparam(
                "embedding",
                type_=Vector(EMBEDDING_DIMENSIONS)
            )
        )

        records = []

        for student_id, data in self.database.items():
            embedding = data["embedding"]

            if hasattr(embedding, "tolist"):
                embedding = embedding.tolist()

            if len(embedding) != EMBEDDING_DIMENSIONS:
                raise ValueError(
                    f"Student {student_id} must have a "
                    f"{EMBEDDING_DIMENSIONS}-dimensional embedding."
                )

            records.append({
                "student_id": str(student_id),
                "student_name": data["name"],
                "embedding": embedding
            })

        with engine.begin() as connection:
            for record in records:
                connection.execute(query, record)

    def add_student(self, student_id, name, embedding):
        """Add or update a student's face embedding in PostgreSQL."""

        student_id = str(student_id)

        if hasattr(embedding, "tolist"):
            embedding = embedding.tolist()

        if len(embedding) != EMBEDDING_DIMENSIONS:
            raise ValueError(
                f"Expected {EMBEDDING_DIMENSIONS} embedding values, "
                f"but received {len(embedding)}."
            )

        self.database[student_id] = {
            "name": name,
            "embedding": embedding
        }

        self.save()

        print(
            f"Student {name} ({student_id}) "
            "saved successfully to PostgreSQL."
        )

    def get_students(self):
        """Return students in the format expected by recognition code."""

        return self.load()
